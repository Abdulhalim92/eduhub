package moderation

import "time"

// Статусы заявки на публикацию филиала (85-states.md, PLT-MOD-010).
const (
	StatusPending   = "pending"
	StatusPublished = "published"
	StatusReturned  = "returned"
	StatusRejected  = "rejected"
)

// Submission — заявка центра на публикацию филиала в каталоге.
// gps — точка, указанная центром; geo — точка геокодера.
type Submission struct {
	ID          int64      `gorm:"column:id;primaryKey"`
	CenterID    int64      `gorm:"column:center_id"`
	Branch      string     `gorm:"column:branch"`
	City        string     `gorm:"column:city"`
	District    string     `gorm:"column:district"`
	Address     string     `gorm:"column:address"`
	Phone       string     `gorm:"column:phone"`
	GPSLat      float64    `gorm:"column:gps_lat"`
	GPSLng      float64    `gorm:"column:gps_lng"`
	GeoLat      float64    `gorm:"column:geo_lat"`
	GeoLng      float64    `gorm:"column:geo_lng"`
	DescRU      string     `gorm:"column:desc_ru"`
	DescTJ      string     `gorm:"column:desc_tj"`
	DescEN      string     `gorm:"column:desc_en"`
	Status      string     `gorm:"column:status"`
	Reason      string     `gorm:"column:reason"`
	GPSOk       bool       `gorm:"column:gps_ok"`
	SubmittedAt time.Time  `gorm:"column:submitted_at"`
	SubmittedBy string     `gorm:"column:submitted_by"`
	DecidedAt   *time.Time `gorm:"column:decided_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Submission) TableName() string { return "branch_submissions" }
