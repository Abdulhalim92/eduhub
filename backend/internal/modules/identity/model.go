// Package identity — единый аккаунт по телефону и членства центра (ТЗ v2.5, 30-auth-rbac): вход по
// SMS-коду (OTP), выбор членства и выпуск рабочего токена, профиль /me. Мобильный контур; веб-вход
// (auth.users) не затрагивается. Технологии как в проекте (GORM/PostgreSQL), контракт — по ТЗ.
package identity

import "time"

// Account — аккаунт человека, один на нормализованный номер телефона (E.164).
type Account struct {
	ID          int64     `gorm:"column:id;primaryKey"`
	Phone       string    `gorm:"column:phone"`
	DisplayName string    `gorm:"column:display_name"`
	Locale      string    `gorm:"column:locale"`
	Status      string    `gorm:"column:status"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Account) TableName() string { return "accounts" }

// Membership — роль аккаунта в центре (BR-035/BR-040).
type Membership struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	AccountID int64     `gorm:"column:account_id"`
	TenantID  int64     `gorm:"column:tenant_id"`
	Role      string    `gorm:"column:role"`
	Status    string    `gorm:"column:status"`
	BranchID  *int64    `gorm:"column:branch_id"`
	CreatedBy string    `gorm:"column:created_by"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Membership) TableName() string { return "memberships" }

// OtpCode — одноразовый код входа по SMS (хранится хэш).
type OtpCode struct {
	Phone       string    `gorm:"column:phone;primaryKey"`
	CodeHash    string    `gorm:"column:code_hash"`
	ExpiresAt   time.Time `gorm:"column:expires_at"`
	Attempts    int       `gorm:"column:attempts"`
	RequestedAt time.Time `gorm:"column:requested_at"`
}

// TableName задаёт имя таблицы для GORM.
func (OtpCode) TableName() string { return "otp_codes" }

// Статусы и роли мобильного контура.
const (
	AccountActive  = "active"
	AccountBlocked = "blocked"

	MembershipActive  = "active"
	MembershipRevoked = "revoked"

	RoleStudent = "student"
	RoleParent  = "parent"
)
