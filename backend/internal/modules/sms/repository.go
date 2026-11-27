package sms

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// Repository — доступ к пакетам и продажам SMS. Центры читаются сырым SQL.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий sms.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// Packages возвращает пакеты каталога (по возрастанию числа SMS).
func (r *Repository) Packages(ctx context.Context) ([]Package, error) {
	var out []Package
	if err := r.db.WithContext(ctx).Order("sms ASC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("sms: packages: %w", err)
	}
	return out, nil
}

// Package возвращает пакет по id или NOT_FOUND.
func (r *Repository) Package(ctx context.Context, tx *gorm.DB, id string) (*Package, error) {
	var p Package
	err := tx.WithContext(ctx).First(&p, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Пакет не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("sms: package: %w", err)
	}
	return &p, nil
}

// SavePackage сохраняет изменения пакета.
func (r *Repository) SavePackage(ctx context.Context, tx *gorm.DB, p *Package) error {
	if err := tx.WithContext(ctx).Save(p).Error; err != nil {
		return fmt.Errorf("sms: save package: %w", err)
	}
	return nil
}

// NextSaleID выдаёт следующий номер продажи SMS-N.
func (r *Repository) NextSaleID(ctx context.Context, tx *gorm.DB) (string, error) {
	var n int64
	if err := tx.WithContext(ctx).Raw("SELECT nextval('sms_sale_seq')").Scan(&n).Error; err != nil {
		return "", fmt.Errorf("sms: next sale id: %w", err)
	}
	return "SMS-" + strconv.FormatInt(n, 10), nil
}

// CreateSale вставляет продажу/начисление.
func (r *Repository) CreateSale(ctx context.Context, tx *gorm.DB, s *Sale) error {
	if err := tx.WithContext(ctx).Create(s).Error; err != nil {
		return fmt.Errorf("sms: create sale: %w", err)
	}
	return nil
}

// AllSales возвращает все продажи (новые сверху) — фильтрация в сервисе (масштаб прототипа).
func (r *Repository) AllSales(ctx context.Context) ([]Sale, error) {
	var out []Sale
	if err := r.db.WithContext(ctx).Order("bought_at DESC, id DESC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("sms: all sales: %w", err)
	}
	return out, nil
}

// CenterNames возвращает названия центров (id → имя) для отображения продаж.
func (r *Repository) CenterNames(ctx context.Context) (map[int64]string, error) {
	var rows []struct {
		ID   int64  `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := r.db.WithContext(ctx).Table("centers").Select("id, name").Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("sms: center names: %w", err)
	}
	m := make(map[int64]string, len(rows))
	for _, row := range rows {
		m[row.ID] = row.Name
	}
	return m, nil
}

// CenterInfo — срез центра для начисления.
type CenterInfo struct {
	ID     int64  `gorm:"column:id"`
	Name   string `gorm:"column:name"`
	Status string `gorm:"column:status"`
}

// Center читает срез центра или NOT_FOUND.
func (r *Repository) Center(ctx context.Context, tx *gorm.DB, id int64) (*CenterInfo, error) {
	var c CenterInfo
	res := tx.WithContext(ctx).Table("centers").Select("id, name, status").Where("id = ?", id).Scan(&c)
	if res.Error != nil {
		return nil, fmt.Errorf("sms: center: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &c, nil
}
