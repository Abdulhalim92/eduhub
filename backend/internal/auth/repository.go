package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository — доступ к пользователям и журналу попыток входа.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий auth.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// FindByLogin возвращает пользователя по логину или (nil, nil), если не найден.
func (r *Repository) FindByLogin(ctx context.Context, login string) (*User, error) {
	var u User
	err := r.db.WithContext(ctx).First(&u, "login = ?", login).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("auth: find user: %w", err)
	}
	return &u, nil
}

// SaveUser сохраняет изменения пользователя.
func (r *Repository) SaveUser(ctx context.Context, u *User) error {
	if err := r.db.WithContext(ctx).Save(u).Error; err != nil {
		return fmt.Errorf("auth: save user: %w", err)
	}
	return nil
}

// Attempt возвращает журнал попыток входа по логину (nil, nil — записи нет).
func (r *Repository) Attempt(ctx context.Context, login string) (*LoginAttempt, error) {
	var a LoginAttempt
	err := r.db.WithContext(ctx).First(&a, "login = ?", login).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("auth: attempt: %w", err)
	}
	return &a, nil
}

// SaveAttempt вставляет или обновляет счётчик попыток (upsert по login).
func (r *Repository) SaveAttempt(ctx context.Context, a *LoginAttempt) error {
	a.UpdatedAt = time.Now().UTC()
	err := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "login"}},
		DoUpdates: clause.AssignmentColumns([]string{"fail_count", "locked_until", "updated_at"}),
	}).Create(a).Error
	if err != nil {
		return fmt.Errorf("auth: save attempt: %w", err)
	}
	return nil
}

// ClearAttempt удаляет счётчик попыток после успешного входа.
func (r *Repository) ClearAttempt(ctx context.Context, login string) error {
	if err := r.db.WithContext(ctx).Delete(&LoginAttempt{}, "login = ?", login).Error; err != nil {
		return fmt.Errorf("auth: clear attempt: %w", err)
	}
	return nil
}

// CenterName возвращает название центра по id (для сессии владельца центра).
func (r *Repository) CenterName(ctx context.Context, id int64) (string, error) {
	var name string
	err := r.db.WithContext(ctx).Table("centers").
		Select("name").Where("id = ?", id).Scan(&name).Error
	if err != nil {
		return "", fmt.Errorf("auth: center name: %w", err)
	}
	return name, nil
}
