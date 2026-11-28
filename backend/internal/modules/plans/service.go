package plans

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
)

// NearLimitPct — порог «центр у лимита» по умолчанию (BR-021).
const NearLimitPct = 80

const (
	maxPriceSomoni = 1_000_000
	maxLimit       = 100_000
)

// Service реализует бизнес-правила тарифов (PLT-TRF-010).
type Service struct {
	repo  *Repository
	audit *audit.Recorder
}

// NewService создаёт сервис тарифов.
func NewService(repo *Repository, rec *audit.Recorder) *Service {
	return &Service{repo: repo, audit: rec}
}

// List возвращает тарифы и сводку.
func (s *Service) List(ctx context.Context) (ListResponse, error) {
	items, err := s.repo.List(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	stats, err := s.repo.AggregateStats(ctx, NearLimitPct)
	if err != nil {
		return ListResponse{}, err
	}
	dtos := make([]DTO, 0, len(items))
	var mrr int64
	activeCount := 0
	for _, p := range items {
		centers := stats.CentersByPlan[p.ID]
		dto := toDTO(p, centers)
		mrr += dto.MRR
		if p.Active {
			activeCount++
		}
		dtos = append(dtos, dto)
	}
	return ListResponse{
		Items: dtos,
		Meta: ListMeta{
			Total:       len(dtos),
			Active:      activeCount,
			PaidCenters: stats.PaidCenters,
			MRR:         mrr,
			NearLimit:   stats.NearLimit,
		},
	}, nil
}

// Create добавляет тариф по правилам PLT-TRF-010.
func (s *Service) Create(ctx context.Context, actor audit.Actor, req CreateRequest) (DTO, error) {
	fields := map[string]string{}
	name := strings.TrimSpace(req.Name)
	if len([]rune(name)) < 2 {
		fields["name"] = "Укажите название (минимум 2 символа)"
	} else {
		exists, err := s.repo.NameExists(ctx, name)
		if err != nil {
			return DTO{}, err
		}
		if exists {
			fields["name"] = "Тариф с таким названием уже есть"
		}
	}
	// При создании тариф не может быть бесплатным (бесплатный — только стартовый из seed).
	s.validatePrice(req.Price, false, fields)
	limits := s.validateLimits(req.Limits, nil, fields)
	if len(fields) > 0 {
		return DTO{}, apierr.Validation("Проверьте данные тарифа", fields)
	}

	p := Plan{
		ID:             "plan-" + uuid.NewString()[:8],
		Name:           name,
		PriceDiram:     money.FromSomoni(*req.Price),
		LimitStaff:     limits.Staff,
		LimitStorageGB: limits.StorageGB,
		LimitBranches:  limits.Branches,
		Active:         true,
	}
	applyModules(&p, req.Modules)
	if err := s.repo.Create(ctx, &p); err != nil {
		return DTO{}, err
	}
	if err := s.audit.Log(ctx, s.repo.db, audit.Event{
		Actor:      actor,
		Action:     "plan.created",
		EntityType: "plan",
		EntityID:   p.ID,
		EntityName: p.Name,
		After:      map[string]any{"price": p.PriceDiram.Somoni(), "limits": limits, "modules": modulesOf(p)},
	}); err != nil {
		return DTO{}, err
	}
	return toDTO(p, 0), nil
}

// Update меняет цену, лимиты, модули или статус тарифа (PLT-TRF-010).
func (s *Service) Update(ctx context.Context, actor audit.Actor, id string, req UpdateRequest) (DTO, error) {
	p, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return DTO{}, err
	}
	onPlan, err := s.repo.ActiveCentersOnPlan(ctx, p.ID)
	if err != nil {
		return DTO{}, err
	}

	// Архивация: нельзя архивировать бесплатный тариф и тариф с активными центрами.
	if req.Active != nil && !*req.Active && p.Active {
		if p.PriceDiram == 0 {
			return DTO{}, apierr.Conflict("Тариф «" + p.Name + "» нельзя архивировать: он назначается новым центрам")
		}
		if n := len(onPlan); n > 0 {
			return DTO{}, apierr.Conflict(fmt.Sprintf("На тарифе «%s» %d %s: сначала переведите их на другой тариф", p.Name, n, pluralCenters(n)))
		}
	}

	before := snapshot(*p)
	changed := false

	if req.Price != nil || req.Limits != nil || req.Modules != nil {
		fields := map[string]string{}
		free := p.PriceDiram == 0
		price := p.PriceDiram.Somoni()
		if req.Price != nil {
			price = *req.Price
		}
		s.validatePrice(&price, free, fields)
		limits := s.validateLimits(req.Limits, onPlan, fields)
		if len(fields) > 0 {
			return DTO{}, apierr.Validation("Проверьте данные тарифа", fields)
		}
		p.PriceDiram = money.FromSomoni(price)
		if req.Limits != nil {
			p.LimitStaff, p.LimitStorageGB, p.LimitBranches = limits.Staff, limits.StorageGB, limits.Branches
		}
		if req.Modules != nil {
			applyModules(p, req.Modules)
		}
		changed = true
	}

	statusAction := ""
	if req.Active != nil && *req.Active != p.Active {
		p.Active = *req.Active
		changed = true
		if p.Active {
			statusAction = "plan.restored"
		} else {
			statusAction = "plan.archived"
		}
	}

	if !changed {
		return toDTO(*p, len(onPlan)), nil
	}
	if err := s.repo.Save(ctx, p); err != nil {
		return DTO{}, err
	}

	after := snapshot(*p)
	action := "plan.updated"
	if statusAction != "" {
		action = statusAction
	}
	if err := s.audit.Log(ctx, s.repo.db, audit.Event{
		Actor:      actor,
		Action:     action,
		EntityType: "plan",
		EntityID:   p.ID,
		EntityName: p.Name,
		Before:     before,
		After:      after,
	}); err != nil {
		return DTO{}, err
	}
	return toDTO(*p, len(onPlan)), nil
}

func (s *Service) validatePrice(price *int64, free bool, fields map[string]string) {
	if price == nil {
		fields["price"] = "Цена — целое число сомони"
		return
	}
	if *price < 0 || *price > maxPriceSomoni {
		fields["price"] = "Цена — целое число сомони"
		return
	}
	if free && *price != 0 {
		fields["price"] = "Стартовый тариф остаётся бесплатным"
		return
	}
	if !free && *price < 1 {
		fields["price"] = "Цена должна быть больше 0"
	}
}

// validateLimits проверяет лимиты и, если переданы, что они не ниже текущего
// использования активных центров (PLT-TRF-010, критерий 1). Возвращает итоговые лимиты.
func (s *Service) validateLimits(in *Limits, onPlan []CenterUsage, fields map[string]string) Limits {
	if in == nil {
		return Limits{}
	}
	check := func(val int, field string, worstVal int, worstName, label string) {
		if val < 1 || val > maxLimit {
			fields[field] = "Целое число от 1"
			return
		}
		if worstName != "" && val < worstVal {
			fields[field] = fmt.Sprintf("Ниже текущего использования: у центра «%s» сейчас %d (%s)", worstName, worstVal, label)
		}
	}
	ws := worst(onPlan)
	check(in.Staff, "staff", ws.staff, ws.staffName, "сотрудники")
	check(in.StorageGB, "storageGb", ws.storage, ws.storageName, "ГБ")
	check(in.Branches, "branches", ws.branches, ws.branchesName, "филиалы")
	return *in
}

type worstUsage struct {
	staff, storage, branches             int
	staffName, storageName, branchesName string
}

func worst(centers []CenterUsage) worstUsage {
	var w worstUsage
	for _, c := range centers {
		if c.StaffUsed > w.staff {
			w.staff, w.staffName = c.StaffUsed, c.Name
		}
		if c.StorageUsedGB > w.storage {
			w.storage, w.storageName = c.StorageUsedGB, c.Name
		}
		if c.BranchesUsed > w.branches {
			w.branches, w.branchesName = c.BranchesUsed, c.Name
		}
	}
	return w
}

func applyModules(p *Plan, m *Modules) {
	if m == nil {
		return
	}
	p.ModulePayroll, p.ModuleInventory, p.ModuleCRM, p.ModuleGeo = m.Payroll, m.Inventory, m.CRM, m.Geo
}

func modulesOf(p Plan) Modules {
	return Modules{Payroll: p.ModulePayroll, Inventory: p.ModuleInventory, CRM: p.ModuleCRM, Geo: p.ModuleGeo}
}

func snapshot(p Plan) map[string]any {
	return map[string]any{
		"price":   p.PriceDiram.Somoni(),
		"limits":  Limits{Staff: p.LimitStaff, StorageGB: p.LimitStorageGB, Branches: p.LimitBranches},
		"modules": modulesOf(p),
		"active":  p.Active,
	}
}

func pluralCenters(n int) string {
	if n == 1 {
		return "центр"
	}
	return "центров"
}
