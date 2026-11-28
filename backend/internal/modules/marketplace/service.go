// Package marketplace — магазин методик (B2B): каталог курсов, передача центрам, заявки,
// собственные курсы центров. Передача курса использует биллинг (счета/оплата) через billing.
package marketplace

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/modules/billing"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

const maxPriceSomoni = 100_000

// Service реализует операции маркетплейса и интерфейс billing.CourseGranter.
type Service struct {
	db      *gorm.DB
	repo    *Repository
	billing *billing.Service
	audit   *audit.Recorder
}

// NewService создаёт сервис маркетплейса.
func NewService(repo *Repository, billingSvc *billing.Service, rec *audit.Recorder) *Service {
	return &Service{db: repo.DB(), repo: repo, billing: billingSvc, audit: rec}
}

func now() time.Time { return time.Now().UTC() }
func itoa(n int64) string { return strconv.FormatInt(n, 10) }

func courseEntity(c *Course) (string, string) { return itoa(c.ID), c.Title }

func (s *Service) courseDTO(ctx context.Context, c Course) (CourseDTO, error) {
	n, err := s.repo.ActiveBuyers(ctx, c.ID)
	if err != nil {
		return CourseDTO{}, err
	}
	return toCourseDTO(c, n), nil
}

// List возвращает каталог курсов платформы и сводку.
func (s *Service) List(ctx context.Context, q, direction, status string) (ListResponse, error) {
	courses, err := s.repo.ListPlatform(ctx, strings.TrimSpace(q), direction, status)
	if err != nil {
		return ListResponse{}, err
	}
	items := make([]CourseDTO, 0, len(courses))
	for _, c := range courses {
		dto, err := s.courseDTO(ctx, c)
		if err != nil {
			return ListResponse{}, err
		}
		items = append(items, dto)
	}

	all, err := s.repo.ListPlatform(ctx, "", "all", "all")
	if err != nil {
		return ListResponse{}, err
	}
	meta := ListMeta{}
	for _, c := range all {
		switch c.Status {
		case StatusPublished:
			meta.Published++
		case StatusDraft:
			meta.Draft++
		}
		n, err := s.repo.ActiveBuyers(ctx, c.ID)
		if err != nil {
			return ListResponse{}, err
		}
		buyers := n + c.BuyersOther
		meta.Buyers += buyers
		meta.Revenue += int64(buyers) * c.PriceDiram.Somoni()
	}
	if meta.Requests, err = s.repo.NewRequestCount(ctx); err != nil {
		return ListResponse{}, err
	}
	return ListResponse{Items: items, Total: len(items), Directions: courseDirections, Meta: meta}, nil
}

// Create добавляет черновик курса платформы (PLT-MKT-040).
func (s *Service) Create(ctx context.Context, actor audit.Actor, title, direction string, price *int64) (CourseDTO, error) {
	title = strings.TrimSpace(title)
	fields := map[string]string{}
	if n := len([]rune(title)); n < 3 || n > 80 {
		fields["title"] = "Название — от 3 до 80 символов"
	} else if exists, err := s.repo.PlatformTitleExists(ctx, title, 0); err != nil {
		return CourseDTO{}, err
	} else if exists {
		fields["title"] = "Курс с таким названием уже есть"
	}
	if !contains(courseDirections, direction) {
		fields["direction"] = "Выберите направление"
	}
	if price == nil || *price < 0 || *price > maxPriceSomoni {
		fields["price"] = "Цена — целое число сомони от 0 до 100 000"
	}
	if len(fields) > 0 {
		return CourseDTO{}, apierr.Validation("Проверьте данные курса", fields)
	}
	c := Course{Title: title, Direction: direction, Status: StatusDraft, PriceDiram: money.FromSomoni(*price), Note: "Черновик", Content: Program{Modules: []Module{}}, ContentSeq: 1}
	if err := s.repo.CreateCourse(ctx, s.db, &c); err != nil {
		return CourseDTO{}, err
	}
	id, name := courseEntity(&c)
	_ = s.audit.Log(ctx, s.db, audit.Event{Actor: actor, Action: "course.created", EntityType: "course", EntityID: id, EntityName: name, After: map[string]any{"status": StatusDraft, "direction": direction, "price": *price}, Reason: "Создан черновик курса"})
	return s.courseDTO(ctx, c)
}

// SetPrice меняет цену курса с обязательной причиной (BR-011).
func (s *Service) SetPrice(ctx context.Context, actor audit.Actor, id int64, price *int64, reason string) (CourseDTO, error) {
	var out CourseDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		c, err := s.repo.CourseTx(ctx, tx, id, true)
		if err != nil {
			return err
		}
		fields := map[string]string{}
		if price == nil || *price < 1 || *price > maxPriceSomoni {
			fields["price"] = "Цена — целое число сомони от 1 до 100 000"
		} else if money.FromSomoni(*price) == c.PriceDiram {
			fields["price"] = "Цена не изменилась"
		}
		if len([]rune(strings.TrimSpace(reason))) < 5 {
			fields["reason"] = "Укажите причину (минимум 5 символов)"
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные", fields)
		}
		before := c.PriceDiram.Somoni()
		c.PriceDiram = money.FromSomoni(*price)
		if err := s.repo.SaveCourse(ctx, tx, c); err != nil {
			return err
		}
		cid, name := courseEntity(c)
		if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.price", EntityType: "course", EntityID: cid, EntityName: name, Before: map[string]any{"price": before}, After: map[string]any{"price": *price}, Reason: strings.TrimSpace(reason)}); err != nil {
			return err
		}
		out, err = s.courseDTO(ctx, *c)
		return err
	})
	return out, err
}

// Publish публикует курс (BR-013: цена и ≥1 урок).
func (s *Service) Publish(ctx context.Context, actor audit.Actor, id int64) (CourseDTO, error) {
	var out CourseDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		c, err := s.repo.CourseTx(ctx, tx, id, true)
		if err != nil {
			return err
		}
		if !c.IsPlatform() {
			return apierr.Conflict("Собственный курс центра не публикуется в магазине")
		}
		if c.Status == StatusPublished {
			return apierr.Conflict("Курс уже опубликован")
		}
		if b := publishBlockers(*c); len(b) > 0 {
			return apierr.Validation("Нельзя опубликовать: "+strings.Join(b, "; "), nil)
		}
		c.Status = StatusPublished
		c.Note = ""
		if err := s.repo.SaveCourse(ctx, tx, c); err != nil {
			return err
		}
		cid, name := courseEntity(c)
		if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.published", EntityType: "course", EntityID: cid, EntityName: name, Before: map[string]any{"status": StatusDraft}, After: map[string]any{"status": StatusPublished}, Reason: "Курс доступен центрам для покупки"}); err != nil {
			return err
		}
		out, err = s.courseDTO(ctx, *c)
		return err
	})
	return out, err
}

// Unpublish снимает курс с публикации с причиной; доступ у купивших сохраняется (PLT-MKT-050).
func (s *Service) Unpublish(ctx context.Context, actor audit.Actor, id int64, reason string) (CourseDTO, error) {
	var out CourseDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		c, err := s.repo.CourseTx(ctx, tx, id, true)
		if err != nil {
			return err
		}
		if c.Status != StatusPublished {
			return apierr.Conflict("Курс не опубликован")
		}
		if len([]rune(strings.TrimSpace(reason))) < 5 {
			return apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
		}
		c.Status = StatusDraft
		if err := s.repo.SaveCourse(ctx, tx, c); err != nil {
			return err
		}
		cid, name := courseEntity(c)
		if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.unpublished", EntityType: "course", EntityID: cid, EntityName: name, Before: map[string]any{"status": StatusPublished}, After: map[string]any{"status": StatusDraft}, Reason: strings.TrimSpace(reason)}); err != nil {
			return err
		}
		out, err = s.courseDTO(ctx, *c)
		return err
	})
	return out, err
}

// SellResult — исход передачи курса.
type SellResult struct {
	Mode      string      `json:"mode"` // granted | invoice | paid
	InvoiceID *string     `json:"invoiceId"`
	Course    *CourseDTO  `json:"course"`
}

// Sell передаёт курс центру: invoice | balance | bonus (PLT-MKT-080).
func (s *Service) Sell(ctx context.Context, actor audit.Actor, centerID, courseID int64, mode, reason string) (SellResult, error) {
	var res SellResult
	err := s.db.Transaction(func(tx *gorm.DB) error {
		course, err := s.repo.CourseTx(ctx, tx, courseID, false)
		if err != nil {
			return err
		}
		mres, invID, err := s.sellTx(ctx, tx, actor, centerID, course, mode, reason)
		if err != nil {
			return err
		}
		dto, err := s.courseDTO(ctx, *course)
		if err != nil {
			return err
		}
		res = SellResult{Mode: mres, InvoiceID: invID, Course: &dto}
		return nil
	})
	return res, err
}

// sellTx — общая логика передачи курса внутри транзакции (используется Sell и requests.Process).
func (s *Service) sellTx(ctx context.Context, tx *gorm.DB, actor audit.Actor, centerID int64, course *Course, mode, reason string) (string, *string, error) {
	if !course.IsPlatform() {
		return "", nil, apierr.Conflict("Это собственный курс центра: передавать его нельзя")
	}
	if course.Status != StatusPublished {
		return "", nil, apierr.Conflict("Курс не опубликован: передать его центру нельзя")
	}
	center, err := s.repo.Center(ctx, tx, centerID)
	if err != nil {
		return "", nil, err
	}
	if center.Status != "active" {
		return "", nil, apierr.Conflict("Центр заблокирован: передача курса недоступна")
	}
	if a, err := s.repo.ActiveAccessTx(ctx, tx, centerID, course.ID); err != nil {
		return "", nil, err
	} else if a != nil {
		return "", nil, apierr.Conflict("Центр уже владеет курсом «" + course.Title + "»")
	}
	if open, err := s.billing.HasOpenCourseInvoice(ctx, tx, centerID, course.ID); err != nil {
		return "", nil, err
	} else if open {
		return "", nil, apierr.Conflict("По этому курсу уже выставлен счёт: оплатите или отмените его")
	}

	switch mode {
	case SourceBonus:
		if len([]rune(strings.TrimSpace(reason))) < 5 {
			return "", nil, apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
		}
		if err := s.grantBonus(ctx, tx, centerID, course, strings.TrimSpace(reason), actor); err != nil {
			return "", nil, err
		}
		return "granted", nil, nil
	case SourceBalance:
		available := center.BalanceDiram + center.OverdraftLimitDiram
		if available < course.PriceDiram {
			return "", nil, apierr.Field(fmt.Sprintf("Недостаточно средств на балансе на платформе (доступно %d сомони, нужно %d)", available.Somoni(), course.PriceDiram.Somoni()), "mode", "Не хватает баланса на платформе")
		}
		inv, err := s.billing.NewCourseInvoice(ctx, tx, centerID, course.ID, course.Title, course.PriceDiram, actor)
		if err != nil {
			return "", nil, err
		}
		if err := s.billing.SettleFromBalanceTx(ctx, tx, inv, actor); err != nil {
			return "", nil, err
		}
		return "paid", &inv.ID, nil
	case SourceInvoice:
		inv, err := s.billing.NewCourseInvoice(ctx, tx, centerID, course.ID, course.Title, course.PriceDiram, actor)
		if err != nil {
			return "", nil, err
		}
		return "invoice", &inv.ID, nil
	default:
		return "", nil, apierr.Field("Выберите способ передачи", "mode", "invoice | balance | bonus")
	}
}

func (s *Service) grantBonus(ctx context.Context, tx *gorm.DB, centerID int64, course *Course, reason string, actor audit.Actor) error {
	access := &Access{CenterID: centerID, CourseID: course.ID, Source: SourceBonus, Reason: reason, GrantedAt: now(), Status: AccessActive, VersionLessons: course.Lessons, VersionTests: course.Tests}
	if err := s.repo.CreateAccess(ctx, tx, access); err != nil {
		return err
	}
	cid, name := courseEntity(course)
	return s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.granted", EntityType: "course", EntityID: cid, EntityName: name, After: map[string]any{"center": centerID, "source": SourceBonus}, Reason: course.Title + " · бонус · " + reason})
}

// --- интерфейс billing.CourseGranter ---

// GrantFromInvoice передаёт курс центру после оплаты счёта (вызывается биллингом в транзакции оплаты).
func (s *Service) GrantFromInvoice(ctx context.Context, tx *gorm.DB, centerID, courseID int64, invoiceID string, actor audit.Actor) error {
	course, err := s.repo.CourseTx(ctx, tx, courseID, true) // блокировка: фиксируем версию (BR-015)
	if err != nil {
		return err
	}
	if a, err := s.repo.ActiveAccessTx(ctx, tx, centerID, courseID); err != nil {
		return err
	} else if a != nil {
		return apierr.Conflict("Центр уже владеет этим курсом")
	}
	id := invoiceID
	access := &Access{CenterID: centerID, CourseID: courseID, Source: SourceInvoice, InvoiceID: &id, GrantedAt: now(), Status: AccessActive, VersionLessons: course.Lessons, VersionTests: course.Tests}
	if err := s.repo.CreateAccess(ctx, tx, access); err != nil {
		return err
	}
	cid, name := courseEntity(course)
	if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.granted", EntityType: "course", EntityID: cid, EntityName: name, After: map[string]any{"center": centerID, "source": SourceInvoice}, Reason: course.Title + " · " + invoiceID}); err != nil {
		return err
	}
	if req, err := s.repo.RequestByInvoice(ctx, tx, invoiceID); err != nil {
		return err
	} else if req != nil && req.Status == ReqInvoiced {
		t := now()
		req.Status = ReqFulfilled
		req.DecidedAt = &t
		if err := s.repo.SaveRequest(ctx, tx, req); err != nil {
			return err
		}
	}
	return nil
}

// OnInvoiceCancelled возвращает заявку в статус «Новая» при отмене курс-счёта (PLT-MKT-070).
func (s *Service) OnInvoiceCancelled(ctx context.Context, tx *gorm.DB, invoiceID string) error {
	req, err := s.repo.RequestByInvoice(ctx, tx, invoiceID)
	if err != nil {
		return err
	}
	if req != nil && req.Status == ReqInvoiced {
		req.Status = ReqNew
		req.InvoiceID = nil
		req.DecidedAt = nil
		return s.repo.SaveRequest(ctx, tx, req)
	}
	return nil
}

func contains(xs []string, v string) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}
