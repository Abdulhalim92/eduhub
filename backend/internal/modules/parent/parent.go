// Package parent — кабинет родителя (LRN-PRN-020, role=parent): список детей и по каждому ребёнку
// финансы (долг/остаток уроков, чеки) и расписание. Родитель видит только привязанных администратором
// детей (таблица student_guardians). Данные ребёнка переиспользуются из модуля student.
package parent

import (
	"context"

	"github.com/line/eduhub-backend/internal/modules/student"
	"github.com/line/eduhub-backend/pkg/apierr"
)

// ChildData отдаёт данные ребёнка (реализуется student.Service): финансы и расписание по (ученик, центр).
type ChildData interface {
	Finance(ctx context.Context, studentID, tenantID int64) (student.FinanceResponse, error)
	ScheduleFor(ctx context.Context, studentID, tenantID int64, from, to string) (student.ScheduleResponse, error)
}

// Service реализует кабинет родителя.
type Service struct {
	repo  *Repository
	child ChildData
}

// NewService создаёт сервис кабинета родителя.
func NewService(repo *Repository, child ChildData) *Service {
	return &Service{repo: repo, child: child}
}

// Children возвращает детей, привязанных к аккаунту родителя.
func (s *Service) Children(ctx context.Context, accountID int64) ([]ChildDTO, error) {
	rows, err := s.repo.Children(ctx, accountID)
	if err != nil {
		return nil, err
	}
	out := make([]ChildDTO, 0, len(rows))
	for i := range rows {
		r := rows[i]
		dto := ChildDTO{StudentID: r.StudentID, Name: r.Name, Status: r.Status, CenterID: r.TenantID, CenterName: r.CenterName}
		if r.GroupID != nil {
			dto.Group = &ChildGroup{ID: *r.GroupID, Name: r.GroupName, Course: r.Course}
		}
		out = append(out, dto)
	}
	return out, nil
}

// ChildFinance возвращает финансы ребёнка (после проверки связи опеки).
func (s *Service) ChildFinance(ctx context.Context, accountID, studentID int64) (student.FinanceResponse, error) {
	tenantID, err := s.authorizeChild(ctx, accountID, studentID)
	if err != nil {
		return student.FinanceResponse{}, err
	}
	return s.child.Finance(ctx, studentID, tenantID)
}

// ChildSchedule возвращает расписание ребёнка (после проверки связи опеки).
func (s *Service) ChildSchedule(ctx context.Context, accountID, studentID int64, from, to string) (student.ScheduleResponse, error) {
	tenantID, err := s.authorizeChild(ctx, accountID, studentID)
	if err != nil {
		return student.ScheduleResponse{}, err
	}
	return s.child.ScheduleFor(ctx, studentID, tenantID, from, to)
}

// authorizeChild проверяет активную связь опеки аккаунта с ребёнком и возвращает центр ребёнка.
func (s *Service) authorizeChild(ctx context.Context, accountID, studentID int64) (int64, error) {
	tenantID, ok, err := s.repo.GuardianTenant(ctx, accountID, studentID)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, apierr.NotFound("Ребёнок не найден")
	}
	return tenantID, nil
}
