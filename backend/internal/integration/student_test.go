package integration_test

import (
	"context"
	"testing"

	"github.com/line/eduhub-backend/internal/modules/cashier"
	"github.com/line/eduhub-backend/internal/modules/journal"
	"github.com/line/eduhub-backend/internal/modules/student"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

func newStudent(db *gorm.DB) *student.Service {
	js := newJournal(db)
	return student.NewService(student.NewRepository(db), js, js)
}

func TestStudentScheduleFromJournal(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, students := journalGroup(t, db)
	_ = gid
	svc := newStudent(db)
	ctx := context.Background()

	res, err := svc.ScheduleFor(ctx, students[0], center, "2026-01-01", "2026-01-15")
	if err != nil {
		t.Fatalf("расписание: %v", err)
	}
	if res.Group == nil || res.Group.Course == "" {
		t.Fatalf("ожидалась справка о группе: %+v", res.Group)
	}
	if len(res.Lessons.Slots) == 0 {
		t.Fatal("ожидались слоты расписания из журнала")
	}
	// Изоляция: чужой центр — ученик не найден.
	if _, err := svc.ScheduleFor(ctx, students[0], center+99999, "2026-01-01", "2026-01-15"); asAPIError(t, err).Code != apierr.CodeNotFound {
		t.Fatal("ученик не должен быть виден в чужом центре")
	}
}

func TestStudentTestsHideCorrectAndSubmit(t *testing.T) {
	db, _ := freshDB(t)
	_, center, _, _, students := journalGroup(t, db)
	jsvc := newJournal(db)
	svc := newStudent(db)
	ctx := context.Background()

	tst, err := jsvc.CreateTest(ctx, center, journal.CreateTestRequest{
		Title: "Арифметика",
		Questions: []journal.Question{
			{Text: "2+2?", Options: []string{"3", "4"}, Correct: 1},
			{Text: "3*3?", Options: []string{"9", "6"}, Correct: 0},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	list, err := svc.Tests(ctx, students[0], center)
	if err != nil || len(list) != 1 || list[0].Questions != 2 {
		t.Fatalf("список тестов: %+v / %v", list, err)
	}
	// Детали без правильных ответов (тип QuestionView не содержит индекс правильного).
	detail, err := svc.TestDetail(ctx, students[0], center, tst.ID)
	if err != nil || len(detail.Questions) != 2 || detail.Questions[0].Text == "" {
		t.Fatalf("детали теста: %+v / %v", detail, err)
	}
	// Сдача через journal.SubmitTest: один верный из двух → 50%.
	sub, err := svc.SubmitTest(ctx, students[0], center, tst.ID, []int{1, 1})
	if err != nil || sub.ScorePct != 50 {
		t.Fatalf("ожидалось 50%%: %+v / %v", sub, err)
	}
	// После сдачи результат виден в списке.
	list2, _ := svc.Tests(ctx, students[0], center)
	if list2[0].ScorePct == nil || *list2[0].ScorePct != 50 {
		t.Fatalf("результат должен отражаться в списке: %+v", list2[0])
	}
}

func TestStudentPointsAndFinance(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, students := journalGroup(t, db)
	svc := newStudent(db)
	ctx := context.Background()
	sid := students[0]

	// История достижений: начисление баллов.
	if err := db.Exec(`INSERT INTO point_grants (center_id, group_id, student_id, amount, reason, at)
		VALUES (?, ?, ?, 30, 'активность на уроке', now())`, center, gid, sid).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("UPDATE students SET coin = 70 WHERE id = ?", sid).Error; err != nil {
		t.Fatal(err)
	}
	pts, err := svc.Points(ctx, sid, center)
	if err != nil || pts.Balance != 70 || len(pts.Achievements) != 1 || pts.Achievements[0].Amount != 30 {
		t.Fatalf("баллы/достижения: %+v / %v", pts, err)
	}

	// Финансы: оплата через кассу даёт чек и остаток оплаченных уроков.
	cash := newCashier(db)
	if _, err := cash.Charge(ctx, actor(), center, cashier.ChargeRequest{
		StudentID: sid, GroupID: &gid, Amount: money.FromSomoni(300), Method: cashier.MethodCash, Lessons: 8,
	}, ""); err != nil {
		t.Fatal(err)
	}
	fin, err := svc.Finance(ctx, sid, center)
	if err != nil || fin.LessonsPaid != 8 || len(fin.Receipts) != 1 || fin.Receipts[0].Final.Somoni() != 300 {
		t.Fatalf("финансы: %+v / %v", fin, err)
	}
}

func TestStudentBlockedForbidden(t *testing.T) {
	db, _ := freshDB(t)
	cab, center, _, _, students := journalGroup(t, db)
	ctx := context.Background()
	if _, err := cab.SetStudentStatus(ctx, actor(), center, students[0], "blocked", "нарушение правил"); err != nil {
		t.Fatal(err)
	}
	svc := newStudent(db)
	if _, err := svc.Finance(ctx, students[0], center); asAPIError(t, err).Code != apierr.CodeForbidden {
		t.Fatal("заблокированный ученик не имеет доступа к кабинету")
	}
}
