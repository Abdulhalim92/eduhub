package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/line/eduhub-backend/pkg/apierr"
)

// Claims — полезная нагрузка JWT: id, логин, роль, имя и tenant.
// Мобильный контур (ТЗ v2.5): AccountID — аккаунт по телефону; роль задаётся членством (Role+TenantID).
// Токен выбора членства несёт только AccountID (Role пустая). StudentID — для роли student.
type Claims struct {
	UID       int64  `json:"uid"`
	Login     string `json:"login"`
	Role      string `json:"role"`
	Name      string `json:"name"`
	TenantID  *int64 `json:"tenant_id,omitempty"`
	AccountID *int64 `json:"acc,omitempty"`
	StudentID *int64 `json:"sid,omitempty"`
	jwt.RegisteredClaims
}

// TokenService выпускает и проверяет JWT (HS256).
type TokenService struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewTokenService создаёт сервис токенов.
func NewTokenService(secret string, accessTTL, refreshTTL time.Duration) *TokenService {
	return &TokenService{secret: []byte(secret), accessTTL: accessTTL, refreshTTL: refreshTTL}
}

// Issue выпускает пару access/refresh токенов для пользователя.
func (t *TokenService) Issue(u User) (access, refresh string, err error) {
	access, err = t.sign(u, t.accessTTL, "access")
	if err != nil {
		return "", "", err
	}
	refresh, err = t.sign(u, t.refreshTTL, "refresh")
	if err != nil {
		return "", "", err
	}
	return access, refresh, nil
}

func (t *TokenService) sign(u User, ttl time.Duration, kind string) (string, error) {
	return t.signClaims(Claims{UID: u.ID, Login: u.Login, Role: u.Role, Name: u.Name, TenantID: u.TenantID}, ttl, kind)
}

// Membership — выбранное членство для выпуска рабочего токена мобильного контура.
type Membership struct {
	AccountID int64
	TenantID  int64
	Role      string
	Name      string
	Phone     string
	StudentID *int64 // для роли student
}

// IssueMembership выпускает пару токенов для выбранного членства (ТЗ: роль из membership в токене).
func (t *TokenService) IssueMembership(m Membership) (access, refresh string, err error) {
	tenant := m.TenantID
	base := Claims{
		UID: m.AccountID, Login: m.Phone, Role: m.Role, Name: m.Name,
		TenantID: &tenant, AccountID: &m.AccountID, StudentID: m.StudentID,
	}
	access, err = t.signClaims(base, t.accessTTL, "access")
	if err != nil {
		return "", "", err
	}
	refresh, err = t.signClaims(base, t.refreshTTL, "refresh")
	if err != nil {
		return "", "", err
	}
	return access, refresh, nil
}

// IssueAccountSelect выпускает короткий access-токен выбора членства (несёт аккаунт, без роли/центра).
func (t *TokenService) IssueAccountSelect(accountID int64, phone, name string) (string, error) {
	base := Claims{UID: accountID, Login: phone, Name: name, AccountID: &accountID}
	return t.signClaims(base, t.accessTTL, "select")
}

func (t *TokenService) signClaims(base Claims, ttl time.Duration, kind string) (string, error) {
	now := time.Now()
	base.RegisteredClaims = jwt.RegisteredClaims{
		Subject:   base.Login,
		ID:        kind,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, base)
	signed, err := token.SignedString(t.secret)
	if err != nil {
		return "", fmt.Errorf("auth: sign token: %w", err)
	}
	return signed, nil
}

// Verify разбирает и проверяет access-токен, возвращая его claims.
func (t *TokenService) Verify(tokenString string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("неожиданный метод подписи: %v", token.Header["alg"])
		}
		return t.secret, nil
	})
	if err != nil {
		return nil, apierr.New(apierr.CodeUnauthorized, "Недействительный токен")
	}
	return claims, nil
}
