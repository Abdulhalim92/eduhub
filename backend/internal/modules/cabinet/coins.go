package cabinet

import (
	"context"
	"sort"
	"strconv"
	"strings"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// CoinRuleDTO — автоправило для ответа (ruleDto).
type CoinRuleDTO struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Scope       string `json:"scope"`
	ScopeLabel  string `json:"scopeLabel"`
	Threshold   int    `json:"threshold"`
	Coin        int    `json:"coin"`
	Active      bool   `json:"active"`
	Condition   string `json:"condition"`
	StatusLabel string `json:"statusLabel"`
}

func coinRuleToDTO(r CoinRule) CoinRuleDTO {
	label := "Выключено"
	if r.Active {
		label = "Активно"
	}
	return CoinRuleDTO{
		ID: r.ID, Name: r.Name, Scope: r.Scope, ScopeLabel: coinScopes[r.Scope], Threshold: r.Threshold, Coin: r.Coin,
		Active: r.Active, Condition: "Средний % ≥ " + strconv.Itoa(r.Threshold), StatusLabel: label,
	}
}

// CoinRulesListResponse — ответ cabinet.coinRules.list.
type CoinRulesListResponse struct {
	Center   centers.DTO       `json:"center"`
	Items    []CoinRuleDTO     `json:"items"`
	Total    int               `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
	Scopes   map[string]string `json:"scopes"`
}

// CoinRulesList возвращает автоправила центра (CTR-CIN-010).
func (s *Service) CoinRulesList(ctx context.Context, centerID int64, scope string, page, pageSize int) (CoinRulesListResponse, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return CoinRulesListResponse{}, err
	}
	list, total, err := s.repo.CoinRulesList(ctx, centerID, scope, (page-1)*pageSize, pageSize)
	if err != nil {
		return CoinRulesListResponse{}, err
	}
	items := make([]CoinRuleDTO, 0, len(list))
	for _, r := range list {
		items = append(items, coinRuleToDTO(r))
	}
	return CoinRulesListResponse{Center: centerDTO, Items: items, Total: total, Page: page, PageSize: pageSize, Scopes: coinScopes}, nil
}

// CoinRuleRequest — тело создания/правки правила (поля опциональны при правке).
type CoinRuleRequest struct {
	Name      *string `json:"name"`
	Scope     *string `json:"scope"`
	Threshold *int    `json:"threshold"`
	Coin      *int    `json:"coin"`
	Active    *bool   `json:"active"`
}

func validateRule(name, scope string, threshold, coin int) *apierr.Error {
	fields := map[string]string{}
	if n := len([]rune(strings.TrimSpace(name))); n < 3 || n > 80 {
		fields["name"] = "Название — от 3 до 80 символов"
	}
	if coinScopes[scope] == "" {
		fields["scope"] = "Выберите область"
	}
	if threshold < 1 || threshold > 100 {
		fields["threshold"] = "Порог — от 1 до 100 %"
	}
	if coin < 1 || coin > 10000 {
		fields["coin"] = "Награда — от 1 до 10 000 coin"
	}
	if len(fields) > 0 {
		return apierr.Validation("Проверьте данные правила", fields)
	}
	return nil
}

// CreateCoinRule добавляет автоправило (CTR-CIN-010).
func (s *Service) CreateCoinRule(ctx context.Context, centerID int64, req CoinRuleRequest) (CoinRuleDTO, error) {
	var out CoinRuleDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "добавлять правила"); err != nil {
			return err
		}
		name, scope := deref(req.Name), deref(req.Scope)
		threshold, coin := 0, 0
		if req.Threshold != nil {
			threshold = *req.Threshold
		}
		if req.Coin != nil {
			coin = *req.Coin
		}
		if verr := validateRule(name, scope, threshold, coin); verr != nil {
			return verr
		}
		cr := &CoinRule{CenterID: centerID, Name: strings.TrimSpace(name), Scope: scope, Threshold: threshold, Coin: coin, Active: true}
		if err := s.repo.CreateCoinRule(ctx, tx, cr); err != nil {
			return err
		}
		out = coinRuleToDTO(*cr)
		return nil
	})
	return out, err
}

// UpdateCoinRule меняет правило или переключает его активность (CTR-CIN-010).
func (s *Service) UpdateCoinRule(ctx context.Context, centerID, ruleID int64, req CoinRuleRequest) (CoinRuleDTO, error) {
	var out CoinRuleDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		cr, err := s.repo.FindCoinRule(ctx, tx, centerID, ruleID)
		if err != nil {
			return err
		}
		if err := writable(center, "менять правила"); err != nil {
			return err
		}
		if req.Name != nil || req.Scope != nil || req.Threshold != nil || req.Coin != nil {
			name := valueOr(req.Name, cr.Name)
			scope := valueOr(req.Scope, cr.Scope)
			threshold := intOr(req.Threshold, cr.Threshold)
			coin := intOr(req.Coin, cr.Coin)
			if verr := validateRule(name, scope, threshold, coin); verr != nil {
				return verr
			}
			cr.Name, cr.Scope, cr.Threshold, cr.Coin = strings.TrimSpace(name), scope, threshold, coin
		}
		if req.Active != nil {
			cr.Active = *req.Active
		}
		if err := s.repo.SaveCoinRule(ctx, tx, cr); err != nil {
			return err
		}
		out = coinRuleToDTO(*cr)
		return nil
	})
	return out, err
}

// --- аналитика coin (CTR-COI/ANL) ---

// AnalyticsTotals — итоги по coin центра.
type AnalyticsTotals struct {
	Students int `json:"students"`
	Coin     int `json:"coin"`
	Avg      int `json:"avg"`
}

// AnalyticsResponse — ответ cabinet.analytics.list.
type AnalyticsResponse struct {
	Center   centers.DTO     `json:"center"`
	Items    []StudentDTO    `json:"items"`
	Total    int             `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
	Totals   AnalyticsTotals `json:"totals"`
	Groups   []GroupRef      `json:"groups"`
}

// Analytics возвращает рейтинг учеников по coin и итоги (CTR-COI-010).
func (s *Service) Analytics(ctx context.Context, centerID int64, groupID *int64, coinFrom, coinTo *int, q string, page, pageSize int) (AnalyticsResponse, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return AnalyticsResponse{}, err
	}
	all, err := s.repo.StudentsByCenter(ctx, centerID)
	if err != nil {
		return AnalyticsResponse{}, err
	}
	groups, err := s.repo.GroupsByCenter(ctx, centerID)
	if err != nil {
		return AnalyticsResponse{}, err
	}
	groupByID := map[int64]Group{}
	refs := []GroupRef{}
	for _, g := range groups {
		groupByID[g.ID] = g
		refs = append(refs, GroupRef{ID: g.ID, Name: g.Name})
	}

	totalCoin := 0
	for _, st := range all {
		totalCoin += st.Coin
	}
	totals := AnalyticsTotals{Students: len(all), Coin: totalCoin}
	if len(all) > 0 {
		totals.Avg = int(float64(totalCoin)/float64(len(all)) + 0.5)
	}

	term := strings.ToLower(strings.TrimSpace(q))
	filtered := make([]Student, 0, len(all))
	for _, st := range all {
		if groupID != nil && (st.GroupID == nil || *st.GroupID != *groupID) {
			continue
		}
		if coinFrom != nil && st.Coin < *coinFrom {
			continue
		}
		if coinTo != nil && st.Coin > *coinTo {
			continue
		}
		if term != "" && !strings.Contains(strings.ToLower(st.Name), term) {
			continue
		}
		filtered = append(filtered, st)
	}
	sort.SliceStable(filtered, func(i, j int) bool {
		if filtered[i].Coin != filtered[j].Coin {
			return filtered[i].Coin > filtered[j].Coin
		}
		return filtered[i].ID < filtered[j].ID
	})

	total := len(filtered)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	items := make([]StudentDTO, 0, end-start)
	for _, st := range filtered[start:end] {
		var grp *Group
		if st.GroupID != nil {
			if g, ok := groupByID[*st.GroupID]; ok {
				grp = &g
			}
		}
		items = append(items, studentDTO(st, grp, false))
	}
	return AnalyticsResponse{Center: centerDTO, Items: items, Total: total, Page: page, PageSize: pageSize, Totals: totals, Groups: refs}, nil
}

// GrantCoin начисляет coin ученику вручную (CTR-COI-010, BR-011/012). Необратимо, пишется в аудит.
func (s *Service) GrantCoin(ctx context.Context, actor audit.Actor, centerID, studentID int64, amount int, reason string) (StudentDTO, error) {
	reason = strings.TrimSpace(reason)
	var out StudentDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		st, err := s.repo.FindStudent(ctx, tx, centerID, studentID)
		if err != nil {
			return err
		}
		fields := map[string]string{}
		if amount < 1 || amount > 10000 {
			fields["amount"] = "Количество — целое число от 1 до 10 000"
		}
		if len([]rune(reason)) < 5 {
			fields["reason"] = "Минимум 5 символов"
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные начисления", fields)
		}
		if err := writable(center, "начислять coin"); err != nil {
			return err
		}
		if st.Status != StudentActive {
			return apierr.Conflict("Ученик заблокирован: начислять coin нельзя")
		}
		before := st.Coin
		newCoin, err := s.repo.AddStudentCoin(ctx, tx, st.ID, amount)
		if err != nil {
			return err
		}
		st.Coin = newCoin
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "coin.granted", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			Before: map[string]any{"student": st.Name, "coin": before}, After: map[string]any{"coin": newCoin},
			Reason: st.Name + " · +" + strconv.Itoa(amount) + " coin · " + reason,
		}); err != nil {
			return err
		}
		var grp *Group
		if st.GroupID != nil {
			if g, err := s.repo.FindGroup(ctx, tx, centerID, *st.GroupID); err == nil {
				grp = g
			}
		}
		out = studentDTO(*st, grp, false)
		return nil
	})
	return out, err
}

func valueOr(p *string, def string) string {
	if p != nil {
		return *p
	}
	return def
}

func intOr(p *int, def int) int {
	if p != nil {
		return *p
	}
	return def
}
