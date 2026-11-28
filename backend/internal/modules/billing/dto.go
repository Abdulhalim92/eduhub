package billing

import (
	"math"
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// CenterBrief — краткая карточка центра для карточки счёта (center{} в invoiceDto).
type CenterBrief struct {
	ID                  int64       `json:"id" gorm:"column:id"`
	Name                string      `json:"name" gorm:"column:name"`
	City                string      `json:"city" gorm:"column:city"`
	Owner               string      `json:"owner" gorm:"column:owner"`
	Phone               string      `json:"phone" gorm:"column:phone"`
	Plan                string      `json:"plan" gorm:"column:plan"`
	BalanceDiram        money.Diram `json:"-" gorm:"column:balance_diram"`
	OverdraftLimitDiram money.Diram `json:"-" gorm:"column:overdraft_limit_diram"`
	Status              string      `json:"-" gorm:"column:status"`
}

// PlanRef — к какому тарифу ведёт счёт смены тарифа.
type PlanRef struct {
	FromName string `json:"fromName"`
	ToID     string `json:"toId"`
	ToName   string `json:"toName"`
}

// EventDTO — событие истории счёта.
type EventDTO struct {
	At        time.Time `json:"at"`
	Type      string    `json:"type"`
	ActorName string    `json:"actorName"`
	ActorRole string    `json:"actorRole"`
	Text      string    `json:"text"`
}

// FromBalance — хватает ли баланса для оплаты открытого счёта.
type FromBalance struct {
	Balance        money.Diram `json:"balance"`
	OverdraftLimit money.Diram `json:"overdraftLimit"`
	Available      money.Diram `json:"available"`
	After          money.Diram `json:"after"`
	UsesOverdraft  bool        `json:"usesOverdraft"`
	Possible       bool        `json:"possible"`
}

// InvoiceDTO — счёт для ответа (invoiceDto из контракта). Деньги — целые сомони.
type InvoiceDTO struct {
	ID          string      `json:"id"`
	CenterID    int64       `json:"centerId"`
	CenterName  string      `json:"centerName"`
	Center      CenterBrief `json:"center"`
	Kind        string      `json:"kind"`
	Purpose     string      `json:"purpose"`
	Amount      money.Diram `json:"amount"`
	Status      string      `json:"status"`
	IssuedAt    time.Time   `json:"issuedAt"`
	DueAt       *time.Time  `json:"dueAt"`
	PaidAt      *time.Time  `json:"paidAt"`
	PaidVia     *string     `json:"paidVia"`
	Method      *string     `json:"method"`
	Channel     *string     `json:"channel"`
	Reference   string      `json:"reference"`
	Reason      string      `json:"reason"`
	RemindedAt  *time.Time  `json:"remindedAt"`
	Deferred    bool        `json:"deferred"`
	Plan        *PlanRef    `json:"plan"`
	Payment     *Payment    `json:"payment"`
	Events      []EventDTO  `json:"events,omitempty"`
	Overdue     bool        `json:"overdue"`
	DaysLeft    *int        `json:"daysLeft"`
	DaysOverdue int         `json:"daysOverdue"`
	PayLink     *string     `json:"payLink"`
	FromBalance *FromBalance `json:"fromBalance"`
}

func daysUntil(t time.Time) int {
	return int(math.Ceil(time.Until(t).Hours() / 24))
}

func toInvoiceDTO(inv Invoice, center CenterBrief, events []Event) InvoiceDTO {
	dto := InvoiceDTO{
		ID: inv.ID, CenterID: inv.CenterID, CenterName: center.Name, Center: center,
		Kind: inv.Kind, Purpose: inv.Purpose, Amount: inv.AmountDiram, Status: inv.Status,
		IssuedAt: inv.IssuedAt, DueAt: inv.DueAt, PaidAt: inv.PaidAt, PaidVia: inv.PaidVia,
		Method: inv.Method, Channel: inv.Channel, Reference: inv.Reference, Reason: inv.Reason,
		RemindedAt: inv.RemindedAt, Deferred: inv.Deferred, Payment: inv.Payment,
	}
	if inv.Kind == KindPlanChange && inv.PlanToID != nil {
		dto.Plan = &PlanRef{FromName: deref(inv.PlanFromName), ToID: *inv.PlanToID, ToName: deref(inv.PlanToName)}
	}

	now := time.Now()
	if inv.DueAt != nil {
		left := daysUntil(*inv.DueAt)
		dto.DaysLeft = &left
		if inv.Status == StatusPending && inv.DueAt.Before(now) {
			dto.Overdue = true
			dto.DaysOverdue = -left
		}
	}
	if inv.Status == StatusPending {
		link := "https://pay.liniya.tj/" + inv.ID
		dto.PayLink = &link
		after := center.BalanceDiram - inv.AmountDiram
		dto.FromBalance = &FromBalance{
			Balance:        center.BalanceDiram,
			OverdraftLimit: center.OverdraftLimitDiram,
			Available:      center.BalanceDiram + center.OverdraftLimitDiram,
			After:          after,
			UsesOverdraft:  after < 0,
			Possible:       center.Status == "active" && center.BalanceDiram+center.OverdraftLimitDiram >= inv.AmountDiram,
		}
	}
	for _, e := range events {
		dto.Events = append(dto.Events, EventDTO{At: e.At, Type: e.Type, ActorName: e.ActorName, ActorRole: e.ActorRole, Text: e.Text})
	}
	return dto
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
