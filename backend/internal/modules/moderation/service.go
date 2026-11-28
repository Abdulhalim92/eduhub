// Package moderation — модерация каталога филиалов (PLT-MOD): очередь заявок и решения
// (SuperAdmin), подача и исправление заявок (администратор центра). Денег модуль не двигает.
package moderation

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// Service реализует операции модерации и подачи заявок.
type Service struct {
	db    *gorm.DB
	repo  *Repository
	audit *audit.Recorder
}

// NewService создаёт сервис модерации.
func NewService(repo *Repository, rec *audit.Recorder) *Service {
	return &Service{db: repo.DB(), repo: repo, audit: rec}
}

func digits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

// List возвращает очередь модерации по статусу (pending|processed) и сводку.
func (s *Service) List(ctx context.Context, status string) (ListResponse, error) {
	subs, err := s.repo.List(ctx, status)
	if err != nil {
		return ListResponse{}, err
	}
	names, err := s.repo.CenterNames(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	pending, processed, err := s.repo.Counts(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	items := make([]SubmissionDTO, 0, len(subs))
	for _, sub := range subs {
		items = append(items, toDTO(sub, names[sub.CenterID].Name))
	}
	return ListResponse{Items: items, Meta: ListMeta{Pending: pending, Processed: processed}}, nil
}

// Decide применяет решение модерации (PLT-MOD-030, BR-017).
func (s *Service) Decide(ctx context.Context, actor audit.Actor, id int64, in DecideInput) (SubmissionDTO, error) {
	var out SubmissionDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		sub, err := s.repo.FindForUpdate(ctx, tx, id)
		if err != nil {
			return err
		}
		if sub.Status != StatusPending {
			return apierr.Conflict("Заявка уже обработана")
		}
		if in.Decision != StatusPublished && in.Decision != StatusReturned && in.Decision != StatusRejected {
			return apierr.Validation("Неизвестное решение", nil)
		}
		if in.Desc != nil {
			sub.DescRU, sub.DescTJ, sub.DescEN = strings.TrimSpace(in.Desc.RU), strings.TrimSpace(in.Desc.TJ), strings.TrimSpace(in.Desc.EN)
		}
		if in.GPS != nil {
			sub.GPSLat, sub.GPSLng = in.GPS.Lat, in.GPS.Lng
		}
		sub.GPSOk = in.GPSConfirmed

		if in.Decision == StatusPublished {
			if b := publishBlockers(*sub); len(b) > 0 {
				return apierr.Validation("Нельзя опубликовать: "+strings.Join(b, "; "), nil)
			}
			sub.Reason = ""
		} else {
			if lenRunes(strings.TrimSpace(in.Reason)) < 5 {
				return apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
			}
			sub.Reason = strings.TrimSpace(in.Reason)
		}
		now := time.Now().UTC()
		sub.Status = in.Decision
		sub.DecidedAt = &now
		if err := s.repo.Save(ctx, tx, sub); err != nil {
			return err
		}
		center, err := s.repo.Center(ctx, tx, sub.CenterID)
		if err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "moderation." + in.Decision, EntityType: "center", EntityID: itoa(sub.CenterID), EntityName: center.Name,
			After: map[string]any{"branch": sub.Branch, "status": in.Decision}, Reason: sub.Branch + reasonSuffix(sub.Reason),
		}); err != nil {
			return err
		}
		out = toDTO(*sub, center.Name)
		return nil
	})
	return out, err
}

// Requeue возвращает обработанную заявку в очередь (PLT-MOD-030).
func (s *Service) Requeue(ctx context.Context, actor audit.Actor, id int64) (SubmissionDTO, error) {
	var out SubmissionDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		sub, err := s.repo.FindForUpdate(ctx, tx, id)
		if err != nil {
			return err
		}
		sub.Status = StatusPending
		sub.Reason = ""
		sub.GPSOk = false
		sub.DecidedAt = nil
		if err := s.repo.Save(ctx, tx, sub); err != nil {
			return err
		}
		center, err := s.repo.Center(ctx, tx, sub.CenterID)
		if err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "moderation.requeued", EntityType: "center", EntityID: itoa(sub.CenterID), EntityName: center.Name,
			After: map[string]any{"branch": sub.Branch, "status": StatusPending}, Reason: sub.Branch,
		}); err != nil {
			return err
		}
		out = toDTO(*sub, center.Name)
		return nil
	})
	return out, err
}

// CenterBranches возвращает заявки центра и лимит филиалов тарифа (PLT-MOD-050).
func (s *Service) CenterBranches(ctx context.Context, centerID int64) (BranchesResponse, error) {
	center, err := s.repo.Center(ctx, s.db, centerID)
	if err != nil {
		return BranchesResponse{}, err
	}
	subs, err := s.repo.ByCenter(ctx, centerID)
	if err != nil {
		return BranchesResponse{}, err
	}
	used, err := s.repo.ActiveCount(ctx, s.db, centerID, 0)
	if err != nil {
		return BranchesResponse{}, err
	}
	items := make([]SubmissionDTO, 0, len(subs))
	for _, sub := range subs {
		items = append(items, toDTO(sub, center.Name))
	}
	return BranchesResponse{
		Items:  items,
		Meta:   BranchesMeta{Limit: center.LimitBranches, Used: used, Plan: center.PlanName},
		Cities: cities,
	}, nil
}

// Geocode возвращает координаты по адресу (мок, INT-GEO-010).
func (s *Service) Geocode(city, address string) (map[string]any, error) {
	if lenRunes(strings.TrimSpace(address)) < 5 {
		return nil, apierr.Field("Введите адрес", "address", "Укажите адрес (улица и дом)")
	}
	p := Geocode(city, address)
	return map[string]any{"lat": p.Lat, "lng": p.Lng, "source": "mock"}, nil
}

// Submit подаёт заявку на публикацию филиала (PLT-MOD-040, BR-018).
func (s *Service) Submit(ctx context.Context, actor audit.Actor, centerID int64, in BranchInput) (SubmissionDTO, error) {
	var out SubmissionDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if fields, err := s.validateBranch(ctx, tx, in, center, 0); err != nil {
			return err
		} else if len(fields) > 0 {
			return apierr.Validation("Проверьте данные филиала", fields)
		}
		sub := &Submission{CenterID: centerID, SubmittedBy: center.Owner, SubmittedAt: time.Now().UTC(), Status: StatusPending}
		applyInput(sub, in)
		if err := s.repo.Create(ctx, tx, sub); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "branch.submitted", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"branch": sub.Branch, "address": sub.Address}, Reason: "Заявка на публикацию в каталоге",
		}); err != nil {
			return err
		}
		out = toDTO(*sub, center.Name)
		return nil
	})
	return out, err
}

// Resubmit отправляет исправленную заявку после возврата на доработку (PLT-MOD-050).
func (s *Service) Resubmit(ctx context.Context, actor audit.Actor, centerID, id int64, in BranchInput) (SubmissionDTO, error) {
	var out SubmissionDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		sub, err := s.repo.FindForUpdate(ctx, tx, id)
		if err != nil {
			return err
		}
		if sub.CenterID != centerID {
			return apierr.NotFound("Заявка не найдена")
		}
		if sub.Status != StatusReturned {
			return apierr.Conflict("Исправлять можно только заявку, возвращённую на доработку")
		}
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if fields, err := s.validateBranch(ctx, tx, in, center, id); err != nil {
			return err
		} else if len(fields) > 0 {
			return apierr.Validation("Проверьте данные филиала", fields)
		}
		applyInput(sub, in)
		sub.Status = StatusPending
		sub.Reason = ""
		sub.GPSOk = false
		sub.SubmittedAt = time.Now().UTC()
		if err := s.repo.Save(ctx, tx, sub); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "branch.resubmitted", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"branch": sub.Branch}, Reason: "Исправленная заявка после доработки",
		}); err != nil {
			return err
		}
		out = toDTO(*sub, center.Name)
		return nil
	})
	return out, err
}

func applyInput(sub *Submission, in BranchInput) {
	district := strings.TrimSpace(in.District)
	if district == "" {
		district = "Центр"
	}
	geo := Geocode(in.City, in.Address)
	sub.Branch = strings.TrimSpace(in.Branch)
	sub.City = in.City
	sub.District = district
	sub.Address = strings.TrimSpace(in.Address)
	sub.Phone = strings.TrimSpace(in.Phone)
	sub.GPSLat, sub.GPSLng = in.GPS.Lat, in.GPS.Lng
	sub.GeoLat, sub.GeoLng = geo.Lat, geo.Lng
	sub.DescRU = strings.TrimSpace(in.Desc.RU)
	sub.DescTJ = strings.TrimSpace(in.Desc.TJ)
	sub.DescEN = strings.TrimSpace(in.Desc.EN)
}

// validateBranch проверяет данные заявки (PLT-MOD-040, BR-018). excludeID=0 — новая заявка.
func (s *Service) validateBranch(ctx context.Context, tx *gorm.DB, in BranchInput, center *CenterInfo, excludeID int64) (map[string]string, error) {
	e := map[string]string{}
	if lenRunes(strings.TrimSpace(in.Branch)) < 3 {
		e["branch"] = "Укажите название филиала (минимум 3 символа)"
	}
	if !contains(cities, in.City) {
		e["city"] = "Выберите город"
	}
	addr := strings.TrimSpace(in.Address)
	if lenRunes(addr) < 5 {
		e["address"] = "Укажите адрес (улица и дом)"
	}
	if len(digits(in.Phone)) < 9 {
		e["phone"] = "Введите корректный номер телефона"
	}
	if in.GPS.Lat == 0 && in.GPS.Lng == 0 {
		e["gps"] = "Укажите координаты или нажмите «Определить по адресу»"
	} else if !inTajikistan(in.GPS.Lat, in.GPS.Lng) {
		e["gps"] = "Координаты вне Таджикистана — проверьте широту и долготу"
	}
	if lenRunes(strings.TrimSpace(in.Desc.RU)) < descMinLen {
		e["descRu"] = "Описание на русском обязательно (от 20 символов)"
	}
	if _, ok := e["address"]; !ok && in.City != "" {
		dup, err := s.repo.DuplicateAddress(ctx, tx, center.ID, in.City, addr, excludeID)
		if err != nil {
			return nil, err
		}
		if dup {
			e["address"] = "Филиал с таким адресом уже подан"
		}
	}
	if excludeID == 0 {
		active, err := s.repo.ActiveCount(ctx, tx, center.ID, 0)
		if err != nil {
			return nil, err
		}
		if active >= center.LimitBranches {
			e["branch"] = "Лимит филиалов тарифа «" + center.PlanName + "»: " + strconv.Itoa(center.LimitBranches) + ". Повысьте тариф, чтобы добавить ещё"
		}
	}
	return e, nil
}

func reasonSuffix(reason string) string {
	if reason == "" {
		return ""
	}
	return " · " + reason
}

func contains(xs []string, v string) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}
