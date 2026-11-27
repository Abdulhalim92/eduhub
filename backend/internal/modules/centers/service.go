package centers

import (
	"context"
	"strconv"
	"strings"

	"github.com/line/eduhub-backend/internal/audit"
	"gorm.io/gorm"
)

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

// ListQuery — параметры фильтрации и пагинации для centers.list.
type ListQuery struct {
	Q        string
	Plan     string // название тарифа или "all"
	City     string // город или "all"
	Filter   string // all|expiring|churn|blocked|overdraft
	Page     int
	PageSize int
}

// Service — чтение и правка центров (нефинансовая часть этого инкремента).
type Service struct {
	repo  *Repository
	audit *audit.Recorder
}

// NewService создаёт сервис центров.
func NewService(repo *Repository, rec *audit.Recorder) *Service {
	return &Service{repo: repo, audit: rec}
}

// List фильтрует, сортирует и пагинирует центры. Правила (отток, истечение,
// у лимита) считаются в Go — единый источник истины с DTO (rules.go).
func (s *Service) List(ctx context.Context, q ListQuery) (ListResponse, error) {
	rows, err := s.repo.AllRows(ctx)
	if err != nil {
		return ListResponse{}, err
	}

	term := strings.ToLower(strings.TrimSpace(q.Q))
	filtered := make([]Row, 0, len(rows))
	overdraftTotal := 0
	activeSubs := 0
	for _, r := range rows {
		if r.BalanceDiram < 0 {
			overdraftTotal++
		}
		if isActive(r) && r.PlanPriceDiram > 0 {
			activeSubs++
		}
		if !matches(r, term, q.Plan, q.City, q.Filter) {
			continue
		}
		filtered = append(filtered, r)
	}

	total := len(filtered)
	start := (q.Page - 1) * q.PageSize
	if start > total {
		start = total
	}
	end := start + q.PageSize
	if end > total {
		end = total
	}
	page := filtered[start:end]

	pending, err := s.repo.PendingPlanChanges(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	smsBal, err := s.repo.SMSBalances(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	items := make([]DTO, 0, len(page))
	for _, r := range page {
		dto := toDTO(r)
		if pc, ok := pending[r.ID]; ok {
			pcCopy := pc
			dto.PendingChange = &pcCopy
		}
		dto.SMSBalance = smsBal[r.ID]
		items = append(items, dto)
	}

	return ListResponse{
		Items:         items,
		Total:         total,
		Page:          q.Page,
		PageSize:      q.PageSize,
		PlatformTotal: len(rows),
		Meta: ListMeta{
			ActiveSubs: activeSubs,
			NewMonth:   0, // появится с датой подключения и реальным трафиком
			Overdraft:  overdraftTotal,
		},
	}, nil
}

func matches(r Row, term, plan, city, filter string) bool {
	if term != "" {
		hay := strings.ToLower(r.Name + " " + r.City + " " + r.Owner)
		if !strings.Contains(hay, term) {
			return false
		}
	}
	if plan != "" && plan != "all" && r.PlanName != plan {
		return false
	}
	if city != "" && city != "all" && r.City != city {
		return false
	}
	switch filter {
	case "", "all":
		return true
	case "expiring":
		return isExpiring(r, expiringWithin)
	case "churn":
		return isChurn(r)
	case "blocked":
		return r.Status == "blocked"
	case "overdraft":
		return r.BalanceDiram < 0
	default:
		return true
	}
}

// NameAvailable сообщает, свободно ли название центра.
func (s *Service) NameAvailable(ctx context.Context, name string) (bool, error) {
	exists, err := s.repo.NameExists(ctx, strings.TrimSpace(name))
	if err != nil {
		return false, err
	}
	return !exists, nil
}

// SetManager назначает или снимает менеджера центра (PUT /centers/{id}/manager).
func (s *Service) SetManager(ctx context.Context, actor audit.Actor, id int64, managerName *string) (DTO, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return DTO{}, err
	}
	before := c.ManagerID
	if managerName != nil && strings.TrimSpace(*managerName) != "" {
		m, err := s.repo.ManagerByName(ctx, strings.TrimSpace(*managerName))
		if err != nil {
			return DTO{}, err
		}
		c.ManagerID = &m.ID
	} else {
		c.ManagerID = nil
	}
	if err := s.repo.Save(ctx, c); err != nil {
		return DTO{}, err
	}
	if err := s.audit.Log(ctx, s.repo.DB(), audit.Event{
		Actor:      actor,
		Action:     "center.manager_changed",
		EntityType: "center",
		EntityID:   itoa(c.ID),
		EntityName: c.Name,
		Before:     map[string]any{"managerId": before},
		After:      map[string]any{"managerId": c.ManagerID},
	}); err != nil {
		return DTO{}, err
	}
	return s.byID(ctx, id)
}

// MarkContacted отмечает, что с центром связались (POST /centers/{id}/contact).
func (s *Service) MarkContacted(ctx context.Context, id int64) (DTO, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return DTO{}, err
	}
	c.Contacted = true
	if err := s.repo.Save(ctx, c); err != nil {
		return DTO{}, err
	}
	return s.byID(ctx, id)
}

// DTOByID возвращает centerDto одного центра (используется finance.get).
func (s *Service) DTOByID(ctx context.Context, id int64) (DTO, error) {
	return s.byID(ctx, id)
}

// DTOByIDTx строит centerDto через соединение транзакции — ответ отражает
// изменения, сделанные в этой же транзакции (баланс, тариф) до коммита.
func (s *Service) DTOByIDTx(ctx context.Context, tx *gorm.DB, id int64) (DTO, error) {
	row, err := s.repo.RowByIDTx(ctx, tx, id)
	if err != nil {
		return DTO{}, err
	}
	dto := toDTO(*row)
	pc, err := s.repo.PendingPlanChangeForTx(ctx, tx, id)
	if err != nil {
		return DTO{}, err
	}
	dto.PendingChange = pc
	if dto.SMSBalance, err = s.repo.SMSBalanceFor(ctx, tx, id); err != nil {
		return DTO{}, err
	}
	return dto, nil
}

func (s *Service) byID(ctx context.Context, id int64) (DTO, error) {
	row, err := s.repo.RowByID(ctx, id)
	if err != nil {
		return DTO{}, err
	}
	dto := toDTO(*row)
	pc, err := s.repo.PendingPlanChangeFor(ctx, id)
	if err != nil {
		return DTO{}, err
	}
	dto.PendingChange = pc
	if dto.SMSBalance, err = s.repo.SMSBalanceFor(ctx, s.repo.DB(), id); err != nil {
		return DTO{}, err
	}
	return dto, nil
}
