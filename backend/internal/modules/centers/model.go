package centers

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// Center — учебный центр (арендатор платформы). Деньги в дирамах, время в UTC.
// Контракт отдаёт loginDays/expiresIn, но хранить лучше абсолютные
// lastLoginAt/expiresAt и считать «дней назад» (прим. в шапке api.js).
type Center struct {
	ID                  int64       `gorm:"column:id;primaryKey"`
	Name                string      `gorm:"column:name"`
	City                string      `gorm:"column:city"`
	Owner               string      `gorm:"column:owner"`
	Phone               string      `gorm:"column:phone"`
	PlanID              string      `gorm:"column:plan_id"`
	BalanceDiram        money.Diram `gorm:"column:balance_diram"`
	OverdraftLimitDiram money.Diram `gorm:"column:overdraft_limit_diram"`
	StaffUsed           int         `gorm:"column:staff_used"`
	StorageUsedGB       int         `gorm:"column:storage_used_gb"`
	BranchesUsed        int         `gorm:"column:branches_used"`
	LastLoginAt         *time.Time  `gorm:"column:last_login_at"`
	Lessons7d           int         `gorm:"column:lessons_7d"`
	Status              string      `gorm:"column:status"`
	ExpiresAt           *time.Time  `gorm:"column:expires_at"`
	ManagerID           *int64      `gorm:"column:manager_id"`
	Contacted           bool        `gorm:"column:contacted"`
	Reminded            bool        `gorm:"column:reminded"`
	CreatedAt           time.Time   `gorm:"column:created_at"`
	UpdatedAt           time.Time   `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Center) TableName() string { return "centers" }

// Manager — менеджер платформы, курирующий центры.
type Manager struct {
	ID     int64  `gorm:"column:id;primaryKey"`
	Name   string `gorm:"column:name"`
	Active bool   `gorm:"column:active"`
}

// TableName задаёт имя таблицы для GORM.
func (Manager) TableName() string { return "managers" }

// Row — центр вместе с полями тарифа и именем менеджера (результат join).
// Используется для расчёта centerDto без обращения к модулю plans.
type Row struct {
	ID                  int64       `gorm:"column:id"`
	Name                string      `gorm:"column:name"`
	City                string      `gorm:"column:city"`
	Owner               string      `gorm:"column:owner"`
	Phone               string      `gorm:"column:phone"`
	PlanID              string      `gorm:"column:plan_id"`
	PlanName            string      `gorm:"column:plan_name"`
	PlanPriceDiram      money.Diram `gorm:"column:plan_price_diram"`
	LimitStaff          int         `gorm:"column:limit_staff"`
	LimitStorageGB      int         `gorm:"column:limit_storage_gb"`
	LimitBranches       int         `gorm:"column:limit_branches"`
	BalanceDiram        money.Diram `gorm:"column:balance_diram"`
	OverdraftLimitDiram money.Diram `gorm:"column:overdraft_limit_diram"`
	StaffUsed           int         `gorm:"column:staff_used"`
	StorageUsedGB       int         `gorm:"column:storage_used_gb"`
	BranchesUsed        int         `gorm:"column:branches_used"`
	LastLoginAt         *time.Time  `gorm:"column:last_login_at"`
	Lessons7d           int         `gorm:"column:lessons_7d"`
	Status              string      `gorm:"column:status"`
	ExpiresAt           *time.Time  `gorm:"column:expires_at"`
	ManagerName         *string     `gorm:"column:manager_name"`
	Contacted           bool        `gorm:"column:contacted"`
	Reminded            bool        `gorm:"column:reminded"`
}
