package plans

import (
	"context"
	"errors"
	"fmt"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// Repository — доступ к тарифам и связанным агрегатам по центрам.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий тарифов.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// List возвращает все тарифы, отсортированные по цене (как в контракте plans.list).
func (r *Repository) List(ctx context.Context) ([]Plan, error) {
	var out []Plan
	if err := r.db.WithContext(ctx).Order("price_diram ASC, name ASC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("plans: list: %w", err)
	}
	return out, nil
}

// FindByID возвращает тариф по id или NOT_FOUND.
func (r *Repository) FindByID(ctx context.Context, id string) (*Plan, error) {
	var p Plan
	err := r.db.WithContext(ctx).First(&p, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Тариф не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("plans: find: %w", err)
	}
	return &p, nil
}

// NameExists сообщает, занято ли название (без учёта регистра).
func (r *Repository) NameExists(ctx context.Context, name string) (bool, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&Plan{}).
		Where("lower(name) = lower(?)", name).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("plans: name exists: %w", err)
	}
	return n > 0, nil
}

// Create вставляет новый тариф.
func (r *Repository) Create(ctx context.Context, p *Plan) error {
	if err := r.db.WithContext(ctx).Create(p).Error; err != nil {
		return fmt.Errorf("plans: create: %w", err)
	}
	return nil
}

// Save сохраняет изменения тарифа.
func (r *Repository) Save(ctx context.Context, p *Plan) error {
	if err := r.db.WithContext(ctx).Save(p).Error; err != nil {
		return fmt.Errorf("plans: save: %w", err)
	}
	return nil
}

// ActiveCentersOnPlan возвращает использование лимитов активными центрами тарифа.
func (r *Repository) ActiveCentersOnPlan(ctx context.Context, planID string) ([]CenterUsage, error) {
	var out []CenterUsage
	err := r.db.WithContext(ctx).Table("centers").
		Select("name, staff_used, storage_used_gb, branches_used").
		Where("plan_id = ? AND status = 'active'", planID).
		Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("plans: centers on plan: %w", err)
	}
	return out, nil
}

// Stats — агрегаты для plans.list.meta.
type Stats struct {
	// CentersByPlan — число активных центров на каждом тарифе (plan_id → count).
	CentersByPlan map[string]int
	// PaidCenters — активные центры на платных тарифах.
	PaidCenters int
	// NearLimit — активные центры, где любой лимит заполнен на >= threshold%.
	NearLimit int
}

// AggregateStats считает агрегаты по центрам для сводки тарифов.
func (r *Repository) AggregateStats(ctx context.Context, nearThresholdPct int) (Stats, error) {
	st := Stats{CentersByPlan: map[string]int{}}

	var rows []struct {
		PlanID string `gorm:"column:plan_id"`
		N      int    `gorm:"column:n"`
	}
	err := r.db.WithContext(ctx).Table("centers").
		Select("plan_id, count(*) AS n").
		Where("status = 'active'").Group("plan_id").Scan(&rows).Error
	if err != nil {
		return Stats{}, fmt.Errorf("plans: centers by plan: %w", err)
	}
	for _, row := range rows {
		st.CentersByPlan[row.PlanID] = row.N
	}

	var paid int64
	err = r.db.WithContext(ctx).Table("centers AS c").
		Joins("JOIN plans p ON p.id = c.plan_id").
		Where("c.status = 'active' AND p.price_diram > 0").
		Count(&paid).Error
	if err != nil {
		return Stats{}, fmt.Errorf("plans: paid centers: %w", err)
	}
	st.PaidCenters = int(paid)

	var near int64
	err = r.db.WithContext(ctx).Table("centers AS c").
		Joins("JOIN plans p ON p.id = c.plan_id").
		Where(`c.status = 'active' AND (
			c.staff_used * 100 >= ? * p.limit_staff OR
			c.storage_used_gb * 100 >= ? * p.limit_storage_gb OR
			c.branches_used * 100 >= ? * p.limit_branches
		)`, nearThresholdPct, nearThresholdPct, nearThresholdPct).
		Count(&near).Error
	if err != nil {
		return Stats{}, fmt.Errorf("plans: near limit: %w", err)
	}
	st.NearLimit = int(near)
	return st, nil
}
