package student

import (
	"context"

	"github.com/line/eduhub-backend/internal/modules/journal"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
)

// Schedule — расписание группы (реализуется journal.Service), чтобы не дублировать гибридную логику слотов.
type Schedule interface {
	LessonsRange(ctx context.Context, centerID, groupID int64, from, to string) (journal.LessonsRangeResponse, error)
}

// TestGrader — сдача и автооценка теста (реализуется journal.Service), единый источник грейда.
type TestGrader interface {
	SubmitTest(ctx context.Context, centerID, testID int64, req journal.SubmitRequest) (journal.SubmitResult, error)
}

// Service реализует кабинет ученика.
type Service struct {
	repo     *Repository
	schedule Schedule
	grader   TestGrader
}

// NewService создаёт сервис кабинета ученика.
func NewService(repo *Repository, schedule Schedule, grader TestGrader) *Service {
	return &Service{repo: repo, schedule: schedule, grader: grader}
}

// ctxStudent читает ученика и проверяет доступ (активен, принадлежит центру токена).
func (s *Service) ctxStudent(ctx context.Context, studentID, tenantID int64) (*StudentContext, error) {
	st, ok, err := s.repo.Student(ctx, studentID, tenantID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apierr.NotFound("Ученик не найден")
	}
	if st.Status == "blocked" {
		return nil, apierr.New(apierr.CodeForbidden, "Доступ закрыт. Обратитесь к центру")
	}
	return st, nil
}

// ScheduleFor возвращает расписание ученика за период.
func (s *Service) ScheduleFor(ctx context.Context, studentID, tenantID int64, from, to string) (ScheduleResponse, error) {
	st, err := s.ctxStudent(ctx, studentID, tenantID)
	if err != nil {
		return ScheduleResponse{}, err
	}
	var resp ScheduleResponse
	if st.GroupID == nil {
		return resp, nil // ученик не прикреплён к группе
	}
	if g, ok, err := s.repo.Group(ctx, *st.GroupID); err != nil {
		return ScheduleResponse{}, err
	} else if ok {
		resp.Group = &GroupSummary{
			ID: g.ID, Name: g.Name, Course: g.Course, Branch: g.Branch, Schedule: g.Days,
			StartTime: g.StartTime, DurationMin: g.DurationMin, Teacher: g.Teacher,
		}
	}
	lessons, err := s.schedule.LessonsRange(ctx, tenantID, *st.GroupID, from, to)
	if err != nil {
		return ScheduleResponse{}, err
	}
	resp.Lessons = lessons
	return resp, nil
}

// Materials возвращает программу курса группы ученика (без скачивания файлов).
func (s *Service) Materials(ctx context.Context, studentID, tenantID int64) (MaterialsResponse, error) {
	st, err := s.ctxStudent(ctx, studentID, tenantID)
	if err != nil {
		return MaterialsResponse{}, err
	}
	if st.GroupID == nil {
		return MaterialsResponse{Program: emptyProgram()}, nil
	}
	g, ok, err := s.repo.Group(ctx, *st.GroupID)
	if err != nil {
		return MaterialsResponse{}, err
	}
	if !ok {
		return MaterialsResponse{Program: emptyProgram()}, nil
	}
	content, found, err := s.repo.CourseContent(ctx, tenantID, g.Course)
	if err != nil {
		return MaterialsResponse{}, err
	}
	if !found {
		return MaterialsResponse{Course: g.Course, Program: emptyProgram()}, nil
	}
	return MaterialsResponse{Course: g.Course, Program: content}, nil
}

// Points возвращает баланс баллов и историю достижений.
func (s *Service) Points(ctx context.Context, studentID, tenantID int64) (PointsResponse, error) {
	st, err := s.ctxStudent(ctx, studentID, tenantID)
	if err != nil {
		return PointsResponse{}, err
	}
	rows, err := s.repo.Achievements(ctx, studentID)
	if err != nil {
		return PointsResponse{}, err
	}
	out := PointsResponse{Balance: st.Coin, Achievements: make([]AchievementDTO, 0, len(rows))}
	for _, a := range rows {
		out.Achievements = append(out.Achievements, AchievementDTO(a))
	}
	return out, nil
}

// Finance возвращает остаток оплаченных уроков, баллы и архив чеков ученика.
func (s *Service) Finance(ctx context.Context, studentID, tenantID int64) (FinanceResponse, error) {
	st, err := s.ctxStudent(ctx, studentID, tenantID)
	if err != nil {
		return FinanceResponse{}, err
	}
	paid, err := s.repo.LessonsPaid(ctx, studentID, st.GroupID)
	if err != nil {
		return FinanceResponse{}, err
	}
	rows, err := s.repo.Receipts(ctx, studentID)
	if err != nil {
		return FinanceResponse{}, err
	}
	out := FinanceResponse{Coin: st.Coin, LessonsPaid: paid, Receipts: make([]ReceiptDTO, 0, len(rows))}
	for i := range rows {
		r := rows[i]
		out.Receipts = append(out.Receipts, ReceiptDTO{
			ID: r.ID, ReceiptNo: r.ReceiptNo, Purpose: r.Purpose,
			Amount: money.Diram(r.AmountDiram), Discount: money.Diram(r.DiscountDiram), Final: money.Diram(r.FinalDiram),
			Method: r.Method, Lessons: r.Lessons, Status: r.Status, CreatedAt: r.CreatedAt, RefundedAt: r.RefundedAt,
		})
	}
	return out, nil
}

func emptyProgram() []byte { return []byte(`{"modules":[]}`) }
