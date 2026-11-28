package student

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/line/eduhub-backend/internal/modules/journal"
	"github.com/line/eduhub-backend/pkg/apierr"
)

// Tests возвращает тесты группы и центра ученика с его результатами.
func (s *Service) Tests(ctx context.Context, studentID, tenantID int64) ([]TestListItem, error) {
	st, err := s.ctxStudent(ctx, studentID, tenantID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.Tests(ctx, tenantID, studentID, st.GroupID)
	if err != nil {
		return nil, err
	}
	out := make([]TestListItem, 0, len(rows))
	for _, t := range rows {
		out = append(out, TestListItem(t))
	}
	return out, nil
}

// TestDetail возвращает тест для прохождения без правильных ответов.
func (s *Service) TestDetail(ctx context.Context, studentID, tenantID, testID int64) (TestDetailResponse, error) {
	st, err := s.ctxStudent(ctx, studentID, tenantID)
	if err != nil {
		return TestDetailResponse{}, err
	}
	row, ok, err := s.repo.TestDetail(ctx, tenantID, studentID, testID, st.GroupID)
	if err != nil {
		return TestDetailResponse{}, err
	}
	if !ok {
		return TestDetailResponse{}, apierr.NotFound("Тест не найден")
	}
	// Санитизация: убираем индекс правильного ответа — ученику он не виден.
	var raw []struct {
		Text    string   `json:"text"`
		Options []string `json:"options"`
	}
	if err := json.Unmarshal(row.Questions, &raw); err != nil {
		return TestDetailResponse{}, fmt.Errorf("student: parse questions: %w", err)
	}
	questions := make([]QuestionView, 0, len(raw))
	for _, q := range raw {
		questions = append(questions, QuestionView{Text: q.Text, Options: q.Options})
	}
	return TestDetailResponse{ID: row.ID, Title: row.Title, Questions: questions, ScorePct: row.ScorePct, SubmittedAt: row.SubmittedAt}, nil
}

// SubmitTest сдаёт тест от имени ученика (studentId из токена) — грейд через journal.SubmitTest.
func (s *Service) SubmitTest(ctx context.Context, studentID, tenantID, testID int64, answers []int) (journal.SubmitResult, error) {
	st, err := s.ctxStudent(ctx, studentID, tenantID)
	if err != nil {
		return journal.SubmitResult{}, err
	}
	// Тест должен быть доступен ученику (его группа или общий центра).
	if _, ok, err := s.repo.TestDetail(ctx, tenantID, studentID, testID, st.GroupID); err != nil {
		return journal.SubmitResult{}, err
	} else if !ok {
		return journal.SubmitResult{}, apierr.NotFound("Тест не найден")
	}
	return s.grader.SubmitTest(ctx, tenantID, testID, journal.SubmitRequest{StudentID: studentID, Answers: answers})
}
