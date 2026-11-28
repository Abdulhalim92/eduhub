package billing

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository — доступ к счетам, событиям и связанным данным центров/тарифов.
// Таблицы centers/plans читаются сырым SQL, чтобы не импортировать их модули (одна БД).
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий billing.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// NextInvoiceID выдаёт следующий номер счёта INV-N из последовательности.
func (r *Repository) NextInvoiceID(ctx context.Context, tx *gorm.DB) (string, error) {
	var n int64
	if err := tx.WithContext(ctx).Raw("SELECT nextval('invoice_number_seq')").Scan(&n).Error; err != nil {
		return "", fmt.Errorf("billing: next invoice id: %w", err)
	}
	return "INV-" + strconv.FormatInt(n, 10), nil
}

// Create вставляет счёт.
func (r *Repository) Create(ctx context.Context, tx *gorm.DB, inv *Invoice) error {
	if err := tx.WithContext(ctx).Create(inv).Error; err != nil {
		return fmt.Errorf("billing: create invoice: %w", err)
	}
	return nil
}

// Save сохраняет изменения счёта.
func (r *Repository) Save(ctx context.Context, tx *gorm.DB, inv *Invoice) error {
	if err := tx.WithContext(ctx).Save(inv).Error; err != nil {
		return fmt.Errorf("billing: save invoice: %w", err)
	}
	return nil
}

// Find возвращает счёт по id или NOT_FOUND.
func (r *Repository) Find(ctx context.Context, id string) (*Invoice, error) {
	return findWith(r.db.WithContext(ctx), id)
}

// FindForUpdate блокирует строку счёта (FOR UPDATE) в транзакции tx — защита от двойной оплаты.
func (r *Repository) FindForUpdate(ctx context.Context, tx *gorm.DB, id string) (*Invoice, error) {
	return findWith(tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}), id)
}

func findWith(q *gorm.DB, id string) (*Invoice, error) {
	var inv Invoice
	err := q.First(&inv, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Счёт не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("billing: find invoice: %w", err)
	}
	return &inv, nil
}

// List возвращает счета по фильтрам, новые сверху.
func (r *Repository) List(ctx context.Context, status, kind, q string) ([]Invoice, error) {
	query := r.db.WithContext(ctx).Model(&Invoice{})
	if kind != "" && kind != "all" {
		query = query.Where("kind = ?", kind)
	}
	if status != "" && status != "all" && status != "overdue" {
		query = query.Where("status = ?", status)
	}
	if q != "" {
		like := "%" + q + "%"
		query = query.Where("id ILIKE ? OR purpose ILIKE ? OR reference ILIKE ?", like, like, like)
	}
	var out []Invoice
	if err := query.Order("issued_at DESC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("billing: list: %w", err)
	}
	return out, nil
}

// AddEvent добавляет событие в историю счёта.
func (r *Repository) AddEvent(ctx context.Context, tx *gorm.DB, ev Event) error {
	ev.At = time.Now().UTC()
	if err := tx.WithContext(ctx).Create(&ev).Error; err != nil {
		return fmt.Errorf("billing: add event: %w", err)
	}
	return nil
}

// EventsFor возвращает историю счёта по возрастанию времени.
func (r *Repository) EventsFor(ctx context.Context, invoiceID string) ([]Event, error) {
	return r.eventsFor(ctx, r.db, invoiceID)
}

// EventsForTx — то же через соединение транзакции.
func (r *Repository) EventsForTx(ctx context.Context, tx *gorm.DB, invoiceID string) ([]Event, error) {
	return r.eventsFor(ctx, tx, invoiceID)
}

func (r *Repository) eventsFor(ctx context.Context, q *gorm.DB, invoiceID string) ([]Event, error) {
	var out []Event
	err := q.WithContext(ctx).Where("invoice_id = ?", invoiceID).Order("at, id").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("billing: events: %w", err)
	}
	return out, nil
}

// PendingByKind возвращает открытый счёт центра заданного вида (nil, если нет).
func (r *Repository) PendingByKind(ctx context.Context, centerID int64, kind string) (*Invoice, error) {
	var inv Invoice
	err := r.db.WithContext(ctx).
		First(&inv, "center_id = ? AND kind = ? AND status = ?", centerID, kind, StatusPending).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("billing: pending by kind: %w", err)
	}
	return &inv, nil
}

// OpenInvoices возвращает открытые счета центра (для finance.get).
func (r *Repository) OpenInvoices(ctx context.Context, centerID int64) ([]Invoice, error) {
	var out []Invoice
	err := r.db.WithContext(ctx).
		Where("center_id = ? AND status = ?", centerID, StatusPending).
		Order("issued_at DESC").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("billing: open invoices: %w", err)
	}
	return out, nil
}

const centerBriefSelect = `c.id, c.name, c.city, c.owner, c.phone, p.name AS plan,
	c.balance_diram, c.overdraft_limit_diram, c.status`

// CenterBriefByID возвращает краткую карточку центра для DTO счёта.
func (r *Repository) CenterBriefByID(ctx context.Context, id int64) (CenterBrief, error) {
	return r.centerBrief(ctx, r.db, id)
}

// CenterBriefByIDTx — то же через соединение транзакции.
func (r *Repository) CenterBriefByIDTx(ctx context.Context, tx *gorm.DB, id int64) (CenterBrief, error) {
	return r.centerBrief(ctx, tx, id)
}

func (r *Repository) centerBrief(ctx context.Context, q *gorm.DB, id int64) (CenterBrief, error) {
	var b CenterBrief
	res := q.WithContext(ctx).Raw(
		"SELECT "+centerBriefSelect+" FROM centers c JOIN plans p ON p.id = c.plan_id WHERE c.id = ?", id).Scan(&b)
	if res.Error != nil {
		return CenterBrief{}, fmt.Errorf("billing: center brief: %w", res.Error)
	}
	return b, nil
}

// CenterBriefs возвращает краткие карточки всех центров (id → карточка) для списка счетов.
func (r *Repository) CenterBriefs(ctx context.Context) (map[int64]CenterBrief, error) {
	var rows []CenterBrief
	err := r.db.WithContext(ctx).Raw(
		"SELECT " + centerBriefSelect + " FROM centers c JOIN plans p ON p.id = c.plan_id").Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("billing: center briefs: %w", err)
	}
	m := make(map[int64]CenterBrief, len(rows))
	for _, b := range rows {
		m[b.ID] = b
	}
	return m, nil
}

// CenterInfo — срез центра для счетов и смены тарифа.
type CenterInfo struct {
	ID                  int64       `gorm:"column:id"`
	Name                string      `gorm:"column:name"`
	City                string      `gorm:"column:city"`
	Owner               string      `gorm:"column:owner"`
	Phone               string      `gorm:"column:phone"`
	PlanID              string      `gorm:"column:plan_id"`
	PlanName            string      `gorm:"column:plan_name"`
	PlanPriceDiram      money.Diram `gorm:"column:plan_price_diram"`
	BalanceDiram        money.Diram `gorm:"column:balance_diram"`
	OverdraftLimitDiram money.Diram `gorm:"column:overdraft_limit_diram"`
	Status              string      `gorm:"column:status"`
	ExpiresAt           *time.Time  `gorm:"column:expires_at"`
	StaffUsed           int         `gorm:"column:staff_used"`
	StorageUsedGB       int         `gorm:"column:storage_used_gb"`
	BranchesUsed        int         `gorm:"column:branches_used"`
}

// Center читает срез центра с полями тарифа.
func (r *Repository) Center(ctx context.Context, tx *gorm.DB, id int64) (*CenterInfo, error) {
	var c CenterInfo
	res := tx.WithContext(ctx).Raw(`
		SELECT c.id, c.name, c.city, c.owner, c.phone, c.plan_id,
		       p.name AS plan_name, p.price_diram AS plan_price_diram,
		       c.balance_diram, c.overdraft_limit_diram, c.status, c.expires_at,
		       c.staff_used, c.storage_used_gb, c.branches_used
		FROM centers c JOIN plans p ON p.id = c.plan_id WHERE c.id = ?`, id).Scan(&c)
	if res.Error != nil {
		return nil, fmt.Errorf("billing: center: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &c, nil
}

// PlanInfo — тариф для расчёта смены.
type PlanInfo struct {
	ID             string      `gorm:"column:id"`
	Name           string      `gorm:"column:name"`
	PriceDiram     money.Diram `gorm:"column:price_diram"`
	LimitStaff     int         `gorm:"column:limit_staff"`
	LimitStorageGB int         `gorm:"column:limit_storage_gb"`
	LimitBranches  int         `gorm:"column:limit_branches"`
	Active         bool        `gorm:"column:active"`
}

// Plan читает тариф по id.
func (r *Repository) Plan(ctx context.Context, tx *gorm.DB, id string) (*PlanInfo, error) {
	var p PlanInfo
	res := tx.WithContext(ctx).Table("plans").
		Select("id, name, price_diram, limit_staff, limit_storage_gb, limit_branches, active").
		Where("id = ?", id).Scan(&p)
	if res.Error != nil {
		return nil, fmt.Errorf("billing: plan: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Тариф не найден")
	}
	return &p, nil
}

// ActivePlans возвращает активные тарифы (для вариантов смены).
func (r *Repository) ActivePlans(ctx context.Context) ([]PlanInfo, error) {
	var out []PlanInfo
	err := r.db.WithContext(ctx).Table("plans").
		Select("id, name, price_diram, limit_staff, limit_storage_gb, limit_branches, active").
		Where("active").Order("price_diram ASC").Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("billing: active plans: %w", err)
	}
	return out, nil
}

// SetCenterPlan меняет тариф центра и срок подписки (в транзакции).
func (r *Repository) SetCenterPlan(ctx context.Context, tx *gorm.DB, centerID int64, planID string, expiresAt *time.Time) error {
	err := tx.WithContext(ctx).Exec(
		"UPDATE centers SET plan_id = ?, expires_at = ?, reminded = FALSE, updated_at = now() WHERE id = ?",
		planID, expiresAt, centerID).Error
	if err != nil {
		return fmt.Errorf("billing: set center plan: %w", err)
	}
	return nil
}

// CancelPendingRenewals отменяет открытые счета на продление центра
// (при смене тарифа счёт на продление старого тарифа больше не нужен).
func (r *Repository) CancelPendingRenewals(ctx context.Context, tx *gorm.DB, centerID int64) error {
	err := tx.WithContext(ctx).Model(&Invoice{}).
		Where("center_id = ? AND kind = ? AND status = ?", centerID, KindRenewal, StatusPending).
		Updates(map[string]any{"status": StatusCancelled, "reason": "Заменён сменой тарифа", "updated_at": time.Now().UTC()}).Error
	if err != nil {
		return fmt.Errorf("billing: cancel pending renewals: %w", err)
	}
	return nil
}

// SetCenterExpires продлевает подписку центра (в транзакции).
func (r *Repository) SetCenterExpires(ctx context.Context, tx *gorm.DB, centerID int64, expiresAt *time.Time) error {
	err := tx.WithContext(ctx).Exec(
		"UPDATE centers SET expires_at = ?, reminded = FALSE, updated_at = now() WHERE id = ?",
		expiresAt, centerID).Error
	if err != nil {
		return fmt.Errorf("billing: set center expires: %w", err)
	}
	return nil
}
