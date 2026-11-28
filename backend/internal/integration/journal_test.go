package integration_test

import (
	"context"
	"testing"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/modules/cabinet"
	"github.com/line/eduhub-backend/internal/modules/journal"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

func newJournal(db *gorm.DB) *journal.Service {
	return journal.NewService(journal.NewRepository(db), audit.New())
}

// journalGroup создаёт центр pro с преподавателем, активной группой (Пн,Ср,Пт 09:00) и 2 учениками.
func journalGroup(t *testing.T, db *gorm.DB) (cabSvc *cabinet.Service, center, gid, tid int64, students []int64) {
	t.Helper()
	seedProPlan(t, db)
	cab := newCabinet(db)
	ctx := context.Background()
	center = makeCenter(t, db, "pro", 0, 0, 0)
	teacher, err := cab.AddStaff(ctx, actor(), center, staffReq(1, cabinet.RoleTeacher))
	if err != nil {
		t.Fatal(err)
	}
	tid = teacher.Staff.ID
	grp, err := cab.GroupCreate(ctx, center, groupInput(tid, "Пн, Ср, Пт", "09:00"))
	if err != nil {
		t.Fatal(err)
	}
	gid = grp.ID
	for i := 1; i <= 2; i++ {
		sid := addStudent(t, cab, center, 10+i)
		if _, err := cab.AddStudentToGroup(ctx, center, gid, sid); err != nil {
			t.Fatalf("прикрепление ученика: %v", err)
		}
		students = append(students, sid)
	}
	return cab, center, gid, tid, students
}

const mondayDate = "2026-01-05" // понедельник в периоде группы (2026-01-01..2026-06-01)

func TestLessonsRangeAndOpen(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, _ := journalGroup(t, db)
	svc := newJournal(db)
	ctx := context.Background()

	// Слоты расписания в январе: должны быть (Пн/Ср/Пт).
	rng, err := svc.LessonsRange(ctx, center, gid, "2026-01-01", "2026-01-31")
	if err != nil {
		t.Fatal(err)
	}
	if len(rng.Slots) == 0 {
		t.Fatal("ожидались слоты расписания")
	}
	for _, s := range rng.Slots {
		if s.Stored {
			t.Fatal("до открытия слоты не должны быть сохранёнными")
		}
	}
	// Открыть занятие на понедельник.
	l, err := svc.OpenLesson(ctx, center, gid, journal.OpenLessonRequest{Date: mondayDate})
	if err != nil {
		t.Fatalf("открытие занятия: %v", err)
	}
	if l.Status != journal.LessonPlanned || l.Date != mondayDate {
		t.Fatalf("занятие некорректно: %+v", l)
	}
	// Повторное открытие той же даты — то же занятие (upsert).
	l2, err := svc.OpenLesson(ctx, center, gid, journal.OpenLessonRequest{Date: mondayDate})
	if err != nil || l2.ID != l.ID {
		t.Fatalf("повторное открытие должно вернуть то же занятие: %+v / %v", l2, err)
	}
	// Дата вне расписания без adHoc → отказ; с adHoc → ок.
	if _, err := svc.OpenLesson(ctx, center, gid, journal.OpenLessonRequest{Date: "2026-01-06"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("дата вне расписания без adHoc должна отклоняться")
	}
	adhoc, err := svc.OpenLesson(ctx, center, gid, journal.OpenLessonRequest{Date: "2026-01-06", AdHoc: true})
	if err != nil || !adhoc.AdHoc {
		t.Fatalf("внеплановое занятие должно создаться: %+v / %v", adhoc, err)
	}
}

func TestAttendanceMarking(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, students := journalGroup(t, db)
	svc := newJournal(db)
	ctx := context.Background()
	l, err := svc.OpenLesson(ctx, center, gid, journal.OpenLessonRequest{Date: mondayDate})
	if err != nil {
		t.Fatal(err)
	}
	// «Опоздал» без минут → отказ.
	if _, err := svc.SetAttendance(ctx, center, l.ID, []journal.AttendanceEntry{{StudentID: students[0], Status: journal.AttLate}}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("«Опоздал» без минут должно отклоняться")
	}
	// Чужой ученик (не из группы) → конфликт.
	foreign := addStudent(t, newCabinet(db), center, 19)
	if _, err := svc.SetAttendance(ctx, center, l.ID, []journal.AttendanceEntry{{StudentID: foreign, Status: journal.AttPresent}}); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("ученик не из группы не должен отмечаться")
	}
	// Корректная отметка.
	grade := 90
	detail, err := svc.SetAttendance(ctx, center, l.ID, []journal.AttendanceEntry{
		{StudentID: students[0], Status: journal.AttPresent, Grade: &grade, Tags: "активен"},
		{StudentID: students[1], Status: journal.AttLate, LateMin: 10},
	})
	if err != nil {
		t.Fatalf("отметка посещаемости: %v", err)
	}
	present := map[int64]journal.AttendanceDTO{}
	for _, a := range detail.Students {
		present[a.StudentID] = a
	}
	if present[students[0]].Status != journal.AttPresent || present[students[1]].LateMin != 10 {
		t.Fatalf("отметки не сохранились: %+v", detail.Students)
	}
}

func TestConductIdempotent(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, _ := journalGroup(t, db)
	svc := newJournal(db)
	ctx := context.Background()
	l, err := svc.OpenLesson(ctx, center, gid, journal.OpenLessonRequest{Date: mondayDate})
	if err != nil {
		t.Fatal(err)
	}
	c1, err := svc.Conduct(ctx, actor(), center, l.ID)
	if err != nil || c1.Status != journal.LessonConducted {
		t.Fatalf("занятие должно стать проведённым: %+v / %v", c1, err)
	}
	c2, err := svc.Conduct(ctx, actor(), center, l.ID)
	if err != nil || c2.Status != journal.LessonConducted {
		t.Fatalf("повторное «Проведён» должно быть идемпотентным: %+v / %v", c2, err)
	}
}

func TestShiftGeoRadius(t *testing.T) {
	db, _ := freshDB(t)
	_, center, _, tid, _ := journalGroup(t, db)
	svc := newJournal(db)
	ctx := context.Background()
	// Филиал с координатами (Душанбе).
	if err := db.Exec(`INSERT INTO branch_submissions (center_id, branch, city, address, gps_lat, gps_lng, geo_lat, geo_lng, status)
		VALUES (?, 'Главный филиал', 'Душанбе', 'ул. Тест, 1', 38.5600, 68.7900, 38.5600, 68.7900, 'published')`, center).Error; err != nil {
		t.Fatal(err)
	}
	// Рядом → ок.
	if _, err := svc.StartShift(ctx, actor(), center, journal.StartShiftRequest{TeacherID: tid, Branch: "Главный филиал", Lat: 38.5601, Lng: 68.7901}); err != nil {
		t.Fatalf("смена рядом с филиалом должна начаться: %v", err)
	}
	// Далеко → отказ.
	if _, err := svc.StartShift(ctx, actor(), center, journal.StartShiftRequest{TeacherID: tid, Branch: "Главный филиал", Lat: 40.0, Lng: 70.0}); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("смена вне радиуса должна отклоняться")
	}
	// Нет координат филиала → гео пропускается (ок).
	res, err := svc.StartShift(ctx, actor(), center, journal.StartShiftRequest{TeacherID: tid, Branch: "Неизвестный", Lat: 0, Lng: 0})
	if err != nil || res.GeoChecked {
		t.Fatalf("без координат филиала гео не проверяется: %+v / %v", res, err)
	}
}

func TestPointsBudget(t *testing.T) {
	db, _ := freshDB(t)
	_, center, gid, _, students := journalGroup(t, db)
	svc := newJournal(db)
	ctx := context.Background()

	// Без бюджета — отказ.
	if _, err := svc.GrantPoints(ctx, actor(), center, gid, journal.GrantPointsRequest{StudentID: students[0], Amount: 10, Reason: "активность"}); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("без бюджета начисление должно отклоняться")
	}
	if _, err := svc.SetBudget(ctx, center, gid, journal.BudgetRequest{Period: "week", Amount: 100}); err != nil {
		t.Fatal(err)
	}
	// Основание/количество.
	if _, err := svc.GrantPoints(ctx, actor(), center, gid, journal.GrantPointsRequest{StudentID: students[0], Amount: 0, Reason: "активность на уроке"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("нулевое количество должно отклоняться")
	}
	res, err := svc.GrantPoints(ctx, actor(), center, gid, journal.GrantPointsRequest{StudentID: students[0], Amount: 60, Reason: "активность на уроке"})
	if err != nil || res.Coin != 60 || res.Remaining != 40 {
		t.Fatalf("начисление в пределах бюджета: %+v / %v", res, err)
	}
	// Сверх остатка (40) → отказ.
	if _, err := svc.GrantPoints(ctx, actor(), center, gid, journal.GrantPointsRequest{StudentID: students[1], Amount: 50, Reason: "ещё баллы"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("превышение бюджета должно отклоняться")
	}
	budget, err := svc.GetBudget(ctx, center, gid)
	if err != nil || budget.Spent != 60 || budget.Remaining != 40 {
		t.Fatalf("остаток бюджета неверен: %+v / %v", budget, err)
	}
}

func TestTestAutograde(t *testing.T) {
	db, _ := freshDB(t)
	_, center, _, _, students := journalGroup(t, db)
	svc := newJournal(db)
	ctx := context.Background()

	// Невалидный тест (у вопроса один вариант) → отказ.
	bad := journal.CreateTestRequest{Title: "Тест", Questions: []journal.Question{{Text: "2+2?", Options: []string{"4"}, Correct: 0}}}
	if _, err := svc.CreateTest(ctx, center, bad); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("вопрос с одним вариантом должен отклоняться")
	}
	tst, err := svc.CreateTest(ctx, center, journal.CreateTestRequest{
		Title: "Арифметика",
		Questions: []journal.Question{
			{Text: "2+2?", Options: []string{"3", "4", "5"}, Correct: 1},
			{Text: "3*3?", Options: []string{"6", "9"}, Correct: 1},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	// Один верный из двух → 50%.
	r1, err := svc.SubmitTest(ctx, center, tst.ID, journal.SubmitRequest{StudentID: students[0], Answers: []int{1, 0}})
	if err != nil || r1.ScorePct != 50 {
		t.Fatalf("ожидалось 50%%: %+v / %v", r1, err)
	}
	// Пересдача — апсерт, оба верных → 100%.
	r2, err := svc.SubmitTest(ctx, center, tst.ID, journal.SubmitRequest{StudentID: students[0], Answers: []int{1, 1}})
	if err != nil || r2.ScorePct != 100 {
		t.Fatalf("пересдача должна дать 100%%: %+v / %v", r2, err)
	}
	var n int64
	db.Raw("SELECT count(*) FROM test_submissions WHERE test_id = ? AND student_id = ?", tst.ID, students[0]).Scan(&n)
	if n != 1 {
		t.Fatalf("пересдача должна быть апсертом (одна запись), got %d", n)
	}
}
