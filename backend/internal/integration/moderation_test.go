package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/modules/moderation"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

func newModeration(db *gorm.DB) *moderation.Service {
	return moderation.NewService(moderation.NewRepository(db), audit.New())
}

func branchInput(addr string) moderation.BranchInput {
	return moderation.BranchInput{
		Branch: "Филиал Тест", City: "Душанбе", District: "Сино", Address: addr, Phone: "+992 90 000 00 00",
		GPS:  moderation.Point{Lat: 38.56, Lng: 68.78},
		Desc: moderation.Desc{RU: "Описание филиала на русском языке, достаточно длинное для публикации."},
	}
}

func TestBranchSubmitAppearsInQueue(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newModeration(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)

	sub, err := svc.Submit(ctx, actor(), center, branchInput("ул. Рудаки, 10"))
	if err != nil {
		t.Fatalf("подача заявки: %v", err)
	}
	if sub.Status != moderation.StatusPending {
		t.Fatalf("заявка должна быть pending: %+v", sub)
	}
	list, err := svc.List(ctx, moderation.StatusPending)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, it := range list.Items {
		if it.ID == sub.ID {
			found = true
		}
	}
	if !found || list.Meta.Pending < 1 {
		t.Fatal("поданная заявка должна быть в очереди pending")
	}
}

func TestBranchSubmitLimitAndDuplicate(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db) // лимит филиалов тарифа «Старт» = 2
	svc := newModeration(db)
	ctx := context.Background()
	center := makeCenter(t, db, "start", 0, 0, 1)

	if _, err := svc.Submit(ctx, actor(), center, branchInput("ул. Первая, 1")); err != nil {
		t.Fatal(err)
	}
	// Дубль адреса.
	if _, err := svc.Submit(ctx, actor(), center, branchInput("ул. Первая, 1")); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("дубль адреса должен отклоняться")
	}
	if _, err := svc.Submit(ctx, actor(), center, branchInput("ул. Вторая, 2")); err != nil {
		t.Fatal(err)
	}
	// Третья заявка превышает лимит филиалов (BR-018).
	_, err := svc.Submit(ctx, actor(), center, branchInput("ул. Третья, 3"))
	ae := asAPIError(t, err)
	if ae.Code != apierr.CodeValidation || ae.Fields["branch"] == "" {
		t.Fatalf("превышение лимита филиалов должно отклоняться (BR-018): %+v", ae)
	}
}

func TestBranchInvalidData(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newModeration(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)

	// Короткое RU-описание и координаты вне Таджикистана.
	in := branchInput("ул. Тестовая, 5")
	in.Desc.RU = "коротко"
	in.GPS = moderation.Point{Lat: 10, Lng: 10}
	_, err := svc.Submit(ctx, actor(), center, in)
	ae := asAPIError(t, err)
	if ae.Code != apierr.CodeValidation || ae.Fields["descRu"] == "" || ae.Fields["gps"] == "" {
		t.Fatalf("короткое RU и координаты вне страны должны отклоняться: %+v", ae)
	}
}

func TestDecidePublishRequiresTJAndGPS(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newModeration(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)
	sub, err := svc.Submit(ctx, actor(), center, branchInput("ул. Рудаки, 20")) // без TJ, gpsOk=false
	if err != nil {
		t.Fatal(err)
	}
	// Публикация без TJ/подтверждения координат — отказ (BR-017).
	if _, err := svc.Decide(ctx, actor(), sub.ID, moderation.DecideInput{Decision: moderation.StatusPublished}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("публикация без TJ/координат должна отклоняться (BR-017)")
	}
	// С TJ и подтверждёнными координатами — публикуется.
	res, err := svc.Decide(ctx, actor(), sub.ID, moderation.DecideInput{
		Decision:     moderation.StatusPublished,
		Desc:         &moderation.Desc{RU: "Описание филиала на русском языке, достаточно длинное.", TJ: "Тавсифи филиал ба забони тоҷикӣ, ба қадри кофӣ дароз."},
		GPS:          &moderation.Point{Lat: 38.56, Lng: 68.78},
		GPSConfirmed: true,
	})
	if err != nil {
		t.Fatalf("публикация должна пройти: %v", err)
	}
	if res.Status != moderation.StatusPublished {
		t.Fatalf("статус должен быть published: %+v", res)
	}
}

func TestDecideReturnNeedsReasonAndResubmit(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newModeration(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)
	sub, err := svc.Submit(ctx, actor(), center, branchInput("ул. Рудаки, 30"))
	if err != nil {
		t.Fatal(err)
	}
	// Возврат без причины — отказ.
	if _, err := svc.Decide(ctx, actor(), sub.ID, moderation.DecideInput{Decision: moderation.StatusReturned}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("возврат без причины должен отклоняться")
	}
	// Возврат с причиной.
	ret, err := svc.Decide(ctx, actor(), sub.ID, moderation.DecideInput{Decision: moderation.StatusReturned, Reason: "добавьте описание TJ"})
	if err != nil {
		t.Fatal(err)
	}
	if ret.Status != moderation.StatusReturned || ret.Reason == "" {
		t.Fatalf("заявка должна быть returned с причиной: %+v", ret)
	}
	// Resubmit возможен только из returned → снова pending.
	again, err := svc.Resubmit(ctx, actor(), center, sub.ID, branchInput("ул. Рудаки, 30"))
	if err != nil {
		t.Fatalf("resubmit после возврата: %v", err)
	}
	if again.Status != moderation.StatusPending || again.GPSOk {
		t.Fatalf("после resubmit заявка должна стать pending с gpsOk=false: %+v", again)
	}
}

func TestResubmitOnlyFromReturned(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newModeration(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)
	sub, err := svc.Submit(ctx, actor(), center, branchInput("ул. Рудаки, 40"))
	if err != nil {
		t.Fatal(err)
	}
	// Заявка pending — исправлять нельзя.
	if _, err := svc.Resubmit(ctx, actor(), center, sub.ID, branchInput("ул. Рудаки, 40")); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("исправлять можно только возвращённую заявку")
	}
}

func TestRequeueProcessed(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newModeration(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)
	sub, err := svc.Submit(ctx, actor(), center, branchInput("ул. Рудаки, 50"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Decide(ctx, actor(), sub.ID, moderation.DecideInput{Decision: moderation.StatusRejected, Reason: "фиктивный адрес"}); err != nil {
		t.Fatal(err)
	}
	res, err := svc.Requeue(ctx, actor(), sub.ID)
	if err != nil {
		t.Fatalf("requeue: %v", err)
	}
	if res.Status != moderation.StatusPending {
		t.Fatalf("после requeue заявка должна быть pending: %+v", res)
	}
}

func TestGPSMismatchFlag(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newModeration(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)
	// Точка центра далеко от геокодера (> 150 м).
	mustExec(t, db, &moderation.Submission{
		CenterID: center, Branch: "Филиал Далеко", City: "Душанбе", District: "Сино", Address: "ул. Далёкая, 9", Phone: "+992",
		GPSLat: 38.5000, GPSLng: 68.7000, GeoLat: 38.6000, GeoLng: 68.9000, DescRU: "Описание достаточно длинное для проверки.", Status: moderation.StatusPending, SubmittedAt: time.Now(),
	})
	list, err := svc.List(ctx, moderation.StatusPending)
	if err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, it := range list.Items {
		if it.Branch == "Филиал Далеко" {
			found = true
			if !it.GPSMismatch || it.GPSMismatchM <= 150 {
				t.Fatalf("далёкая точка должна помечаться gpsMismatch (метры > 150): %+v", it)
			}
		}
	}
	if !found {
		t.Fatal("заявка не найдена в очереди")
	}
}
