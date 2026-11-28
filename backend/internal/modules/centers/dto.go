package centers

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// PendingChange — открытый счёт центра на смену тарифа (pendingChange в centerDto).
type PendingChange struct {
	InvoiceID string      `json:"invoiceId"`
	PlanID    string      `json:"planId"`
	PlanName  string      `json:"planName"`
	Amount    money.Diram `json:"amount"`
	Deferred  bool        `json:"deferred"`
	DueAt     *time.Time  `json:"dueAt"`
	Overdue   bool        `json:"overdue"`
}

// UsageItem — использование одного лимита (как в api.js usageOf).
type UsageItem struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Used  int    `json:"used"`
	Limit int    `json:"limit"`
	Pct   int    `json:"pct"`
}

// Limits — лимиты тарифа центра.
type Limits struct {
	Staff     int `json:"staff"`
	StorageGB int `json:"storageGb"`
	Branches  int `json:"branches"`
}

// DTO — центр для ответа (centerDto). Деньги — целые сомони.
// Поля offer/pendingChange/smsBalance появятся с денежным и SMS-модулями;
// пока отдаются нейтральные значения, чтобы не ломать форму ответа.
type DTO struct {
	ID           int64       `json:"id"`
	Name         string      `json:"name"`
	City         string      `json:"city"`
	Owner        string      `json:"owner"`
	Phone        string      `json:"phone"`
	Plan         string      `json:"plan"`
	Manager      *string     `json:"manager"`
	Status       string      `json:"status"`
	StaffUsed    int         `json:"staffUsed"`
	StorageUsedGB int        `json:"storageUsedGb"`
	BranchesUsed int         `json:"branchesUsed"`
	Lessons7d    int         `json:"lessons7d"`
	LoginDays    int         `json:"loginDays"`
	NeverLogged  bool        `json:"neverLogged"`
	ExpiresIn    *int        `json:"expiresIn"`
	Contacted    bool        `json:"contacted"`
	Reminded     bool        `json:"reminded"`

	Balance        money.Diram `json:"balance"`
	OverdraftLimit money.Diram `json:"overdraftLimit"`
	MonthlyPrice   money.Diram `json:"monthlyPrice"`
	OverdraftUsed  money.Diram `json:"overdraftUsed"`
	Available      money.Diram `json:"available"`
	OverdraftPct   *int        `json:"overdraftPct"`
	FinanceStatus  string      `json:"financeStatus"`
	SMSBalance     int         `json:"smsBalance"`

	IsChurn    bool        `json:"isChurn"`
	IsExpiring bool        `json:"isExpiring"`
	NearLimit  bool        `json:"nearLimit"`
	Staff      [2]int      `json:"staff"`
	StaffPct   int         `json:"staffPct"`
	Limits     Limits      `json:"limits"`
	Usage      []UsageItem `json:"usage"`
	Worst      UsageItem   `json:"worst"`
	RiskScore  *int        `json:"riskScore"`
	RiskLevel  *string     `json:"riskLevel"`

	// offer — под модуль адресных предложений (near-limit), пока null.
	Offer         *struct{}      `json:"offer"`
	PendingChange *PendingChange `json:"pendingChange"`
}

// ListMeta — сводка над списком центров.
type ListMeta struct {
	ActiveSubs int `json:"activeSubs"`
	NewMonth   int `json:"newMonth"`
	Overdraft  int `json:"overdraft"`
}

// ListResponse — ответ centers.list.
type ListResponse struct {
	Items         []DTO    `json:"items"`
	Total         int      `json:"total"`
	Page          int      `json:"page"`
	PageSize      int      `json:"pageSize"`
	PlatformTotal int      `json:"platformTotal"`
	Meta          ListMeta `json:"meta"`
}

// SetManagerRequest — тело PUT /centers/{id}/manager.
type SetManagerRequest struct {
	Manager *string `json:"manager"`
}

func toDTO(r Row) DTO {
	days, never := loginDays(r.LastLoginAt)
	usage := []UsageItem{
		{Key: "staff", Label: "Сотрудники", Used: r.StaffUsed, Limit: r.LimitStaff, Pct: pct(r.StaffUsed, r.LimitStaff)},
		{Key: "storage", Label: "Хранилище, ГБ", Used: r.StorageUsedGB, Limit: r.LimitStorageGB, Pct: pct(r.StorageUsedGB, r.LimitStorageGB)},
		{Key: "branches", Label: "Филиалы", Used: r.BranchesUsed, Limit: r.LimitBranches, Pct: pct(r.BranchesUsed, r.LimitBranches)},
	}
	worst := usage[0]
	for _, u := range usage[1:] {
		if u.Pct > worst.Pct {
			worst = u
		}
	}

	used := money.Diram(0)
	if r.BalanceDiram < 0 {
		used = -r.BalanceDiram
	}
	var overdraftPct *int
	financeStatus := "ok"
	if r.BalanceDiram < 0 {
		if r.OverdraftLimitDiram > 0 {
			p := int(float64(used)/float64(r.OverdraftLimitDiram)*100 + 0.5)
			overdraftPct = &p
			if p >= 80 {
				financeStatus = "critical"
			} else {
				financeStatus = "overdraft"
			}
		} else {
			financeStatus = "overdraft"
		}
	}

	churn := isChurn(r)
	var scorePtr *int
	var levelPtr *string
	if churn {
		s := riskScore(r)
		scorePtr = &s
		l := riskLevel(s)
		levelPtr = &l
	}

	return DTO{
		ID:            r.ID,
		Name:          r.Name,
		City:          r.City,
		Owner:         r.Owner,
		Phone:         r.Phone,
		Plan:          r.PlanName,
		Manager:       r.ManagerName,
		Status:        r.Status,
		StaffUsed:     r.StaffUsed,
		StorageUsedGB: r.StorageUsedGB,
		BranchesUsed:  r.BranchesUsed,
		Lessons7d:     r.Lessons7d,
		LoginDays:     days,
		NeverLogged:   never,
		ExpiresIn:     expiresInDays(r.ExpiresAt),
		Contacted:     r.Contacted,
		Reminded:      r.Reminded,

		Balance:        r.BalanceDiram,
		OverdraftLimit: r.OverdraftLimitDiram,
		MonthlyPrice:   r.PlanPriceDiram,
		OverdraftUsed:  used,
		Available:      r.BalanceDiram + r.OverdraftLimitDiram,
		OverdraftPct:   overdraftPct,
		FinanceStatus:  financeStatus,
		SMSBalance:     0,

		IsChurn:    churn,
		IsExpiring: isExpiring(r, expiringWithin),
		NearLimit:  nearLimit(r, nearLimitPct),
		Staff:      [2]int{r.StaffUsed, r.LimitStaff},
		StaffPct:   pct(r.StaffUsed, r.LimitStaff),
		Limits:     Limits{Staff: r.LimitStaff, StorageGB: r.LimitStorageGB, Branches: r.LimitBranches},
		Usage:      usage,
		Worst:      worst,
		RiskScore:  scorePtr,
		RiskLevel:  levelPtr,
	}
}
