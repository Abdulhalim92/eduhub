package cashier

import (
	"context"
	"fmt"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/modules/journal"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

// Hook реализует journal.ConductHook: при «Проведён» списывает оплаченные уроки у присутствовавших
// и начисляет зарплату преподавателю по его схеме. Работает в транзакции журнала (одна атомарная операция).
type Hook struct {
	repo  *Repository
	audit *audit.Recorder
}

// NewHook создаёт хук кассы для журнала.
func NewHook(repo *Repository, rec *audit.Recorder) *Hook { return &Hook{repo: repo, audit: rec} }

// гарантируем совместимость с интерфейсом журнала на этапе компиляции.
var _ journal.ConductHook = (*Hook)(nil)

// OnConducted вызывается журналом при переводе занятия в «Проведён».
func (h *Hook) OnConducted(ctx context.Context, tx *gorm.DB, lesson journal.Lesson, presentStudentIDs []int64) error {
	// 1) Списать по 1 оплаченному уроку у каждого присутствовавшего (не ниже 0).
	for _, studentID := range presentStudentIDs {
		if _, err := h.repo.AddLessons(ctx, tx, studentID, lesson.GroupID, -1); err != nil {
			return err
		}
	}

	// 2) Начислить зарплату ведущему преподавателю (идемпотентно по lesson_id).
	if lesson.TeacherID == nil {
		return nil
	}
	already, err := h.repo.HasAccrual(ctx, tx, lesson.ID)
	if err != nil {
		return err
	}
	if already {
		return nil
	}
	groupID := lesson.GroupID
	scheme, err := h.repo.SchemeFor(ctx, tx, *lesson.TeacherID, &groupID)
	if err != nil {
		return err
	}
	if scheme == nil {
		return nil // схемы нет — зарплата не начисляется
	}

	heads := int64(len(presentStudentIDs))
	var amount money.Diram
	var detail string
	switch scheme.Type {
	case SchemeFixed:
		amount = scheme.RateDiram
		detail = "фиксированная за занятие"
	case SchemePerHead:
		amount = money.Diram(int64(scheme.RateDiram) * heads)
		detail = fmt.Sprintf("за присутствовавших: %d", heads)
	case SchemeRevShare:
		perHead := money.Diram(int64(scheme.LessonPriceDiram) * int64(scheme.Percent) / 100)
		amount = money.Diram(int64(perHead) * heads)
		detail = fmt.Sprintf("%d%% от цены урока × %d", scheme.Percent, heads)
	default:
		return nil
	}

	accrual := &SalaryAccrual{
		CenterID: lesson.CenterID, TeacherID: *lesson.TeacherID, LessonID: lesson.ID,
		AmountDiram: amount, SchemeType: scheme.Type, Detail: detail, At: time.Now().UTC(),
	}
	if err := h.repo.CreateAccrual(ctx, tx, accrual); err != nil {
		return err
	}
	return h.audit.Log(ctx, tx, audit.Event{
		Actor:      audit.Actor{Name: "Журнал", Role: "system"},
		Action:     "salary.accrued",
		EntityType: "center",
		EntityID:   itoa(lesson.CenterID),
		After:      map[string]any{"teacher": *lesson.TeacherID, "lesson": lesson.ID, "amount": amount.Somoni(), "scheme": scheme.Type},
		Reason:     "Начислена зарплата за проведённое занятие",
	})
}
