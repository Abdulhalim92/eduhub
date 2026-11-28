package plans

import "github.com/line/eduhub-backend/pkg/money"

// Limits — лимиты тарифа (совпадают с контрактом api.js).
type Limits struct {
	Staff     int `json:"staff"`
	StorageGB int `json:"storageGb"`
	Branches  int `json:"branches"`
}

// Modules — доступные модули тарифа (Feature Flags).
type Modules struct {
	Payroll   bool `json:"payroll"`
	Inventory bool `json:"inventory"`
	CRM       bool `json:"crm"`
	Geo       bool `json:"geo"`
}

// DTO — тариф для ответа (planDto): план + isFree, centers, mrr.
type DTO struct {
	ID      string      `json:"id"`
	Name    string      `json:"name"`
	Price   money.Diram `json:"price"` // в JSON — целые сомони
	Limits  Limits      `json:"limits"`
	Modules Modules     `json:"modules"`
	Active  bool        `json:"active"`
	IsFree  bool        `json:"isFree"`
	Centers int         `json:"centers"`
	MRR     int64       `json:"mrr"` // сомони: centers * price
}

// ListMeta — сводка над списком тарифов.
type ListMeta struct {
	Total       int   `json:"total"`
	Active      int   `json:"active"`
	PaidCenters int   `json:"paidCenters"`
	MRR         int64 `json:"mrr"`
	NearLimit   int   `json:"nearLimit"`
}

// ListResponse — ответ plans.list.
type ListResponse struct {
	Items []DTO    `json:"items"`
	Meta  ListMeta `json:"meta"`
}

// CreateRequest — тело POST /plans. Цена — целые сомони.
type CreateRequest struct {
	Name    string   `json:"name"`
	Price   *int64   `json:"price"`
	Limits  *Limits  `json:"limits"`
	Modules *Modules `json:"modules"`
}

// UpdateRequest — тело PATCH /plans/{id}. Все поля опциональны.
type UpdateRequest struct {
	Price   *int64   `json:"price"`
	Limits  *Limits  `json:"limits"`
	Modules *Modules `json:"modules"`
	Active  *bool    `json:"active"`
}

func toDTO(p Plan, centers int) DTO {
	return DTO{
		ID:    p.ID,
		Name:  p.Name,
		Price: p.PriceDiram,
		Limits: Limits{
			Staff:     p.LimitStaff,
			StorageGB: p.LimitStorageGB,
			Branches:  p.LimitBranches,
		},
		Modules: Modules{
			Payroll:   p.ModulePayroll,
			Inventory: p.ModuleInventory,
			CRM:       p.ModuleCRM,
			Geo:       p.ModuleGeo,
		},
		Active:  p.Active,
		IsFree:  p.PriceDiram == 0,
		Centers: centers,
		MRR:     int64(centers) * p.PriceDiram.Somoni(),
	}
}
