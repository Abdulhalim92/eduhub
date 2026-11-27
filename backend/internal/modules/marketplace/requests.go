package marketplace

import (
	"context"
	"strings"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

func (s *Service) accessDTO(ctx context.Context, a Access, course *CourseDTO) (AccessDTO, error) {
	name, city, err := s.repo.CenterName(ctx, a.CenterID)
	if err != nil {
		return AccessDTO{}, err
	}
	return AccessDTO{
		ID: a.ID, CenterID: a.CenterID, CenterName: name, City: city, Source: a.Source, InvoiceID: a.InvoiceID,
		Reason: a.Reason, GrantedAt: a.GrantedAt, Status: a.Status, RevokedAt: a.RevokedAt, RevokeReason: a.RevokeReason,
		Version: Version{Lessons: a.VersionLessons, Tests: a.VersionTests}, Course: course,
	}, nil
}

func (s *Service) requestDTO(ctx context.Context, r Request) (RequestDTO, error) {
	name, city, err := s.repo.CenterName(ctx, r.CenterID)
	if err != nil {
		return RequestDTO{}, err
	}
	var cdto *CourseDTO
	if course, err := s.repo.Course(ctx, r.CourseID); err == nil {
		d, err := s.courseDTO(ctx, *course)
		if err != nil {
			return RequestDTO{}, err
		}
		cdto = &d
	}
	return RequestDTO{
		ID: r.ID, CenterID: r.CenterID, CenterName: name, City: city, CourseID: r.CourseID, Status: r.Status,
		Note: r.Note, CreatedAt: r.CreatedAt, InvoiceID: r.InvoiceID, Reason: r.Reason, DecidedAt: r.DecidedAt, Course: cdto,
	}, nil
}

// BuyersResponse — владельцы курса (PLT-MKT-110).
type BuyersResponse struct {
	Course CourseDTO   `json:"course"`
	Items  []AccessDTO `json:"items"`
	Other  int         `json:"other"`
}

// Buyers возвращает список центров с доступом к курсу.
func (s *Service) Buyers(ctx context.Context, courseID int64) (BuyersResponse, error) {
	course, err := s.repo.Course(ctx, courseID)
	if err != nil {
		return BuyersResponse{}, err
	}
	cdto, err := s.courseDTO(ctx, *course)
	if err != nil {
		return BuyersResponse{}, err
	}
	accesses, err := s.repo.AccessByCourse(ctx, courseID)
	if err != nil {
		return BuyersResponse{}, err
	}
	items := make([]AccessDTO, 0, len(accesses))
	for _, a := range accesses {
		dto, err := s.accessDTO(ctx, a, &cdto)
		if err != nil {
			return BuyersResponse{}, err
		}
		items = append(items, dto)
	}
	return BuyersResponse{Course: cdto, Items: items, Other: course.BuyersOther}, nil
}

// Revoke отзывает доступ центра к курсу с обязательной причиной (BR-011, PLT-MKT-110).
func (s *Service) Revoke(ctx context.Context, actor audit.Actor, accessID int64, reason string) (AccessDTO, error) {
	var out AccessDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		a, err := s.repo.FindAccess(ctx, tx, accessID)
		if err != nil {
			return err
		}
		if a.Status != AccessActive {
			return apierr.Conflict("Доступ уже отозван")
		}
		if len([]rune(strings.TrimSpace(reason))) < 5 {
			return apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
		}
		t := now()
		a.Status = AccessRevoked
		a.RevokedAt = &t
		a.RevokeReason = strings.TrimSpace(reason)
		if err := s.repo.SaveAccess(ctx, tx, a); err != nil {
			return err
		}
		course, err := s.repo.CourseTx(ctx, tx, a.CourseID, false)
		if err != nil {
			return err
		}
		cid, name := courseEntity(course)
		if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.revoked", EntityType: "course", EntityID: cid, EntityName: name, Before: map[string]any{"status": AccessActive}, After: map[string]any{"status": AccessRevoked}, Reason: course.Title + " · " + a.RevokeReason}); err != nil {
			return err
		}
		cdto, err := s.courseDTO(ctx, *course)
		if err != nil {
			return err
		}
		out, err = s.accessDTO(ctx, *a, &cdto)
		return err
	})
	return out, err
}

// RequestCounts — счётчики заявок по статусам.
type RequestCounts struct {
	New       int `json:"new"`
	Invoiced  int `json:"invoiced"`
	Fulfilled int `json:"fulfilled"`
	Rejected  int `json:"rejected"`
}

// RequestsResponse — ответ marketplace.requests.list.
type RequestsResponse struct {
	Items  []RequestDTO  `json:"items"`
	Total  int           `json:"total"`
	Counts RequestCounts `json:"counts"`
}

// RequestsList возвращает заявки центров с фильтрами и счётчиками.
func (s *Service) RequestsList(ctx context.Context, status string, courseID int64) (RequestsResponse, error) {
	reqs, err := s.repo.ListRequests(ctx, status, courseID)
	if err != nil {
		return RequestsResponse{}, err
	}
	items := make([]RequestDTO, 0, len(reqs))
	for _, r := range reqs {
		dto, err := s.requestDTO(ctx, r)
		if err != nil {
			return RequestsResponse{}, err
		}
		items = append(items, dto)
	}
	all, err := s.repo.ListRequests(ctx, "all", courseID)
	if err != nil {
		return RequestsResponse{}, err
	}
	var cnt RequestCounts
	for _, r := range all {
		switch r.Status {
		case ReqNew:
			cnt.New++
		case ReqInvoiced:
			cnt.Invoiced++
		case ReqFulfilled:
			cnt.Fulfilled++
		case ReqRejected:
			cnt.Rejected++
		}
	}
	return RequestsResponse{Items: items, Total: len(items), Counts: cnt}, nil
}

// Process обрабатывает заявку: invoice | balance | bonus | reject (PLT-MKT-070).
func (s *Service) Process(ctx context.Context, actor audit.Actor, id int64, action, reason string) (RequestDTO, error) {
	var out RequestDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		r, err := s.repo.FindRequest(ctx, tx, id)
		if err != nil {
			return err
		}
		if r.Status != ReqNew {
			if r.Status == ReqInvoiced {
				return apierr.Conflict("По заявке уже выставлен счёт " + deref(r.InvoiceID))
			}
			return apierr.Conflict("Заявка уже обработана")
		}
		course, err := s.repo.CourseTx(ctx, tx, r.CourseID, false)
		if err != nil {
			return err
		}

		if action == "reject" {
			if len([]rune(strings.TrimSpace(reason))) < 5 {
				return apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
			}
			t := now()
			r.Status = ReqRejected
			r.Reason = strings.TrimSpace(reason)
			r.DecidedAt = &t
			if err := s.repo.SaveRequest(ctx, tx, r); err != nil {
				return err
			}
			cid, name := courseEntity(course)
			if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.request.rejected", EntityType: "course", EntityID: cid, EntityName: name, After: map[string]any{"center": r.CenterID}, Reason: course.Title + " · " + r.Reason}); err != nil {
				return err
			}
			out, err = s.requestDTO(ctx, *r)
			return err
		}

		mode, invID, err := s.sellTx(ctx, tx, actor, r.CenterID, course, action, reason)
		if err != nil {
			return err
		}
		t := now()
		if mode == "invoice" {
			r.Status = ReqInvoiced
			r.InvoiceID = invID
		} else {
			r.Status = ReqFulfilled
			r.DecidedAt = &t
			if invID != nil {
				r.InvoiceID = invID
			}
		}
		if err := s.repo.SaveRequest(ctx, tx, r); err != nil {
			return err
		}
		out, err = s.requestDTO(ctx, *r)
		return err
	})
	return out, err
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
