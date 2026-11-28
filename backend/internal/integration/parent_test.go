package integration_test

import (
	"context"
	"testing"

	"github.com/line/eduhub-backend/internal/modules/cashier"
	"github.com/line/eduhub-backend/internal/modules/identity"
	"github.com/line/eduhub-backend/internal/modules/parent"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

func newParent(db *gorm.DB) *parent.Service {
	return parent.NewService(parent.NewRepository(db), newStudent(db))
}

func TestParentCabinet(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, students := journalGroup(t, db)
	childID := students[0]
	ctx := context.Background()

	// Администратор привязывает родителя к ребёнку.
	idSvc, _ := newIdentity(db)
	g, err := idSvc.AttachGuardian(ctx, actor(), center, childID, identity.AttachGuardianInput{Phone: "+992 90 777 00 01", Relation: "Мать"})
	if err != nil {
		t.Fatalf("привязка опекуна: %v", err)
	}
	accID := g.AccountID

	// Оплата ребёнку, чтобы в финансах были данные.
	if _, err := newCashier(db).Charge(ctx, actor(), center, cashier.ChargeRequest{
		StudentID: childID, GroupID: &gid, Amount: money.FromSomoni(300), Method: cashier.MethodCash, Lessons: 8,
	}, ""); err != nil {
		t.Fatal(err)
	}

	par := newParent(db)

	// Список детей родителя.
	kids, err := par.Children(ctx, accID)
	if err != nil || len(kids) != 1 || kids[0].StudentID != childID || kids[0].Group == nil {
		t.Fatalf("дети родителя: %+v / %v", kids, err)
	}

	// Финансы ребёнка.
	fin, err := par.ChildFinance(ctx, accID, childID)
	if err != nil || fin.LessonsPaid != 8 || len(fin.Receipts) != 1 {
		t.Fatalf("финансы ребёнка: %+v / %v", fin, err)
	}

	// Расписание ребёнка (группа в периоде янв 2026).
	sch, err := par.ChildSchedule(ctx, accID, childID, "2026-01-01", "2026-01-15")
	if err != nil || sch.Group == nil || len(sch.Lessons.Slots) == 0 {
		t.Fatalf("расписание ребёнка: %+v / %v", sch, err)
	}

	// Изоляция: к непривязанному ученику доступа нет.
	other := addStudent(t, newCabinet(db), center, 50)
	if _, err := par.ChildFinance(ctx, accID, other); asAPIError(t, err).Code != apierr.CodeNotFound {
		t.Fatal("родитель не должен видеть чужого ребёнка")
	}
}
