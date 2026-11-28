package cashier

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// Способы оплаты, статусы чека/смены и типы схем зарплаты (CTR-FIN/CTR-PAY).
const (
	MethodCash = "cash"
	MethodPOS  = "pos"
	MethodCard = "card"

	PayPaid     = "paid"
	PayRefunded = "refunded"

	ShiftOpen   = "open"
	ShiftClosed = "closed"

	SchemeFixed    = "fixed"
	SchemePerHead  = "perhead"
	SchemeRevShare = "revshare"
)

var payMethods = map[string]bool{MethodCash: true, MethodPOS: true, MethodCard: true}

// CashSettings — настройки кассы центра (курс баллов, потолок скидки).
type CashSettings struct {
	CenterID       int64     `gorm:"column:center_id;primaryKey"`
	CoinRate       int       `gorm:"column:coin_rate"`        // баллов за 1 сомони
	MaxDiscountPct int       `gorm:"column:max_discount_pct"` // потолок скидки, %
	CreatedAt      time.Time `gorm:"column:created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (CashSettings) TableName() string { return "cash_settings" }

// CashShift — кассовая смена.
type CashShift struct {
	ID          int64      `gorm:"column:id;primaryKey"`
	CenterID    int64      `gorm:"column:center_id"`
	CashierName string     `gorm:"column:cashier_name"`
	OpenedAt    time.Time  `gorm:"column:opened_at"`
	ClosedAt    *time.Time `gorm:"column:closed_at"`
	Status      string     `gorm:"column:status"`
}

// TableName задаёт имя таблицы для GORM.
func (CashShift) TableName() string { return "cash_shifts" }

// Payment — оплата/чек.
type Payment struct {
	ID            int64       `gorm:"column:id;primaryKey"`
	CenterID      int64       `gorm:"column:center_id"`
	StudentID     int64       `gorm:"column:student_id"`
	GroupID       *int64      `gorm:"column:group_id"`
	Purpose       string      `gorm:"column:purpose"`
	AmountDiram   money.Diram `gorm:"column:amount_diram"`
	DiscountCoin  int         `gorm:"column:discount_coin"`
	DiscountDiram money.Diram `gorm:"column:discount_diram"`
	FinalDiram    money.Diram `gorm:"column:final_diram"`
	Method        string      `gorm:"column:method"`
	Lessons       int         `gorm:"column:lessons"`
	ShiftID       *int64      `gorm:"column:shift_id"`
	Status        string      `gorm:"column:status"`
	RefundReason  string      `gorm:"column:refund_reason"`
	ReceiptNo     string      `gorm:"column:receipt_no"`
	CashierName   string      `gorm:"column:cashier_name"`
	RefundedAt    *time.Time  `gorm:"column:refunded_at"`
	CreatedAt     time.Time   `gorm:"column:created_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Payment) TableName() string { return "payments" }

// LessonBalance — оплаченные, не проведённые уроки на (ученик, группа).
type LessonBalance struct {
	StudentID int64     `gorm:"column:student_id;primaryKey"`
	GroupID   int64     `gorm:"column:group_id;primaryKey"`
	Paid      int       `gorm:"column:paid"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (LessonBalance) TableName() string { return "lesson_balances" }

// SalaryScheme — схема расчёта зарплаты преподавателя (CTR-PAY-010).
type SalaryScheme struct {
	ID               int64       `gorm:"column:id;primaryKey"`
	CenterID         int64       `gorm:"column:center_id"`
	TeacherID        int64       `gorm:"column:teacher_id"`
	GroupID          *int64      `gorm:"column:group_id"`
	Type             string      `gorm:"column:type"`
	RateDiram        money.Diram `gorm:"column:rate_diram"`
	Percent          int         `gorm:"column:percent"`
	LessonPriceDiram money.Diram `gorm:"column:lesson_price_diram"`
	CreatedAt        time.Time   `gorm:"column:created_at"`
	UpdatedAt        time.Time   `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (SalaryScheme) TableName() string { return "salary_schemes" }

// SalaryAccrual — начисление зарплаты за проведённое занятие.
type SalaryAccrual struct {
	ID          int64       `gorm:"column:id;primaryKey"`
	CenterID    int64       `gorm:"column:center_id"`
	TeacherID   int64       `gorm:"column:teacher_id"`
	LessonID    int64       `gorm:"column:lesson_id"`
	AmountDiram money.Diram `gorm:"column:amount_diram"`
	SchemeType  string      `gorm:"column:scheme_type"`
	Detail      string      `gorm:"column:detail"`
	At          time.Time   `gorm:"column:at"`
}

// TableName задаёт имя таблицы для GORM.
func (SalaryAccrual) TableName() string { return "salary_accruals" }
