package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/internal/modules/cabinet"
	"github.com/line/eduhub-backend/internal/modules/identity"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// captureSender перехватывает коды OTP для тестов (вместо реального SMS).
type captureSender struct{ codes map[string]string }

func (c *captureSender) Send(_ context.Context, phone, code string) error {
	c.codes[phone] = code
	return nil
}

func newIdentity(db *gorm.DB) (*identity.Service, *captureSender) {
	tokens := auth.NewTokenService("test-secret", time.Minute, time.Hour)
	sender := &captureSender{codes: map[string]string{}}
	return identity.NewService(identity.NewRepository(db), tokens, sender, audit.New()), sender
}

// studentWithPhone создаёт центр pro и ученика с заданным телефоном.
func studentWithPhone(t *testing.T, db *gorm.DB, phone string) (center, studentID int64) {
	t.Helper()
	seedProPlan(t, db)
	cab := newCabinet(db)
	center = makeCenter(t, db, "pro", 0, 0, 0)
	res, err := cab.AddStudent(context.Background(), actor(), center, cabinet.AddStudentRequest{Name: "Ученик Мобильный", Phone: phone, Login: "mob01"})
	if err != nil {
		t.Fatalf("добавление ученика: %v", err)
	}
	return center, res.Student.ID
}

func TestOtpLoginAutolinksStudent(t *testing.T) {
	db, _ := freshDB(t)
	const phone = "+992 90 555 00 01"
	center, studentID := studentWithPhone(t, db, phone)
	svc, sender := newIdentity(db)
	ctx := context.Background()

	if err := svc.RequestOtp(ctx, phone); err != nil {
		t.Fatalf("запрос кода: %v", err)
	}
	code := sender.codes["+992905550001"]
	if code == "" {
		t.Fatal("код не отправлен")
	}
	// Неверный код — отказ.
	if _, err := svc.VerifyOtp(ctx, phone, "000000"); asAPIError(t, err).Code != apierr.CodeUnauthorized {
		t.Fatal("неверный код должен отклоняться")
	}
	// Верный код — сессия ученика с авто-привязкой.
	res, err := svc.VerifyOtp(ctx, phone, code)
	if err != nil {
		t.Fatalf("проверка кода: %v", err)
	}
	if res.Session == nil || res.Session.Role != identity.RoleStudent || res.Session.StudentID == nil || *res.Session.StudentID != studentID {
		t.Fatalf("ожидалась сессия ученика: %+v", res)
	}
	if res.Session.TenantID != center || res.Session.Token == "" {
		t.Fatalf("сессия некорректна: %+v", res.Session)
	}
	// Ученик привязан к аккаунту и заведено членство student.
	var accountID int64
	db.Raw("SELECT account_id FROM students WHERE id = ?", studentID).Scan(&accountID)
	if accountID == 0 {
		t.Fatal("ученик должен быть привязан к аккаунту")
	}
	var n int64
	db.Raw("SELECT count(*) FROM memberships WHERE account_id = ? AND tenant_id = ? AND role = 'student'", accountID, center).Scan(&n)
	if n != 1 {
		t.Fatalf("ожидалось одно членство student, got %d", n)
	}
	// Повторный ввод уже погашенного кода — отказ.
	if _, err := svc.VerifyOtp(ctx, phone, code); asAPIError(t, err).Code != apierr.CodeUnauthorized {
		t.Fatal("погашенный код не должен приниматься повторно")
	}

	// /me возвращает аккаунт и членства.
	me, err := svc.Me(ctx, accountID, &center, identity.RoleStudent)
	if err != nil {
		t.Fatal(err)
	}
	if len(me.Memberships) != 1 || me.StudentID == nil || *me.StudentID != studentID {
		t.Fatalf("/me некорректен: %+v", me)
	}
}

func TestOtpLockoutAfterFiveWrong(t *testing.T) {
	db, _ := freshDB(t)
	const phone = "+992 90 555 00 02"
	studentWithPhone(t, db, phone)
	svc, sender := newIdentity(db)
	ctx := context.Background()
	if err := svc.RequestOtp(ctx, phone); err != nil {
		t.Fatal(err)
	}
	_ = sender
	for i := 0; i < 5; i++ {
		if _, err := svc.VerifyOtp(ctx, phone, "111111"); asAPIError(t, err).Code != apierr.CodeUnauthorized {
			t.Fatalf("попытка %d: ожидался UNAUTHORIZED", i+1)
		}
	}
	// После пяти неудач номер блокируется (BR-025).
	if _, err := svc.VerifyOtp(ctx, phone, "111111"); asAPIError(t, err).Code != apierr.CodeLocked {
		t.Fatal("после пяти неудач должна быть блокировка")
	}
}

func TestOtpBlockedStudentRejected(t *testing.T) {
	db, _ := freshDB(t)
	const phone = "+992 90 555 00 03"
	center, studentID := studentWithPhone(t, db, phone)
	// Блокируем ученика.
	if _, err := newCabinet(db).SetStudentStatus(context.Background(), actor(), center, studentID, "blocked", "нарушение правил"); err != nil {
		t.Fatal(err)
	}
	svc, sender := newIdentity(db)
	ctx := context.Background()
	if err := svc.RequestOtp(ctx, phone); err != nil {
		t.Fatal(err)
	}
	// Единственное членство — заблокированный ученик → вход запрещён (BR-025).
	if _, err := svc.VerifyOtp(ctx, phone, sender.codes["+992905550003"]); asAPIError(t, err).Code != apierr.CodeForbidden {
		t.Fatal("заблокированный ученик не должен входить")
	}
}

func TestGuardianAttachListDetach(t *testing.T) {
	db, _ := freshDB(t)
	_, center, _, _, students := journalGroup(t, db)
	childID := students[0]
	svc, _ := newIdentity(db)
	ctx := context.Background()

	g, err := svc.AttachGuardian(ctx, actor(), center, childID, identity.AttachGuardianInput{Phone: "+992 90 777 00 02", Relation: "Отец"})
	if err != nil || g.AccountID == 0 || g.Phone != "+992907770002" {
		t.Fatalf("привязка опекуна: %+v / %v", g, err)
	}
	// Заведены аккаунт и членство parent.
	var n int64
	db.Raw("SELECT count(*) FROM memberships WHERE account_id = ? AND tenant_id = ? AND role = 'parent'", g.AccountID, center).Scan(&n)
	if n != 1 {
		t.Fatalf("ожидалось членство parent, got %d", n)
	}
	// Список опекунов ученика.
	list, err := svc.ListGuardians(ctx, center, childID)
	if err != nil || len(list) != 1 || list[0].Relation != "Отец" {
		t.Fatalf("список опекунов: %+v / %v", list, err)
	}
	// Чужой центр: ученик там не найден.
	if _, err := svc.AttachGuardian(ctx, actor(), center+99999, childID, identity.AttachGuardianInput{Phone: "+992907770003"}); asAPIError(t, err).Code != apierr.CodeNotFound {
		t.Fatal("ученик другого центра должен быть недоступен")
	}
	// Снятие связи.
	if err := svc.DetachGuardian(ctx, actor(), center, childID, g.AccountID); err != nil {
		t.Fatalf("снятие опекуна: %v", err)
	}
	after, _ := svc.ListGuardians(ctx, center, childID)
	if len(after) != 1 || after[0].Status != "revoked" {
		t.Fatalf("после снятия статус должен быть revoked: %+v", after)
	}
	// Повторное снятие — связи уже нет.
	if err := svc.DetachGuardian(ctx, actor(), center, childID, g.AccountID); asAPIError(t, err).Code != apierr.CodeNotFound {
		t.Fatal("повторное снятие должно давать NOT_FOUND")
	}
}

func TestOtpNoMembershipReturnsSelectToken(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	const phone = "+992 90 555 00 09" // ученика с таким телефоном нет
	svc, sender := newIdentity(db)
	ctx := context.Background()
	if err := svc.RequestOtp(ctx, phone); err != nil {
		t.Fatal(err)
	}
	res, err := svc.VerifyOtp(ctx, phone, sender.codes["+992905550009"])
	if err != nil {
		t.Fatalf("проверка кода: %v", err)
	}
	if res.Session != nil || res.SelectToken == "" || len(res.Memberships) != 0 {
		t.Fatalf("без членств ожидался токен выбора и пустой список: %+v", res)
	}
}
