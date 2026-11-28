package sms

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// Статусы продажи и способы начисления (PLT-SMS).
const (
	StatusPaid  = "paid"
	StatusBonus = "bonus"

	ModeBalance = "balance"
	ModeManual  = "manual"
	ModeBonus   = "bonus"
)

// lowThreshold — доля остатка, с которой пакет помечается «Заканчиваются» (≤10%).
const lowThreshold = 0.10

// Package — SMS-пакет каталога.
type Package struct {
	ID          string      `gorm:"column:id;primaryKey"`
	SMS         int         `gorm:"column:sms"`
	PriceDiram  money.Diram `gorm:"column:price_diram"`
	Description string      `gorm:"column:description"`
	Active      bool        `gorm:"column:active"`
	CreatedAt   time.Time   `gorm:"column:created_at"`
	UpdatedAt   time.Time   `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Package) TableName() string { return "sms_packages" }

// Sale — продажа/начисление пакета центру. Цена зафиксирована на момент продажи (BR-020).
type Sale struct {
	ID         string      `gorm:"column:id;primaryKey"`
	CenterID   int64       `gorm:"column:center_id"`
	PackageID  string      `gorm:"column:package_id"`
	SMS        int         `gorm:"column:sms"`
	Remaining  int         `gorm:"column:remaining"`
	PriceDiram money.Diram `gorm:"column:price_diram"`
	BoughtAt   time.Time   `gorm:"column:bought_at"`
	Status     string      `gorm:"column:status"`
	Method     string      `gorm:"column:method"`
	Reference  string      `gorm:"column:reference"`
	Reason     string      `gorm:"column:reason"`
	ActorName  string      `gorm:"column:actor_name"`
}

// TableName задаёт имя таблицы для GORM.
func (Sale) TableName() string { return "sms_sales" }

func (s Sale) low() bool {
	return s.SMS > 0 && float64(s.Remaining)/float64(s.SMS) <= lowThreshold
}

func (s Sale) usedPct() int {
	if s.SMS == 0 {
		return 0
	}
	return int(float64(s.SMS-s.Remaining)/float64(s.SMS)*100 + 0.5)
}
