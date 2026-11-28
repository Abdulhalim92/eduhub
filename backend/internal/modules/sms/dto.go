package sms

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// PackageDTO — пакет каталога с числом продаж и центров.
type PackageDTO struct {
	ID          string      `json:"id"`
	SMS         int         `json:"sms"`
	Price       money.Diram `json:"price"`
	Description string      `json:"description"`
	Active      bool        `json:"active"`
	Sold        int         `json:"sold"`
	Centers     int         `json:"centers"`
}

// PackagesMeta — сводка каталога.
type PackagesMeta struct {
	Total   int `json:"total"`   // суммарный остаток SMS по всем продажам
	Revenue int64 `json:"revenue"` // сомони: сумма по оплаченным продажам
	Low     int `json:"low"`     // продаж с остатком ≤10%
}

// PackagesResponse — ответ sms.packages.
type PackagesResponse struct {
	Items []PackageDTO `json:"items"`
	Meta  PackagesMeta `json:"meta"`
}

// SaleDTO — продажа для ответа.
type SaleDTO struct {
	ID         string      `json:"id"`
	CenterID   int64       `json:"centerId"`
	Center     string      `json:"center"`
	PackageID  string      `json:"packageId"`
	SMS        int         `json:"sms"`
	Remaining  int         `json:"remaining"`
	Price      money.Diram `json:"price"`
	BoughtAt   time.Time   `json:"boughtAt"`
	Status     string      `json:"status"`
	Method     string      `json:"method"`
	Reference  string      `json:"reference"`
	Reason     string      `json:"reason"`
	Low        bool        `json:"low"`
	UsedPct    int         `json:"usedPct"`
}

// SalesCounts — счётчики продаж по статусам и остаткам.
type SalesCounts struct {
	Paid  int `json:"paid"`
	Bonus int `json:"bonus"`
	Low   int `json:"low"`
}

// SalesResponse — ответ sms.sales.
type SalesResponse struct {
	Items    []SaleDTO   `json:"items"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
	Counts   SalesCounts `json:"counts"`
}

func toSaleDTO(s Sale, center string) SaleDTO {
	return SaleDTO{
		ID: s.ID, CenterID: s.CenterID, Center: center, PackageID: s.PackageID, SMS: s.SMS,
		Remaining: s.Remaining, Price: s.PriceDiram, BoughtAt: s.BoughtAt, Status: s.Status,
		Method: s.Method, Reference: s.Reference, Reason: s.Reason, Low: s.low(), UsedPct: s.usedPct(),
	}
}
