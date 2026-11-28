package integration_test

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/internal/ledger"
	"github.com/line/eduhub-backend/internal/modules/billing"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/internal/modules/finance"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

var centerSeq int64

func makeCenter(t *testing.T, db *gorm.DB, planID string, balance, overdraft int64, staff int) int64 {
	t.Helper()
	n := atomic.AddInt64(&centerSeq, 1)
	c := &centers.Center{
		Name: fmt.Sprintf("Центр %d-%d", time.Now().UnixNano(), n), City: "Душанбе", Owner: "Владелец", Phone: "+992 90 000 00 00",
		PlanID: planID, Status: "active", BalanceDiram: money.FromSomoni(balance), OverdraftLimitDiram: money.FromSomoni(overdraft),
		StaffUsed: staff, StorageUsedGB: 1, BranchesUsed: 1,
	}
	mustExec(t, db, c)
	// Стартовый баланс — через проводку, чтобы кэш баланса = сумме проводок (money.md).
	if balance != 0 {
		entryType := "topup"
		if balance < 0 {
			entryType = "charge"
		}
		mustExec(t, db, &ledger.Entry{
			CenterID: c.ID, At: time.Now(), Type: entryType,
			AmountDiram: money.FromSomoni(balance), BalanceAfterDiram: money.FromSomoni(balance),
			Method: "Стартовый баланс", ActorName: "seed",
		})
	}
	return c.ID
}

func newBilling(db *gorm.DB) *billing.Service {
	return billing.NewService(billing.NewRepository(db), audit.New(), idempotency.New(db))
}

func newFinance(db *gorm.DB) *finance.Service {
	c := centers.NewService(centers.NewRepository(db), audit.New())
	return finance.NewService(finance.NewRepository(db), c, newBilling(db), audit.New(), idempotency.New(db))
}

func evidence(amount int64) billing.EvidenceInput {
	return billing.EvidenceInput{Method: "Безнал (Р/С)", Reference: "ПП № 7", ReceivedAmount: amount, ReceivedOn: time.Now().Format("2006-01-02"), Confirmed: true}
}

func centerBalance(t *testing.T, db *gorm.DB, id int64) int64 {
	t.Helper()
	var bal int64
	if err := db.Raw("SELECT balance_diram FROM centers WHERE id = ?", id).Scan(&bal).Error; err != nil {
		t.Fatal(err)
	}
	return bal
}

func ledgerSum(t *testing.T, db *gorm.DB, id int64) int64 {
	t.Helper()
	var sum *int64
	if err := db.Raw("SELECT sum(amount_diram) FROM ledger WHERE center_id = ?", id).Scan(&sum).Error; err != nil {
		t.Fatal(err)
	}
	if sum == nil {
		return 0
	}
	return *sum
}

// --- finance: пополнение ---

func TestTopUpIncreasesBalance(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	id := makeCenter(t, db, "pro", 0, 0, 1)
	fin := newFinance(db)
	ctx := context.Background()

	dto, err := fin.TopUp(ctx, actor(), id, evidence(500), "")
	if err != nil {
		t.Fatalf("пополнение: %v", err)
	}
	if dto.Balance.Somoni() != 500 {
		t.Fatalf("баланс после пополнения = %d, ожидалось 500", dto.Balance.Somoni())
	}
	if centerBalance(t, db, id) != 50000 {
		t.Fatalf("баланс в БД (дирамы) = %d, ожидалось 50000", centerBalance(t, db, id))
	}
	// Кэш баланса совпадает с суммой проводок (money.md).
	if ledgerSum(t, db, id) != centerBalance(t, db, id) {
		t.Fatalf("баланс (%d) не равен сумме проводок (%d)", centerBalance(t, db, id), ledgerSum(t, db, id))
	}
}

func TestTopUpRejectsBadEvidence(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	id := makeCenter(t, db, "pro", 0, 0, 1)
	fin := newFinance(db)
	ctx := context.Background()

	future := evidence(500)
	future.ReceivedOn = time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	if _, err := fin.TopUp(ctx, actor(), id, future, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("дата в будущем должна отклоняться")
	}
	noConfirm := evidence(500)
	noConfirm.Confirmed = false
	if _, err := fin.TopUp(ctx, actor(), id, noConfirm, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("без подтверждения должно отклоняться")
	}
	if centerBalance(t, db, id) != 0 {
		t.Fatal("баланс не должен меняться при отклонённых пополнениях")
	}
}

func TestTopUpIdempotent(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	id := makeCenter(t, db, "pro", 0, 0, 1)
	fin := newFinance(db)
	ctx := context.Background()

	key := "idem-topup-1"
	if _, err := fin.TopUp(ctx, actor(), id, evidence(500), key); err != nil {
		t.Fatal(err)
	}
	if _, err := fin.TopUp(ctx, actor(), id, evidence(500), key); err != nil {
		t.Fatal(err)
	}
	if centerBalance(t, db, id) != 50000 {
		t.Fatalf("повтор с тем же ключом не должен удваивать пополнение: баланс %d", centerBalance(t, db, id))
	}
	var n int64
	db.Raw("SELECT count(*) FROM ledger WHERE center_id = ? AND type = 'topup'", id).Scan(&n)
	if n != 1 {
		t.Fatalf("ожидалась одна проводка пополнения, получено %d", n)
	}
}

// --- billing: оплата ---

func TestPayFromBalanceSuccessAndInsufficient(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	bill := newBilling(db)
	ctx := context.Background()

	// Достаточно средств: баланс 2000, счёт продления 900.
	rich := makeCenter(t, db, "pro", 2000, 0, 1)
	inv, err := bill.RenewalInvoice(ctx, actor(), rich)
	if err != nil {
		t.Fatalf("счёт продления: %v", err)
	}
	paid, err := bill.PayFromBalance(ctx, actor(), inv.ID, "")
	if err != nil {
		t.Fatalf("оплата с баланса: %v", err)
	}
	if paid.Status != billing.StatusPaid || paid.Channel == nil || *paid.Channel != "balance" {
		t.Fatalf("счёт должен быть оплачен каналом balance: %+v", paid)
	}
	if centerBalance(t, db, rich) != 110000 {
		t.Fatalf("баланс после списания 900 = %d, ожидалось 110000 дирам", centerBalance(t, db, rich))
	}

	// Недостаточно средств: баланс 0, овердрафт 0.
	poor := makeCenter(t, db, "pro", 0, 0, 1)
	inv2, err := bill.RenewalInvoice(ctx, actor(), poor)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := bill.PayFromBalance(ctx, actor(), inv2.ID, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("нехватка средств должна отклонять списание")
	}
	got, _ := bill.Get(ctx, inv2.ID)
	if got.Status != billing.StatusPending {
		t.Fatal("при отказе счёт остаётся открытым")
	}
	if centerBalance(t, db, poor) != 0 {
		t.Fatal("баланс не должен меняться при отказе")
	}
}

func TestConfirmPaymentMismatchSuccessAndRepeat(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	bill := newBilling(db)
	ctx := context.Background()
	id := makeCenter(t, db, "pro", 0, 0, 1)
	inv, err := bill.RenewalInvoice(ctx, actor(), id)
	if err != nil {
		t.Fatal(err)
	}
	// Сумма не совпадает со счётом (900) → отказ.
	if _, err := bill.ConfirmPayment(ctx, actor(), inv.ID, evidence(800), ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("несовпадение суммы должно отклоняться (частичная оплата не поддерживается)")
	}
	// Верная сумма → оплачен.
	paid, err := bill.ConfirmPayment(ctx, actor(), inv.ID, evidence(900), "")
	if err != nil {
		t.Fatalf("подтверждение оплаты: %v", err)
	}
	if paid.Status != billing.StatusPaid {
		t.Fatal("счёт должен стать оплаченным")
	}
	// Повторное подтверждение → CONFLICT (необратимо).
	if _, err := bill.ConfirmPayment(ctx, actor(), inv.ID, evidence(900), ""); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("повторное подтверждение оплаченного счёта запрещено")
	}
}

func TestCancelRequiresReasonAndPending(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	bill := newBilling(db)
	ctx := context.Background()
	id := makeCenter(t, db, "pro", 0, 0, 1)
	inv, err := bill.RenewalInvoice(ctx, actor(), id)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := bill.Cancel(ctx, actor(), inv.ID, "нет"); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("причина короче 5 символов должна отклоняться")
	}
	cancelled, err := bill.Cancel(ctx, actor(), inv.ID, "дубликат счёта")
	if err != nil {
		t.Fatal(err)
	}
	if cancelled.Status != billing.StatusCancelled {
		t.Fatal("счёт должен стать отменённым")
	}
}

// --- смена тарифа ---

func TestRequestPlanChangeInvoiceThenPayChangesPlan(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db)
	seedProPlan(t, db)
	bill := newBilling(db)
	ctx := context.Background()
	id := makeCenter(t, db, "start", 0, 0, 1)

	res, err := bill.RequestPlanChange(ctx, actor(), id, billing.PlanChangeRequest{PlanID: "pro", Reason: "рост центра"}, "")
	if err != nil {
		t.Fatalf("смена тарифа счётом: %v", err)
	}
	if res.Mode != "invoice" || res.Invoice == nil {
		t.Fatalf("ожидался режим invoice: %+v", res)
	}
	// Тариф пока не изменился (BR-001).
	if planOf(t, db, id) != "start" {
		t.Fatal("до оплаты тариф не меняется")
	}
	// Второй счёт на смену тарифа запрещён (BR-007).
	if _, err := bill.RequestPlanChange(ctx, actor(), id, billing.PlanChangeRequest{PlanID: "pro", Reason: "ещё раз"}, ""); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("второй открытый счёт на смену тарифа запрещён")
	}
	// Оплата счёта → тариф сменился.
	if _, err := bill.ConfirmPayment(ctx, actor(), res.Invoice.ID, evidence(900), ""); err != nil {
		t.Fatal(err)
	}
	if planOf(t, db, id) != "pro" {
		t.Fatal("после оплаты тариф должен стать pro (BR-001)")
	}
}

func TestRequestPlanChangeFreeImmediate(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db)
	seedProPlan(t, db)
	bill := newBilling(db)
	ctx := context.Background()
	id := makeCenter(t, db, "pro", 0, 0, 1)

	res, err := bill.RequestPlanChange(ctx, actor(), id, billing.PlanChangeRequest{PlanID: "start", Reason: "понижение"}, "")
	if err != nil {
		t.Fatal(err)
	}
	if res.Mode != "applied" {
		t.Fatalf("переход на бесплатный тариф — сразу: %+v", res)
	}
	if planOf(t, db, id) != "start" {
		t.Fatal("тариф должен стать start немедленно")
	}
}

func TestRequestPlanChangeBalanceMode(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db)
	seedProPlan(t, db)
	bill := newBilling(db)
	ctx := context.Background()
	id := makeCenter(t, db, "start", 1000, 0, 1)

	res, err := bill.RequestPlanChange(ctx, actor(), id, billing.PlanChangeRequest{PlanID: "pro", Reason: "оплата с баланса", PayFromBalance: true}, "")
	if err != nil {
		t.Fatalf("смена с баланса: %v", err)
	}
	if res.Mode != "paid" {
		t.Fatalf("ожидался режим paid: %+v", res)
	}
	if planOf(t, db, id) != "pro" {
		t.Fatal("тариф должен смениться сразу при оплате с баланса")
	}
	if centerBalance(t, db, id) != 10000 {
		t.Fatalf("баланс после списания 900 из 1000 = %d дирам, ожидалось 10000", centerBalance(t, db, id))
	}
}

func TestRequestPlanChangeDeferNeedsConfirm(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db)
	seedProPlan(t, db)
	bill := newBilling(db)
	ctx := context.Background()
	id := makeCenter(t, db, "start", 0, 0, 1)

	// Отсрочка без подтверждения → отказ (PLT-TRF-030).
	if _, err := bill.RequestPlanChange(ctx, actor(), id, billing.PlanChangeRequest{PlanID: "pro", Reason: "срочно нужен тариф", DeferPayment: true}, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("отсрочка без подтверждения должна отклоняться")
	}
	// С подтверждением → тариф меняется сразу, счёт открыт.
	res, err := bill.RequestPlanChange(ctx, actor(), id, billing.PlanChangeRequest{PlanID: "pro", Reason: "срочно нужен тариф", DeferPayment: true, DeferConfirmed: true}, "")
	if err != nil {
		t.Fatalf("отсрочка: %v", err)
	}
	if res.Mode != "deferred" || planOf(t, db, id) != "pro" {
		t.Fatalf("отсрочка: тариф должен смениться сразу, режим deferred: %+v", res)
	}
	// Отмена отсрочённого счёта откатывает тариф (PLT-TRF-030).
	if _, err := bill.Cancel(ctx, actor(), res.Invoice.ID, "центр передумал"); err != nil {
		t.Fatalf("отмена отсрочённого: %v", err)
	}
	if planOf(t, db, id) != "start" {
		t.Fatal("после отмены отсрочённого счёта тариф должен вернуться на start")
	}
}

func TestRequestPlanChangeDoesNotFit(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db)
	seedProPlan(t, db)
	bill := newBilling(db)
	ctx := context.Background()
	// Центр на pro с 20 сотрудниками не вмещается в start (лимит 5).
	id := makeCenter(t, db, "pro", 0, 0, 20)
	_, err := bill.RequestPlanChange(ctx, actor(), id, billing.PlanChangeRequest{PlanID: "start", Reason: "понижение"}, "")
	ae := asAPIError(t, err)
	if ae.Code != apierr.CodeValidation || ae.Fields["plan"] == "" {
		t.Fatalf("тариф, в который центр не вмещается, недоступен (BR-008): %+v", ae)
	}
}

// --- овердрафт ---

func TestSetOverdraftRules(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	fin := newFinance(db)
	ctx := context.Background()
	id := makeCenter(t, db, "pro", -150, 300, 1) // использовано 150 овердрафта

	below := int64(100)
	if _, err := fin.SetOverdraft(ctx, actor(), id, finance.SetOverdraftRequest{Limit: &below, Reason: "снизить лимит"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("лимит ниже использованного должен отклоняться (BR-006)")
	}
	same := int64(300)
	if _, err := fin.SetOverdraft(ctx, actor(), id, finance.SetOverdraftRequest{Limit: &same, Reason: "без изменений"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("неизменный лимит должен отклоняться")
	}
	up := int64(500)
	if _, err := fin.SetOverdraft(ctx, actor(), id, finance.SetOverdraftRequest{Limit: &up, Reason: "нет"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("причина короче 5 символов должна отклоняться (BR-011)")
	}
	dto, err := fin.SetOverdraft(ctx, actor(), id, finance.SetOverdraftRequest{Limit: &up, Reason: "повышение по договорённости"})
	if err != nil {
		t.Fatalf("корректное изменение: %v", err)
	}
	if dto.OverdraftLimit.Somoni() != 500 {
		t.Fatalf("лимит овердрафта = %d, ожидалось 500", dto.OverdraftLimit.Somoni())
	}
}

// --- конкурентность (BR-005) ---

func TestConcurrentChargesRespectAvailable(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	ctx := context.Background()
	id := makeCenter(t, db, "pro", 1000, 0, 1) // хватает ровно на 10 списаний по 100

	const workers = 20
	var wg sync.WaitGroup
	var ok int64
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := db.Transaction(func(tx *gorm.DB) error {
				_, e := ledger.Charge(ctx, tx, id, money.FromSomoni(100), ledger.Meta{Method: "test", ActorName: "Админ"})
				return e
			})
			if err == nil {
				atomic.AddInt64(&ok, 1)
			}
		}()
	}
	wg.Wait()

	if ok != 10 {
		t.Fatalf("успешных списаний должно быть ровно 10, получено %d", ok)
	}
	if bal := centerBalance(t, db, id); bal != 0 {
		t.Fatalf("итоговый баланс = %d дирам, ожидалось 0 (не ниже допустимого, BR-005)", bal)
	}
	if ledgerSum(t, db, id) != centerBalance(t, db, id) {
		t.Fatal("баланс должен совпадать с суммой проводок")
	}
}

func planOf(t *testing.T, db *gorm.DB, centerID int64) string {
	t.Helper()
	var plan string
	if err := db.Raw("SELECT plan_id FROM centers WHERE id = ?", centerID).Scan(&plan).Error; err != nil {
		t.Fatal(err)
	}
	return plan
}
