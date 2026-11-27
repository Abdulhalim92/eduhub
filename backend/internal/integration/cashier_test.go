package integration_test

import (
	"context"
	"testing"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/internal/modules/cashier"
	"github.com/line/eduhub-backend/internal/modules/journal"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

func newCashier(db *gorm.DB) *cashier.Service {
	return cashier.NewService(cashier.NewRepository(db), audit.New(), idempotency.New(db))
}

// journalWithCashier собирает журнал с подключённым хуком кассы (списание уроков + зарплата).
func journalWithCashier(db *gorm.DB) *journal.Service {
	jsvc := journal.NewService(journal.NewRepository(db), audit.New())
	jsvc.SetConductHook(cashier.NewHook(cashier.NewRepository(db), audit.New()))
	return jsvc
}

func lessonPaid(t *testing.T, db *gorm.DB, studentID, groupID int64) int {
	t.Helper()
	var paid int
	if err := db.Raw("SELECT COALESCE(paid,0) FROM lesson_balances WHERE student_id = ? AND group_id = ?", studentID, groupID).Scan(&paid).Error; err != nil {
		t.Fatal(err)
	}
	return paid
}

func TestCashSettings(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	center := makeCenter(t, db, "pro", 0, 0, 0)
	svc := newCashier(db)
	ctx := context.Background()

	// По умолчанию — курс 10 баллов/сомони, потолок 25%.
	def, err := svc.GetSettings(ctx, center)
	if err != nil || def.CoinRate != 10 || def.MaxDiscountPct != 25 {
		t.Fatalf("дефолтные настройки неверны: %+v / %v", def, err)
	}
	// Невалидные значения.
	if _, err := svc.UpdateSettings(ctx, actor(), center, cashier.UpdateSettingsRequest{CoinRate: 0, MaxDiscountPct: 10}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("курс < 1 должен отклоняться")
	}
	if _, err := svc.UpdateSettings(ctx, actor(), center, cashier.UpdateSettingsRequest{CoinRate: 5, MaxDiscountPct: 150}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("потолок > 100% должен отклоняться")
	}
	// Корректное изменение и чтение.
	if _, err := svc.UpdateSettings(ctx, actor(), center, cashier.UpdateSettingsRequest{CoinRate: 5, MaxDiscountPct: 40}); err != nil {
		t.Fatal(err)
	}
	got, err := svc.GetSettings(ctx, center)
	if err != nil || got.CoinRate != 5 || got.MaxDiscountPct != 40 {
		t.Fatalf("настройки не сохранились: %+v / %v", got, err)
	}
}

func TestPaymentDiscountLessonsIdempotent(t *testing.T) {
	db, _ := freshDB(t)
	cab, center, gid, _, students := journalGroup(t, db)
	_ = cab
	svc := newCashier(db)
	ctx := context.Background()
	student := students[0]

	// У ученика 1000 баллов; курс по умолчанию 10 → 100 сомони, но потолок 25% от 200 = 50 сомони.
	if err := db.Exec("UPDATE students SET coin = 1000 WHERE id = ?", student).Error; err != nil {
		t.Fatal(err)
	}

	// Невалидный способ и сумма.
	if _, err := svc.Charge(ctx, actor(), center, cashier.ChargeRequest{StudentID: student, Amount: money.FromSomoni(200), Method: "btc"}, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("неизвестный способ оплаты должен отклоняться")
	}
	if _, err := svc.Charge(ctx, actor(), center, cashier.ChargeRequest{StudentID: student, Amount: money.FromSomoni(0), Method: cashier.MethodCash}, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("нулевая сумма должна отклоняться")
	}
	// Больше баллов, чем есть.
	if _, err := svc.Charge(ctx, actor(), center, cashier.ChargeRequest{StudentID: student, GroupID: &gid, Amount: money.FromSomoni(200), Method: cashier.MethodCash, DiscountCoin: 2000}, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("скидка больше остатка баллов должна отклоняться")
	}

	// Оплата со скидкой за баллы и 4 оплаченными уроками.
	req := cashier.ChargeRequest{StudentID: student, GroupID: &gid, Purpose: "обучение", Amount: money.FromSomoni(200), Method: cashier.MethodCash, Lessons: 4, DiscountCoin: 1000, CashierName: "Касса 1"}
	p, err := svc.Charge(ctx, actor(), center, req, "key-1")
	if err != nil {
		t.Fatalf("оплата: %v", err)
	}
	if p.Discount.Somoni() != 50 || p.Final.Somoni() != 150 {
		t.Fatalf("скидка должна упереться в потолок 25%% (50 сомони), final 150: %+v", p)
	}
	if p.DiscountCoin != 500 || p.ReceiptNo == "" || p.Status != cashier.PayPaid {
		t.Fatalf("списано баллов 500 и выдан чек: %+v", p)
	}
	if lessonPaid(t, db, student, gid) != 4 {
		t.Fatalf("должно начислиться 4 оплаченных урока, got %d", lessonPaid(t, db, student, gid))
	}
	if studentCoin(t, db, student) != 500 {
		t.Fatalf("у ученика должно остаться 500 баллов, got %d", studentCoin(t, db, student))
	}

	// Повтор с тем же ключом — тот же чек, без повторного начисления уроков/списания баллов.
	p2, err := svc.Charge(ctx, actor(), center, req, "key-1")
	if err != nil || p2.ID != p.ID || p2.ReceiptNo != p.ReceiptNo {
		t.Fatalf("идемпотентный повтор должен вернуть тот же чек: %+v / %v", p2, err)
	}
	if lessonPaid(t, db, student, gid) != 4 || studentCoin(t, db, student) != 500 {
		t.Fatalf("повтор по ключу не должен дублировать эффекты: уроки=%d баллы=%d", lessonPaid(t, db, student, gid), studentCoin(t, db, student))
	}
	var cnt int64
	db.Raw("SELECT count(*) FROM payments WHERE center_id = ?", center).Scan(&cnt)
	if cnt != 1 {
		t.Fatalf("должен быть один чек, got %d", cnt)
	}
}

func TestRefundSterno(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, students := journalGroup(t, db)
	svc := newCashier(db)
	ctx := context.Background()
	student := students[0]
	if err := db.Exec("UPDATE students SET coin = 1000 WHERE id = ?", student).Error; err != nil {
		t.Fatal(err)
	}

	p, err := svc.Charge(ctx, actor(), center, cashier.ChargeRequest{
		StudentID: student, GroupID: &gid, Amount: money.FromSomoni(200), Method: cashier.MethodCash, Lessons: 4, DiscountCoin: 300,
	}, "")
	if err != nil {
		t.Fatal(err)
	}
	// Курс 10 → 30 сомони скидки (в пределах потолка 50), списано 300 баллов; 4 урока.
	if p.Discount.Somoni() != 30 || lessonPaid(t, db, student, gid) != 4 || studentCoin(t, db, student) != 700 {
		t.Fatalf("исходная оплата неверна: discount=%d уроки=%d баллы=%d", p.Discount.Somoni(), lessonPaid(t, db, student, gid), studentCoin(t, db, student))
	}

	// Возврат без причины — отказ.
	if _, err := svc.Refund(ctx, actor(), center, p.ID, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("возврат без причины должен отклоняться")
	}
	// Возврат: сторно + откат уроков и баллов.
	r, err := svc.Refund(ctx, actor(), center, p.ID, "ошибка кассира")
	if err != nil || r.Status != cashier.PayRefunded {
		t.Fatalf("возврат: %+v / %v", r, err)
	}
	if lessonPaid(t, db, student, gid) != 0 || studentCoin(t, db, student) != 1000 {
		t.Fatalf("возврат должен откатить уроки (0) и вернуть баллы (1000): уроки=%d баллы=%d", lessonPaid(t, db, student, gid), studentCoin(t, db, student))
	}
	// Повторный возврат — конфликт; исходный чек не удалён.
	if _, err := svc.Refund(ctx, actor(), center, p.ID, "ещё раз"); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("повторный возврат должен давать конфликт")
	}
	var status string
	db.Raw("SELECT status FROM payments WHERE id = ?", p.ID).Scan(&status)
	if status != cashier.PayRefunded {
		t.Fatalf("чек должен остаться со статусом refunded, got %q", status)
	}
}

func TestShiftZReport(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, students := journalGroup(t, db)
	svc := newCashier(db)
	ctx := context.Background()

	sh, err := svc.OpenShift(ctx, actor(), center, cashier.OpenShiftRequest{CashierName: "Касса 1"})
	if err != nil || sh.Status != cashier.ShiftOpen {
		t.Fatalf("смена должна открыться: %+v / %v", sh, err)
	}
	// Повторное открытие при открытой — конфликт.
	if _, err := svc.OpenShift(ctx, actor(), center, cashier.OpenShiftRequest{}); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("вторая открытая смена должна отклоняться")
	}

	// Оплаты разными способами внутри смены.
	pCash, err := svc.Charge(ctx, actor(), center, cashier.ChargeRequest{StudentID: students[0], GroupID: &gid, Amount: money.FromSomoni(100), Method: cashier.MethodCash}, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Charge(ctx, actor(), center, cashier.ChargeRequest{StudentID: students[1], GroupID: &gid, Amount: money.FromSomoni(200), Method: cashier.MethodPOS}, ""); err != nil {
		t.Fatal(err)
	}
	// Возврат наличного чека — уменьшает итог.
	if _, err := svc.Refund(ctx, actor(), center, pCash.ID, "возврат"); err != nil {
		t.Fatal(err)
	}

	z, err := svc.CloseShift(ctx, actor(), center, sh.ID)
	if err != nil || z.Shift.Status != cashier.ShiftClosed {
		t.Fatalf("смена должна закрыться с Z-отчётом: %+v / %v", z, err)
	}
	if z.Cash.Somoni() != 100 || z.POS.Somoni() != 200 || z.Gross.Somoni() != 300 {
		t.Fatalf("разбивка Z-отчёта неверна: %+v", z)
	}
	if z.Refunds.Somoni() != 100 || z.Net.Somoni() != 200 {
		t.Fatalf("возвраты/итог Z-отчёта неверны: %+v", z)
	}
	// Повторное закрытие — не ошибка, тот же Z-отчёт.
	z2, err := svc.CloseShift(ctx, actor(), center, sh.ID)
	if err != nil || z2.Net.Somoni() != 200 {
		t.Fatalf("повторное закрытие должно быть идемпотентным: %+v / %v", z2, err)
	}
}

func TestSalarySchemesAndAccrualOnConduct(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, tid, students := journalGroup(t, db)
	cash := newCashier(db)
	jsvc := journalWithCashier(db)
	ctx := context.Background()

	// Валидация revshare: процент вне 1..100.
	if _, err := cash.UpsertScheme(ctx, actor(), center, cashier.UpsertSchemeRequest{TeacherID: tid, Type: cashier.SchemeRevShare, Percent: 0}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("revshare с процентом 0 должен отклоняться")
	}

	// Оплатим ученику 4 урока, чтобы проверить списание при «Проведён».
	if _, err := cash.Charge(ctx, actor(), center, cashier.ChargeRequest{StudentID: students[0], GroupID: &gid, Amount: money.FromSomoni(400), Method: cashier.MethodCash, Lessons: 4}, ""); err != nil {
		t.Fatal(err)
	}

	conduct := func(date string, present []int64) {
		t.Helper()
		l, err := jsvc.OpenLesson(ctx, center, gid, journal.OpenLessonRequest{Date: date})
		if err != nil {
			t.Fatalf("открытие занятия %s: %v", date, err)
		}
		entries := make([]journal.AttendanceEntry, 0, len(present))
		for _, s := range present {
			entries = append(entries, journal.AttendanceEntry{StudentID: s, Status: journal.AttPresent})
		}
		if _, err := jsvc.SetAttendance(ctx, center, l.ID, entries); err != nil {
			t.Fatalf("посещаемость %s: %v", date, err)
		}
		if _, err := jsvc.Conduct(ctx, actor(), center, l.ID); err != nil {
			t.Fatalf("проведение %s: %v", date, err)
		}
	}

	// fixed: 200 сомони за занятие (оба присутствуют) — 05.01 (Пн).
	if _, err := cash.UpsertScheme(ctx, actor(), center, cashier.UpsertSchemeRequest{TeacherID: tid, Type: cashier.SchemeFixed, Rate: money.FromSomoni(200)}); err != nil {
		t.Fatal(err)
	}
	conduct("2026-01-05", students)
	// Списание оплаченного урока у присутствовавшего (student[0]: 4 → 3).
	if lessonPaid(t, db, students[0], gid) != 3 {
		t.Fatalf("после «Проведён» оплаченные уроки должны уменьшиться до 3, got %d", lessonPaid(t, db, students[0], gid))
	}

	// perhead: 30 сомони × присутствовавших — 07.01 (Ср), оба присутствуют → 60.
	if _, err := cash.UpsertScheme(ctx, actor(), center, cashier.UpsertSchemeRequest{TeacherID: tid, Type: cashier.SchemePerHead, Rate: money.FromSomoni(30)}); err != nil {
		t.Fatal(err)
	}
	conduct("2026-01-07", students)

	// revshare: 50% от цены урока 100 × присутствовавших — 09.01 (Пт), оба → 100.
	if _, err := cash.UpsertScheme(ctx, actor(), center, cashier.UpsertSchemeRequest{TeacherID: tid, Type: cashier.SchemeRevShare, Percent: 50, LessonPrice: money.FromSomoni(100)}); err != nil {
		t.Fatal(err)
	}
	conduct("2026-01-09", students)

	accruals, err := cash.ListAccruals(ctx, center, tid, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(accruals) != 3 {
		t.Fatalf("ожидалось 3 начисления, got %d", len(accruals))
	}
	var total int64
	for _, a := range accruals {
		total += a.Amount.Somoni()
	}
	if total != 360 { // 200 + 60 + 100
		t.Fatalf("сумма начислений должна быть 360 сомони, got %d", total)
	}

	// Идемпотентность: повторное «Проведён» того же занятия не создаёт новое начисление.
	l, _ := jsvc.OpenLesson(ctx, center, gid, journal.OpenLessonRequest{Date: "2026-01-05"})
	if _, err := jsvc.Conduct(ctx, actor(), center, l.ID); err != nil {
		t.Fatal(err)
	}
	again, _ := cash.ListAccruals(ctx, center, tid, "", "")
	if len(again) != 3 {
		t.Fatalf("повторное «Проведён» не должно дублировать начисление, got %d", len(again))
	}
}

func TestCashierCrossCenterIsolation(t *testing.T) {
	db, _ := freshDB(t)
	_, centerA, gidA, _, studentsA := journalGroup(t, db)
	svc := newCashier(db)
	ctx := context.Background()

	// Второй центр.
	centerB := makeCenter(t, db, "pro", 0, 0, 0)

	p, err := svc.Charge(ctx, actor(), centerA, cashier.ChargeRequest{StudentID: studentsA[0], GroupID: &gidA, Amount: money.FromSomoni(100), Method: cashier.MethodCash}, "")
	if err != nil {
		t.Fatal(err)
	}
	// Чужой центр не видит и не может вернуть чужой чек (BR-022).
	if _, err := svc.Refund(ctx, actor(), centerB, p.ID, "чужой"); asAPIError(t, err).Code != apierr.CodeNotFound {
		t.Fatal("чек другого центра должен быть недоступен (BR-022)")
	}
	list, err := svc.ListPayments(ctx, centerB, "")
	if err != nil || len(list) != 0 {
		t.Fatalf("у другого центра не должно быть чеков: %+v / %v", list, err)
	}
}
