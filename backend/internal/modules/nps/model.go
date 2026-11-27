// Package nps — оценка качества уроков (LRN-PRN-040): ежемесячный опрос и опрос после пробного занятия
// (1–5 звёзд) от ученика/родителя. Низкая оценка (1–3) помечается alert и пишет сигнал директору
// (CTR-ANL-010); реальная доставка уведомления — в модуле уведомлений (Q-NNN). Технологии как в проекте.
package nps

import "time"

// Виды опроса и порог тревожной оценки.
const (
	KindMonthly = "monthly"
	KindTrial   = "trial"

	alertThreshold = 3 // оценка ≤ 3 — тревожный сигнал
)

var kinds = map[string]bool{KindMonthly: true, KindTrial: true}

// Response — оценка качества (ответ на опрос).
type Response struct {
	ID             int64      `gorm:"column:id;primaryKey"`
	TenantID       int64      `gorm:"column:tenant_id"`
	StudentID      int64      `gorm:"column:student_id"`
	RaterAccountID *int64     `gorm:"column:rater_account_id"`
	Kind           string     `gorm:"column:kind"`
	Period         *time.Time `gorm:"column:period"`
	Stars          int        `gorm:"column:stars"`
	Comment        string     `gorm:"column:comment"`
	Alert          bool       `gorm:"column:alert"`
	CreatedAt      time.Time  `gorm:"column:created_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Response) TableName() string { return "nps_responses" }
