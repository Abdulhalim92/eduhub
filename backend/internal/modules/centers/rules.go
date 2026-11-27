package centers

import (
	"math"
	"time"
)

// Бизнес-правила центров (на проде — на сервере, как указано в api.js).
const (
	churnDays      = 10 // дней без входа, после которых центр в оттоке
	expiringWithin = 14 // дней до конца подписки для признака «истекает»
	nearLimitPct   = 80 // порог «у лимита» (BR-021)
)

// loginDays — сколько дней назад был последний вход (0, если не входил).
func loginDays(lastLoginAt *time.Time) (days int, neverLogged bool) {
	if lastLoginAt == nil {
		return 0, true
	}
	d := int(math.Floor(time.Since(*lastLoginAt).Hours() / 24))
	if d < 0 {
		d = 0
	}
	return d, false
}

// expiresInDays — сколько дней до конца подписки (nil, если не истекает).
func expiresInDays(expiresAt *time.Time) *int {
	if expiresAt == nil {
		return nil
	}
	d := int(math.Ceil(time.Until(*expiresAt).Hours() / 24))
	return &d
}

func isActive(r Row) bool { return r.Status == "active" }

// isExpiring: активный платный центр с подпиской, истекающей в пределах within дней.
func isExpiring(r Row, within int) bool {
	if !isActive(r) || r.PlanPriceDiram == 0 || r.ExpiresAt == nil {
		return false
	}
	ed := expiresInDays(r.ExpiresAt)
	return ed != nil && *ed <= within
}

// isChurn: активный центр, который входил, но не заходил больше churnDays дней.
func isChurn(r Row) bool {
	days, never := loginDays(r.LastLoginAt)
	return isActive(r) && !never && days > churnDays
}

// riskScore — оценка риска оттока (0..100), повторяет формулу mock.
func riskScore(r Row) int {
	days, _ := loginDays(r.LastLoginAt)
	s := 40 + (days-churnDays)*4
	if r.Lessons7d == 0 {
		s += 20
	}
	if isExpiring(r, expiringWithin) {
		s += 15
	}
	if s < 0 {
		s = 0
	}
	if s > 100 {
		s = 100
	}
	return s
}

func riskLevel(score int) string {
	switch {
	case score >= 75:
		return "high"
	case score >= 50:
		return "medium"
	default:
		return "low"
	}
}

func pct(used, limit int) int {
	if limit == 0 {
		return 0
	}
	return int(math.Round(float64(used) / float64(limit) * 100))
}

// nearLimit: активный центр, где любой из трёх лимитов заполнен на >= threshold%.
func nearLimit(r Row, threshold int) bool {
	if !isActive(r) {
		return false
	}
	return pct(r.StaffUsed, r.LimitStaff) >= threshold ||
		pct(r.StorageUsedGB, r.LimitStorageGB) >= threshold ||
		pct(r.BranchesUsed, r.LimitBranches) >= threshold
}
