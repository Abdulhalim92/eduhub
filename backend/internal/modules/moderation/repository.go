package moderation

import (
	"context"
	"errors"
	"fmt"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository — доступ к заявкам на публикацию филиалов. Центры читаются сырым SQL.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий модерации.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// List возвращает заявки по статусу: pending | processed | "" (все), новые сверху.
func (r *Repository) List(ctx context.Context, status string) ([]Submission, error) {
	q := r.db.WithContext(ctx)
	switch status {
	case StatusPending:
		q = q.Where("status = ?", StatusPending)
	case "processed":
		q = q.Where("status <> ?", StatusPending)
	}
	var out []Submission
	if err := q.Order("id DESC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("moderation: list: %w", err)
	}
	return out, nil
}

// Counts возвращает число ожидающих и обработанных заявок.
func (r *Repository) Counts(ctx context.Context) (pending, processed int, err error) {
	var p, total int64
	if err = r.db.WithContext(ctx).Model(&Submission{}).Where("status = ?", StatusPending).Count(&p).Error; err != nil {
		return 0, 0, fmt.Errorf("moderation: count pending: %w", err)
	}
	if err = r.db.WithContext(ctx).Model(&Submission{}).Count(&total).Error; err != nil {
		return 0, 0, fmt.Errorf("moderation: count total: %w", err)
	}
	return int(p), int(total - p), nil
}

// FindForUpdate блокирует строку заявки в транзакции.
func (r *Repository) FindForUpdate(ctx context.Context, tx *gorm.DB, id int64) (*Submission, error) {
	var s Submission
	err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&s, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Заявка не найдена")
	}
	if err != nil {
		return nil, fmt.Errorf("moderation: find: %w", err)
	}
	return &s, nil
}

// Create вставляет заявку.
func (r *Repository) Create(ctx context.Context, tx *gorm.DB, s *Submission) error {
	if err := tx.WithContext(ctx).Create(s).Error; err != nil {
		return fmt.Errorf("moderation: create: %w", err)
	}
	return nil
}

// Save сохраняет изменения заявки.
func (r *Repository) Save(ctx context.Context, tx *gorm.DB, s *Submission) error {
	if err := tx.WithContext(ctx).Save(s).Error; err != nil {
		return fmt.Errorf("moderation: save: %w", err)
	}
	return nil
}

// ByCenter возвращает заявки центра (новые сверху).
func (r *Repository) ByCenter(ctx context.Context, centerID int64) ([]Submission, error) {
	var out []Submission
	if err := r.db.WithContext(ctx).Where("center_id = ?", centerID).Order("id DESC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("moderation: by center: %w", err)
	}
	return out, nil
}

// DuplicateAddress сообщает, есть ли у центра не отклонённая заявка с тем же адресом и городом.
func (r *Repository) DuplicateAddress(ctx context.Context, tx *gorm.DB, centerID int64, city, address string, excludeID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Model(&Submission{}).
		Where("center_id = ? AND status <> ? AND city = ? AND lower(address) = lower(?) AND id <> ?",
			centerID, StatusRejected, city, address, excludeID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("moderation: duplicate address: %w", err)
	}
	return n > 0, nil
}

// ActiveCount считает заявки центра на модерации и опубликованные (для лимита филиалов, BR-018).
func (r *Repository) ActiveCount(ctx context.Context, tx *gorm.DB, centerID, excludeID int64) (int, error) {
	var n int64
	err := tx.WithContext(ctx).Model(&Submission{}).
		Where("center_id = ? AND id <> ? AND status IN ?", centerID, excludeID, []string{StatusPending, StatusPublished}).Count(&n).Error
	if err != nil {
		return 0, fmt.Errorf("moderation: active count: %w", err)
	}
	return int(n), nil
}

// CenterInfo — срез центра для заявок (имя, владелец, тариф и лимит филиалов, статус).
type CenterInfo struct {
	ID            int64  `gorm:"column:id"`
	Name          string `gorm:"column:name"`
	Owner         string `gorm:"column:owner"`
	Status        string `gorm:"column:status"`
	PlanName      string `gorm:"column:plan_name"`
	LimitBranches int    `gorm:"column:limit_branches"`
}

// Center читает срез центра с лимитом филиалов тарифа.
func (r *Repository) Center(ctx context.Context, tx *gorm.DB, id int64) (*CenterInfo, error) {
	var c CenterInfo
	res := tx.WithContext(ctx).Raw(`
		SELECT c.id, c.name, c.owner, c.status, p.name AS plan_name, p.limit_branches
		FROM centers c JOIN plans p ON p.id = c.plan_id WHERE c.id = ?`, id).Scan(&c)
	if res.Error != nil {
		return nil, fmt.Errorf("moderation: center: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &c, nil
}

// CenterNames возвращает имена и владельцев центров (для DTO очереди).
func (r *Repository) CenterNames(ctx context.Context) (map[int64]CenterInfo, error) {
	var rows []CenterInfo
	err := r.db.WithContext(ctx).Raw(`SELECT c.id, c.name, c.owner, c.status, '' AS plan_name, 0 AS limit_branches FROM centers c`).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("moderation: center names: %w", err)
	}
	m := make(map[int64]CenterInfo, len(rows))
	for _, row := range rows {
		m[row.ID] = row
	}
	return m, nil
}
