package integration_test

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/modules/billing"
	"github.com/line/eduhub-backend/internal/modules/marketplace"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

var courseSeq int64

// newMarketplace собирает маркетплейс с подключённым биллингом (granter установлен).
func newMarketplace(db *gorm.DB) (*marketplace.Service, *billing.Service) {
	b := newBilling(db)
	m := marketplace.NewService(marketplace.NewRepository(db), b, audit.New())
	b.SetCourseGranter(m)
	return m, b
}

func buildProgram(lessons, tests int) (marketplace.Program, int64) {
	var seq int64 = 1
	next := func() int64 { id := seq; seq++; return id }
	modules := []marketplace.Module{}
	for i := 0; i < lessons; i++ {
		m := i / 6
		if len(modules) == m {
			modules = append(modules, marketplace.Module{ID: next(), Title: fmt.Sprintf("Модуль %d", m+1), Lessons: []marketplace.Lesson{}})
		}
		l := marketplace.Lesson{ID: next(), Title: "Урок", Materials: []marketplace.Material{}}
		l.Materials = append(l.Materials, marketplace.Material{ID: next(), Type: "plan", Name: "План", Size: "1 МБ"})
		if i < tests {
			l.Materials = append(l.Materials, marketplace.Material{ID: next(), Type: "test", Name: "Тест", Size: "10 вопросов"})
		}
		modules[m].Lessons = append(modules[m].Lessons, l)
	}
	return marketplace.Program{Modules: modules}, seq
}

func makeCourse(t *testing.T, db *gorm.DB, status string, price int64, lessons, tests int) int64 {
	t.Helper()
	n := atomic.AddInt64(&courseSeq, 1)
	program, seq := buildProgram(lessons, tests)
	c := &marketplace.Course{
		Title: fmt.Sprintf("Курс %d", n), Direction: "Языки", Status: status, PriceDiram: money.FromSomoni(price),
		Lessons: lessons, Tests: tests, Content: program, ContentSeq: seq,
	}
	mustExec(t, db, c)
	return c.ID
}

func activeAccess(t *testing.T, db *gorm.DB, centerID, courseID int64) *marketplace.Access {
	t.Helper()
	var a marketplace.Access
	err := db.Where("center_id = ? AND course_id = ? AND status = 'active'", centerID, courseID).First(&a).Error
	if err != nil {
		return nil
	}
	return &a
}

func spCaller() marketplace.Caller { return marketplace.Caller{SuperAdmin: true} }

func TestPublishRequiresPriceAndLesson(t *testing.T) {
	db, _ := freshDB(t)
	mkt, _ := newMarketplace(db)
	ctx := context.Background()

	// Черновик без цены и уроков.
	zero := int64(0)
	dto, err := mkt.Create(ctx, actor(), "Новый курс", "Языки", &zero)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := mkt.Publish(ctx, actor(), dto.ID); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("без цены и уроков публикация должна отклоняться (BR-013)")
	}
	// Задать цену.
	price := int64(500)
	if _, err := mkt.SetPrice(ctx, actor(), dto.ID, &price, "стартовая цена"); err != nil {
		t.Fatal(err)
	}
	// Всё ещё нет уроков.
	if _, err := mkt.Publish(ctx, actor(), dto.ID); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("без урока публикация должна отклоняться")
	}
	// Добавить модуль и урок, затем опубликовать.
	page, err := mkt.AddModule(ctx, actor(), dto.ID, spCaller(), "Модуль 1")
	if err != nil {
		t.Fatal(err)
	}
	mid := page.Content.Modules[0].ID
	if _, err := mkt.AddLesson(ctx, actor(), dto.ID, mid, spCaller(), "Урок 1"); err != nil {
		t.Fatal(err)
	}
	pub, err := mkt.Publish(ctx, actor(), dto.ID)
	if err != nil {
		t.Fatalf("публикация должна пройти: %v", err)
	}
	if pub.Status != marketplace.StatusPublished || pub.Lessons != 1 {
		t.Fatalf("курс должен быть опубликован с 1 уроком: %+v", pub)
	}
}

func TestSellInvoiceThenPayGrantsCourse(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	mkt, bill := newMarketplace(db)
	ctx := context.Background()
	courseID := makeCourse(t, db, marketplace.StatusPublished, 900, 3, 1)
	center := makeCenter(t, db, "pro", 0, 0, 1)

	res, err := mkt.Sell(ctx, actor(), center, courseID, marketplace.SourceInvoice, "")
	if err != nil {
		t.Fatalf("передача счётом: %v", err)
	}
	if res.Mode != "invoice" || res.InvoiceID == nil {
		t.Fatalf("ожидался режим invoice: %+v", res)
	}
	if activeAccess(t, db, center, courseID) != nil {
		t.Fatal("до оплаты доступа быть не должно (BR-014)")
	}
	// Повторная передача при открытом счёте запрещена.
	if _, err := mkt.Sell(ctx, actor(), center, courseID, marketplace.SourceInvoice, ""); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("второй открытый счёт на курс запрещён (BR-014)")
	}
	// Оплата счёта → доступ, версия зафиксирована.
	if _, err := bill.ConfirmPayment(ctx, actor(), *res.InvoiceID, evidence(900), ""); err != nil {
		t.Fatalf("подтверждение оплаты: %v", err)
	}
	acc := activeAccess(t, db, center, courseID)
	if acc == nil {
		t.Fatal("после оплаты должен появиться доступ")
	}
	if acc.VersionLessons != 3 || acc.VersionTests != 1 {
		t.Fatalf("версия должна зафиксироваться (3 урока, 1 тест): %+v (BR-015)", acc)
	}
	if acc.Source != marketplace.SourceInvoice {
		t.Fatalf("источник доступа = %s, ожидался invoice", acc.Source)
	}
	// Владеть дважды нельзя.
	if _, err := mkt.Sell(ctx, actor(), center, courseID, marketplace.SourceInvoice, ""); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("повторная передача владельцу запрещена")
	}
}

func TestSellBalanceAndInsufficient(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	mkt, _ := newMarketplace(db)
	ctx := context.Background()
	courseID := makeCourse(t, db, marketplace.StatusPublished, 900, 1, 0)

	rich := makeCenter(t, db, "pro", 1000, 0, 1)
	res, err := mkt.Sell(ctx, actor(), rich, courseID, marketplace.SourceBalance, "")
	if err != nil {
		t.Fatalf("передача с баланса: %v", err)
	}
	if res.Mode != "paid" {
		t.Fatalf("ожидался режим paid: %+v", res)
	}
	if activeAccess(t, db, rich, courseID) == nil {
		t.Fatal("доступ должен появиться сразу при оплате с баланса")
	}
	if centerBalance(t, db, rich) != 10000 {
		t.Fatalf("баланс после списания 900 = %d дирам, ожидалось 10000", centerBalance(t, db, rich))
	}

	poor := makeCenter(t, db, "pro", 0, 0, 1)
	if _, err := mkt.Sell(ctx, actor(), poor, courseID, marketplace.SourceBalance, ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("нехватка баланса должна отклонять передачу")
	}
}

func TestSellBonusNeedsReason(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	mkt, _ := newMarketplace(db)
	ctx := context.Background()
	courseID := makeCourse(t, db, marketplace.StatusPublished, 900, 1, 0)
	center := makeCenter(t, db, "pro", 0, 0, 1)

	if _, err := mkt.Sell(ctx, actor(), center, courseID, marketplace.SourceBonus, "нет"); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("бонус без причины должен отклоняться (BR-011)")
	}
	res, err := mkt.Sell(ctx, actor(), center, courseID, marketplace.SourceBonus, "подарок партнёру")
	if err != nil {
		t.Fatal(err)
	}
	if res.Mode != "granted" {
		t.Fatalf("бонус должен сразу выдавать доступ: %+v", res)
	}
	acc := activeAccess(t, db, center, courseID)
	if acc == nil || acc.Source != marketplace.SourceBonus {
		t.Fatal("доступ бонусом должен быть активным с источником bonus")
	}
}

func TestRequestProcessInvoiceAndCancelRevertsToNew(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	mkt, bill := newMarketplace(db)
	ctx := context.Background()
	courseID := makeCourse(t, db, marketplace.StatusPublished, 900, 1, 0)
	center := makeCenter(t, db, "pro", 0, 0, 1)

	req, err := mkt.CreateRequest(ctx, actor(), center, courseID, "нужен курс")
	if err != nil {
		t.Fatalf("заявка центра: %v", err)
	}
	// reject без причины.
	if _, err := mkt.Process(ctx, actor(), req.ID, "reject", ""); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("отклонение без причины должно отклоняться")
	}
	// Выставить счёт по заявке.
	processed, err := mkt.Process(ctx, actor(), req.ID, "invoice", "")
	if err != nil {
		t.Fatalf("обработка заявки: %v", err)
	}
	if processed.Status != marketplace.ReqInvoiced || processed.InvoiceID == nil {
		t.Fatalf("заявка должна стать invoiced со счётом: %+v", processed)
	}
	// Отмена счёта возвращает заявку в new.
	if _, err := bill.Cancel(ctx, actor(), *processed.InvoiceID, "передумали выставлять"); err != nil {
		t.Fatalf("отмена счёта: %v", err)
	}
	var status string
	db.Raw("SELECT status FROM course_requests WHERE id = ?", req.ID).Scan(&status)
	if status != marketplace.ReqNew {
		t.Fatalf("после отмены счёта заявка должна вернуться в new, статус=%s", status)
	}
}

func TestRevokeAndRegrant(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	mkt, _ := newMarketplace(db)
	ctx := context.Background()
	courseID := makeCourse(t, db, marketplace.StatusPublished, 900, 1, 0)
	center := makeCenter(t, db, "pro", 0, 0, 1)

	if _, err := mkt.Sell(ctx, actor(), center, courseID, marketplace.SourceBonus, "первый подарок"); err != nil {
		t.Fatal(err)
	}
	acc := activeAccess(t, db, center, courseID)
	if _, err := mkt.Revoke(ctx, actor(), acc.ID, "нет"); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("отзыв без причины должен отклоняться (BR-011)")
	}
	if _, err := mkt.Revoke(ctx, actor(), acc.ID, "возврат средств"); err != nil {
		t.Fatalf("отзыв: %v", err)
	}
	if activeAccess(t, db, center, courseID) != nil {
		t.Fatal("после отзыва активного доступа быть не должно")
	}
	// Центр может получить курс снова.
	if _, err := mkt.Sell(ctx, actor(), center, courseID, marketplace.SourceBonus, "повторная выдача"); err != nil {
		t.Fatalf("повторная выдача после отзыва должна проходить: %v", err)
	}
}

func TestUnpublishKeepsAccess(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	mkt, _ := newMarketplace(db)
	ctx := context.Background()
	courseID := makeCourse(t, db, marketplace.StatusPublished, 900, 1, 0)
	center := makeCenter(t, db, "pro", 0, 0, 1)
	if _, err := mkt.Sell(ctx, actor(), center, courseID, marketplace.SourceBonus, "доступ центру"); err != nil {
		t.Fatal(err)
	}
	if _, err := mkt.Unpublish(ctx, actor(), courseID, "обновление версии"); err != nil {
		t.Fatalf("снятие с публикации: %v", err)
	}
	// Нет в каталоге центра…
	catalog, err := mkt.Catalog(ctx, center)
	if err != nil {
		t.Fatal(err)
	}
	for _, it := range catalog {
		if it.ID == courseID {
			t.Fatal("снятый с публикации курс не должен быть в каталоге")
		}
	}
	// …но доступ сохранён (PLT-MKT-050).
	if activeAccess(t, db, center, courseID) == nil {
		t.Fatal("доступ у купившего центра должен сохраниться")
	}
}

func TestOwnCourseIsolation(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	mkt, _ := newMarketplace(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 1)

	own, err := mkt.CreateOwn(ctx, center, "Мой курс", "Языки", "описание")
	if err != nil {
		t.Fatalf("создание собственного курса: %v", err)
	}
	// Нет в каталоге платформы.
	list, err := mkt.List(ctx, "", "all", "all")
	if err != nil {
		t.Fatal(err)
	}
	for _, it := range list.Items {
		if it.ID == own.ID {
			t.Fatal("собственный курс центра не должен быть в каталоге платформы (BR-016)")
		}
	}
	// SuperAdmin не может управлять собственным курсом центра.
	if _, err := mkt.GetCourse(ctx, own.ID, spCaller()); asAPIError(t, err).Code != apierr.CodeForbidden {
		t.Fatal("SuperAdmin не должен иметь доступ к собственному курсу центра")
	}
	// Владелец видит и правит.
	if _, err := mkt.GetCourse(ctx, own.ID, marketplace.Caller{CenterID: &center}); err != nil {
		t.Fatalf("владелец должен видеть свой курс: %v", err)
	}
}

func TestProgramCounts(t *testing.T) {
	db, _ := freshDB(t)
	mkt, _ := newMarketplace(db)
	ctx := context.Background()
	zero := int64(100)
	dto, err := mkt.Create(ctx, actor(), "Курс с программой", "Языки", &zero)
	if err != nil {
		t.Fatal(err)
	}
	page, err := mkt.AddModule(ctx, actor(), dto.ID, spCaller(), "Модуль 1")
	if err != nil {
		t.Fatal(err)
	}
	mid := page.Content.Modules[0].ID
	page, err = mkt.AddLesson(ctx, actor(), dto.ID, mid, spCaller(), "Урок 1")
	if err != nil {
		t.Fatal(err)
	}
	lid := page.Content.Modules[0].Lessons[0].ID
	page, err = mkt.AddMaterial(ctx, actor(), dto.ID, lid, spCaller(), "test", "Тест 1", 10)
	if err != nil {
		t.Fatal(err)
	}
	if page.Course.Lessons != 1 || page.Course.Tests != 1 {
		t.Fatalf("после добавления урока с тестом счётчики должны быть 1/1: %+v", page.Course)
	}
	// Удаление модуля обнуляет счётчики.
	page, err = mkt.RemoveModule(ctx, actor(), dto.ID, mid, spCaller())
	if err != nil {
		t.Fatal(err)
	}
	if page.Course.Lessons != 0 || page.Course.Tests != 0 {
		t.Fatalf("после удаления модуля счётчики должны обнулиться: %+v", page.Course)
	}
}
