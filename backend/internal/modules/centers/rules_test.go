package centers

import (
	"testing"
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

func daysAgo(d int) *time.Time   { t := time.Now().AddDate(0, 0, -d); return &t }
func daysAhead(d int) *time.Time { t := time.Now().AddDate(0, 0, d); return &t }

func baseRow() Row {
	return Row{
		Status: "active", PlanName: "Про", PlanPriceDiram: money.FromSomoni(900),
		LimitStaff: 50, LimitStorageGB: 50, LimitBranches: 10,
		StaffUsed: 10, StorageUsedGB: 10, BranchesUsed: 2,
		LastLoginAt: daysAgo(0), Lessons7d: 40,
	}
}

func TestLoginDaysNeverLogged(t *testing.T) {
	days, never := loginDays(nil)
	if !never || days != 0 {
		t.Fatalf("nil lastLogin → neverLogged, got days=%d never=%v", days, never)
	}
}

func TestIsChurn(t *testing.T) {
	r := baseRow()
	r.LastLoginAt = daysAgo(11)
	if !isChurn(r) {
		t.Fatal("11 дней без входа → отток")
	}
	r.LastLoginAt = daysAgo(10)
	if isChurn(r) {
		t.Fatal("ровно 10 дней — ещё не отток (условие > 10)")
	}
	r.LastLoginAt = nil
	if isChurn(r) {
		t.Fatal("ни разу не входил — не отток")
	}
}

func TestIsExpiring(t *testing.T) {
	r := baseRow()
	r.ExpiresAt = daysAhead(14)
	if !isExpiring(r, expiringWithin) {
		t.Fatal("подписка через 14 дней → истекает")
	}
	r.ExpiresAt = daysAhead(20)
	if isExpiring(r, expiringWithin) {
		t.Fatal("подписка через 20 дней — не истекает")
	}
	r.PlanPriceDiram = 0
	r.ExpiresAt = daysAhead(5)
	if isExpiring(r, expiringWithin) {
		t.Fatal("бесплатный тариф не истекает")
	}
}

func TestNearLimit(t *testing.T) {
	r := baseRow()
	r.StaffUsed = 40 // 40/50 = 80%
	if !nearLimit(r, nearLimitPct) {
		t.Fatal("80% сотрудников → у лимита")
	}
	r.StaffUsed = 39 // 78%
	if nearLimit(r, nearLimitPct) {
		t.Fatal("78% — ещё не у лимита")
	}
	r.Status = "blocked"
	r.StaffUsed = 50
	if nearLimit(r, nearLimitPct) {
		t.Fatal("заблокированный центр не считается у лимита")
	}
}

func TestRiskScoreAndLevel(t *testing.T) {
	r := baseRow()
	r.LastLoginAt = daysAgo(20) // 40 + (20-10)*4 = 80
	r.Lessons7d = 40
	r.ExpiresAt = daysAhead(90)
	if got := riskScore(r); got != 80 {
		t.Fatalf("riskScore = %d, ожидалось 80", got)
	}
	if riskLevel(80) != "high" {
		t.Fatal("80 → high")
	}
	if riskLevel(50) != "medium" || riskLevel(49) != "low" {
		t.Fatal("границы medium/low неверны")
	}
}

func TestDTOFinanceOverdraft(t *testing.T) {
	r := baseRow()
	r.BalanceDiram = money.FromSomoni(-150)
	r.OverdraftLimitDiram = money.FromSomoni(300)
	dto := toDTO(r)
	if dto.OverdraftUsed.Somoni() != 150 {
		t.Fatalf("overdraftUsed = %d, ожидалось 150", dto.OverdraftUsed.Somoni())
	}
	if dto.Available.Somoni() != 150 {
		t.Fatalf("available = %d, ожидалось 150 (-150 + 300)", dto.Available.Somoni())
	}
	if dto.OverdraftPct == nil || *dto.OverdraftPct != 50 {
		t.Fatalf("overdraftPct ожидался 50")
	}
	if dto.FinanceStatus != "overdraft" {
		t.Fatalf("financeStatus = %s, ожидался overdraft", dto.FinanceStatus)
	}
}
