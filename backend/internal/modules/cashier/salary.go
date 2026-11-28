package cashier

import (
	"context"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

// UpsertSchemeRequest — тело схемы зарплаты преподавателя.
type UpsertSchemeRequest struct {
	TeacherID   int64       `json:"teacherId"`
	GroupID     *int64      `json:"groupId"`
	Type        string      `json:"type"`
	Rate        money.Diram `json:"rate"`
	Percent     int         `json:"percent"`
	LessonPrice money.Diram `json:"lessonPrice"`
}

var schemeTypes = map[string]bool{SchemeFixed: true, SchemePerHead: true, SchemeRevShare: true}

// UpsertScheme задаёт схему расчёта зарплаты (по умолчанию или для конкретной группы).
func (s *Service) UpsertScheme(ctx context.Context, actor audit.Actor, centerID int64, req UpsertSchemeRequest) (SchemeDTO, error) {
	if !schemeTypes[req.Type] {
		return SchemeDTO{}, apierr.Field("Выберите тип схемы", "type", "fixed | perhead | revshare")
	}
	if req.Rate < 0 || req.LessonPrice < 0 {
		return SchemeDTO{}, apierr.Field("Суммы не могут быть отрицательными", "rate", "Минимум 0")
	}
	if req.Type == SchemeRevShare && (req.Percent < 1 || req.Percent > 100) {
		return SchemeDTO{}, apierr.Field("Процент revshare — от 1 до 100", "percent", "1..100")
	}
	var out SchemeDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if ok, err := s.repo.TeacherExists(ctx, tx, centerID, req.TeacherID); err != nil {
			return err
		} else if !ok {
			return apierr.Field("Преподаватель не найден в этом центре", "teacherId", "Неизвестный преподаватель")
		}
		if req.GroupID != nil {
			if ok, err := s.repo.GroupInCenter(ctx, tx, centerID, *req.GroupID); err != nil {
				return err
			} else if !ok {
				return apierr.Field("Группа не найдена в этом центре", "groupId", "Неизвестная группа")
			}
		}
		now := time.Now().UTC()
		sc := &SalaryScheme{
			CenterID: centerID, TeacherID: req.TeacherID, GroupID: req.GroupID, Type: req.Type,
			RateDiram: req.Rate, Percent: req.Percent, LessonPriceDiram: req.LessonPrice,
			CreatedAt: now, UpdatedAt: now,
		}
		if err := s.repo.UpsertScheme(ctx, tx, sc); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "salary.scheme_updated", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"teacher": req.TeacherID, "group": req.GroupID, "type": req.Type,
				"rate": req.Rate.Somoni(), "percent": req.Percent, "lessonPrice": req.LessonPrice.Somoni()},
			Reason: "Схема зарплаты изменена",
		}); err != nil {
			return err
		}
		out = schemeToDTO(sc)
		return nil
	})
	return out, err
}

// ListSchemes возвращает схемы центра (опционально одного преподавателя).
func (s *Service) ListSchemes(ctx context.Context, centerID, teacherID int64) ([]SchemeDTO, error) {
	if _, err := s.repo.Center(ctx, s.db, centerID); err != nil {
		return nil, err
	}
	schemes, err := s.repo.Schemes(ctx, centerID, teacherID)
	if err != nil {
		return nil, err
	}
	out := make([]SchemeDTO, 0, len(schemes))
	for i := range schemes {
		out = append(out, schemeToDTO(&schemes[i]))
	}
	return out, nil
}

// ListAccruals возвращает ведомость начислений (фильтры: преподаватель, период дат ГГГГ-ММ-ДД).
func (s *Service) ListAccruals(ctx context.Context, centerID, teacherID int64, fromStr, toStr string) ([]AccrualDTO, error) {
	if _, err := s.repo.Center(ctx, s.db, centerID); err != nil {
		return nil, err
	}
	var from, to *time.Time
	if fromStr != "" {
		v, err := time.Parse("2006-01-02", fromStr)
		if err != nil {
			return nil, apierr.Field("Некорректная дата from", "from", "Формат ГГГГ-ММ-ДД")
		}
		from = &v
	}
	if toStr != "" {
		v, err := time.Parse("2006-01-02", toStr)
		if err != nil {
			return nil, apierr.Field("Некорректная дата to", "to", "Формат ГГГГ-ММ-ДД")
		}
		end := v.Add(24*time.Hour - time.Nanosecond)
		to = &end
	}
	accruals, err := s.repo.Accruals(ctx, centerID, teacherID, from, to)
	if err != nil {
		return nil, err
	}
	out := make([]AccrualDTO, 0, len(accruals))
	for i := range accruals {
		out = append(out, accrualToDTO(&accruals[i]))
	}
	return out, nil
}
