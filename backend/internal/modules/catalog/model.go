// Package catalog — единый публичный каталог филиалов на карте (LRN-CAT-010) и заявки на пробный
// урок (CTR-CRM-010). Публикуются только прошедшие модерацию филиалы активных центров (BR-017).
// Заявка создаётся без аккаунта; центр ведёт её статус. Технологии как в проекте (GORM/PostgreSQL).
package catalog

import "time"

// Статусы лида (воронка пробного урока).
const (
	LeadNew       = "new"
	LeadContacted = "contacted"
	LeadTrial     = "trial"
	LeadEnrolled  = "enrolled"
	LeadLost      = "lost"
)

// Lead — заявка на пробный урок из каталога.
type Lead struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	TenantID  int64     `gorm:"column:tenant_id"`
	GroupID   *int64    `gorm:"column:group_id"`
	Name      string    `gorm:"column:name"`
	Phone     string    `gorm:"column:phone"`
	Source    string    `gorm:"column:source"`
	Note      string    `gorm:"column:note"`
	Status    string    `gorm:"column:status"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Lead) TableName() string { return "catalog_leads" }
