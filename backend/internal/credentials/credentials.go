// Package credentials выдаёт данные для входа сотрудникам и ученикам (BR-025): уникальный логин,
// одноразовый пароль (bcrypt, в открытом виде не хранится), признак must_change. Логин освобождается
// при удалении. Веб-кабинет этими учётками не пользуется — они для мобильных приложений (вне скоупа).
package credentials

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/line/eduhub-backend/pkg/apierr"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var loginRe = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{3,31}$`)

const pwAlphabet = "abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

// Record — строка access_credentials.
type Record struct {
	ID           int64     `gorm:"column:id;primaryKey"`
	OwnerKind    string    `gorm:"column:owner_kind"`
	OwnerID      int64     `gorm:"column:owner_id"`
	Login        string    `gorm:"column:login"`
	PasswordHash string    `gorm:"column:password_hash"`
	MustChange   bool      `gorm:"column:must_change"`
	IssuedAt     time.Time `gorm:"column:issued_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Record) TableName() string { return "access_credentials" }

// Issued — результат выдачи (пароль показывается один раз).
type Issued struct {
	Login      string `json:"login"`
	Password   string `json:"password"`
	MustChange bool   `json:"mustChange"`
}

// Store работает с таблицей access_credentials.
type Store struct {
	bcryptCost int
}

// New создаёт Store.
func New(bcryptCost int) *Store { return &Store{bcryptCost: bcryptCost} }

// Normalize приводит логин к нижнему регистру без пробелов.
func Normalize(raw string) string { return strings.ToLower(strings.TrimSpace(raw)) }

// ValidateLogin проверяет формат логина (BR-025).
func ValidateLogin(raw string) (string, *apierr.Error) {
	login := Normalize(raw)
	if !loginRe.MatchString(login) {
		return "", apierr.Field("Проверьте логин", "login",
			"Логин — от 4 до 32 символов: латинские буквы, цифры, точка, дефис, подчёркивание")
	}
	return login, nil
}

// LoginTaken сообщает, занят ли логин в access_credentials или среди веб-пользователей (auth.users).
func (s *Store) LoginTaken(ctx context.Context, tx *gorm.DB, login string, exceptKind string, exceptID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Table("access_credentials").
		Where("login = ? AND NOT (owner_kind = ? AND owner_id = ?)", login, exceptKind, exceptID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("credentials: taken (ac): %w", err)
	}
	if n > 0 {
		return true, nil
	}
	err = tx.WithContext(ctx).Table("users").Where("login = ?", login).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("credentials: taken (users): %w", err)
	}
	return n > 0, nil
}

// Find возвращает учётку владельца (nil — доступа ещё нет).
func (s *Store) Find(ctx context.Context, tx *gorm.DB, kind string, id int64) (*Record, error) {
	var rec Record
	err := tx.WithContext(ctx).First(&rec, "owner_kind = ? AND owner_id = ?", kind, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("credentials: find: %w", err)
	}
	return &rec, nil
}

// Issue выдаёт (или перевыдаёт) учётку: генерирует пароль, пишет bcrypt-хеш, must_change=true.
// login должен быть уже проверен и свободен вызывающим (для нового) либо равен текущему (для сброса).
func (s *Store) Issue(ctx context.Context, tx *gorm.DB, kind string, id int64, login string) (Issued, error) {
	password, err := generatePassword(10)
	if err != nil {
		return Issued{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), s.bcryptCost)
	if err != nil {
		return Issued{}, fmt.Errorf("credentials: hash: %w", err)
	}
	rec := Record{OwnerKind: kind, OwnerID: id, Login: login, PasswordHash: string(hash), MustChange: true, IssuedAt: time.Now().UTC()}
	err = tx.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "owner_kind"}, {Name: "owner_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"login", "password_hash", "must_change", "issued_at"}),
	}).Create(&rec).Error
	if err != nil {
		return Issued{}, fmt.Errorf("credentials: issue: %w", err)
	}
	return Issued{Login: login, Password: password, MustChange: true}, nil
}

// Delete освобождает логин при увольнении/удалении владельца.
func (s *Store) Delete(ctx context.Context, tx *gorm.DB, kind string, id int64) error {
	err := tx.WithContext(ctx).Delete(&Record{}, "owner_kind = ? AND owner_id = ?", kind, id).Error
	if err != nil {
		return fmt.Errorf("credentials: delete: %w", err)
	}
	return nil
}

// HasAccessMap возвращает множество id владельцев заданного типа, у которых есть учётка.
func (s *Store) HasAccessMap(ctx context.Context, db *gorm.DB, kind string, ids []int64) (map[int64]bool, error) {
	out := map[int64]bool{}
	if len(ids) == 0 {
		return out, nil
	}
	var owners []int64
	err := db.WithContext(ctx).Table("access_credentials").
		Where("owner_kind = ? AND owner_id IN ?", kind, ids).Pluck("owner_id", &owners).Error
	if err != nil {
		return nil, fmt.Errorf("credentials: has access map: %w", err)
	}
	for _, id := range owners {
		out[id] = true
	}
	return out, nil
}

func generatePassword(n int) (string, error) {
	var b strings.Builder
	max := big.NewInt(int64(len(pwAlphabet)))
	for i := 0; i < n; i++ {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("credentials: rand: %w", err)
		}
		b.WriteByte(pwAlphabet[idx.Int64()])
	}
	return b.String(), nil
}
