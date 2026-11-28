package billing

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// Виды и статусы счёта (85-states.md, PLT-BIL-020).
const (
	KindRenewal    = "renewal"
	KindPlanChange = "plan_change"
	KindCourse     = "course"
	KindTrial      = "trial"

	StatusPending   = "pending"
	StatusPaid      = "paid"
	StatusCancelled = "cancelled"
	StatusTrial     = "trial"
)

// ActorRef — кто подтвердил оплату (в платёжных данных счёта).
type ActorRef struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

// Payment — платёжные данные счёта. Без номеров карт/токенов: только маска и tx id (money.md).
type Payment struct {
	Channel        string   `json:"channel"`
	Method         string   `json:"method"`
	Reference      string   `json:"reference"`
	ReceivedAmount int64    `json:"receivedAmount"` // сомони
	ReceivedOn     string   `json:"receivedOn"`
	Comment        string   `json:"comment"`
	Via            string   `json:"via"` // manual | balance | online
	TxID           *string  `json:"txId"`
	CardMask       *string  `json:"cardMask"`
	ConfirmedBy    ActorRef `json:"confirmedBy"`
}

// Invoice — счёт (B2B-биллинг). Деньги в дирамах.
type Invoice struct {
	ID          string      `gorm:"column:id;primaryKey"`
	CenterID    int64       `gorm:"column:center_id"`
	Kind        string      `gorm:"column:kind"`
	Purpose     string      `gorm:"column:purpose"`
	AmountDiram money.Diram `gorm:"column:amount_diram"`
	Status      string      `gorm:"column:status"`
	IssuedAt    time.Time   `gorm:"column:issued_at"`
	DueAt       *time.Time  `gorm:"column:due_at"`
	PaidAt      *time.Time  `gorm:"column:paid_at"`
	PaidVia     *string     `gorm:"column:paid_via"`
	Method      *string     `gorm:"column:method"`
	Channel     *string     `gorm:"column:channel"`
	Reference   string      `gorm:"column:reference"`
	Reason      string      `gorm:"column:reason"`
	RemindedAt  *time.Time  `gorm:"column:reminded_at"`

	PlanFromID        *string    `gorm:"column:plan_from_id"`
	PlanFromName      *string    `gorm:"column:plan_from_name"`
	PlanToID          *string    `gorm:"column:plan_to_id"`
	PlanToName        *string    `gorm:"column:plan_to_name"`
	PlanFromExpiresAt *time.Time `gorm:"column:plan_from_expires_at"`
	Deferred          bool       `gorm:"column:deferred"`
	CourseID          *int64     `gorm:"column:course_id"`

	Payment   *Payment  `gorm:"column:payment;type:jsonb;serializer:json"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Invoice) TableName() string { return "invoices" }

// Event — событие в истории счёта (PLT-BIL-010).
type Event struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	InvoiceID string    `gorm:"column:invoice_id"`
	At        time.Time `gorm:"column:at"`
	Type      string    `gorm:"column:type"`
	ActorName string    `gorm:"column:actor_name"`
	ActorRole string    `gorm:"column:actor_role"`
	Text      string    `gorm:"column:text"`
}

// TableName задаёт имя таблицы для GORM.
func (Event) TableName() string { return "invoice_events" }
