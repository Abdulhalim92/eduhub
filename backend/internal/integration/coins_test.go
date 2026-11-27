package integration_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/line/eduhub-backend/internal/modules/cabinet"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

func strptr(s string) *string { return &s }
func intptr(n int) *int       { return &n }

func addStudent(t *testing.T, svc *cabinet.Service, center int64, i int) int64 {
	t.Helper()
	res, err := svc.AddStudent(context.Background(), actor(), center, cabinet.AddStudentRequest{
		Name: fmt.Sprintf("Ученик Номер %d", i), Phone: fmt.Sprintf("+992 90 %03d %02d %02d", i, i, i), Login: fmt.Sprintf("pupil%02d", i),
	})
	if err != nil {
		t.Fatalf("добавление ученика %d: %v", i, err)
	}
	return res.Student.ID
}

func studentCoin(t *testing.T, db *gorm.DB, id int64) int {
	t.Helper()
	var coin int
	if err := db.Raw("SELECT coin FROM students WHERE id = ?", id).Scan(&coin).Error; err != nil {
		t.Fatal(err)
	}
	return coin
}

func TestRewardCreateFilterArchive(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)

	// Цена 0 → отказ.
	if _, err := svc.CreateReward(ctx, center, cabinet.RewardRequest{Name: strptr("Награда"), Category: strptr("Мерч"), Price: intptr(0)}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("цена 0 должна отклоняться")
	}
	// Неизвестная категория → отказ.
	if _, err := svc.CreateReward(ctx, center, cabinet.RewardRequest{Name: strptr("Награда"), Category: strptr("Чужое"), Price: intptr(500)}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("неизвестная категория должна отклоняться")
	}
	a, err := svc.CreateReward(ctx, center, cabinet.RewardRequest{Name: strptr("Скидка 10%"), Category: strptr("Скидки"), Price: intptr(600)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateReward(ctx, center, cabinet.RewardRequest{Name: strptr("Футболка"), Category: strptr("Мерч"), Price: intptr(900)}); err != nil {
		t.Fatal(err)
	}
	// Диапазон цены 500–800 → только первая.
	res, err := svc.RewardsList(ctx, center, "", intptr(500), intptr(800), 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if res.Total != 1 || res.Items[0].Price != 600 {
		t.Fatalf("фильтр по цене 500–800 должен вернуть одну награду 600: %+v", res.Items)
	}
	// Архивация и фильтр по статусу.
	if _, err := svc.UpdateReward(ctx, center, a.ID, cabinet.RewardRequest{Status: strptr("archived")}); err != nil {
		t.Fatal(err)
	}
	arch, err := svc.RewardsList(ctx, center, "archived", nil, nil, 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if arch.Total != 1 || arch.Items[0].ID != a.ID {
		t.Fatalf("фильтр «в архиве» должен вернуть одну награду: %+v", arch.Items)
	}
}

func TestCoinRuleCreateToggleFilter(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)

	// Порог > 100 → отказ.
	if _, err := svc.CreateCoinRule(ctx, center, cabinet.CoinRuleRequest{Name: strptr("Правило"), Scope: strptr("academy"), Threshold: intptr(101), Coin: intptr(30)}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("порог больше 100 должен отклоняться")
	}
	rule, err := svc.CreateCoinRule(ctx, center, cabinet.CoinRuleRequest{Name: strptr("Посещаемость"), Scope: strptr("academy"), Threshold: intptr(90), Coin: intptr(30)})
	if err != nil {
		t.Fatal(err)
	}
	if rule.Condition != "Средний % ≥ 90" || !rule.Active {
		t.Fatalf("правило некорректно: %+v", rule)
	}
	// Выключение не меняет прочие поля.
	off, err := svc.UpdateCoinRule(ctx, center, rule.ID, cabinet.CoinRuleRequest{Active: boolptr(false)})
	if err != nil {
		t.Fatal(err)
	}
	if off.Active || off.Threshold != 90 || off.Coin != 30 {
		t.Fatalf("выключение изменило прочие поля: %+v", off)
	}
	// Фильтр по области.
	list, err := svc.CoinRulesList(ctx, center, "course", 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if list.Total != 0 {
		t.Fatalf("по области course правил нет, got %d", list.Total)
	}
}

func boolptr(b bool) *bool { return &b }

func TestGrantCoinRulesAndBlocks(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)
	sid := addStudent(t, svc, center, 1)

	if _, err := svc.GrantCoin(ctx, actor(), center, sid, 0, "мало"); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("количество 0 должно отклоняться")
	}
	if _, err := svc.GrantCoin(ctx, actor(), center, sid, 50, "нет"); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("основание короче 5 должно отклоняться")
	}
	res, err := svc.GrantCoin(ctx, actor(), center, sid, 50, "победа в олимпиаде")
	if err != nil {
		t.Fatalf("начисление: %v", err)
	}
	if res.Coin != 50 || studentCoin(t, db, sid) != 50 {
		t.Fatalf("coin ученика должен стать 50: dto=%d db=%d", res.Coin, studentCoin(t, db, sid))
	}
	// Аудит coin.granted.
	var n int64
	db.Raw("SELECT count(*) FROM audit_log WHERE action = 'coin.granted'").Scan(&n)
	if n < 1 {
		t.Fatal("должна быть запись аудита coin.granted")
	}
	// Заблокированный ученик → отказ.
	if _, err := svc.SetStudentStatus(ctx, actor(), center, sid, "blocked", "нарушение правил"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.GrantCoin(ctx, actor(), center, sid, 10, "ещё немного"); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("заблокированному ученику начислять нельзя")
	}
	// Заблокированный центр → отказ (BR-012).
	sid2 := addStudent(t, svc, center, 2)
	if err := db.Exec("UPDATE centers SET status = 'blocked' WHERE id = ?", center).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := svc.GrantCoin(ctx, actor(), center, sid2, 10, "попытка в блоке"); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("в заблокированном центре начисление недоступно (BR-012)")
	}
}

func TestAnalyticsRankingAndRange(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)
	s1 := addStudent(t, svc, center, 1)
	s2 := addStudent(t, svc, center, 2)
	s3 := addStudent(t, svc, center, 3)
	mustGrant(t, svc, center, s1, 100)
	mustGrant(t, svc, center, s2, 50)
	mustGrant(t, svc, center, s3, 50)

	res, err := svc.Analytics(ctx, center, nil, nil, nil, "", 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if res.Total != 3 || res.Items[0].Coin != 100 {
		t.Fatalf("рейтинг должен быть по убыванию coin: %+v", res.Items)
	}
	if res.Totals.Students != 3 || res.Totals.Coin != 200 || res.Totals.Avg != 67 {
		t.Fatalf("итоги неверны: %+v", res.Totals)
	}
	// Диапазон «от 50 до 50» → только ученики с 50.
	rng, err := svc.Analytics(ctx, center, nil, intptr(50), intptr(50), "", 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if rng.Total != 2 {
		t.Fatalf("диапазон 50–50 должен вернуть двоих, got %d", rng.Total)
	}
}

func mustGrant(t *testing.T, svc *cabinet.Service, center, sid int64, amount int) {
	t.Helper()
	if _, err := svc.GrantCoin(context.Background(), actor(), center, sid, amount, "начисление за успехи"); err != nil {
		t.Fatalf("начисление coin: %v", err)
	}
}
