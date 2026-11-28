package marketplace

import (
	"context"
	"errors"
	"fmt"

	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository — доступ к курсам, доступам и заявкам. Центры читаются сырым SQL.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий маркетплейса.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// --- курсы ---

func (r *Repository) courseByID(ctx context.Context, q *gorm.DB, id int64, lock bool) (*Course, error) {
	if lock {
		q = q.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var c Course
	err := q.WithContext(ctx).First(&c, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Курс не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("marketplace: course: %w", err)
	}
	return &c, nil
}

// Course читает курс по id.
func (r *Repository) Course(ctx context.Context, id int64) (*Course, error) {
	return r.courseByID(ctx, r.db, id, false)
}

// CourseTx читает курс по id в транзакции с блокировкой строки (для передачи/версии).
func (r *Repository) CourseTx(ctx context.Context, tx *gorm.DB, id int64, lock bool) (*Course, error) {
	return r.courseByID(ctx, tx, id, lock)
}

// CreateCourse вставляет курс.
func (r *Repository) CreateCourse(ctx context.Context, tx *gorm.DB, c *Course) error {
	if err := tx.WithContext(ctx).Create(c).Error; err != nil {
		return fmt.Errorf("marketplace: create course: %w", err)
	}
	return nil
}

// SaveCourse сохраняет изменения курса.
func (r *Repository) SaveCourse(ctx context.Context, tx *gorm.DB, c *Course) error {
	if err := tx.WithContext(ctx).Save(c).Error; err != nil {
		return fmt.Errorf("marketplace: save course: %w", err)
	}
	return nil
}

// ListPlatform возвращает курсы платформы по фильтрам.
func (r *Repository) ListPlatform(ctx context.Context, q, direction, status string) ([]Course, error) {
	query := r.db.WithContext(ctx).Where("owner_center_id IS NULL")
	if direction != "" && direction != "all" {
		query = query.Where("direction = ?", direction)
	}
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if q != "" {
		query = query.Where("title ILIKE ?", "%"+q+"%")
	}
	var out []Course
	if err := query.Order("id").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("marketplace: list platform: %w", err)
	}
	return out, nil
}

// PublishedPlatform возвращает опубликованные курсы платформы (каталог для центра).
func (r *Repository) PublishedPlatform(ctx context.Context) ([]Course, error) {
	var out []Course
	err := r.db.WithContext(ctx).Where("owner_center_id IS NULL AND status = ?", StatusPublished).Order("id").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("marketplace: published: %w", err)
	}
	return out, nil
}

// OwnCourses возвращает собственные курсы центра.
func (r *Repository) OwnCourses(ctx context.Context, centerID int64) ([]Course, error) {
	var out []Course
	err := r.db.WithContext(ctx).Where("owner_center_id = ?", centerID).Order("id").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("marketplace: own courses: %w", err)
	}
	return out, nil
}

// PlatformTitleExists проверяет уникальность названия среди платформенных (без excludeID).
func (r *Repository) PlatformTitleExists(ctx context.Context, title string, excludeID int64) (bool, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&Course{}).
		Where("owner_center_id IS NULL AND lower(title) = lower(?) AND id <> ?", title, excludeID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("marketplace: platform title: %w", err)
	}
	return n > 0, nil
}

// CenterTitleExists проверяет уникальность названия среди собственных курсов центра.
func (r *Repository) CenterTitleExists(ctx context.Context, centerID int64, title string, excludeID int64) (bool, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&Course{}).
		Where("owner_center_id = ? AND lower(title) = lower(?) AND id <> ?", centerID, title, excludeID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("marketplace: center title: %w", err)
	}
	return n > 0, nil
}

// --- доступы ---

func (r *Repository) activeAccess(ctx context.Context, q *gorm.DB, centerID, courseID int64) (*Access, error) {
	var a Access
	err := q.WithContext(ctx).First(&a, "center_id = ? AND course_id = ? AND status = ?", centerID, courseID, AccessActive).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("marketplace: active access: %w", err)
	}
	return &a, nil
}

// ActiveAccess возвращает активный доступ центра к курсу (nil — нет).
func (r *Repository) ActiveAccess(ctx context.Context, centerID, courseID int64) (*Access, error) {
	return r.activeAccess(ctx, r.db, centerID, courseID)
}

// ActiveAccessTx — то же в транзакции.
func (r *Repository) ActiveAccessTx(ctx context.Context, tx *gorm.DB, centerID, courseID int64) (*Access, error) {
	return r.activeAccess(ctx, tx, centerID, courseID)
}

// CreateAccess вставляет доступ.
func (r *Repository) CreateAccess(ctx context.Context, tx *gorm.DB, a *Access) error {
	if err := tx.WithContext(ctx).Create(a).Error; err != nil {
		return fmt.Errorf("marketplace: create access: %w", err)
	}
	return nil
}

// SaveAccess сохраняет изменения доступа.
func (r *Repository) SaveAccess(ctx context.Context, tx *gorm.DB, a *Access) error {
	if err := tx.WithContext(ctx).Save(a).Error; err != nil {
		return fmt.Errorf("marketplace: save access: %w", err)
	}
	return nil
}

// FindAccess возвращает доступ по id или NOT_FOUND.
func (r *Repository) FindAccess(ctx context.Context, tx *gorm.DB, id int64) (*Access, error) {
	var a Access
	err := tx.WithContext(ctx).First(&a, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Доступ не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("marketplace: find access: %w", err)
	}
	return &a, nil
}

// AccessByCourse возвращает доступы к курсу (новые сверху) — для списка покупателей.
func (r *Repository) AccessByCourse(ctx context.Context, courseID int64) ([]Access, error) {
	var out []Access
	err := r.db.WithContext(ctx).Where("course_id = ?", courseID).Order("granted_at DESC, id DESC").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("marketplace: access by course: %w", err)
	}
	return out, nil
}

// ActiveAccessByCenter возвращает активные доступы центра (переданные курсы).
func (r *Repository) ActiveAccessByCenter(ctx context.Context, centerID int64) ([]Access, error) {
	var out []Access
	err := r.db.WithContext(ctx).Where("center_id = ? AND status = ?", centerID, AccessActive).Order("granted_at DESC, id DESC").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("marketplace: access by center: %w", err)
	}
	return out, nil
}

// ActiveBuyers считает активных владельцев курса (для карточки).
func (r *Repository) ActiveBuyers(ctx context.Context, courseID int64) (int, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&Access{}).Where("course_id = ? AND status = ?", courseID, AccessActive).Count(&n).Error
	if err != nil {
		return 0, fmt.Errorf("marketplace: buyers: %w", err)
	}
	return int(n), nil
}

// --- заявки ---

// CreateRequest вставляет заявку.
func (r *Repository) CreateRequest(ctx context.Context, tx *gorm.DB, req *Request) error {
	if err := tx.WithContext(ctx).Create(req).Error; err != nil {
		return fmt.Errorf("marketplace: create request: %w", err)
	}
	return nil
}

// SaveRequest сохраняет изменения заявки.
func (r *Repository) SaveRequest(ctx context.Context, tx *gorm.DB, req *Request) error {
	if err := tx.WithContext(ctx).Save(req).Error; err != nil {
		return fmt.Errorf("marketplace: save request: %w", err)
	}
	return nil
}

// DeleteRequest удаляет заявку (отмена центром до счёта).
func (r *Repository) DeleteRequest(ctx context.Context, tx *gorm.DB, id int64) error {
	if err := tx.WithContext(ctx).Delete(&Request{}, "id = ?", id).Error; err != nil {
		return fmt.Errorf("marketplace: delete request: %w", err)
	}
	return nil
}

// FindRequest возвращает заявку по id или NOT_FOUND.
func (r *Repository) FindRequest(ctx context.Context, tx *gorm.DB, id int64) (*Request, error) {
	var req Request
	err := tx.WithContext(ctx).First(&req, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Заявка не найдена")
	}
	if err != nil {
		return nil, fmt.Errorf("marketplace: find request: %w", err)
	}
	return &req, nil
}

// OpenRequest возвращает открытую заявку центра на курс (new|invoiced), nil — нет.
func (r *Repository) OpenRequest(ctx context.Context, tx *gorm.DB, centerID, courseID int64) (*Request, error) {
	var req Request
	err := tx.WithContext(ctx).First(&req, "center_id = ? AND course_id = ? AND status IN ?", centerID, courseID, []string{ReqNew, ReqInvoiced}).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("marketplace: open request: %w", err)
	}
	return &req, nil
}

// RequestByInvoice возвращает заявку по id связанного счёта (nil — нет).
func (r *Repository) RequestByInvoice(ctx context.Context, tx *gorm.DB, invoiceID string) (*Request, error) {
	var req Request
	err := tx.WithContext(ctx).First(&req, "invoice_id = ?", invoiceID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("marketplace: request by invoice: %w", err)
	}
	return &req, nil
}

// ListRequests возвращает заявки по фильтрам (новые сверху).
func (r *Repository) ListRequests(ctx context.Context, status string, courseID int64) ([]Request, error) {
	query := r.db.WithContext(ctx)
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if courseID != 0 {
		query = query.Where("course_id = ?", courseID)
	}
	var out []Request
	if err := query.Order("created_at DESC, id DESC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("marketplace: list requests: %w", err)
	}
	return out, nil
}

// RequestsByCenter возвращает заявки центра.
func (r *Repository) RequestsByCenter(ctx context.Context, centerID int64) ([]Request, error) {
	var out []Request
	err := r.db.WithContext(ctx).Where("center_id = ?", centerID).Order("created_at DESC, id DESC").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("marketplace: requests by center: %w", err)
	}
	return out, nil
}

// NewRequestCount считает заявки в статусе «Новая».
func (r *Repository) NewRequestCount(ctx context.Context) (int, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&Request{}).Where("status = ?", ReqNew).Count(&n).Error
	if err != nil {
		return 0, fmt.Errorf("marketplace: new request count: %w", err)
	}
	return int(n), nil
}

// --- центр (сырой SQL, без импорта модуля centers) ---

// CenterInfo — срез центра для проверок маркетплейса.
type CenterInfo struct {
	ID                  int64       `gorm:"column:id"`
	Name                string      `gorm:"column:name"`
	Status              string      `gorm:"column:status"`
	BalanceDiram        money.Diram `gorm:"column:balance_diram"`
	OverdraftLimitDiram money.Diram `gorm:"column:overdraft_limit_diram"`
}

// Center читает срез центра или NOT_FOUND.
func (r *Repository) Center(ctx context.Context, tx *gorm.DB, id int64) (*CenterInfo, error) {
	var c CenterInfo
	res := tx.WithContext(ctx).Table("centers").
		Select("id, name, status, balance_diram, overdraft_limit_diram").
		Where("id = ?", id).Scan(&c)
	if res.Error != nil {
		return nil, fmt.Errorf("marketplace: center: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &c, nil
}

// CenterName возвращает название центра (для DTO).
func (r *Repository) CenterName(ctx context.Context, id int64) (string, string, error) {
	var row struct {
		Name string `gorm:"column:name"`
		City string `gorm:"column:city"`
	}
	err := r.db.WithContext(ctx).Table("centers").Select("name, city").Where("id = ?", id).Scan(&row).Error
	if err != nil {
		return "", "", fmt.Errorf("marketplace: center name: %w", err)
	}
	return row.Name, row.City, nil
}
