package journal

import (
	"context"
	"strings"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// TestDTO — тест для ответа.
type TestDTO struct {
	ID        int64      `json:"id"`
	GroupID   *int64     `json:"groupId"`
	LessonID  *int64     `json:"lessonId"`
	Title     string     `json:"title"`
	Questions []Question `json:"questions"`
}

func testToDTO(t Test) TestDTO {
	return TestDTO{ID: t.ID, GroupID: t.GroupID, LessonID: t.LessonID, Title: t.Title, Questions: t.Questions}
}

// CreateTestRequest — тело создания теста (LRN-TCH-030).
type CreateTestRequest struct {
	GroupID   *int64     `json:"groupId"`
	LessonID  *int64     `json:"lessonId"`
	Title     string     `json:"title"`
	Questions []Question `json:"questions"`
}

// CreateTest создаёт тест с автопроверкой.
func (s *Service) CreateTest(ctx context.Context, centerID int64, req CreateTestRequest) (TestDTO, error) {
	var out TestDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "создавать тесты"); err != nil {
			return err
		}
		title := strings.TrimSpace(req.Title)
		if n := len([]rune(title)); n < 3 || n > 120 {
			return apierr.Field("Название — от 3 до 120 символов", "title", "3..120")
		}
		if len(req.Questions) < 1 {
			return apierr.Field("Добавьте хотя бы один вопрос", "questions", "Минимум один вопрос")
		}
		for i, q := range req.Questions {
			if strings.TrimSpace(q.Text) == "" {
				return apierr.Field("Текст вопроса обязателен", "questions", "Пустой вопрос")
			}
			if len(q.Options) < 2 {
				return apierr.Field("У вопроса минимум 2 варианта", "questions", "Мало вариантов")
			}
			if q.Correct < 0 || q.Correct >= len(q.Options) {
				return apierr.Field("Неверный индекс правильного ответа", "questions", "correct вне диапазона")
			}
			_ = i
		}
		t := &Test{CenterID: centerID, GroupID: req.GroupID, LessonID: req.LessonID, Title: title, Questions: req.Questions}
		if err := s.repo.CreateTest(ctx, tx, t); err != nil {
			return err
		}
		out = testToDTO(*t)
		return nil
	})
	return out, err
}

// GetTest возвращает тест.
func (s *Service) GetTest(ctx context.Context, centerID, testID int64) (TestDTO, error) {
	t, err := s.repo.FindTest(ctx, s.db, centerID, testID)
	if err != nil {
		return TestDTO{}, err
	}
	return testToDTO(*t), nil
}

// SubmitRequest — тело сдачи теста.
type SubmitRequest struct {
	StudentID int64 `json:"studentId"`
	Answers   []int `json:"answers"`
}

// SubmitResult — результат автопроверки.
type SubmitResult struct {
	TestID    int64 `json:"testId"`
	StudentID int64 `json:"studentId"`
	Correct   int   `json:"correct"`
	Total     int   `json:"total"`
	ScorePct  int   `json:"scorePct"`
}

// SubmitTest принимает ответы ученика и автоматически считает результат (пересдача — апсерт).
func (s *Service) SubmitTest(ctx context.Context, centerID, testID int64, req SubmitRequest) (SubmitResult, error) {
	var out SubmitResult
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "сдавать тесты"); err != nil {
			return err
		}
		t, err := s.repo.FindTest(ctx, tx, centerID, testID)
		if err != nil {
			return err
		}
		if exists, _, err := s.repo.StudentActive(ctx, tx, centerID, req.StudentID); err != nil {
			return err
		} else if !exists {
			return apierr.NotFound("Ученик не найден")
		}
		total := len(t.Questions)
		correct := 0
		for i, q := range t.Questions {
			if i < len(req.Answers) && req.Answers[i] == q.Correct {
				correct++
			}
		}
		score := 0
		if total > 0 {
			score = int(float64(correct)/float64(total)*100 + 0.5)
		}
		sub := &TestSubmission{TestID: testID, StudentID: req.StudentID, Answers: req.Answers, ScorePct: score}
		if err := s.repo.UpsertSubmission(ctx, tx, sub); err != nil {
			return err
		}
		out = SubmitResult{TestID: testID, StudentID: req.StudentID, Correct: correct, Total: total, ScorePct: score}
		return nil
	})
	return out, err
}
