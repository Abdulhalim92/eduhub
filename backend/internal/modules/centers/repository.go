package centers

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

type pendingChangeRow struct {
	CenterID    int64       `gorm:"column:center_id"`
	InvoiceID   string      `gorm:"column:id"`
	PlanID      *string     `gorm:"column:plan_to_id"`
	PlanName    *string     `gorm:"column:plan_to_name"`
	AmountDiram money.Diram `gorm:"column:amount_diram"`
	Deferred    bool        `gorm:"column:deferred"`
	DueAt       *time.Time  `gorm:"column:due_at"`
}

const pendingChangeSelect = `SELECT center_id, id, plan_to_id, plan_to_name, amount_diram, deferred, due_at
	FROM invoices WHERE kind = 'plan_change' AND status = 'pending'`

func toPendingChange(row pendingChangeRow) PendingChange {
	pc := PendingChange{
		InvoiceID: row.InvoiceID, Amount: row.AmountDiram, Deferred: row.Deferred, DueAt: row.DueAt,
	}
	if row.PlanID != nil {
		pc.PlanID = *row.PlanID
	}
	if row.PlanName != nil {
		pc.PlanName = *row.PlanName
	}
	if row.DueAt != nil && row.DueAt.Before(time.Now()) {
		pc.Overdue = true
	}
	return pc
}

// PendingPlanChanges возвращает открытые счета на смену тарифа (center_id → счёт).
func (r *Repository) PendingPlanChanges(ctx context.Context) (map[int64]PendingChange, error) {
	var rows []pendingChangeRow
	if err := r.db.WithContext(ctx).Raw(pendingChangeSelect).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("centers: pending plan changes: %w", err)
	}
	m := make(map[int64]PendingChange, len(rows))
	for _, row := range rows {
		m[row.CenterID] = toPendingChange(row)
	}
	return m, nil
}

// PendingPlanChangeFor возвращает открытый счёт на смену тарифа одного центра (nil, если нет).
func (r *Repository) PendingPlanChangeFor(ctx context.Context, centerID int64) (*PendingChange, error) {
	return r.pendingPlanChangeFor(ctx, r.db, centerID)
}

// PendingPlanChangeForTx — то же через соединение транзакции.
func (r *Repository) PendingPlanChangeForTx(ctx context.Context, tx *gorm.DB, centerID int64) (*PendingChange, error) {
	return r.pendingPlanChangeFor(ctx, tx, centerID)
}

func (r *Repository) pendingPlanChangeFor(ctx context.Context, q *gorm.DB, centerID int64) (*PendingChange, error) {
	var rows []pendingChangeRow
	if err := q.WithContext(ctx).Raw(pendingChangeSelect+" AND center_id = ?", centerID).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("centers: pending plan change: %w", err)
	}
	if len(rows) == 0 {
		return nil, nil
	}
	pc := toPendingChange(rows[0])
	return &pc, nil
}

// Repository — доступ к центрам и менеджерам.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий центров.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

const rowSelect = `c.id, c.name, c.city, c.owner, c.phone, c.plan_id,
	p.name AS plan_name, p.price_diram AS plan_price_diram,
	p.limit_staff, p.limit_storage_gb, p.limit_branches,
	c.balance_diram, c.overdraft_limit_diram,
	c.staff_used, c.storage_used_gb, c.branches_used,
	c.last_login_at, c.lessons_7d, c.status, c.expires_at,
	m.name AS manager_name, c.contacted, c.reminded`

const rowJoins = `FROM centers c
	JOIN plans p ON p.id = c.plan_id
	LEFT JOIN managers m ON m.id = c.manager_id`

// AllRows загружает все центры с полями тарифа и менеджера (масштаб прототипа).
func (r *Repository) AllRows(ctx context.Context) ([]Row, error) {
	var rows []Row
	err := r.db.WithContext(ctx).
		Raw("SELECT "+rowSelect+" "+rowJoins+" ORDER BY c.id").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("centers: all rows: %w", err)
	}
	return rows, nil
}

// RowByID возвращает один центр (с тарифом и менеджером) или NOT_FOUND.
func (r *Repository) RowByID(ctx context.Context, id int64) (*Row, error) {
	return r.rowByID(ctx, r.db, id)
}

// RowByIDTx — то же, но через соединение транзакции (видит незакоммиченные изменения).
func (r *Repository) RowByIDTx(ctx context.Context, tx *gorm.DB, id int64) (*Row, error) {
	return r.rowByID(ctx, tx, id)
}

func (r *Repository) rowByID(ctx context.Context, q *gorm.DB, id int64) (*Row, error) {
	var row Row
	err := q.WithContext(ctx).
		Raw("SELECT "+rowSelect+" "+rowJoins+" WHERE c.id = ?", id).
		Scan(&row).Error
	if err != nil {
		return nil, fmt.Errorf("centers: row by id: %w", err)
	}
	if row.ID == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &row, nil
}

// NameExists сообщает, занято ли название центра (без учёта регистра).
func (r *Repository) NameExists(ctx context.Context, name string) (bool, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&Center{}).
		Where("lower(name) = lower(?)", name).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("centers: name exists: %w", err)
	}
	return n > 0, nil
}

// ManagerByName возвращает активного менеджера по имени или NOT_FOUND.
func (r *Repository) ManagerByName(ctx context.Context, name string) (*Manager, error) {
	var m Manager
	err := r.db.WithContext(ctx).First(&m, "name = ? AND active", name).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.Field("Неизвестный менеджер", "manager", "Выберите менеджера из списка")
	}
	if err != nil {
		return nil, fmt.Errorf("centers: manager by name: %w", err)
	}
	return &m, nil
}

// FindByID возвращает запись центра для изменения.
func (r *Repository) FindByID(ctx context.Context, id int64) (*Center, error) {
	var c Center
	err := r.db.WithContext(ctx).First(&c, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Центр не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("centers: find: %w", err)
	}
	return &c, nil
}

// Save сохраняет изменения центра.
func (r *Repository) Save(ctx context.Context, c *Center) error {
	if err := r.db.WithContext(ctx).Save(c).Error; err != nil {
		return fmt.Errorf("centers: save: %w", err)
	}
	return nil
}

// DB возвращает соединение для записи аудита в том же контексте.
func (r *Repository) DB() *gorm.DB { return r.db }

// SMSBalances возвращает суммарный остаток SMS по каждому центру (center_id → остаток).
func (r *Repository) SMSBalances(ctx context.Context) (map[int64]int, error) {
	var rows []struct {
		CenterID int64 `gorm:"column:center_id"`
		Total    int   `gorm:"column:total"`
	}
	err := r.db.WithContext(ctx).Table("sms_sales").
		Select("center_id, COALESCE(SUM(remaining), 0) AS total").Group("center_id").Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("centers: sms balances: %w", err)
	}
	m := make(map[int64]int, len(rows))
	for _, row := range rows {
		m[row.CenterID] = row.Total
	}
	return m, nil
}

// SMSBalanceFor возвращает суммарный остаток SMS одного центра (через переданное соединение).
func (r *Repository) SMSBalanceFor(ctx context.Context, q *gorm.DB, centerID int64) (int, error) {
	var total int
	err := q.WithContext(ctx).Table("sms_sales").
		Select("COALESCE(SUM(remaining), 0)").Where("center_id = ?", centerID).Scan(&total).Error
	if err != nil {
		return 0, fmt.Errorf("centers: sms balance: %w", err)
	}
	return total, nil
}
