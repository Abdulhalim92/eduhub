// Package student — кабинет ученика (LRN-PRN-030, role=student): расписание, материалы, тесты (без
// правильных ответов), баллы и достижения, остаток оплаченных уроков и электронные чеки. Ученик видит
// только себя (studentId/tenantId из токена). Расписание и оценивание тестов переиспользуются из journal.
package student

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Repository — чтение данных ученика из существующих таблиц (сырой SQL, без мутаций денег/баллов).
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий кабинета ученика.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// StudentContext — срез ученика для кабинета.
type StudentContext struct {
	Name    string `gorm:"column:name"`
	Status  string `gorm:"column:status"`
	GroupID *int64 `gorm:"column:group_id"`
	Coin    int    `gorm:"column:coin"`
}

// Student возвращает ученика центра (ok=false — нет).
func (r *Repository) Student(ctx context.Context, studentID, tenantID int64) (*StudentContext, bool, error) {
	var s StudentContext
	res := r.db.WithContext(ctx).Table("students").Select("name, status, group_id, coin").
		Where("id = ? AND center_id = ?", studentID, tenantID).Scan(&s)
	if res.Error != nil {
		return nil, false, fmt.Errorf("student: context: %w", res.Error)
	}
	return &s, res.RowsAffected > 0, nil
}

// GroupInfo — сводка группы ученика.
type GroupInfo struct {
	ID          int64  `gorm:"column:id"`
	Name        string `gorm:"column:name"`
	Course      string `gorm:"column:course"`
	Branch      string `gorm:"column:branch"`
	Days        string `gorm:"column:days"`
	StartTime   string `gorm:"column:start_time"`
	DurationMin int    `gorm:"column:duration_min"`
	Teacher     string `gorm:"column:teacher"`
}

// Group возвращает сводку группы (ok=false — нет).
func (r *Repository) Group(ctx context.Context, groupID int64) (*GroupInfo, bool, error) {
	var g GroupInfo
	res := r.db.WithContext(ctx).Table("groups AS g").
		Select("g.id, g.name, g.course, g.branch, g.days, g.start_time, g.duration_min, COALESCE(st.name, '') AS teacher").
		Joins("LEFT JOIN staff st ON st.id = g.teacher_id").
		Where("g.id = ?", groupID).Scan(&g)
	if res.Error != nil {
		return nil, false, fmt.Errorf("student: group: %w", res.Error)
	}
	return &g, res.RowsAffected > 0, nil
}

// CourseContent возвращает программу курса группы (по названию; свой курс центра или платформенный).
func (r *Repository) CourseContent(ctx context.Context, tenantID int64, courseTitle string) (json.RawMessage, bool, error) {
	var content json.RawMessage
	res := r.db.WithContext(ctx).Table("courses").Select("content").
		Where("lower(title) = lower(?) AND (owner_center_id = ? OR owner_center_id IS NULL)", courseTitle, tenantID).
		Order("owner_center_id NULLS LAST").Limit(1).Scan(&content)
	if res.Error != nil {
		return nil, false, fmt.Errorf("student: course content: %w", res.Error)
	}
	return content, res.RowsAffected > 0, nil
}

// TestRow — тест в списке ученика со счётчиком вопросов и результатом ученика (если сдавал).
type TestRow struct {
	ID          int64      `gorm:"column:id"`
	Title       string     `gorm:"column:title"`
	Questions   int        `gorm:"column:questions"`
	ScorePct    *int       `gorm:"column:score_pct"`
	SubmittedAt *time.Time `gorm:"column:submitted_at"`
}

// Tests возвращает тесты группы и центра с результатом ученика.
func (r *Repository) Tests(ctx context.Context, tenantID, studentID int64, groupID *int64) ([]TestRow, error) {
	q := r.db.WithContext(ctx).Table("tests AS t").
		Select(`t.id, t.title, jsonb_array_length(t.questions) AS questions,
			sub.score_pct, sub.graded_at AS submitted_at`).
		Joins("LEFT JOIN test_submissions sub ON sub.test_id = t.id AND sub.student_id = ?", studentID).
		Where("t.center_id = ?", tenantID)
	if groupID != nil {
		q = q.Where("t.group_id = ? OR t.group_id IS NULL", *groupID)
	} else {
		q = q.Where("t.group_id IS NULL")
	}
	var out []TestRow
	if err := q.Order("t.id").Scan(&out).Error; err != nil {
		return nil, fmt.Errorf("student: tests: %w", err)
	}
	return out, nil
}

// TestDetailRow — тест с вопросами (сырой jsonb) и результатом ученика.
type TestDetailRow struct {
	ID          int64           `gorm:"column:id"`
	Title       string          `gorm:"column:title"`
	Questions   json.RawMessage `gorm:"column:questions"`
	ScorePct    *int            `gorm:"column:score_pct"`
	SubmittedAt *time.Time      `gorm:"column:submitted_at"`
}

// TestDetail возвращает тест ученика (ok=false — нет/не его группа).
func (r *Repository) TestDetail(ctx context.Context, tenantID, studentID, testID int64, groupID *int64) (*TestDetailRow, bool, error) {
	q := r.db.WithContext(ctx).Table("tests AS t").
		Select(`t.id, t.title, t.questions, sub.score_pct, sub.graded_at AS submitted_at`).
		Joins("LEFT JOIN test_submissions sub ON sub.test_id = t.id AND sub.student_id = ?", studentID).
		Where("t.id = ? AND t.center_id = ?", testID, tenantID)
	if groupID != nil {
		q = q.Where("t.group_id = ? OR t.group_id IS NULL", *groupID)
	} else {
		q = q.Where("t.group_id IS NULL")
	}
	var row TestDetailRow
	res := q.Scan(&row)
	if res.Error != nil {
		return nil, false, fmt.Errorf("student: test detail: %w", res.Error)
	}
	return &row, res.RowsAffected > 0, nil
}

// Achievement — начисление баллов (история достижений).
type Achievement struct {
	Amount int       `gorm:"column:amount"`
	Reason string    `gorm:"column:reason"`
	At     time.Time `gorm:"column:at"`
}

// Achievements возвращает историю начислений баллов ученика.
func (r *Repository) Achievements(ctx context.Context, studentID int64) ([]Achievement, error) {
	var out []Achievement
	err := r.db.WithContext(ctx).Table("point_grants").Select("amount, reason, at").
		Where("student_id = ?", studentID).Order("at DESC, id DESC").Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("student: achievements: %w", err)
	}
	return out, nil
}

// LessonsPaid возвращает остаток оплаченных уроков по группе ученика.
func (r *Repository) LessonsPaid(ctx context.Context, studentID int64, groupID *int64) (int, error) {
	if groupID == nil {
		return 0, nil
	}
	var paid int
	err := r.db.WithContext(ctx).Table("lesson_balances").Select("COALESCE(paid,0)").
		Where("student_id = ? AND group_id = ?", studentID, *groupID).Scan(&paid).Error
	if err != nil {
		return 0, fmt.Errorf("student: lessons paid: %w", err)
	}
	return paid, nil
}

// ReceiptRow — электронный чек ученика.
type ReceiptRow struct {
	ID            int64      `gorm:"column:id"`
	ReceiptNo     string     `gorm:"column:receipt_no"`
	Purpose       string     `gorm:"column:purpose"`
	AmountDiram   int64      `gorm:"column:amount_diram"`
	DiscountDiram int64      `gorm:"column:discount_diram"`
	FinalDiram    int64      `gorm:"column:final_diram"`
	Method        string     `gorm:"column:method"`
	Lessons       int        `gorm:"column:lessons"`
	Status        string     `gorm:"column:status"`
	CreatedAt     time.Time  `gorm:"column:created_at"`
	RefundedAt    *time.Time `gorm:"column:refunded_at"`
}

// Receipts возвращает чеки ученика (новые сверху).
func (r *Repository) Receipts(ctx context.Context, studentID int64) ([]ReceiptRow, error) {
	var out []ReceiptRow
	err := r.db.WithContext(ctx).Table("payments").
		Select("id, receipt_no, purpose, amount_diram, discount_diram, final_diram, method, lessons, status, created_at, refunded_at").
		Where("student_id = ?", studentID).Order("id DESC").Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("student: receipts: %w", err)
	}
	return out, nil
}
