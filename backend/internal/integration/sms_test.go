package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/internal/modules/sms"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

func newSMS(db *gorm.DB) *sms.Service {
	return sms.NewService(sms.NewRepository(db), audit.New(), idempotency.New(db))
}

func makePackage(t *testing.T, db *gorm.DB, id string, smsCount int, price int64) {
	t.Helper()
	mustExec(t, db, &sms.Package{ID: id, SMS: smsCount, PriceDiram: money.FromSomoni(price), Description: "демо пакет", Active: true})
}

func smsBalanceOf(t *testing.T, db *gorm.DB, centerID int64) int {
	t.Helper()
	var total int
	if err := db.Raw("SELECT COALESCE(SUM(remaining),0) FROM sms_sales WHERE center_id = ?", centerID).Scan(&total).Error; err != nil {
		t.Fatal(err)
	}
	return total
}

func smsAccrue(mode, pkg string, centerID int64) sms.AccrueRequest {
	return sms.AccrueRequest{CenterID: centerID, PackageID: pkg, Mode: mode}
}

func TestSMSAccrueBalance(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	makePackage(t, db, "sms500", 500, 120)
	svc := newSMS(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 500, 0, 1)

	sale, err := svc.Accrue(ctx, actor(), smsAccrue(sms.ModeBalance, "sms500", center), "")
	if err != nil {
		t.Fatalf("начисление с баланса: %v", err)
	}
	if sale.Status != sms.StatusPaid || sale.Remaining != 500 {
		t.Fatalf("продажа некорректна: %+v", sale)
	}
	if smsBalanceOf(t, db, center) != 500 {
		t.Fatalf("SMS-баланс центра = %d, ожидалось 500", smsBalanceOf(t, db, center))
	}
	if centerBalance(t, db, center) != 38000 { // 500 - 120 = 380 сомони
		t.Fatalf("баланс после списания 120 = %d дирам, ожидалось 38000", centerBalance(t, db, center))
	}
}

func TestSMSAccrueBalanceInsufficientAndBlocked(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	makePackage(t, db, "sms500", 500, 120)
	svc := newSMS(db)
	ctx := context.Background()

	poor := makeCenter(t, db, "pro", 0, 0, 1)
	if _, err := svc.Accrue(ctx, actor(), smsAccrue(sms.ModeBalance, "sms500", poor), ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("нехватка баланса должна отклонять начисление (BR-005)")
	}

	blocked := makeCenter(t, db, "pro", 1000, 0, 1)
	if err := db.Exec("UPDATE centers SET status = 'blocked' WHERE id = ?", blocked).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Accrue(ctx, actor(), smsAccrue(sms.ModeBalance, "sms500", blocked), ""); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("заблокированному центру начислять нельзя (BR-012)")
	}
}

func TestSMSAccrueManual(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	makePackage(t, db, "sms1000", 1000, 210)
	svc := newSMS(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)

	bad := smsAccrue(sms.ModeManual, "sms1000", center)
	bad.Method, bad.Reference, bad.ReceivedAmount, bad.ReceivedOn, bad.Confirmed = "Безнал (Р/С)", "ПП № 9", 100, time.Now().Format("2006-01-02"), true
	if _, err := svc.Accrue(ctx, actor(), bad, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("сумма не равная цене пакета должна отклоняться (BR-002)")
	}

	ok := smsAccrue(sms.ModeManual, "sms1000", center)
	ok.Method, ok.Reference, ok.ReceivedAmount, ok.ReceivedOn, ok.Confirmed = "Безнал (Р/С)", "ПП № 9", 210, time.Now().Format("2006-01-02"), true
	sale, err := svc.Accrue(ctx, actor(), ok, "")
	if err != nil {
		t.Fatalf("ручное начисление: %v", err)
	}
	if sale.Status != sms.StatusPaid || sale.Method != "Безнал (Р/С)" {
		t.Fatalf("продажа некорректна: %+v", sale)
	}
}

func TestSMSAccrueBonus(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	makePackage(t, db, "sms500", 500, 120)
	svc := newSMS(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)

	noReason := smsAccrue(sms.ModeBonus, "sms500", center)
	if _, err := svc.Accrue(ctx, actor(), noReason, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("бонус без причины должен отклоняться (BR-011)")
	}
	bonus := smsAccrue(sms.ModeBonus, "sms500", center)
	bonus.Reason = "компенсация за сбой"
	sale, err := svc.Accrue(ctx, actor(), bonus, "")
	if err != nil {
		t.Fatalf("бонусное начисление: %v", err)
	}
	if sale.Status != sms.StatusBonus || sale.Price.Somoni() != 0 {
		t.Fatalf("бонус должен быть бесплатным: %+v", sale)
	}
}

func TestSMSAccrueIdempotent(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	makePackage(t, db, "sms500", 500, 120)
	svc := newSMS(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 1000, 0, 1)

	key := "sms-idem-1"
	if _, err := svc.Accrue(ctx, actor(), smsAccrue(sms.ModeBalance, "sms500", center), key); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Accrue(ctx, actor(), smsAccrue(sms.ModeBalance, "sms500", center), key); err != nil {
		t.Fatal(err)
	}
	var n int64
	db.Raw("SELECT count(*) FROM sms_sales WHERE center_id = ?", center).Scan(&n)
	if n != 1 {
		t.Fatalf("повтор с тем же ключом не должен дублировать продажу: %d", n)
	}
	if smsBalanceOf(t, db, center) != 500 {
		t.Fatalf("SMS-баланс = %d, ожидалось 500 (одно начисление)", smsBalanceOf(t, db, center))
	}
}

func TestSMSUpdatePackageKeepsOldSalesPrice(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	makePackage(t, db, "sms500", 500, 120)
	svc := newSMS(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 1000, 0, 1)

	// Продажа по старой цене 120.
	if _, err := svc.Accrue(ctx, actor(), smsAccrue(sms.ModeBalance, "sms500", center), ""); err != nil {
		t.Fatal(err)
	}
	// Без причины — отказ.
	newPrice := int64(150)
	if _, err := svc.UpdatePackage(ctx, actor(), "sms500", sms.UpdatePackageRequest{Price: &newPrice, Description: "новое описание"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("смена цены без причины должна отклоняться")
	}
	// С причиной — ок.
	if _, err := svc.UpdatePackage(ctx, actor(), "sms500", sms.UpdatePackageRequest{Price: &newPrice, Description: "новое описание", Reason: "индексация цен"}); err != nil {
		t.Fatalf("смена цены: %v", err)
	}
	// Прошлая продажа сохраняет цену 120 (BR-020).
	var priceDiram int64
	db.Raw("SELECT price_diram FROM sms_sales WHERE center_id = ?", center).Scan(&priceDiram)
	if priceDiram != 12000 {
		t.Fatalf("прошлая продажа должна сохранить цену 120 сомони (12000 дирам), got %d", priceDiram)
	}
}

func TestCenterDTOHasSMSBalance(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	makePackage(t, db, "sms1000", 1000, 210)
	svc := newSMS(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 1000, 0, 1)
	if _, err := svc.Accrue(ctx, actor(), smsAccrue(sms.ModeBalance, "sms1000", center), ""); err != nil {
		t.Fatal(err)
	}
	centersSvc := centers.NewService(centers.NewRepository(db), audit.New())
	dto, err := centersSvc.DTOByID(ctx, center)
	if err != nil {
		t.Fatal(err)
	}
	if dto.SMSBalance != 1000 {
		t.Fatalf("smsBalance в centerDto = %d, ожидалось 1000", dto.SMSBalance)
	}
}
