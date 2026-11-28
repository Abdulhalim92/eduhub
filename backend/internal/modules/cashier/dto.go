package cashier

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// SettingsDTO — настройки кассы центра.
type SettingsDTO struct {
	CoinRate       int `json:"coinRate"`
	MaxDiscountPct int `json:"maxDiscountPct"`
}

func settingsToDTO(s *CashSettings) SettingsDTO {
	return SettingsDTO{CoinRate: s.CoinRate, MaxDiscountPct: s.MaxDiscountPct}
}

// PaymentDTO — чек/оплата.
type PaymentDTO struct {
	ID           int64       `json:"id"`
	ReceiptNo    string      `json:"receiptNo"`
	StudentID    int64       `json:"studentId"`
	GroupID      *int64      `json:"groupId,omitempty"`
	Purpose      string      `json:"purpose"`
	Amount       money.Diram `json:"amount"`
	DiscountCoin int         `json:"discountCoin"`
	Discount     money.Diram `json:"discount"`
	Final        money.Diram `json:"final"`
	Method       string      `json:"method"`
	Lessons      int         `json:"lessons"`
	ShiftID      *int64      `json:"shiftId,omitempty"`
	Status       string      `json:"status"`
	RefundReason string      `json:"refundReason,omitempty"`
	CashierName  string      `json:"cashierName"`
	CreatedAt    time.Time   `json:"createdAt"`
	RefundedAt   *time.Time  `json:"refundedAt,omitempty"`
}

func paymentToDTO(p *Payment) PaymentDTO {
	return PaymentDTO{
		ID: p.ID, ReceiptNo: p.ReceiptNo, StudentID: p.StudentID, GroupID: p.GroupID, Purpose: p.Purpose,
		Amount: p.AmountDiram, DiscountCoin: p.DiscountCoin, Discount: p.DiscountDiram, Final: p.FinalDiram,
		Method: p.Method, Lessons: p.Lessons, ShiftID: p.ShiftID, Status: p.Status, RefundReason: p.RefundReason,
		CashierName: p.CashierName, CreatedAt: p.CreatedAt, RefundedAt: p.RefundedAt,
	}
}

// ShiftDTO — кассовая смена.
type ShiftDTO struct {
	ID          int64      `json:"id"`
	CenterID    int64      `json:"centerId"`
	CashierName string     `json:"cashierName"`
	OpenedAt    time.Time  `json:"openedAt"`
	ClosedAt    *time.Time `json:"closedAt,omitempty"`
	Status      string     `json:"status"`
}

func shiftToDTO(s *CashShift) ShiftDTO {
	return ShiftDTO{
		ID: s.ID, CenterID: s.CenterID, CashierName: s.CashierName,
		OpenedAt: s.OpenedAt, ClosedAt: s.ClosedAt, Status: s.Status,
	}
}

// ZReport — Z-отчёт смены: разбивка выручки по способам, возвраты, итог.
type ZReport struct {
	Shift    ShiftDTO    `json:"shift"`
	Cash     money.Diram `json:"cash"`
	POS      money.Diram `json:"pos"`
	Card     money.Diram `json:"card"`
	Gross    money.Diram `json:"gross"`
	Refunds  money.Diram `json:"refunds"`
	Net      money.Diram `json:"net"`
	Payments int         `json:"payments"`
	Refunded int         `json:"refunded"`
}

// SchemeDTO — схема расчёта зарплаты преподавателя.
type SchemeDTO struct {
	ID          int64       `json:"id"`
	TeacherID   int64       `json:"teacherId"`
	GroupID     *int64      `json:"groupId,omitempty"`
	Type        string      `json:"type"`
	Rate        money.Diram `json:"rate"`
	Percent     int         `json:"percent"`
	LessonPrice money.Diram `json:"lessonPrice"`
}

func schemeToDTO(s *SalaryScheme) SchemeDTO {
	return SchemeDTO{
		ID: s.ID, TeacherID: s.TeacherID, GroupID: s.GroupID, Type: s.Type,
		Rate: s.RateDiram, Percent: s.Percent, LessonPrice: s.LessonPriceDiram,
	}
}

// AccrualDTO — начисление зарплаты за занятие.
type AccrualDTO struct {
	ID         int64       `json:"id"`
	TeacherID  int64       `json:"teacherId"`
	LessonID   int64       `json:"lessonId"`
	Amount     money.Diram `json:"amount"`
	SchemeType string      `json:"schemeType"`
	Detail     string      `json:"detail"`
	At         time.Time   `json:"at"`
}

func accrualToDTO(a *SalaryAccrual) AccrualDTO {
	return AccrualDTO{
		ID: a.ID, TeacherID: a.TeacherID, LessonID: a.LessonID, Amount: a.AmountDiram,
		SchemeType: a.SchemeType, Detail: a.Detail, At: a.At,
	}
}
