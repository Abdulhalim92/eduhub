package cashier

import (
	"context"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

// OpenShiftRequest — тело открытия смены.
type OpenShiftRequest struct {
	CashierName string `json:"cashierName"`
}

// OpenShift открывает кассовую смену. Одновременно открыта не более одной смены на центр.
func (s *Service) OpenShift(ctx context.Context, actor audit.Actor, centerID int64, req OpenShiftRequest) (ShiftDTO, error) {
	var out ShiftDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "открывать смену"); err != nil {
			return err
		}
		if open, err := s.repo.OpenShift(ctx, tx, centerID); err != nil {
			return err
		} else if open != nil {
			return apierr.Conflict("Смена уже открыта — закройте её перед открытием новой")
		}
		sh := &CashShift{CenterID: centerID, CashierName: req.CashierName, OpenedAt: time.Now().UTC(), Status: ShiftOpen}
		if err := s.repo.CreateShift(ctx, tx, sh); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "cash.shift_opened", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"shift": sh.ID, "cashier": req.CashierName}, Reason: "Открыта кассовая смена",
		}); err != nil {
			return err
		}
		out = shiftToDTO(sh)
		return nil
	})
	return out, err
}

// CloseShift закрывает смену и возвращает Z-отчёт. Повторное закрытие — не ошибка (идемпотентно).
func (s *Service) CloseShift(ctx context.Context, actor audit.Actor, centerID, shiftID int64) (ZReport, error) {
	var out ZReport
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		sh, err := s.repo.FindShift(ctx, tx, centerID, shiftID)
		if err != nil {
			return err
		}
		if sh.Status == ShiftOpen {
			now := time.Now().UTC()
			sh.Status = ShiftClosed
			sh.ClosedAt = &now
			if err := s.repo.SaveShift(ctx, tx, sh); err != nil {
				return err
			}
			if err := s.audit.Log(ctx, tx, audit.Event{
				Actor: actor, Action: "cash.shift_closed", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
				After: map[string]any{"shift": sh.ID}, Reason: "Закрыта кассовая смена",
			}); err != nil {
				return err
			}
		}
		z, err := s.zReport(ctx, sh)
		if err != nil {
			return err
		}
		out = z
		return nil
	})
	return out, err
}

// GetShift возвращает Z-отчёт смены на текущий момент.
func (s *Service) GetShift(ctx context.Context, centerID, shiftID int64) (ZReport, error) {
	sh, err := s.repo.FindShift(ctx, s.db, centerID, shiftID)
	if err != nil {
		return ZReport{}, err
	}
	return s.zReport(ctx, sh)
}

// zReport собирает Z-отчёт из оплат смены: выручка по способам (оплаченные) и возвраты.
func (s *Service) zReport(ctx context.Context, sh *CashShift) (ZReport, error) {
	ps, err := s.repo.PaymentsInShift(ctx, sh.ID)
	if err != nil {
		return ZReport{}, err
	}
	// Классический Z-отчёт: валовая выручка (все проведённые оплаты смены) по способам,
	// отдельно сумма возвратов; итог (net) = выручка − возвраты.
	z := ZReport{Shift: shiftToDTO(sh)}
	for i := range ps {
		p := ps[i]
		z.Payments++
		z.Gross += p.FinalDiram
		switch p.Method {
		case MethodCash:
			z.Cash += p.FinalDiram
		case MethodPOS:
			z.POS += p.FinalDiram
		case MethodCard:
			z.Card += p.FinalDiram
		}
		if p.Status == PayRefunded {
			z.Refunds += p.FinalDiram
			z.Refunded++
		}
	}
	z.Net = z.Gross - z.Refunds
	if z.Net < 0 {
		z.Net = money.Diram(0)
	}
	return z, nil
}
