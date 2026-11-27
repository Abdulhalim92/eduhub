package cashier

import (
	"context"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

// ChargeRequest — тело приёма оплаты. Суммы — в сомони (контракт api.js), баллы — целые.
type ChargeRequest struct {
	StudentID    int64       `json:"studentId"`
	GroupID      *int64      `json:"groupId"`
	Purpose      string      `json:"purpose"`
	Amount       money.Diram `json:"amount"`
	Method       string      `json:"method"`
	Lessons      int         `json:"lessons"`
	DiscountCoin int         `json:"discountCoin"`
	CashierName  string      `json:"cashierName"`
}

// Charge принимает оплату: считает скидку за баллы, печатает чек, начисляет оплаченные уроки,
// привязывает к открытой смене. Атомарно и идемпотентно по Idempotency-Key (money.md).
func (s *Service) Charge(ctx context.Context, actor audit.Actor, centerID int64, req ChargeRequest, idemKey string) (PaymentDTO, error) {
	if !payMethods[req.Method] {
		return PaymentDTO{}, apierr.Field("Выберите способ оплаты", "method", "cash | pos | card")
	}
	if req.Amount < money.FromSomoni(1) {
		return PaymentDTO{}, apierr.Field("Сумма оплаты — минимум 1 сомони", "amount", "Минимум 1")
	}
	if req.Lessons < 0 {
		return PaymentDTO{}, apierr.Field("Число уроков не может быть отрицательным", "lessons", "Минимум 0")
	}
	if req.DiscountCoin < 0 {
		return PaymentDTO{}, apierr.Field("Баллы для скидки не могут быть отрицательными", "discountCoin", "Минимум 0")
	}
	if req.Lessons > 0 && req.GroupID == nil {
		return PaymentDTO{}, apierr.Field("Для оплаты уроков укажите группу", "groupId", "Группа обязательна")
	}

	return idempotency.Do(ctx, s.db, s.idem, "cashier.charge", idemKey, func(tx *gorm.DB) (PaymentDTO, error) {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return PaymentDTO{}, err
		}
		if err := writable(center, "принимать оплату"); err != nil {
			return PaymentDTO{}, err
		}
		if _, ok, err := s.repo.StudentInCenter(ctx, tx, centerID, req.StudentID); err != nil {
			return PaymentDTO{}, err
		} else if !ok {
			return PaymentDTO{}, apierr.Field("Ученик не найден в этом центре", "studentId", "Неизвестный ученик")
		}
		if req.GroupID != nil {
			if ok, err := s.repo.GroupInCenter(ctx, tx, centerID, *req.GroupID); err != nil {
				return PaymentDTO{}, err
			} else if !ok {
				return PaymentDTO{}, apierr.Field("Группа не найдена в этом центре", "groupId", "Неизвестная группа")
			}
		}

		set, err := s.repo.Settings(ctx, tx, centerID)
		if err != nil {
			return PaymentDTO{}, err
		}
		if set == nil {
			set = defaultSettings(centerID)
		}

		// Скидка за баллы: не выше того, что даёт курс и остаток баллов, и не выше потолка процента.
		var discount money.Diram
		coinsSpent := 0
		if req.DiscountCoin > 0 {
			coin, err := s.repo.StudentCoinForUpdate(ctx, tx, req.StudentID)
			if err != nil {
				return PaymentDTO{}, err
			}
			if req.DiscountCoin > coin {
				return PaymentDTO{}, apierr.Field("Недостаточно баллов у ученика", "discountCoin", "Не больше остатка баллов")
			}
			requestedSomoni := int64(req.DiscountCoin / set.CoinRate) // курс: баллов за 1 сомони
			capDiram := money.Diram(int64(req.Amount) * int64(set.MaxDiscountPct) / 100)
			capSomoni := capDiram.Somoni()
			grantedSomoni := requestedSomoni
			if grantedSomoni > capSomoni {
				grantedSomoni = capSomoni
			}
			discount = money.FromSomoni(grantedSomoni)
			coinsSpent = int(grantedSomoni) * set.CoinRate
		}
		final := req.Amount - discount
		if final < 0 {
			final = money.Diram(0)
		}

		open, err := s.repo.OpenShift(ctx, tx, centerID)
		if err != nil {
			return PaymentDTO{}, err
		}
		var shiftID *int64
		if open != nil {
			shiftID = &open.ID
		}
		receiptNo, err := s.repo.NextReceiptNo(ctx, tx)
		if err != nil {
			return PaymentDTO{}, err
		}

		p := &Payment{
			CenterID: centerID, StudentID: req.StudentID, GroupID: req.GroupID, Purpose: req.Purpose,
			AmountDiram: req.Amount, DiscountCoin: coinsSpent, DiscountDiram: discount, FinalDiram: final,
			Method: req.Method, Lessons: req.Lessons, ShiftID: shiftID, Status: PayPaid,
			ReceiptNo: receiptNo, CashierName: req.CashierName, CreatedAt: time.Now().UTC(),
		}
		if err := s.repo.CreatePayment(ctx, tx, p); err != nil {
			return PaymentDTO{}, err
		}
		if coinsSpent > 0 {
			if err := s.repo.SpendStudentCoin(ctx, tx, req.StudentID, coinsSpent); err != nil {
				return PaymentDTO{}, err
			}
		}
		if req.Lessons > 0 && req.GroupID != nil {
			if _, err := s.repo.AddLessons(ctx, tx, req.StudentID, *req.GroupID, req.Lessons); err != nil {
				return PaymentDTO{}, err
			}
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "payment.created", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"payment": p.ID, "receipt": receiptNo, "student": req.StudentID, "amount": req.Amount.Somoni(),
				"discount": discount.Somoni(), "final": final.Somoni(), "lessons": req.Lessons, "method": req.Method},
			Reason: "Принята оплата",
		}); err != nil {
			return PaymentDTO{}, err
		}
		return paymentToDTO(p), nil
	})
}

// Refund оформляет возврат по чеку: сторно (статус refunded, запись не удаляется), причина обязательна.
// Возврат снимает начисленные уроки (не ниже 0) и возвращает списанные баллы.
func (s *Service) Refund(ctx context.Context, actor audit.Actor, centerID, paymentID int64, reason string) (PaymentDTO, error) {
	if reason == "" {
		return PaymentDTO{}, apierr.Field("Укажите причину возврата", "reason", "Причина обязательна")
	}
	var out PaymentDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		p, err := s.repo.FindPayment(ctx, tx, centerID, paymentID)
		if err != nil {
			return err
		}
		if p.Status != PayPaid {
			return apierr.Conflict("Возврат возможен только по оплаченному чеку")
		}
		now := time.Now().UTC()
		p.Status = PayRefunded
		p.RefundReason = reason
		p.RefundedAt = &now
		if err := s.repo.SavePayment(ctx, tx, p); err != nil {
			return err
		}
		// Откатываем побочные эффекты оплаты.
		if p.Lessons > 0 && p.GroupID != nil {
			if _, err := s.repo.AddLessons(ctx, tx, p.StudentID, *p.GroupID, -p.Lessons); err != nil {
				return err
			}
		}
		if p.DiscountCoin > 0 {
			if err := s.repo.SpendStudentCoin(ctx, tx, p.StudentID, -p.DiscountCoin); err != nil {
				return err
			}
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "payment.refunded", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			Before: map[string]any{"status": PayPaid}, After: map[string]any{"payment": p.ID, "receipt": p.ReceiptNo, "final": p.FinalDiram.Somoni()},
			Reason: reason,
		}); err != nil {
			return err
		}
		out = paymentToDTO(p)
		return nil
	})
	return out, err
}

// ListPayments возвращает чеки центра (опциональный фильтр по статусу).
func (s *Service) ListPayments(ctx context.Context, centerID int64, status string) ([]PaymentDTO, error) {
	if _, err := s.repo.Center(ctx, s.db, centerID); err != nil {
		return nil, err
	}
	ps, err := s.repo.Payments(ctx, centerID)
	if err != nil {
		return nil, err
	}
	out := make([]PaymentDTO, 0, len(ps))
	for i := range ps {
		if status != "" && ps[i].Status != status {
			continue
		}
		out = append(out, paymentToDTO(&ps[i]))
	}
	return out, nil
}
