package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// Repository — доступ к опубликованным филиалам и заявкам. Центры/группы читаются сырым SQL.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий каталога.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// BranchRow — опубликованный филиал с данными центра и направлением.
type BranchRow struct {
	CenterID  int64   `gorm:"column:center_id"`
	Center    string  `gorm:"column:center"`
	Branch    string  `gorm:"column:branch"`
	City      string  `gorm:"column:city"`
	District  string  `gorm:"column:district"`
	Address   string  `gorm:"column:address"`
	Phone     string  `gorm:"column:phone"`
	Lat       float64 `gorm:"column:lat"`
	Lng       float64 `gorm:"column:lng"`
	DescRu    string  `gorm:"column:desc_ru"`
	DescTj    string  `gorm:"column:desc_tj"`
	Direction string  `gorm:"column:direction"`
}

// BranchFilter — фильтры каталога.
type BranchFilter struct {
	Direction string
	City      string
	Query     string
}

// PublishedBranches возвращает опубликованные филиалы активных центров с учётом фильтров (BR-017).
func (r *Repository) PublishedBranches(ctx context.Context, f BranchFilter) ([]BranchRow, error) {
	q := r.db.WithContext(ctx).Table("branch_submissions AS b").
		Select(`b.center_id, c.name AS center, b.branch, b.city, b.district, b.address, b.phone,
			b.geo_lat AS lat, b.geo_lng AS lng, b.desc_ru, b.desc_tj, COALESCE(p.direction, '') AS direction`).
		Joins("JOIN centers c ON c.id = b.center_id AND c.status = 'active'").
		Joins("LEFT JOIN center_profiles p ON p.center_id = b.center_id").
		Where("b.status = 'published'")
	if f.City != "" {
		q = q.Where("b.city = ?", f.City)
	}
	if f.Direction != "" {
		q = q.Where("p.direction = ?", f.Direction)
	}
	if f.Query != "" {
		like := "%" + f.Query + "%"
		q = q.Where("c.name ILIKE ? OR b.branch ILIKE ? OR b.address ILIKE ?", like, like, like)
	}
	var out []BranchRow
	if err := q.Order("c.name, b.branch").Scan(&out).Error; err != nil {
		return nil, fmt.Errorf("catalog: branches: %w", err)
	}
	return out, nil
}

// Directions возвращает направления опубликованных центров.
func (r *Repository) Directions(ctx context.Context) ([]string, error) {
	var out []string
	err := r.db.WithContext(ctx).Table("branch_submissions AS b").
		Joins("JOIN center_profiles p ON p.center_id = b.center_id").
		Where("b.status = 'published' AND p.direction <> ''").
		Distinct("p.direction").Order("p.direction").Pluck("p.direction", &out).Error
	if err != nil {
		return nil, fmt.Errorf("catalog: directions: %w", err)
	}
	return out, nil
}

// Cities возвращает города опубликованных филиалов.
func (r *Repository) Cities(ctx context.Context) ([]string, error) {
	var out []string
	err := r.db.WithContext(ctx).Table("branch_submissions").
		Where("status = 'published'").Distinct("city").Order("city").Pluck("city", &out).Error
	if err != nil {
		return nil, fmt.Errorf("catalog: cities: %w", err)
	}
	return out, nil
}

// CenterPublic — срез центра для валидации заявки.
type CenterPublic struct {
	ID        int64  `gorm:"column:id"`
	Name      string `gorm:"column:name"`
	Status    string `gorm:"column:status"`
	Published int64  `gorm:"column:published"`
}

// CenterForLead возвращает центр и число его опубликованных филиалов (для проверки заявки).
func (r *Repository) CenterForLead(ctx context.Context, tx *gorm.DB, id int64) (*CenterPublic, error) {
	var c CenterPublic
	res := tx.WithContext(ctx).Table("centers c").
		Select("c.id, c.name, c.status, (SELECT count(*) FROM branch_submissions b WHERE b.center_id = c.id AND b.status = 'published') AS published").
		Where("c.id = ?", id).Scan(&c)
	if res.Error != nil {
		return nil, fmt.Errorf("catalog: center for lead: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &c, nil
}

// GroupInCenter проверяет, что группа принадлежит центру.
func (r *Repository) GroupInCenter(ctx context.Context, tx *gorm.DB, centerID, groupID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Table("groups").Where("id = ? AND center_id = ?", groupID, centerID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("catalog: group: %w", err)
	}
	return n > 0, nil
}

// Center читает статус центра (для управления заявками).
func (r *Repository) Center(ctx context.Context, tx *gorm.DB, id int64) (string, string, bool, error) {
	var row struct {
		Name   string `gorm:"column:name"`
		Status string `gorm:"column:status"`
	}
	res := tx.WithContext(ctx).Table("centers").Select("name, status").Where("id = ?", id).Scan(&row)
	if res.Error != nil {
		return "", "", false, fmt.Errorf("catalog: center: %w", res.Error)
	}
	return row.Name, row.Status, res.RowsAffected > 0, nil
}

// --- заявки ---

// CreateLead вставляет заявку.
func (r *Repository) CreateLead(ctx context.Context, tx *gorm.DB, l *Lead) error {
	if err := tx.WithContext(ctx).Create(l).Error; err != nil {
		return fmt.Errorf("catalog: create lead: %w", err)
	}
	return nil
}

// FindLead возвращает заявку центра или NOT_FOUND.
func (r *Repository) FindLead(ctx context.Context, tx *gorm.DB, tenantID, id int64) (*Lead, error) {
	var l Lead
	err := tx.WithContext(ctx).First(&l, "id = ? AND tenant_id = ?", id, tenantID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Заявка не найдена")
	}
	if err != nil {
		return nil, fmt.Errorf("catalog: find lead: %w", err)
	}
	return &l, nil
}

// SaveLead сохраняет заявку.
func (r *Repository) SaveLead(ctx context.Context, tx *gorm.DB, l *Lead) error {
	if err := tx.WithContext(ctx).Save(l).Error; err != nil {
		return fmt.Errorf("catalog: save lead: %w", err)
	}
	return nil
}

// Leads возвращает заявки центра (опционально по статусу), новые сверху.
func (r *Repository) Leads(ctx context.Context, tenantID int64, status string) ([]Lead, error) {
	q := r.db.WithContext(ctx).Where("tenant_id = ?", tenantID)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var out []Lead
	if err := q.Order("id DESC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("catalog: leads: %w", err)
	}
	return out, nil
}
