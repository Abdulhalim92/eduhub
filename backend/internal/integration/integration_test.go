// Package integration_test проверяет модули против реального PostgreSQL.
// Запускается только если задан TEST_DATABASE_URL; иначе пропускается.
// Все тесты в одном пакете и идут последовательно, т.к. делят одну БД (пересоздают схему).
package integration_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/internal/database"
	"github.com/line/eduhub-backend/internal/migrate"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/internal/modules/plans"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

func dsn(t *testing.T) string {
	v := os.Getenv("TEST_DATABASE_URL")
	if v == "" {
		t.Skip("TEST_DATABASE_URL не задан — пропускаю интеграционные тесты")
	}
	return v
}

// freshDB пересоздаёт схему (Down+Up) и возвращает соединение.
func freshDB(t *testing.T) (*gorm.DB, string) {
	url := dsn(t)
	_ = migrate.Down(url)
	if err := migrate.Up(url); err != nil {
		t.Fatalf("migrate up: %v", err)
	}
	db, err := database.Open(context.Background(), url)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = database.Close(db) })
	return db, url
}

func mustExec(t *testing.T, db *gorm.DB, v any) {
	t.Helper()
	if err := db.Create(v).Error; err != nil {
		t.Fatalf("insert: %v", err)
	}
}

func seedStartPlan(t *testing.T, db *gorm.DB) {
	mustExec(t, db, &plans.Plan{ID: "start", Name: "Старт", PriceDiram: money.FromSomoni(0), LimitStaff: 5, LimitStorageGB: 2, LimitBranches: 2, ModuleGeo: true, Active: true})
}

func seedProPlan(t *testing.T, db *gorm.DB) {
	mustExec(t, db, &plans.Plan{ID: "pro", Name: "Про", PriceDiram: money.FromSomoni(900), LimitStaff: 50, LimitStorageGB: 50, LimitBranches: 10, ModulePayroll: true, ModuleInventory: true, ModuleGeo: true, Active: true})
}

func asAPIError(t *testing.T, err error) *apierr.Error {
	t.Helper()
	ae, ok := err.(*apierr.Error)
	if !ok {
		t.Fatalf("ожидалась *apierr.Error, got %T: %v", err, err)
	}
	return ae
}

// --- auth ---

func newAuth(db *gorm.DB) *auth.Service {
	tokens := auth.NewTokenService("test-secret", time.Minute, time.Hour)
	return auth.NewService(db, auth.NewRepository(db), tokens, audit.New(), 4) // cost 4 — быстрее в тестах
}

func createSuperAdmin(t *testing.T, db *gorm.DB, svc *auth.Service, login, password string) {
	hash, err := svc.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	mustExec(t, db, &auth.User{Login: login, PasswordHash: hash, Role: auth.RoleSuperAdmin, Name: "Админ", MustChangePassword: true, Active: true})
}

func TestLoginLockoutAfterFiveFailures(t *testing.T) {
	db, _ := freshDB(t)
	svc := newAuth(db)
	createSuperAdmin(t, db, svc, "admin", "admin12345")
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		_, err := svc.Login(ctx, auth.LoginRequest{Login: "admin", Password: "wrong"})
		if asAPIError(t, err).Code != apierr.CodeUnauthorized {
			t.Fatalf("попытка %d: ожидался UNAUTHORIZED", i+1)
		}
	}
	// После пяти неудач даже верный пароль блокируется на 15 минут (BR-025).
	_, err := svc.Login(ctx, auth.LoginRequest{Login: "admin", Password: "admin12345"})
	if asAPIError(t, err).Code != apierr.CodeLocked {
		t.Fatalf("шестая попытка должна быть LOCKED, got %v", err)
	}
}

func TestLoginSuccessThenChangePassword(t *testing.T) {
	db, _ := freshDB(t)
	svc := newAuth(db)
	createSuperAdmin(t, db, svc, "admin", "admin12345")
	ctx := context.Background()

	sess, err := svc.Login(ctx, auth.LoginRequest{Login: "ADMIN", Password: "admin12345"})
	if err != nil {
		t.Fatalf("вход верными данными: %v", err)
	}
	if sess.Token == "" || !sess.MustChange || sess.Role != auth.RoleSuperAdmin {
		t.Fatalf("сессия некорректна: %+v", sess)
	}

	if _, err := svc.ChangePassword(ctx, auth.ChangePasswordRequest{Login: "admin", Password: "admin12345", NewPassword: "newPass123"}); err != nil {
		t.Fatalf("смена пароля: %v", err)
	}
	if _, err := svc.Login(ctx, auth.LoginRequest{Login: "admin", Password: "admin12345"}); err == nil {
		t.Fatal("старый пароль не должен работать после смены")
	}
	sess2, err := svc.Login(ctx, auth.LoginRequest{Login: "admin", Password: "newPass123"})
	if err != nil {
		t.Fatalf("новый пароль должен работать: %v", err)
	}
	if sess2.MustChange {
		t.Fatal("после смены mustChange должен стать false")
	}
}

// --- plans ---

func newPlans(db *gorm.DB) *plans.Service {
	return plans.NewService(plans.NewRepository(db), audit.New())
}

func actor() audit.Actor { return audit.Actor{Name: "Админ", Role: "SuperAdmin"} }

func TestPlanCreateAppearsInList(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db)
	svc := newPlans(db)
	ctx := context.Background()

	price := int64(500)
	dto, err := svc.Create(ctx, actor(), plans.CreateRequest{
		Name:    "Стандарт",
		Price:   &price,
		Limits:  &plans.Limits{Staff: 20, StorageGB: 20, Branches: 5},
		Modules: &plans.Modules{Geo: true},
	})
	if err != nil {
		t.Fatalf("создание тарифа: %v", err)
	}
	if dto.Price.Somoni() != 500 || !dto.Active {
		t.Fatalf("созданный тариф некорректен: %+v", dto)
	}
	res, err := svc.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, p := range res.Items {
		if p.Name == "Стандарт" {
			found = true
		}
	}
	if !found {
		t.Fatal("созданный тариф должен быть в списке (критерий PLT-TRF-010 №3)")
	}
}

func TestPlanUpdateLimitBelowUsageNamesCenter(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	// Центр на тарифе «Про» с 7 сотрудниками.
	mustExec(t, db, &centers.Center{Name: "Alpha School", City: "Душанбе", Owner: "Д.А.", Phone: "+992", PlanID: "pro", StaffUsed: 7, StorageUsedGB: 3, BranchesUsed: 1, Status: "active"})
	svc := newPlans(db)

	// Критерий PLT-TRF-010 №1: лимит сотрудников 5 ниже 7 → отказ с именем центра.
	_, err := svc.Update(context.Background(), actor(), "pro", plans.UpdateRequest{
		Limits: &plans.Limits{Staff: 5, StorageGB: 50, Branches: 10},
	})
	ae := asAPIError(t, err)
	if ae.Code != apierr.CodeValidation || ae.Fields["staff"] == "" {
		t.Fatalf("ожидалась VALIDATION с полем staff, got %+v", ae)
	}
}

func TestPlanArchiveWithCentersRejected(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	mustExec(t, db, &centers.Center{Name: "Alpha School", City: "Душанбе", Owner: "Д.А.", Phone: "+992", PlanID: "pro", StaffUsed: 7, StorageUsedGB: 3, BranchesUsed: 1, Status: "active"})
	svc := newPlans(db)

	inactive := false
	// Критерий PLT-TRF-010 №2: тариф с центрами нельзя архивировать.
	_, err := svc.Update(context.Background(), actor(), "pro", plans.UpdateRequest{Active: &inactive})
	if asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatalf("ожидался CONFLICT, got %v", err)
	}
}

func TestPlanArchiveFreeRejected(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db)
	svc := newPlans(db)
	inactive := false
	_, err := svc.Update(context.Background(), actor(), "start", plans.UpdateRequest{Active: &inactive})
	if asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatalf("бесплатный тариф нельзя архивировать: ожидался CONFLICT, got %v", err)
	}
}

// --- centers ---

func TestCentersListPaginationAndFilters(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	seedStartPlan(t, db)
	now := time.Now()
	// 1 овердрафт, 1 в оттоке (12 дней без входа), остальные обычные.
	overdraftBal := money.FromSomoni(-100)
	for i := 1; i <= 15; i++ {
		c := &centers.Center{Name: "Центр " + string(rune('А'+i)), City: "Душанбе", Owner: "Владелец", Phone: "+992", PlanID: "pro", StaffUsed: 1, StorageUsedGB: 1, BranchesUsed: 1, Status: "active", LastLoginAt: &now}
		if i == 1 {
			c.BalanceDiram = overdraftBal
		}
		if i == 2 {
			churned := now.AddDate(0, 0, -12)
			c.LastLoginAt = &churned
		}
		mustExec(t, db, c)
	}
	svc := centers.NewService(centers.NewRepository(db), audit.New())
	ctx := context.Background()

	res, err := svc.List(ctx, centers.ListQuery{Filter: "all", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatal(err)
	}
	if res.Total != 15 || len(res.Items) != 10 {
		t.Fatalf("пагинация: total=%d items=%d (ожидалось 15 и 10)", res.Total, len(res.Items))
	}
	if res.Meta.Overdraft != 1 {
		t.Fatalf("overdraft в meta = %d, ожидалось 1", res.Meta.Overdraft)
	}

	od, err := svc.List(ctx, centers.ListQuery{Filter: "overdraft", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatal(err)
	}
	if od.Total != 1 || od.Items[0].Balance >= 0 {
		t.Fatalf("фильтр overdraft: ожидался 1 центр с отрицательным балансом, got total=%d", od.Total)
	}

	ch, err := svc.List(ctx, centers.ListQuery{Filter: "churn", Page: 1, PageSize: 10})
	if err != nil {
		t.Fatal(err)
	}
	if ch.Total != 1 || !ch.Items[0].IsChurn {
		t.Fatalf("фильтр churn: total=%d, ожидалось 1 и isChurn=true", ch.Total)
	}
}
