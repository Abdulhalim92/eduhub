package plans

import (
	"strings"
	"testing"
)

func i64(v int64) *int64 { return &v }

func TestValidatePricePaidRules(t *testing.T) {
	s := &Service{}
	f := map[string]string{}
	s.validatePrice(i64(0), false, f) // платный тариф не может стоить 0
	if f["price"] == "" {
		t.Fatal("платный тариф с ценой 0 должен давать ошибку")
	}

	f = map[string]string{}
	s.validatePrice(i64(900), false, f)
	if len(f) != 0 {
		t.Fatalf("корректная цена не должна давать ошибок: %v", f)
	}

	f = map[string]string{}
	s.validatePrice(i64(2_000_000), false, f)
	if f["price"] == "" {
		t.Fatal("цена выше максимума должна давать ошибку")
	}
}

func TestValidatePriceFreeStaysFree(t *testing.T) {
	s := &Service{}
	f := map[string]string{}
	s.validatePrice(i64(100), true, f) // бесплатный тариф обязан остаться бесплатным
	if f["price"] == "" {
		t.Fatal("бесплатный тариф с ненулевой ценой должен давать ошибку")
	}
}

func TestValidateLimitsNotBelowUsageNamesCenter(t *testing.T) {
	s := &Service{}
	onPlan := []CenterUsage{
		{Name: "Alpha School", StaffUsed: 7, StorageUsedGB: 3, BranchesUsed: 1},
		{Name: "Math Lab", StaffUsed: 4, StorageUsedGB: 9, BranchesUsed: 2},
	}
	f := map[string]string{}
	// Критерий приёмки PLT-TRF-010 №1: лимит сотрудников 5 ниже 7 у «Alpha School».
	s.validateLimits(&Limits{Staff: 5, StorageGB: 50, Branches: 10}, onPlan, f)
	if msg := f["staff"]; !strings.Contains(msg, "Alpha School") || !strings.Contains(msg, "7") {
		t.Fatalf("ошибка по сотрудникам должна называть центр и использование, got %q", msg)
	}
	if f["storageGb"] != "" || f["branches"] != "" {
		t.Fatalf("по хранилищу и филиалам ошибок быть не должно: %v", f)
	}
}

func TestValidateLimitsBelowOne(t *testing.T) {
	s := &Service{}
	f := map[string]string{}
	s.validateLimits(&Limits{Staff: 0, StorageGB: 10, Branches: 3}, nil, f)
	if f["staff"] == "" {
		t.Fatal("лимит 0 должен давать ошибку «целое число от 1»")
	}
}

func TestWorstPicksMaxPerMetric(t *testing.T) {
	w := worst([]CenterUsage{
		{Name: "A", StaffUsed: 7, StorageUsedGB: 3, BranchesUsed: 1},
		{Name: "B", StaffUsed: 4, StorageUsedGB: 9, BranchesUsed: 5},
	})
	if w.staff != 7 || w.staffName != "A" {
		t.Fatalf("worst staff: got %d/%s", w.staff, w.staffName)
	}
	if w.storage != 9 || w.storageName != "B" {
		t.Fatalf("worst storage: got %d/%s", w.storage, w.storageName)
	}
	if w.branches != 5 || w.branchesName != "B" {
		t.Fatalf("worst branches: got %d/%s", w.branches, w.branchesName)
	}
}
