package billing

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/internal/ledger"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

const subscriptionDays = 30 // платный период — 30 дней (BR-009)

// payChannels сопоставляет способ оплаты с каналом (как PAY_METHODS в api.js).
var payChannels = map[string]string{
	"Безнал (Р/С)":    "bank",
	"Наличные":        "cash",
	"Перевод на карту": "card",
}

var systemActor = audit.Actor{Name: "Платёжный шлюз", Role: "Система", Device: "webhook"}

// CourseGranter передаёт курс центру при оплате счёта вида course и откатывает заявку при
// отмене счёта. Реализуется модулем marketplace и внедряется через SetCourseGranter —
// так billing не импортирует marketplace (нет цикла). Вызовы идут в транзакции оплаты/отмены.
type CourseGranter interface {
	GrantFromInvoice(ctx context.Context, tx *gorm.DB, centerID, courseID int64, invoiceID string, actor audit.Actor) error
	OnInvoiceCancelled(ctx context.Context, tx *gorm.DB, invoiceID string) error
}

// Service реализует жизненный цикл счёта и оплату (PLT-BIL, money.md).
type Service struct {
	db      *gorm.DB
	repo    *Repository
	audit   *audit.Recorder
	idem    *idempotency.Store
	granter CourseGranter
}

// NewService создаёт сервис billing.
func NewService(repo *Repository, rec *audit.Recorder, idem *idempotency.Store) *Service {
	return &Service{db: repo.DB(), repo: repo, audit: rec, idem: idem}
}

// SetCourseGranter подключает передачу курсов (вызывается при сборке сервера).
func (s *Service) SetCourseGranter(g CourseGranter) { s.granter = g }

// EvidenceInput — основание «деньги поступили вне системы» (BR-002).
type EvidenceInput struct {
	Method         string `json:"method"`
	Reference      string `json:"reference"`
	ReceivedAmount int64  `json:"receivedAmount"` // сомони
	ReceivedOn     string `json:"receivedOn"`
	Comment        string `json:"comment"`
	Confirmed      bool   `json:"confirmed"`
}

// validateEvidence проверяет основание оплаты/пополнения. expected != nil — сумма обязана совпасть
// со счётом (оплата); nil — любая положительная (пополнение баланса). Возвращает ошибки и канал.
func validateEvidence(in EvidenceInput, expectedSomoni *int64, notBefore *time.Time) (map[string]string, string) {
	f := map[string]string{}
	channel, ok := payChannels[in.Method]
	if !ok {
		f["method"] = "Выберите способ оплаты"
	}
	if len(strings.TrimSpace(in.Reference)) < 3 {
		f["reference"] = "Укажите номер документа"
	}
	if expectedSomoni != nil {
		if in.ReceivedAmount != *expectedSomoni {
			f["receivedAmount"] = fmt.Sprintf("Сумма поступления должна совпадать со счётом (%d сомони). Частичная оплата не поддерживается", *expectedSomoni)
		}
	} else if in.ReceivedAmount < 1 || in.ReceivedAmount > 1_000_000 {
		f["receivedAmount"] = "Сумма — целое число сомони от 1 до 1 000 000"
	}
	day, err := time.Parse("2006-01-02", in.ReceivedOn)
	switch {
	case in.ReceivedOn == "" || err != nil:
		f["receivedOn"] = "Укажите дату поступления"
	case day.After(truncDay(time.Now())):
		f["receivedOn"] = "Дата поступления не может быть в будущем"
	case notBefore != nil && day.Before(truncDay(*notBefore)):
		f["receivedOn"] = "Оплата не могла поступить раньше выставления счёта"
	}
	if !in.Confirmed {
		f["confirmed"] = "Подтвердите, что деньги действительно поступили"
	}
	return f, channel
}

func truncDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// ---------- чтение ----------

// Get возвращает карточку счёта с историей событий.
func (s *Service) Get(ctx context.Context, id string) (InvoiceDTO, error) {
	inv, err := s.repo.Find(ctx, id)
	if err != nil {
		return InvoiceDTO{}, err
	}
	brief, err := s.repo.CenterBriefByID(ctx, inv.CenterID)
	if err != nil {
		return InvoiceDTO{}, err
	}
	events, err := s.repo.EventsFor(ctx, id)
	if err != nil {
		return InvoiceDTO{}, err
	}
	return toInvoiceDTO(*inv, brief, events), nil
}

// NewCourseInvoice создаёт счёт на курс (kind=course) внутри транзакции вызывающего (marketplace).
func (s *Service) NewCourseInvoice(ctx context.Context, tx *gorm.DB, centerID, courseID int64, title string, amount money.Diram, actor audit.Actor) (*Invoice, error) {
	inv := &Invoice{CenterID: centerID, Kind: KindCourse, CourseID: &courseID, Purpose: "Курс: " + title, AmountDiram: amount}
	if err := s.newInvoice(ctx, tx, inv, actor); err != nil {
		return nil, err
	}
	return inv, nil
}

// SettleFromBalanceTx оплачивает счёт с баланса внутри уже открытой транзакции (для marketplace balance-режима).
func (s *Service) SettleFromBalanceTx(ctx context.Context, tx *gorm.DB, inv *Invoice, actor audit.Actor) error {
	center, err := s.repo.Center(ctx, tx, inv.CenterID)
	if err != nil {
		return err
	}
	if center.Status != "active" {
		return apierr.Conflict("Центр заблокирован: списание недоступно")
	}
	if _, err := ledger.Charge(ctx, tx, inv.CenterID, inv.AmountDiram, ledger.Meta{
		Method: "Списание с баланса на платформе", Reference: inv.Purpose, InvoiceID: &inv.ID, ActorName: actor.Name,
	}); err != nil {
		return err
	}
	pay := Payment{
		Channel: "balance", Method: "Списание с баланса на платформе", Reference: "BAL-" + strings.TrimPrefix(inv.ID, "INV-"),
		ReceivedAmount: inv.AmountDiram.Somoni(), ReceivedOn: truncDay(time.Now()).Format("2006-01-02"),
		Via: "balance", ConfirmedBy: ActorRef{Name: actor.Name, Role: actor.Role},
	}
	return s.applyPaid(ctx, tx, inv, pay, actor)
}

// HasOpenCourseInvoice сообщает, есть ли у центра открытый счёт на этот курс (BR-014).
func (s *Service) HasOpenCourseInvoice(ctx context.Context, tx *gorm.DB, centerID, courseID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Model(&Invoice{}).
		Where("center_id = ? AND kind = ? AND course_id = ? AND status = ?", centerID, KindCourse, courseID, StatusPending).
		Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("billing: open course invoice: %w", err)
	}
	return n > 0, nil
}

// OpenInvoiceDTOs возвращает открытые счета центра как DTO (для finance.get).
func (s *Service) OpenInvoiceDTOs(ctx context.Context, centerID int64) ([]InvoiceDTO, error) {
	invs, err := s.repo.OpenInvoices(ctx, centerID)
	if err != nil {
		return nil, err
	}
	brief, err := s.repo.CenterBriefByID(ctx, centerID)
	if err != nil {
		return nil, err
	}
	out := make([]InvoiceDTO, 0, len(invs))
	for i := range invs {
		out = append(out, toInvoiceDTO(invs[i], brief, nil))
	}
	return out, nil
}

// ValidateEvidence — экспортированная проверка основания оплаты/пополнения (для finance).
func ValidateEvidence(in EvidenceInput, expectedSomoni *int64, notBefore *time.Time) (map[string]string, string) {
	return validateEvidence(in, expectedSomoni, notBefore)
}

// List возвращает счета по фильтрам и сводку.
func (s *Service) List(ctx context.Context, status, kind, q string) (ListResponse, error) {
	base, err := s.repo.List(ctx, "all", kind, strings.TrimSpace(q))
	if err != nil {
		return ListResponse{}, err
	}
	briefs, err := s.repo.CenterBriefs(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	return buildList(base, briefs, status), nil
}

// ---------- оплата ----------

// ConfirmPayment — ручное подтверждение оплаты счёта (PLT-BIL-040, BR-002). Идемпотентно.
func (s *Service) ConfirmPayment(ctx context.Context, actor audit.Actor, id string, in EvidenceInput, idemKey string) (InvoiceDTO, error) {
	return idempotency.Do(ctx, s.db, s.idem, "billing.confirm:"+id, idemKey, func(tx *gorm.DB) (InvoiceDTO, error) {
		inv, err := s.repo.FindForUpdate(ctx, tx, id)
		if err != nil {
			return InvoiceDTO{}, err
		}
		if inv.Status != StatusPending {
			return InvoiceDTO{}, alreadyClosed(inv)
		}
		expected := inv.AmountDiram.Somoni()
		fields, channel := validateEvidence(in, &expected, &inv.IssuedAt)
		if len(fields) > 0 {
			return InvoiceDTO{}, apierr.Validation("Проверьте данные оплаты", fields)
		}
		pay := Payment{
			Channel: channel, Method: in.Method, Reference: strings.TrimSpace(in.Reference),
			ReceivedAmount: in.ReceivedAmount, ReceivedOn: in.ReceivedOn, Comment: strings.TrimSpace(in.Comment),
			Via: "manual", ConfirmedBy: ActorRef{Name: actor.Name, Role: actor.Role},
		}
		if err := s.applyPaid(ctx, tx, inv, pay, actor); err != nil {
			return InvoiceDTO{}, err
		}
		return s.dtoTx(ctx, tx, inv)
	})
}

// PayFromBalance — оплата счёта списанием с баланса на платформе (PLT-BAL-040). Идемпотентно.
func (s *Service) PayFromBalance(ctx context.Context, actor audit.Actor, id, idemKey string) (InvoiceDTO, error) {
	return idempotency.Do(ctx, s.db, s.idem, "billing.pay-from-balance:"+id, idemKey, func(tx *gorm.DB) (InvoiceDTO, error) {
		inv, err := s.repo.FindForUpdate(ctx, tx, id)
		if err != nil {
			return InvoiceDTO{}, err
		}
		if inv.Status != StatusPending {
			return InvoiceDTO{}, alreadyClosed(inv)
		}
		center, err := s.repo.Center(ctx, tx, inv.CenterID)
		if err != nil {
			return InvoiceDTO{}, err
		}
		if center.Status != "active" {
			return InvoiceDTO{}, apierr.Conflict("Центр заблокирован: списание недоступно")
		}
		// Списание под FOR UPDATE внутри транзакции (BR-005). Если применение счёта далее
		// упадёт (центр не вмещается в тариф) — вся транзакция откатится, списания не будет.
		if _, err := ledger.Charge(ctx, tx, inv.CenterID, inv.AmountDiram, ledger.Meta{
			Method: "Списание с баланса на платформе", Reference: inv.Purpose, InvoiceID: &inv.ID, ActorName: actor.Name,
		}); err != nil {
			return InvoiceDTO{}, err
		}
		pay := Payment{
			Channel: "balance", Method: "Списание с баланса на платформе", Reference: "BAL-" + strings.TrimPrefix(inv.ID, "INV-"),
			ReceivedAmount: inv.AmountDiram.Somoni(), ReceivedOn: truncDay(time.Now()).Format("2006-01-02"),
			Via: "balance", ConfirmedBy: ActorRef{Name: actor.Name, Role: actor.Role},
		}
		if err := s.applyPaid(ctx, tx, inv, pay, actor); err != nil {
			return InvoiceDTO{}, err
		}
		return s.dtoTx(ctx, tx, inv)
	})
}

// PayOnline — МОК платёжного шлюза (на проде webhook). Канал online, маска карты, tx id. Идемпотентно.
func (s *Service) PayOnline(ctx context.Context, id, idemKey string) (InvoiceDTO, error) {
	return idempotency.Do(ctx, s.db, s.idem, "billing.pay-online:"+id, idemKey, func(tx *gorm.DB) (InvoiceDTO, error) {
		inv, err := s.repo.FindForUpdate(ctx, tx, id)
		if err != nil {
			return InvoiceDTO{}, err
		}
		if inv.Status != StatusPending {
			return InvoiceDTO{}, alreadyClosed(inv)
		}
		tail := strings.TrimPrefix(inv.ID, "INV-")
		txID := "TX-" + tail
		mask := "•••• 4242"
		pay := Payment{
			Channel: "online", Method: "Онлайн (карта)", Reference: "ONL-" + tail,
			ReceivedAmount: inv.AmountDiram.Somoni(), ReceivedOn: truncDay(time.Now()).Format("2006-01-02"),
			Via: "online", TxID: &txID, CardMask: &mask, ConfirmedBy: ActorRef{Name: systemActor.Name, Role: systemActor.Role},
		}
		if err := s.applyPaid(ctx, tx, inv, pay, systemActor); err != nil {
			return InvoiceDTO{}, err
		}
		return s.dtoTx(ctx, tx, inv)
	})
}

// Cancel отменяет неоплаченный счёт (BR-004); отсрочённая смена тарифа откатывается (PLT-TRF-030).
func (s *Service) Cancel(ctx context.Context, actor audit.Actor, id, reason string) (InvoiceDTO, error) {
	reason = strings.TrimSpace(reason)
	var out InvoiceDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		inv, err := s.repo.FindForUpdate(ctx, tx, id)
		if err != nil {
			return err
		}
		if inv.Status != StatusPending {
			return apierr.Conflict("Отменить можно только неоплаченный счёт")
		}
		if len([]rune(reason)) < 5 {
			return apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
		}
		revert := ""
		if inv.Kind == KindPlanChange && inv.Deferred {
			if err := s.revertDeferred(ctx, tx, inv, reason, actor); err != nil {
				return err
			}
			revert = " Тариф возвращён на «" + deref(inv.PlanFromName) + "»."
		}
		// Отмена курс-счёта возвращает связанную заявку в статус «Новая» (PLT-MKT-070).
		if inv.Kind == KindCourse && s.granter != nil {
			if err := s.granter.OnInvoiceCancelled(ctx, tx, inv.ID); err != nil {
				return err
			}
		}
		inv.Status = StatusCancelled
		if inv.Reason != "" {
			inv.Reason += " · "
		}
		inv.Reason += "Отменён: " + reason
		if err := s.repo.Save(ctx, tx, inv); err != nil {
			return err
		}
		if err := s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "cancelled", ActorName: actor.Name, ActorRole: actor.Role, Text: "Счёт отменён: " + reason + "." + revert}); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "invoice.cancelled", EntityType: "center", EntityID: itoa(inv.CenterID),
			Before: map[string]any{"status": StatusPending}, After: map[string]any{"status": StatusCancelled}, Reason: inv.ID + " · " + reason,
		}); err != nil {
			return err
		}
		out, err = s.dtoTx(ctx, tx, inv)
		return err
	})
	return out, err
}

// Remind отмечает отправку напоминания по открытым счетам (PLT-BIL-060).
func (s *Service) Remind(ctx context.Context, actor audit.Actor, ids []string) (map[string]int, error) {
	sent, skipped := 0, 0
	err := s.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		for _, id := range ids {
			inv, err := s.repo.FindForUpdate(ctx, tx, id)
			if err != nil {
				return err
			}
			if inv.Status != StatusPending {
				skipped++
				continue
			}
			inv.RemindedAt = &now
			if err := s.repo.Save(ctx, tx, inv); err != nil {
				return err
			}
			if err := s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "reminded", ActorName: actor.Name, ActorRole: actor.Role, Text: "Напоминание отправлено владельцу центра"}); err != nil {
				return err
			}
			sent++
		}
		return nil
	})
	return map[string]int{"sent": sent, "skipped": skipped}, err
}

// ---------- применение оплаты (единое место: ручная, с баланса, онлайн) ----------

func (s *Service) applyPaid(ctx context.Context, tx *gorm.DB, inv *Invoice, pay Payment, actor audit.Actor) error {
	if inv.Kind == KindCourse && s.granter == nil {
		return apierr.Conflict("Передача курсов недоступна: модуль маркетплейса не подключён")
	}
	if inv.Kind == KindPlanChange && !inv.Deferred {
		if err := s.checkFits(ctx, tx, inv.CenterID, deref(inv.PlanToID)); err != nil {
			return err
		}
	}
	now := time.Now().UTC()
	inv.Status = StatusPaid
	inv.Method, inv.Channel, inv.Reference = &pay.Method, &pay.Channel, pay.Reference
	inv.PaidAt, inv.PaidVia, inv.Payment = &now, &pay.Via, &pay
	if err := s.repo.Save(ctx, tx, inv); err != nil {
		return err
	}
	prefix := map[string]string{
		"online": "Оплата получена онлайн, подтверждена платёжным шлюзом: ",
		"balance": "Оплата списана с баланса на платформе: ",
		"manual":  "Оплата подтверждена вручную: ",
	}[pay.Via]
	if err := s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "paid", ActorName: actor.Name, ActorRole: actor.Role, Text: prefix + pay.Method + " · " + pay.Reference}); err != nil {
		return err
	}
	if err := s.audit.Log(ctx, tx, audit.Event{
		Actor: actor, Action: "invoice.paid", EntityType: "center", EntityID: itoa(inv.CenterID),
		Before: map[string]any{"status": StatusPending}, After: map[string]any{"status": StatusPaid, "method": pay.Method, "reference": pay.Reference},
		Reason: inv.ID + " · " + inv.Purpose,
	}); err != nil {
		return err
	}
	return s.applyEffect(ctx, tx, inv, actor)
}

func (s *Service) applyEffect(ctx context.Context, tx *gorm.DB, inv *Invoice, actor audit.Actor) error {
	switch {
	case inv.Kind == KindRenewal:
		return s.applyRenewal(ctx, tx, inv, actor)
	case inv.Kind == KindPlanChange && inv.Deferred:
		return s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "applied", ActorName: actor.Name, ActorRole: actor.Role, Text: "Оплата отсроченного счёта получена: тариф «" + deref(inv.PlanToName) + "» уже действует"})
	case inv.Kind == KindPlanChange:
		return s.applyPlanChangePaid(ctx, tx, inv, actor)
	case inv.Kind == KindCourse:
		if inv.CourseID == nil {
			return apierr.Conflict("Счёт курса без привязанного курса")
		}
		if err := s.granter.GrantFromInvoice(ctx, tx, inv.CenterID, *inv.CourseID, inv.ID, actor); err != nil {
			return err
		}
		return s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "applied", ActorName: actor.Name, ActorRole: actor.Role, Text: "Курс передан центру: появился в кабинете, раздел «Материалы и тесты»"})
	default:
		return s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "applied", ActorName: actor.Name, ActorRole: actor.Role, Text: "Покупка зачтена"})
	}
}

func (s *Service) applyRenewal(ctx context.Context, tx *gorm.DB, inv *Invoice, actor audit.Actor) error {
	center, err := s.repo.Center(ctx, tx, inv.CenterID)
	if err != nil {
		return err
	}
	base := time.Now().UTC()
	if center.ExpiresAt != nil && center.ExpiresAt.After(base) {
		base = *center.ExpiresAt
	}
	newExpires := base.AddDate(0, 0, subscriptionDays)
	if err := s.repo.SetCenterExpires(ctx, tx, inv.CenterID, &newExpires); err != nil {
		return err
	}
	if err := s.audit.Log(ctx, tx, audit.Event{
		Actor: actor, Action: "subscription.extended", EntityType: "center", EntityID: itoa(inv.CenterID),
		After: map[string]any{"expiresAt": newExpires}, Reason: inv.ID,
	}); err != nil {
		return err
	}
	return s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "applied", ActorName: actor.Name, ActorRole: actor.Role, Text: "Подписка продлена на 30 дней"})
}

func (s *Service) applyPlanChangePaid(ctx context.Context, tx *gorm.DB, inv *Invoice, actor audit.Actor) error {
	plan, err := s.repo.Plan(ctx, tx, deref(inv.PlanToID))
	if err != nil {
		return err
	}
	center, err := s.repo.Center(ctx, tx, inv.CenterID)
	if err != nil {
		return err
	}
	var expires *time.Time
	if plan.PriceDiram > 0 {
		e := time.Now().UTC().AddDate(0, 0, subscriptionDays)
		expires = &e
	}
	if err := s.repo.SetCenterPlan(ctx, tx, inv.CenterID, plan.ID, expires); err != nil {
		return err
	}
	if err := s.repo.CancelPendingRenewals(ctx, tx, inv.CenterID); err != nil {
		return err
	}
	if err := s.audit.Log(ctx, tx, audit.Event{
		Actor: actor, Action: "plan.changed", EntityType: "center", EntityID: itoa(inv.CenterID),
		Before: map[string]any{"plan": center.PlanName}, After: map[string]any{"plan": plan.Name}, Reason: inv.Reason + " · " + inv.ID,
	}); err != nil {
		return err
	}
	return s.repo.AddEvent(ctx, tx, Event{InvoiceID: inv.ID, Type: "applied", ActorName: actor.Name, ActorRole: actor.Role, Text: "Тариф изменён: «" + center.PlanName + "» → «" + plan.Name + "»"})
}

func (s *Service) revertDeferred(ctx context.Context, tx *gorm.DB, inv *Invoice, reason string, actor audit.Actor) error {
	prev, err := s.repo.Plan(ctx, tx, deref(inv.PlanFromID))
	if err != nil {
		return apierr.Conflict("Прежний тариф недоступен: откат невозможен")
	}
	if err := s.checkFitsPlan(ctx, tx, inv.CenterID, *prev); err != nil {
		return apierr.Conflict("Центр уже не вмещается в прежний тариф «" + prev.Name + "»: откат невозможен, оплатите счёт или сократите нагрузку")
	}
	if err := s.repo.SetCenterPlan(ctx, tx, inv.CenterID, prev.ID, inv.PlanFromExpiresAt); err != nil {
		return err
	}
	return s.audit.Log(ctx, tx, audit.Event{
		Actor: actor, Action: "plan.changed", EntityType: "center", EntityID: itoa(inv.CenterID),
		After: map[string]any{"plan": prev.Name}, Reason: "Откат: отсрочённый счёт " + inv.ID + " отменён · " + reason,
	})
}

// checkFits проверяет, вмещается ли центр в тариф по трём лимитам (BR-008).
func (s *Service) checkFits(ctx context.Context, tx *gorm.DB, centerID int64, planID string) error {
	plan, err := s.repo.Plan(ctx, tx, planID)
	if err != nil {
		return err
	}
	return s.checkFitsPlan(ctx, tx, centerID, *plan)
}

func (s *Service) checkFitsPlan(ctx context.Context, tx *gorm.DB, centerID int64, plan PlanInfo) error {
	c, err := s.repo.Center(ctx, tx, centerID)
	if err != nil {
		return err
	}
	over := func(used, limit int, label string) error {
		if used > limit {
			return apierr.Conflict(fmt.Sprintf("Центр уже не вмещается в тариф «%s» (%s: %d > %d). Отмените счёт и выберите другой тариф", plan.Name, label, used, limit))
		}
		return nil
	}
	if err := over(c.StaffUsed, plan.LimitStaff, "сотрудники"); err != nil {
		return err
	}
	if err := over(c.StorageUsedGB, plan.LimitStorageGB, "хранилище"); err != nil {
		return err
	}
	return over(c.BranchesUsed, plan.LimitBranches, "филиалы")
}

func (s *Service) dtoTx(ctx context.Context, tx *gorm.DB, inv *Invoice) (InvoiceDTO, error) {
	brief, err := s.repo.CenterBriefByIDTx(ctx, tx, inv.CenterID)
	if err != nil {
		return InvoiceDTO{}, err
	}
	events, err := s.repo.EventsForTx(ctx, tx, inv.ID)
	if err != nil {
		return InvoiceDTO{}, err
	}
	return toInvoiceDTO(*inv, brief, events), nil
}

func alreadyClosed(inv *Invoice) error {
	state := "закрыт"
	if inv.Status == StatusPaid {
		state = "оплачен"
	}
	return apierr.Conflict("Счёт " + inv.ID + " уже " + state)
}
