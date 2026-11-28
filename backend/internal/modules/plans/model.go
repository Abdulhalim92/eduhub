package plans

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// Plan — тариф платформы с ценой, лимитами и набором модулей (Feature Flags).
type Plan struct {
	ID              string      `gorm:"column:id;primaryKey"`
	Name            string      `gorm:"column:name"`
	PriceDiram      money.Diram `gorm:"column:price_diram"`
	LimitStaff      int         `gorm:"column:limit_staff"`
	LimitStorageGB  int         `gorm:"column:limit_storage_gb"`
	LimitBranches   int         `gorm:"column:limit_branches"`
	ModulePayroll   bool        `gorm:"column:module_payroll"`
	ModuleInventory bool        `gorm:"column:module_inventory"`
	ModuleCRM       bool        `gorm:"column:module_crm"`
	ModuleGeo       bool        `gorm:"column:module_geo"`
	Active          bool        `gorm:"column:active"`
	CreatedAt       time.Time   `gorm:"column:created_at"`
	UpdatedAt       time.Time   `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Plan) TableName() string { return "plans" }

// CenterUsage — использование лимитов одним активным центром на тарифе.
// Нужен для проверки «лимит не ниже текущего использования» (PLT-TRF-010).
type CenterUsage struct {
	Name          string `gorm:"column:name"`
	StaffUsed     int    `gorm:"column:staff_used"`
	StorageUsedGB int    `gorm:"column:storage_used_gb"`
	BranchesUsed  int    `gorm:"column:branches_used"`
}
