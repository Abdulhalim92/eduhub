package auth

import "time"

// User — принципал платформы: логин, хеш пароля (bcrypt), роль и tenant.
// Пароль в открытом виде не хранится (BR-025).
type User struct {
	ID                 int64      `gorm:"column:id;primaryKey"`
	Login              string     `gorm:"column:login"`
	PasswordHash       string     `gorm:"column:password_hash"`
	Role               string     `gorm:"column:role"`
	Name               string     `gorm:"column:name"`
	TenantID           *int64     `gorm:"column:tenant_id"`
	MustChangePassword bool       `gorm:"column:must_change_password"`
	Active             bool       `gorm:"column:active"`
	PasswordChangedAt  *time.Time `gorm:"column:password_changed_at"`
	CreatedAt          time.Time  `gorm:"column:created_at"`
	UpdatedAt          time.Time  `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (User) TableName() string { return "users" }

// LoginAttempt — счётчик неудачных попыток и блокировка подбора (BR-025).
type LoginAttempt struct {
	Login       string     `gorm:"column:login;primaryKey"`
	FailCount   int        `gorm:"column:fail_count"`
	LockedUntil *time.Time `gorm:"column:locked_until"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (LoginAttempt) TableName() string { return "login_attempts" }

// Роли платформы и мобильного контура (роли центра задаются членством, ТЗ v2.5).
const (
	RoleSuperAdmin  = "superadmin"
	RoleCenterAdmin = "center_admin"
	RoleStudent     = "student"
	RoleParent      = "parent"
)

// roleLabels — человекочитаемые названия ролей для интерфейса.
var roleLabels = map[string]string{
	RoleSuperAdmin:  "SuperAdmin",
	RoleCenterAdmin: "Владелец центра",
	"cashier":       "Кассир",
	"teacher":       "Преподаватель",
	"student":       "Студент",
	"parent":        "Родитель",
}

// cabinetRoles — роли с веб-кабинетом (eduhub.html).
var cabinetRoles = map[string]bool{RoleCenterAdmin: true}

// RoleLabel возвращает подпись роли.
func RoleLabel(role string) string {
	if l, ok := roleLabels[role]; ok {
		return l
	}
	return role
}
