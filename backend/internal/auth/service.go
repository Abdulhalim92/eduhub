package auth

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"
	"unicode"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Блокировка подбора пароля (BR-025).
const (
	lockAfter    = 5
	lockDuration = 15 * time.Minute
)

// Service реализует вход и смену пароля.
type Service struct {
	db         *gorm.DB
	repo       *Repository
	tokens     *TokenService
	audit      *audit.Recorder
	bcryptCost int
}

// NewService создаёт сервис auth.
func NewService(db *gorm.DB, repo *Repository, tokens *TokenService, rec *audit.Recorder, bcryptCost int) *Service {
	return &Service{db: db, repo: repo, tokens: tokens, audit: rec, bcryptCost: bcryptCost}
}

// HashPassword возвращает bcrypt-хеш (используется сидером и сменой пароля).
func (s *Service) HashPassword(raw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(raw), s.bcryptCost)
	if err != nil {
		return "", fmt.Errorf("auth: hash: %w", err)
	}
	return string(b), nil
}

// Login проверяет логин/пароль с учётом блокировки подбора и выдаёт токены.
func (s *Service) Login(ctx context.Context, req LoginRequest) (Session, error) {
	login := normalizeLogin(req.Login)
	u, err := s.authenticate(ctx, login, req.Password)
	if err != nil {
		return Session{}, err
	}
	return s.session(ctx, u)
}

// authenticate — общая проверка: блокировка → логин/пароль → активность.
// Одинаковое сообщение для «нет логина» и «неверный пароль», чтобы не раскрывать существование логина.
func (s *Service) authenticate(ctx context.Context, login, password string) (*User, error) {
	att, err := s.repo.Attempt(ctx, login)
	if err != nil {
		return nil, err
	}
	if att != nil && att.LockedUntil != nil && att.LockedUntil.After(time.Now()) {
		mins := int(math.Ceil(time.Until(*att.LockedUntil).Minutes()))
		return nil, apierr.New(apierr.CodeLocked, fmt.Sprintf("Слишком много неудачных попыток. Повторите через %d мин", mins))
	}

	u, err := s.repo.FindByLogin(ctx, login)
	if err != nil {
		return nil, err
	}
	ok := u != nil && bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) == nil
	if !ok {
		if err := s.registerFailure(ctx, login, att); err != nil {
			return nil, err
		}
		return nil, apierr.New(apierr.CodeUnauthorized, "Неверный логин или пароль")
	}

	if err := s.repo.ClearAttempt(ctx, login); err != nil {
		return nil, err
	}
	if !u.Active {
		return nil, apierr.New(apierr.CodeForbidden, "Доступ закрыт. Обратитесь к администратору центра")
	}
	return u, nil
}

func (s *Service) registerFailure(ctx context.Context, login string, att *LoginAttempt) error {
	if att == nil {
		att = &LoginAttempt{Login: login}
	}
	att.FailCount++
	if att.FailCount >= lockAfter {
		att.FailCount = 0
		until := time.Now().Add(lockDuration)
		att.LockedUntil = &until
	}
	return s.repo.SaveAttempt(ctx, att)
}

// ChangePassword меняет пароль после проверки текущего (POST /auth/password).
func (s *Service) ChangePassword(ctx context.Context, req ChangePasswordRequest) (Session, error) {
	login := normalizeLogin(req.Login)
	u, err := s.authenticate(ctx, login, req.Password)
	if err != nil {
		return Session{}, err
	}
	if err := validateNewPassword(req.NewPassword, req.Password); err != nil {
		return Session{}, err
	}
	hash, err := s.HashPassword(req.NewPassword)
	if err != nil {
		return Session{}, err
	}
	now := time.Now().UTC()
	u.PasswordHash = hash
	u.MustChangePassword = false
	u.PasswordChangedAt = &now
	if err := s.repo.SaveUser(ctx, u); err != nil {
		return Session{}, err
	}
	// Пароль в журнал не попадает (BR-025) — только факт смены.
	if err := s.audit.Log(ctx, s.db, audit.Event{
		Actor:      audit.Actor{Name: u.Name, Role: RoleLabel(u.Role), Device: "Страница входа"},
		Action:     "auth.password_changed",
		EntityType: "user",
		EntityID:   u.Login,
		EntityName: u.Name,
		Reason:     u.Name + " сменил пароль",
	}); err != nil {
		return Session{}, err
	}
	return s.session(ctx, u)
}

func (s *Service) session(ctx context.Context, u *User) (Session, error) {
	access, refresh, err := s.tokens.Issue(*u)
	if err != nil {
		return Session{}, err
	}
	sess := Session{
		Login:        u.Login,
		Role:         u.Role,
		RoleLabel:    RoleLabel(u.Role),
		Name:         u.Name,
		MustChange:   u.MustChangePassword,
		Cabinet:      cabinetRoles[u.Role],
		Token:        access,
		RefreshToken: refresh,
	}
	if u.TenantID != nil {
		name, err := s.repo.CenterName(ctx, *u.TenantID)
		if err != nil {
			return Session{}, err
		}
		sess.CenterID = u.TenantID
		sess.CenterName = &name
	}
	return sess, nil
}

func normalizeLogin(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

// validateNewPassword повторяет правило контракта: не короче 8, буква и цифра, не равен текущему.
func validateNewPassword(np, current string) error {
	var hasLetter, hasDigit bool
	for _, r := range np {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if len([]rune(np)) < 8 || !hasLetter || !hasDigit {
		return apierr.Field("Пароль слишком простой", "newPassword", "Не короче 8 символов, с буквой и цифрой")
	}
	if np == current {
		return apierr.Field("Новый пароль совпадает с текущим", "newPassword", "Придумайте другой пароль")
	}
	return nil
}
