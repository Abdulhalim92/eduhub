package billing

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/internal/ledger"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

// PlanChangeRequest — тело POST /centers/{id}/plan-change (requestPlanChange).
type PlanChangeRequest struct {
	PlanID         string `json:"planId"`
	Reason         string `json:"reason"`
	PayFromBalance bool   `json:"payFromBalance"`
	DeferPayment   bool   `json:"deferPayment"`
	DeferConfirmed bool   `json:"deferConfirmed"`
}

// PlanChangeResponse — результат смены тарифа. mode: applied | invoice | paid | deferred.
type PlanChangeResponse struct {
	Mode    string      `json:"mode"`
	Invoice *InvoiceDTO `json:"invoice"`
}

// PlanOption — вариант смены тарифа (planOptions).
type PlanOption struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Price       money.Diram `json:"price"`
	Delta       int64       `json:"delta"` // сомони; может быть отрицательной
	Fits        bool        `json:"fits"`
	Payable     bool        `json:"payable"`
	Recommended bool        `json:"recommended"`
	Exceeded    []string    `json:"exceeded"`
}

// PlanChangeInfo — данные для диалога смены тарифа (planChangeInfo).
type PlanChangeInfo struct {
	Center  CenterBrief  `json:"center"`
	Options []PlanOption `json:"options"`
	Pending *InvoiceDTO  `json:"pending"`
}

// PlanChangeInfo возвращает варианты смены тарифа и текущий открытый счёт.
func (s *Service) PlanChangeInfo(ctx context.Context, centerID int64) (PlanChangeInfo, error) {
	center, err := s.repo.Center(ctx, s.db, centerID)
	if err != nil {
		return PlanChangeInfo{}, err
	}
	options, err := s.planOptions(ctx, center)
	if err != nil {
		return PlanChangeInfo{}, err
	}
	brief, err := s.repo.CenterBriefByID(ctx, centerID)
	if err != nil {
		return PlanChangeInfo{}, err
	}
	info := PlanChangeInfo{Center: brief, Options: options}
	if pc, err := s.repo.PendingByKind(ctx, centerID, KindPlanChange); err != nil {
		return PlanChangeInfo{}, err
	} else if pc != nil {
		dto := toInvoiceDTO(*pc, brief, nil)
		info.Pending = &dto
	}
	return info, nil
}

func (s *Service) planOptions(ctx context.Context, c *CenterInfo) ([]PlanOption, error) {
	plans, err := s.repo.ActivePlans(ctx)
	if err != nil {
		return nil, err
	}
	available := c.BalanceDiram + c.OverdraftLimitDiram
	out := make([]PlanOption, 0, len(plans))
	recIdx := -1
	for _, p := range plans {
		if p.ID == c.PlanID {
			continue
		}
		exceeded := fitExceed(c, p)
		opt := PlanOption{
			ID: p.ID, Name: p.Name, Price: p.PriceDiram,
			Delta:    p.PriceDiram.Somoni() - c.PlanPriceDiram.Somoni(),
			Fits:     len(exceeded) == 0,
			Payable:  p.PriceDiram == 0 || available >= p.PriceDiram,
			Exceeded: exceeded,
		}
		out = append(out, opt)
		// Рекомендуемый — самый дешёвый апгрейд, в который центр комфортно вмещается.
		if recIdx == -1 && opt.Delta > 0 && opt.Fits {
			recIdx = len(out) - 1
		}
	}
	if recIdx >= 0 {
		out[recIdx].Recommended = true
	}
	return out, nil
}

func fitExceed(c *CenterInfo, p PlanInfo) []string {
	var ex []string
	if c.StaffUsed > p.LimitStaff {
		ex = append(ex, fmt.Sprintf("сотрудники %d > %d", c.StaffUsed, p.LimitStaff))
	}
	if c.StorageUsedGB > p.LimitStorageGB {
		ex = append(ex, fmt.Sprintf("хранилище %d > %d", c.StorageUsedGB, p.LimitStorageGB))
	}
	if c.BranchesUsed > p.LimitBranches {
		ex = append(ex, fmt.Sprintf("филиалы %d > %d", c.BranchesUsed, p.LimitBranches))
	}
	return ex
}

// RequestPlanChange меняет тариф центра (BR-001/007/008/011/012, PLT-TRF-020/030). Идемпотентно.
func (s *Service) RequestPlanChange(ctx context.Context, actor audit.Actor, centerID int64, req PlanChangeRequest, idemKey string) (PlanChangeResponse, error) {
	return idempotency.Do(ctx, s.db, s.idem, "centers.plan-change:"+itoa(centerID), idemKey, func(tx *gorm.DB) (PlanChangeResponse, error) {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return PlanChangeResponse{}, err
		}
		if center.Status != "active" {
			return PlanChangeResponse{}, apierr.Conflict("Центр заблокирован: смена тарифа недоступна")
		}
		plan, err := s.repo.Plan(ctx, tx, req.PlanID)
		if err != nil {
			return PlanChangeResponse{}, err
		}
		if !plan.Active {
			return PlanChangeResponse{}, apierr.Field("Тариф «"+plan.Name+"» в архиве", "plan", "Тариф в архиве")
		}
		if plan.ID == center.PlanID {
			return PlanChangeResponse{}, apierr.Conflict("Центр уже на тарифе «" + plan.Name + "»")
		}
		if pc, err := s.repo.PendingByKind(ctx, centerID, KindPlanChange); err != nil {
			return PlanChangeResponse{}, err
		} else if pc != nil {
			return PlanChangeResponse{}, apierr.Conflict("Уже выставлен счёт на смену тарифа " + pc.ID + ": оплатите или отмените его")
		}

		reason := strings.TrimSpace(req.Reason)
		fields := map[string]string{}
		if ex := fitExceed(center, *plan); len(ex) > 0 {
			fields["plan"] = "Не вмещается: " + strings.Join(ex, "; ")
		}
		if len([]rune(reason)) < 5 {
			fields["reason"] = "Укажите причину (минимум 5 символов)"
		}
		available := center.BalanceDiram + center.OverdraftLimitDiram
		switch {
		case req.PayFromBalance && req.DeferPayment:
			fields["payment"] = "Выберите один способ: списать с баланса или отсрочить оплату"
		case req.DeferPayment && plan.PriceDiram > 0 && !req.DeferConfirmed:
			fields["payment"] = "Подтвердите, что тариф будет изменён до поступления оплаты"
		case req.PayFromBalance && plan.PriceDiram > 0 && available < plan.PriceDiram:
			fields["payment"] = fmt.Sprintf("Недостаточно средств на балансе на платформе (с учётом овердрафта): доступно %d сомони, нужно %d", available.Somoni(), plan.PriceDiram.Somoni())
		}
		if len(fields) > 0 {
			return PlanChangeResponse{}, apierr.Validation("Проверьте данные", fields)
		}

		// Переход на бесплатный тариф — сразу, без счёта (BR-001).
		if plan.PriceDiram == 0 {
			if err := s.setPlan(ctx, tx, center, plan, nil, reason, actor); err != nil {
				return PlanChangeResponse{}, err
			}
			return PlanChangeResponse{Mode: "applied"}, nil
		}

		inv, err := s.createPlanChangeInvoice(ctx, tx, center, plan, reason, actor)
		if err != nil {
			return PlanChangeResponse{}, err
		}

		switch {
		case req.PayFromBalance:
			if _, err := ledger.Charge(ctx, tx, centerID, inv.AmountDiram, ledger.Meta{
				Method: "Списание с баланса на платформе", Reference: inv.Purpose, InvoiceID: &inv.ID, ActorName: actor.Name,
			}); err != nil {
				return PlanChangeResponse{}, err
			}
			pay := Payment{Channel: "balance", Method: "Списание с баланса на платформе", Reference: "BAL-" + strings.TrimPrefix(inv.ID, "INV-"),
				ReceivedAmount: inv.AmountDiram.Somoni(), ReceivedOn: truncDay(time.Now()).Format("2006-01-02"), Via: "balance", ConfirmedBy: ActorRef{Name: actor.Name, Role: actor.Role}}
			if err := s.applyPaid(ctx, tx, inv, pay, actor); err != nil {
				return PlanChangeResponse{}, err
			}
			dto, err := s.dtoTx(ctx, tx, inv)
			return PlanChangeResponse{Mode: "paid", Invoice: &dto}, err

		case req.DeferPayment:
			inv.Deferred = true
			if err := s.repo.Save(ctx, tx, inv); err != nil {
				return PlanChangeResponse{}, err
			}
			due := "—"
			if inv.DueAt != nil {
				due = inv.DueAt.Format("02.01.2006")
			}
			if err := s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "deferred", ActorName: actor.Name, ActorRole: actor.Role, Text: "Тариф изменён до оплаты по решению SuperAdmin; оплата ожидается до " + due}); err != nil {
				return PlanChangeResponse{}, err
			}
			expires := time.Now().UTC().AddDate(0, 0, subscriptionDays)
			if err := s.setPlan(ctx, tx, center, plan, &expires, reason+" · с отсрочкой оплаты ("+inv.ID+")", actor); err != nil {
				return PlanChangeResponse{}, err
			}
			dto, err := s.dtoTx(ctx, tx, inv)
			return PlanChangeResponse{Mode: "deferred", Invoice: &dto}, err

		default:
			dto, err := s.dtoTx(ctx, tx, inv)
			return PlanChangeResponse{Mode: "invoice", Invoice: &dto}, err
		}
	})
}

// RenewalInvoice выставляет счёт на продление подписки (centers.invoice, BR-009).
func (s *Service) RenewalInvoice(ctx context.Context, actor audit.Actor, centerID int64) (InvoiceDTO, error) {
	var out InvoiceDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if pc, err := s.repo.PendingByKind(ctx, centerID, KindPlanChange); err != nil {
			return err
		} else if pc != nil {
			return apierr.Conflict("Есть неоплаченный счёт на смену тарифа " + pc.ID + ": оплатите или отмените его")
		}
		if open, err := s.repo.PendingByKind(ctx, centerID, KindRenewal); err != nil {
			return err
		} else if open != nil {
			return apierr.Conflict("Счёт уже выставлен: " + open.ID)
		}
		if center.PlanPriceDiram <= 0 {
			return apierr.Validation("Бесплатный тариф не продлевается счётом", nil)
		}
		inv := &Invoice{
			CenterID: centerID, Kind: KindRenewal,
			Purpose:     "Продление: тариф «" + center.PlanName + "» (1 мес)",
			AmountDiram: center.PlanPriceDiram,
		}
		if err := s.newInvoice(ctx, tx, inv, actor); err != nil {
			return err
		}
		out, err = s.dtoTx(ctx, tx, inv)
		return err
	})
	return out, err
}

func (s *Service) createPlanChangeInvoice(ctx context.Context, tx *gorm.DB, c *CenterInfo, p *PlanInfo, reason string, actor audit.Actor) (*Invoice, error) {
	fromName := c.PlanName
	inv := &Invoice{
		CenterID: c.ID, Kind: KindPlanChange,
		Purpose:      "Смена тарифа: «" + c.PlanName + "» → «" + p.Name + "» (1 мес)",
		AmountDiram:  p.PriceDiram,
		Reason:       reason,
		PlanFromID:   &c.PlanID,
		PlanFromName: &fromName,
		PlanToID:     &p.ID,
		PlanToName:   &p.Name,
		PlanFromExpiresAt: c.ExpiresAt,
	}
	if err := s.newInvoice(ctx, tx, inv, actor); err != nil {
		return nil, err
	}
	return inv, nil
}

// newInvoice присваивает номер, срок 7 дней, пишет событие «выставлен» и аудит.
func (s *Service) newInvoice(ctx context.Context, tx *gorm.DB, inv *Invoice, actor audit.Actor) error {
	id, err := s.repo.NextInvoiceID(ctx, tx)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	due := now.AddDate(0, 0, 7)
	inv.ID = id
	inv.Status = StatusPending
	inv.IssuedAt = now
	inv.DueAt = &due
	if err := s.repo.Create(ctx, tx, inv); err != nil {
		return err
	}
	if err := s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "issued", ActorName: actor.Name, ActorRole: actor.Role, Text: "Счёт выставлен"}); err != nil {
		return err
	}
	return s.audit.Log(ctx, tx, audit.Event{
		Actor: actor, Action: "invoice.created", EntityType: "center", EntityID: itoa(inv.CenterID),
		After: map[string]any{"id": inv.ID, "amount": inv.AmountDiram.Somoni(), "kind": inv.Kind}, Reason: inv.Purpose,
	})
}

// setPlan меняет тариф центра, отменяет открытые счета на продление и пишет аудит.
func (s *Service) setPlan(ctx context.Context, tx *gorm.DB, c *CenterInfo, p *PlanInfo, expires *time.Time, reason string, actor audit.Actor) error {
	if err := s.repo.SetCenterPlan(ctx, tx, c.ID, p.ID, expires); err != nil {
		return err
	}
	if err := s.repo.CancelPendingRenewals(ctx, tx, c.ID); err != nil {
		return err
	}
	return s.audit.Log(ctx, tx, audit.Event{
		Actor: actor, Action: "plan.changed", EntityType: "center", EntityID: itoa(c.ID),
		Before: map[string]any{"plan": c.PlanName}, After: map[string]any{"plan": p.Name}, Reason: reason,
	})
}

func centerIDParam(c *gin.Context) (int64, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return 0, apierr.New(apierr.CodeValidation, "Некорректный идентификатор центра")
	}
	return id, nil
}
