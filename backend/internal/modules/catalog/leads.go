package catalog

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// leadTransitions задаёт допустимые действия над заявкой и целевой статус.
var leadTransitions = map[string]string{
	"trial":   LeadTrial,
	"enroll":  LeadEnrolled,
	"decline": LeadLost,
}

// CreateLead принимает публичную заявку на пробный урок (без аккаунта, CTR-CRM-010).
func (s *Service) CreateLead(ctx context.Context, in CreateLeadInput) (LeadDTO, error) {
	name := strings.TrimSpace(in.Name)
	phone := normalizePhone(in.Phone)
	if name == "" {
		return LeadDTO{}, apierr.Field("Укажите имя", "name", "Имя обязательно")
	}
	if phone == "" {
		return LeadDTO{}, apierr.Field("Укажите номер телефона", "phone", "Телефон обязателен")
	}
	var out LeadDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.CenterForLead(ctx, tx, in.TenantID)
		if err != nil {
			return err
		}
		if center.Status != "active" {
			return apierr.Conflict("Центр недоступен")
		}
		if center.Published == 0 {
			return apierr.Conflict("Центр не опубликован в каталоге")
		}
		if in.GroupID != nil {
			if ok, err := s.repo.GroupInCenter(ctx, tx, in.TenantID, *in.GroupID); err != nil {
				return err
			} else if !ok {
				return apierr.Field("Группа не найдена в этом центре", "groupId", "Неизвестная группа")
			}
		}
		now := time.Now().UTC()
		l := &Lead{
			TenantID: in.TenantID, GroupID: in.GroupID, Name: name, Phone: phone, Source: "catalog",
			Note: strings.TrimSpace(in.Note), Status: LeadNew, CreatedAt: now, UpdatedAt: now,
		}
		if err := s.repo.CreateLead(ctx, tx, l); err != nil {
			return err
		}
		// Телефон/имя — минимальные ПДн, в аудит не кладём (security.md); фиксируем факт заявки.
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor:      audit.Actor{Name: "Каталог", Role: "public"},
			Action:     "lead.created", EntityType: "center", EntityID: strconv.FormatInt(in.TenantID, 10), EntityName: center.Name,
			After:  map[string]any{"lead": l.ID, "source": "catalog"},
			Reason: "Заявка на пробный урок из каталога",
		}); err != nil {
			return err
		}
		out = leadToDTO(l)
		return nil
	})
	return out, err
}

// Leads возвращает заявки центра (для администратора).
func (s *Service) Leads(ctx context.Context, tenantID int64, status string) ([]LeadDTO, error) {
	leads, err := s.repo.Leads(ctx, tenantID, status)
	if err != nil {
		return nil, err
	}
	out := make([]LeadDTO, 0, len(leads))
	for i := range leads {
		out = append(out, leadToDTO(&leads[i]))
	}
	return out, nil
}

// Transition переводит заявку в статус по действию (trial|enroll|decline) с записью в аудит.
func (s *Service) Transition(ctx context.Context, actor audit.Actor, tenantID, leadID int64, action string) (LeadDTO, error) {
	target, ok := leadTransitions[action]
	if !ok {
		return LeadDTO{}, apierr.Field("Неизвестное действие", "action", "trial | enroll | decline")
	}
	var out LeadDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		name, _, found, err := s.repo.Center(ctx, tx, tenantID)
		if err != nil {
			return err
		}
		if !found {
			return apierr.NotFound("Центр не найден")
		}
		l, err := s.repo.FindLead(ctx, tx, tenantID, leadID)
		if err != nil {
			return err
		}
		if l.Status == LeadEnrolled || l.Status == LeadLost {
			return apierr.Conflict("Заявка уже в конечном статусе")
		}
		before := l.Status
		l.Status = target
		l.UpdatedAt = time.Now().UTC()
		if err := s.repo.SaveLead(ctx, tx, l); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "lead." + action, EntityType: "center", EntityID: strconv.FormatInt(tenantID, 10), EntityName: name,
			Before: map[string]any{"status": before}, After: map[string]any{"lead": l.ID, "status": target},
			Reason: "Изменение статуса заявки",
		}); err != nil {
			return err
		}
		out = leadToDTO(l)
		return nil
	})
	return out, err
}

// normalizePhone приводит номер к E.164 (регион по умолчанию +992).
func normalizePhone(raw string) string {
	var digits strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	d := digits.String()
	switch {
	case d == "":
		return ""
	case len(d) == 9:
		return "+992" + d
	case strings.HasPrefix(d, "0") && len(d) == 10:
		return "+992" + d[1:]
	default:
		return "+" + d
	}
}
