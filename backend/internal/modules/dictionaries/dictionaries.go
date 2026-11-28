// Package dictionaries отдаёт справочники для форм (dictionaries.get):
// города, направления, способы оплаты, менеджеры и активные тарифы.
package dictionaries

import (
	"context"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/pkg/httpx"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

// Города и направления пока константы (как в mock); при необходимости станут таблицами.
var cities = []string{"Душанбе", "Худжанд", "Бохтар", "Куляб", "Турсунзода", "Исфара", "Хорог"}

var directions = []string{"Математика", "Английский язык", "Программирование", "Робототехника", "Подготовка к НЦТ", "Творчество", "Шахматы", "Музыка"}

// PayMethod — способ оплаты с полями для формы подтверждения оплаты.
type PayMethod struct {
	Method   string `json:"method"`
	Channel  string `json:"channel"`
	Evidence string `json:"evidence"`
	DocLabel string `json:"docLabel"`
	DocHint  string `json:"docHint"`
}

var payMethods = []PayMethod{
	{Method: "Безнал (Р/С)", Channel: "bank", Evidence: "Банковская выписка", DocLabel: "№ платёжного поручения", DocHint: "Например, ПП № 123"},
	{Method: "Наличные", Channel: "cash", Evidence: "Кассовый документ", DocLabel: "№ приходного кассового ордера", DocHint: "Например, ПКО № 45"},
	{Method: "Перевод на карту", Channel: "card", Evidence: "Чек или скриншот перевода", DocLabel: "ID перевода или последние 4 цифры карты", DocHint: "Например, 4821"},
}

// Limits — лимиты тарифа в справочнике.
type Limits struct {
	Staff     int `json:"staff"`
	StorageGB int `json:"storageGb"`
	Branches  int `json:"branches"`
}

// Modules — модули тарифа в справочнике.
type Modules struct {
	Payroll   bool `json:"payroll"`
	Inventory bool `json:"inventory"`
	CRM       bool `json:"crm"`
	Geo       bool `json:"geo"`
}

// PlanOption — краткая карточка активного тарифа для форм.
type PlanOption struct {
	ID      string      `json:"id"`
	Name    string      `json:"name"`
	Price   money.Diram `json:"price"`
	Limits  Limits      `json:"limits"`
	Modules Modules     `json:"modules"`
}

// Response — тело ответа dictionaries.get.
type Response struct {
	Cities     []string     `json:"cities"`
	Directions []string     `json:"directions"`
	Managers   []string     `json:"managers"`
	PayMethods []PayMethod  `json:"payMethods"`
	Plans      []PlanOption `json:"plans"`
}

// Service собирает справочники.
type Service struct {
	db *gorm.DB
}

// NewService создаёт сервис справочников.
func NewService(db *gorm.DB) *Service { return &Service{db: db} }

// Get возвращает все справочники.
func (s *Service) Get(ctx context.Context) (Response, error) {
	var managers []string
	if err := s.db.WithContext(ctx).Table("managers").
		Where("active").Order("name").Pluck("name", &managers).Error; err != nil {
		return Response{}, fmt.Errorf("dictionaries: managers: %w", err)
	}

	var plans []struct {
		ID              string      `gorm:"column:id"`
		Name            string      `gorm:"column:name"`
		PriceDiram      money.Diram `gorm:"column:price_diram"`
		LimitStaff      int         `gorm:"column:limit_staff"`
		LimitStorageGB  int         `gorm:"column:limit_storage_gb"`
		LimitBranches   int         `gorm:"column:limit_branches"`
		ModulePayroll   bool        `gorm:"column:module_payroll"`
		ModuleInventory bool        `gorm:"column:module_inventory"`
		ModuleCRM       bool        `gorm:"column:module_crm"`
		ModuleGeo       bool        `gorm:"column:module_geo"`
	}
	if err := s.db.WithContext(ctx).Table("plans").
		Where("active").Order("price_diram ASC").Scan(&plans).Error; err != nil {
		return Response{}, fmt.Errorf("dictionaries: plans: %w", err)
	}
	opts := make([]PlanOption, 0, len(plans))
	for _, p := range plans {
		opts = append(opts, PlanOption{
			ID:      p.ID,
			Name:    p.Name,
			Price:   p.PriceDiram,
			Limits:  Limits{Staff: p.LimitStaff, StorageGB: p.LimitStorageGB, Branches: p.LimitBranches},
			Modules: Modules{Payroll: p.ModulePayroll, Inventory: p.ModuleInventory, CRM: p.ModuleCRM, Geo: p.ModuleGeo},
		})
	}

	if managers == nil {
		managers = []string{}
	}
	return Response{
		Cities:     cities,
		Directions: directions,
		Managers:   managers,
		PayMethods: payMethods,
		Plans:      opts,
	}, nil
}

// Handler обслуживает маршрут справочников.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик справочников.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршрут.
func (h *Handler) Register(r gin.IRoutes) {
	r.GET("/dictionaries", h.get)
}

func (h *Handler) get(c *gin.Context) {
	res, err := h.svc.Get(c.Request.Context())
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}
