package billing

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// StatusCounts — число счетов по статусам внутри выборки (для вкладок реестра).
type StatusCounts struct {
	Pending   int `json:"pending"`
	Overdue   int `json:"overdue"`
	Paid      int `json:"paid"`
	Trial     int `json:"trial"`
	Cancelled int `json:"cancelled"`
}

// ListMeta — сводка над реестром счетов (PLT-BIL-050).
type ListMeta struct {
	Total        int          `json:"total"`
	PendingSum   money.Diram  `json:"pendingSum"`
	PendingCount int          `json:"pendingCount"`
	OverdueSum   money.Diram  `json:"overdueSum"`
	OverdueCount int          `json:"overdueCount"`
	Paid30       money.Diram  `json:"paid30"`
	Trials       int          `json:"trials"`
	Counts       StatusCounts `json:"counts"`
}

// ListResponse — ответ billing.list.
type ListResponse struct {
	Items []InvoiceDTO `json:"items"`
	Meta  ListMeta     `json:"meta"`
}

// buildList строит DTO и сводку из базовой выборки (уже отфильтрованной по типу и поиску)
// и применяет фильтр по статусу к items. Признак «просрочен» считается здесь (BR-003).
func buildList(base []Invoice, briefs map[int64]CenterBrief, status string) ListResponse {
	res := ListResponse{Items: []InvoiceDTO{}}
	monthAgo := time.Now().AddDate(0, 0, -30)

	for _, inv := range base {
		dto := toInvoiceDTO(inv, briefs[inv.CenterID], nil)
		res.Meta.Total++
		switch inv.Status {
		case StatusPending:
			res.Meta.Counts.Pending++
			res.Meta.PendingCount++
			res.Meta.PendingSum += inv.AmountDiram
			if dto.Overdue {
				res.Meta.Counts.Overdue++
				res.Meta.OverdueCount++
				res.Meta.OverdueSum += inv.AmountDiram
			}
		case StatusPaid:
			res.Meta.Counts.Paid++
			if inv.PaidAt != nil && inv.PaidAt.After(monthAgo) {
				res.Meta.Paid30 += inv.AmountDiram
			}
		case StatusTrial:
			res.Meta.Counts.Trial++
			res.Meta.Trials++
		case StatusCancelled:
			res.Meta.Counts.Cancelled++
		}

		if matchesStatus(inv.Status, dto.Overdue, status) {
			res.Items = append(res.Items, dto)
		}
	}
	return res
}

func matchesStatus(status string, overdue bool, want string) bool {
	switch want {
	case "", "all":
		return true
	case "overdue":
		return status == StatusPending && overdue
	default:
		return status == want
	}
}
