package student

import (
	"encoding/json"
	"time"

	"github.com/line/eduhub-backend/internal/modules/journal"
	"github.com/line/eduhub-backend/pkg/money"
)

// GroupSummary — сводка группы ученика.
type GroupSummary struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Course      string `json:"course"`
	Branch      string `json:"branch"`
	Schedule    string `json:"schedule"`
	StartTime   string `json:"startTime"`
	DurationMin int    `json:"durationMin"`
	Teacher     string `json:"teacher"`
}

// ScheduleResponse — расписание ученика с краткой справкой о группе.
type ScheduleResponse struct {
	Group   *GroupSummary                 `json:"group"`
	Lessons journal.LessonsRangeResponse  `json:"lessons"`
}

// MaterialsResponse — программа курса группы (дерево модулей/уроков/материалов, без скачивания).
type MaterialsResponse struct {
	Course  string          `json:"course"`
	Program json.RawMessage `json:"program"`
}

// TestListItem — тест в списке ученика.
type TestListItem struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Questions   int        `json:"questions"`
	ScorePct    *int       `json:"scorePct,omitempty"`
	SubmittedAt *time.Time `json:"submittedAt,omitempty"`
}

// QuestionView — вопрос без правильного ответа (ученику его не показываем).
type QuestionView struct {
	Text    string   `json:"text"`
	Options []string `json:"options"`
}

// TestDetailResponse — тест для прохождения (без правильных ответов) и результат ученика.
type TestDetailResponse struct {
	ID          int64          `json:"id"`
	Title       string         `json:"title"`
	Questions   []QuestionView `json:"questions"`
	ScorePct    *int           `json:"scorePct,omitempty"`
	SubmittedAt *time.Time     `json:"submittedAt,omitempty"`
}

// AchievementDTO — запись истории достижений (начисление баллов).
type AchievementDTO struct {
	Amount int       `json:"amount"`
	Reason string    `json:"reason"`
	At     time.Time `json:"at"`
}

// PointsResponse — витрина баллов: баланс и история начислений.
type PointsResponse struct {
	Balance      int              `json:"balance"`
	Achievements []AchievementDTO `json:"achievements"`
}

// ReceiptDTO — электронный чек ученика.
type ReceiptDTO struct {
	ID         int64       `json:"id"`
	ReceiptNo  string      `json:"receiptNo"`
	Purpose    string      `json:"purpose"`
	Amount     money.Diram `json:"amount"`
	Discount   money.Diram `json:"discount"`
	Final      money.Diram `json:"final"`
	Method     string      `json:"method"`
	Lessons    int         `json:"lessons"`
	Status     string      `json:"status"`
	CreatedAt  time.Time   `json:"createdAt"`
	RefundedAt *time.Time  `json:"refundedAt,omitempty"`
}

// FinanceResponse — остаток оплаченных уроков, баллы и архив чеков ученика.
type FinanceResponse struct {
	Coin        int          `json:"coin"`
	LessonsPaid int          `json:"lessonsPaid"`
	Receipts    []ReceiptDTO `json:"receipts"`
}
