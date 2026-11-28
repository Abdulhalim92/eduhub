package journal

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// BudgetRequest — тело установки бюджета баллов группы.
type BudgetRequest struct {
	Period string `json:"period"` // week | month
	Amount int    `json:"amount"`
}

// BudgetDTO — бюджет баллов группы с остатком за текущий период.
type BudgetDTO struct {
	GroupID   int64  `json:"groupId"`
	Period    string `json:"period"`
	Amount    int    `json:"amount"`
	Spent     int    `json:"spent"`
	Remaining int    `json:"remaining"`
}

// periodStart возвращает начало текущего периода (неделя с понедельника или месяц).
func periodStart(period string, now time.Time) time.Time {
	n := dayOf(now)
	if period == "month" {
		return time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, time.UTC)
	}
	// week: до понедельника
	offset := weekdayIndex(int(n.Weekday()))
	return n.AddDate(0, 0, -offset)
}

// SetBudget задаёт бюджет бонусных баллов на группу (LRN-TCH-040).
func (s *Service) SetBudget(ctx context.Context, centerID, groupID int64, req BudgetRequest) (BudgetDTO, error) {
	var out BudgetDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "задавать бюджет баллов"); err != nil {
			return err
		}
		if _, err := s.repo.Group(ctx, tx, centerID, groupID); err != nil {
			return err
		}
		if req.Period != "week" && req.Period != "month" {
			return apierr.Field("Выберите период", "period", "week | month")
		}
		if req.Amount < 0 || req.Amount > 1_000_000 {
			return apierr.Field("Бюджет — целое число баллов от 0", "amount", "0..1000000")
		}
		b := &GroupPointBudget{GroupID: groupID, Period: req.Period, Amount: req.Amount}
		if err := s.repo.UpsertBudget(ctx, tx, b); err != nil {
			return err
		}
		spent, err := s.repo.SpentSince(ctx, tx, groupID, periodStart(req.Period, time.Now().UTC()))
		if err != nil {
			return err
		}
		out = BudgetDTO{GroupID: groupID, Period: req.Period, Amount: req.Amount, Spent: spent, Remaining: req.Amount - spent}
		return nil
	})
	return out, err
}

// GetBudget возвращает бюджет группы и остаток за период.
func (s *Service) GetBudget(ctx context.Context, centerID, groupID int64) (BudgetDTO, error) {
	if _, err := s.repo.Group(ctx, s.db, centerID, groupID); err != nil {
		return BudgetDTO{}, err
	}
	b, err := s.repo.Budget(ctx, s.db, groupID)
	if err != nil {
		return BudgetDTO{}, err
	}
	if b == nil {
		return BudgetDTO{GroupID: groupID}, nil
	}
	spent, err := s.repo.SpentSince(ctx, s.db, groupID, periodStart(b.Period, time.Now().UTC()))
	if err != nil {
		return BudgetDTO{}, err
	}
	return BudgetDTO{GroupID: groupID, Period: b.Period, Amount: b.Amount, Spent: spent, Remaining: b.Amount - spent}, nil
}

// GrantPointsRequest — тело начисления бонусных баллов.
type GrantPointsRequest struct {
	StudentID int64  `json:"studentId"`
	Amount    int    `json:"amount"`
	Reason    string `json:"reason"`
	LessonID  *int64 `json:"lessonId"`
}

// GrantPointsResult — результат начисления.
type GrantPointsResult struct {
	StudentID int64 `json:"studentId"`
	Coin      int   `json:"coin"`
	Remaining int   `json:"remaining"`
}

// GrantPoints начисляет бонусные баллы ученику в пределах бюджета группы (LRN-TCH-040).
func (s *Service) GrantPoints(ctx context.Context, actor audit.Actor, centerID, groupID int64, req GrantPointsRequest) (GrantPointsResult, error) {
	reason := strings.TrimSpace(req.Reason)
	var out GrantPointsResult
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "начислять баллы"); err != nil {
			return err
		}
		if _, err := s.repo.Group(ctx, tx, centerID, groupID); err != nil {
			return err
		}
		fields := map[string]string{}
		if req.Amount < 1 || req.Amount > 10000 {
			fields["amount"] = "Количество — целое число от 1 до 10 000"
		}
		if len([]rune(reason)) < 5 {
			fields["reason"] = "Минимум 5 символов"
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные начисления", fields)
		}
		if ok, err := s.repo.StudentInGroup(ctx, tx, centerID, groupID, req.StudentID); err != nil {
			return err
		} else if !ok {
			return apierr.Conflict("Ученик не из этой группы")
		}
		if _, active, err := s.repo.StudentActive(ctx, tx, centerID, req.StudentID); err != nil {
			return err
		} else if !active {
			return apierr.Conflict("Ученик заблокирован: начислять баллы нельзя")
		}
		budget, err := s.repo.Budget(ctx, tx, groupID)
		if err != nil {
			return err
		}
		if budget == nil {
			return apierr.Conflict("Сначала задайте бюджет баллов группы")
		}
		spent, err := s.repo.SpentSince(ctx, tx, groupID, periodStart(budget.Period, time.Now().UTC()))
		if err != nil {
			return err
		}
		remaining := budget.Amount - spent
		if req.Amount > remaining {
			return apierr.Field(fmt.Sprintf("Превышен бюджет баллов группы: доступно %d", remaining), "amount", "Недостаточно бюджета")
		}
		coin, err := s.repo.AddStudentCoin(ctx, tx, req.StudentID, int64(req.Amount))
		if err != nil {
			return err
		}
		if err := s.repo.CreatePointGrant(ctx, tx, &PointGrant{CenterID: centerID, GroupID: groupID, StudentID: req.StudentID, LessonID: req.LessonID, Amount: req.Amount, Reason: reason, At: time.Now().UTC()}); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "coin.granted", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"student": req.StudentID, "coin": coin}, Reason: "Баллы за успехи · +" + strconv.Itoa(req.Amount) + " · " + reason,
		}); err != nil {
			return err
		}
		out = GrantPointsResult{StudentID: req.StudentID, Coin: coin, Remaining: remaining - req.Amount}
		return nil
	})
	return out, err
}
