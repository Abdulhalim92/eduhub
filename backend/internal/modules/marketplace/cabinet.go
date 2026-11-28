package marketplace

import (
	"context"
	"strings"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// CabinetCourses — ответ cabinet.courses.list: переданные методики и собственные курсы центра.
type CabinetCourses struct {
	Items []AccessDTO `json:"items"`
	Own   []CourseDTO `json:"own"`
}

// CenterCourses возвращает переданные (активные) и собственные курсы центра (PLT-MKT-090/100).
func (s *Service) CenterCourses(ctx context.Context, centerID int64) (CabinetCourses, error) {
	accesses, err := s.repo.ActiveAccessByCenter(ctx, centerID)
	if err != nil {
		return CabinetCourses{}, err
	}
	items := make([]AccessDTO, 0, len(accesses))
	for _, a := range accesses {
		course, err := s.repo.Course(ctx, a.CourseID)
		if err != nil {
			return CabinetCourses{}, err
		}
		cdto, err := s.courseDTO(ctx, *course)
		if err != nil {
			return CabinetCourses{}, err
		}
		dto, err := s.accessDTO(ctx, a, &cdto)
		if err != nil {
			return CabinetCourses{}, err
		}
		items = append(items, dto)
	}
	own, err := s.repo.OwnCourses(ctx, centerID)
	if err != nil {
		return CabinetCourses{}, err
	}
	ownDTO := make([]CourseDTO, 0, len(own))
	for _, c := range own {
		dto, err := s.courseDTO(ctx, c)
		if err != nil {
			return CabinetCourses{}, err
		}
		ownDTO = append(ownDTO, dto)
	}
	return CabinetCourses{Items: items, Own: ownDTO}, nil
}

// Catalog возвращает опубликованные курсы платформы со статусом владения для центра (PLT-MKT-060).
func (s *Service) Catalog(ctx context.Context, centerID int64) ([]CatalogItem, error) {
	courses, err := s.repo.PublishedPlatform(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]CatalogItem, 0, len(courses))
	for _, c := range courses {
		cdto, err := s.courseDTO(ctx, c)
		if err != nil {
			return nil, err
		}
		item := CatalogItem{CourseDTO: cdto, State: "available"}
		if a, err := s.repo.ActiveAccess(ctx, centerID, c.ID); err != nil {
			return nil, err
		} else if a != nil {
			item.State = "owned"
		} else if r, err := s.repo.OpenRequest(ctx, s.db, centerID, c.ID); err != nil {
			return nil, err
		} else if r != nil {
			id := r.ID
			item.RequestID = &id
			if r.Status == ReqInvoiced {
				item.State = "invoiced"
			} else {
				item.State = "requested"
			}
		}
		items = append(items, item)
	}
	return items, nil
}

// CreateOwn создаёт собственный курс центра (BR-016): виден только центру, не в магазине.
func (s *Service) CreateOwn(ctx context.Context, centerID int64, title, direction, description string) (CourseDTO, error) {
	title = strings.TrimSpace(title)
	fields := map[string]string{}
	if n := len([]rune(title)); n < 3 || n > 80 {
		fields["title"] = "Название — от 3 до 80 символов"
	} else if exists, err := s.repo.CenterTitleExists(ctx, centerID, title, 0); err != nil {
		return CourseDTO{}, err
	} else if exists {
		fields["title"] = "У вас уже есть курс с таким названием"
	}
	if !contains(courseDirections, direction) {
		fields["direction"] = "Выберите направление"
	}
	if len([]rune(description)) > 600 {
		fields["description"] = "Описание — не длиннее 600 символов"
	}
	if len(fields) > 0 {
		return CourseDTO{}, apierr.Validation("Проверьте данные курса", fields)
	}
	owner := centerID
	c := Course{Title: title, Direction: direction, Description: strings.TrimSpace(description), Status: StatusPrivate, Note: "Собственный курс", OwnerCenterID: &owner, Content: Program{Modules: []Module{}}, ContentSeq: 1}
	if err := s.repo.CreateCourse(ctx, s.db, &c); err != nil {
		return CourseDTO{}, err
	}
	return s.courseDTO(ctx, c)
}

// CenterRequests возвращает заявки центра.
func (s *Service) CenterRequests(ctx context.Context, centerID int64) ([]RequestDTO, error) {
	reqs, err := s.repo.RequestsByCenter(ctx, centerID)
	if err != nil {
		return nil, err
	}
	out := make([]RequestDTO, 0, len(reqs))
	for _, r := range reqs {
		dto, err := s.requestDTO(ctx, r)
		if err != nil {
			return nil, err
		}
		out = append(out, dto)
	}
	return out, nil
}

// CreateRequest — заявка центра на курс (PLT-MKT-060, BR-012/014).
func (s *Service) CreateRequest(ctx context.Context, actor audit.Actor, centerID, courseID int64, note string) (RequestDTO, error) {
	var out RequestDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		course, err := s.repo.CourseTx(ctx, tx, courseID, false)
		if err != nil {
			return err
		}
		if !course.IsPlatform() || course.Status != StatusPublished {
			return apierr.Conflict("Этот курс нельзя заказать")
		}
		if center.Status != "active" {
			return apierr.Conflict("Центр заблокирован: заявки недоступны")
		}
		if a, err := s.repo.ActiveAccessTx(ctx, tx, centerID, courseID); err != nil {
			return err
		} else if a != nil {
			return apierr.Conflict("Курс «" + course.Title + "» уже у вас")
		}
		if r, err := s.repo.OpenRequest(ctx, tx, centerID, courseID); err != nil {
			return err
		} else if r != nil {
			return apierr.Conflict("Заявка на этот курс уже подана")
		}
		if len([]rune(note)) > 300 {
			return apierr.Field("Комментарий — не длиннее 300 символов", "note", "Не длиннее 300 символов")
		}
		r := &Request{CenterID: centerID, CourseID: courseID, Status: ReqNew, Note: strings.TrimSpace(note), CreatedAt: now()}
		if err := s.repo.CreateRequest(ctx, tx, r); err != nil {
			return err
		}
		cid, name := courseEntity(course)
		if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.requested", EntityType: "course", EntityID: cid, EntityName: name, After: map[string]any{"center": centerID}, Reason: course.Title + " · заявка центра"}); err != nil {
			return err
		}
		out, err = s.requestDTO(ctx, *r)
		return err
	})
	return out, err
}

// CancelRequest отменяет заявку центра, пока по ней нет счёта.
func (s *Service) CancelRequest(ctx context.Context, centerID, id int64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		r, err := s.repo.FindRequest(ctx, tx, id)
		if err != nil {
			return err
		}
		if r.CenterID != centerID {
			return apierr.New(apierr.CodeForbidden, "Это заявка другого центра")
		}
		if r.Status != ReqNew {
			return apierr.Conflict("Отменить можно только заявку, по которой ещё нет счёта")
		}
		return s.repo.DeleteRequest(ctx, tx, id)
	})
}

// PayRequestOnline оплачивает выставленный по заявке счёт онлайн (мок шлюза); курс передаётся автоматически.
func (s *Service) PayRequestOnline(ctx context.Context, centerID, id int64) (RequestDTO, error) {
	r, err := s.repo.FindRequest(ctx, s.db, id)
	if err != nil {
		return RequestDTO{}, err
	}
	if r.CenterID != centerID {
		return RequestDTO{}, apierr.New(apierr.CodeForbidden, "Это заявка другого центра")
	}
	if r.Status != ReqInvoiced || r.InvoiceID == nil {
		return RequestDTO{}, apierr.Conflict("По заявке нет счёта, ожидающего оплаты")
	}
	if _, err := s.billing.PayOnline(ctx, *r.InvoiceID, ""); err != nil {
		return RequestDTO{}, err
	}
	updated, err := s.repo.FindRequest(ctx, s.db, id)
	if err != nil {
		return RequestDTO{}, err
	}
	return s.requestDTO(ctx, *updated)
}
