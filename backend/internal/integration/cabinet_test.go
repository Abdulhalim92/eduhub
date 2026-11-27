package integration_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/credentials"
	"github.com/line/eduhub-backend/internal/modules/cabinet"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

func newCabinet(db *gorm.DB) *cabinet.Service {
	c := centers.NewService(centers.NewRepository(db), audit.New())
	return cabinet.NewService(cabinet.NewRepository(db), c, credentials.New(4), audit.New())
}

func staffReq(i int, role string) cabinet.AddStaffRequest {
	return cabinet.AddStaffRequest{
		Name:  fmt.Sprintf("Сотрудник Номер %d", i),
		Role:  role,
		Phone: fmt.Sprintf("+992 90 %03d %02d %02d", i, i, i),
		Login: fmt.Sprintf("staff%02d", i),
	}
}

func groupInput(teacherID int64, schedule, start string) cabinet.GroupInput {
	return cabinet.GroupInput{
		Name: "Группа А", Course: "Базовый курс", Branch: "Главный филиал", TeacherID: teacherID,
		Schedule: schedule, StartTime: start, DurationMin: 90, HWPoints: 5, VisitPoints: 1,
		ExamDay: 5, ExamPoints: 50, Capacity: 16, StartsAt: "2026-01-01", EndsAt: "2026-06-01",
	}
}

func TestStaffLimitAndDuplicateLogin(t *testing.T) {
	db, _ := freshDB(t)
	seedStartPlan(t, db) // лимит сотрудников тарифа «Старт» = 5
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()

	// Лимит тарифа (BR-023) на «Старт».
	small := makeCenter(t, db, "start", 0, 0, 0)
	for i := 1; i <= 5; i++ {
		if _, err := svc.AddStaff(ctx, actor(), small, staffReq(i, cabinet.RoleTeacher)); err != nil {
			t.Fatalf("добавление сотрудника %d: %v", i, err)
		}
	}
	if _, err := svc.AddStaff(ctx, actor(), small, staffReq(6, cabinet.RoleTeacher)); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("добавление сверх лимита должно отклоняться (BR-023)")
	}

	// Дубль логина (BR-025) на «Про» (лимит не мешает).
	big := makeCenter(t, db, "pro", 0, 0, 0)
	if _, err := svc.AddStaff(ctx, actor(), big, staffReq(10, cabinet.RoleTeacher)); err != nil {
		t.Fatal(err)
	}
	dup := staffReq(11, cabinet.RoleTeacher)
	dup.Login = "staff10" // логин уже занят сотрудником 10
	if _, err := svc.AddStaff(ctx, actor(), big, dup); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("занятый логин должен отклоняться (BR-025)")
	}
}

func TestStaffRemoveFreesSlotAndLogin(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)

	res, err := svc.AddStaff(ctx, actor(), center, staffReq(1, cabinet.RoleTeacher))
	if err != nil {
		t.Fatal(err)
	}
	if res.Credentials.Login != "staff01" || res.Credentials.Password == "" {
		t.Fatalf("должны вернуться данные для входа: %+v", res.Credentials)
	}
	// Увольнение без причины — отказ.
	if _, err := svc.RemoveStaff(ctx, actor(), center, res.Staff.ID, "нет"); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("увольнение без причины должно отклоняться")
	}
	if _, err := svc.RemoveStaff(ctx, actor(), center, res.Staff.ID, "переезд в другой город"); err != nil {
		t.Fatal(err)
	}
	// staff_used вернулся к 0.
	var used int
	db.Raw("SELECT staff_used FROM centers WHERE id = ?", center).Scan(&used)
	if used != 0 {
		t.Fatalf("после увольнения staff_used = %d, ожидалось 0", used)
	}
	// Логин освобождён — можно переиспользовать.
	if _, err := svc.AddStaff(ctx, actor(), center, staffReq(1, cabinet.RoleTeacher)); err != nil {
		t.Fatalf("логин должен освободиться после увольнения: %v", err)
	}
}

func TestStudentAddBlockUnblock(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)

	res, err := svc.AddStudent(ctx, actor(), center, cabinet.AddStudentRequest{Name: "Ученик Первый", Phone: "+992 90 111 11 11", Login: "stud01"})
	if err != nil {
		t.Fatalf("добавление ученика: %v", err)
	}
	if res.Credentials.Login != "stud01" {
		t.Fatal("ученику должны выдать данные для входа")
	}
	if _, err := svc.SetStudentStatus(ctx, actor(), center, res.Student.ID, "blocked", "нет"); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("блокировка без причины должна отклоняться")
	}
	blocked, err := svc.SetStudentStatus(ctx, actor(), center, res.Student.ID, "blocked", "нарушение правил")
	if err != nil {
		t.Fatal(err)
	}
	if blocked.Status != "blocked" {
		t.Fatal("ученик должен стать заблокированным")
	}
	if _, err := svc.SetStudentStatus(ctx, actor(), center, res.Student.ID, "blocked", "повторно"); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("повторная блокировка должна давать конфликт")
	}
	if _, err := svc.SetStudentStatus(ctx, actor(), center, res.Student.ID, "active", "извинились"); err != nil {
		t.Fatal(err)
	}
}

func TestGroupTeacherClash(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)
	teacher, err := svc.AddStaff(ctx, actor(), center, staffReq(1, cabinet.RoleTeacher))
	if err != nil {
		t.Fatal(err)
	}
	tid := teacher.Staff.ID

	if _, err := svc.GroupCreate(ctx, center, groupInput(tid, "Пн, Ср, Пт", "09:00")); err != nil {
		t.Fatalf("первая группа: %v", err)
	}
	// Пересечение по времени у того же преподавателя (Пн 09:30) → отказ (BR-024).
	clash := groupInput(tid, "Пн, Чт", "09:30")
	if _, err := svc.GroupCreate(ctx, center, clash); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("пересечение занятий преподавателя должно отклоняться (BR-024)")
	}
	// Непересекающееся время — ок.
	ok := groupInput(tid, "Пн, Чт", "12:00")
	if _, err := svc.GroupCreate(ctx, center, ok); err != nil {
		t.Fatalf("непересекающаяся группа должна создаваться: %v", err)
	}
}

func TestGroupCapacityAndArchive(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)
	teacher, _ := svc.AddStaff(ctx, actor(), center, staffReq(1, cabinet.RoleTeacher))

	in := groupInput(teacher.Staff.ID, "Пн, Ср, Пт", "09:00")
	in.Capacity = 1
	grp, err := svc.GroupCreate(ctx, center, in)
	if err != nil {
		t.Fatal(err)
	}
	s1, _ := svc.AddStudent(ctx, actor(), center, cabinet.AddStudentRequest{Name: "Ученик Один", Phone: "+992 90 222 22 21", Login: "stud21"})
	s2, _ := svc.AddStudent(ctx, actor(), center, cabinet.AddStudentRequest{Name: "Ученик Два", Phone: "+992 90 222 22 22", Login: "stud22"})
	if _, err := svc.AddStudentToGroup(ctx, center, grp.ID, s1.Student.ID); err != nil {
		t.Fatalf("первый ученик должен добавиться: %v", err)
	}
	// Группа заполнена (capacity 1).
	if _, err := svc.AddStudentToGroup(ctx, center, grp.ID, s2.Student.ID); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("добавление в полную группу должно отклоняться")
	}
	// Уменьшить вместимость ниже состава — отказ.
	upd := groupInput(teacher.Staff.ID, "Пн, Ср, Пт", "09:00")
	upd.Capacity = 0
	if _, err := svc.GroupUpdate(ctx, center, grp.ID, upd); err == nil {
		t.Fatal("вместимость 0 должна отклоняться валидацией")
	}
	// Архивировать группу и попытаться добавить — отказ.
	arch := groupInput(teacher.Staff.ID, "Пн, Ср, Пт", "09:00")
	arch.Capacity = 16
	arch.Status = cabinet.GroupArchived
	if _, err := svc.GroupUpdate(ctx, center, grp.ID, arch); err != nil {
		t.Fatalf("архивация группы: %v", err)
	}
	if _, err := svc.AddStudentToGroup(ctx, center, grp.ID, s2.Student.ID); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("в архивную группу добавлять нельзя")
	}
}

func TestProfileCountsStaffAndStudents(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)
	mustExec(t, db, &cabinet.CenterProfile{CenterID: center, Direction: "Математика", Description: "описание", Logo: "l", Banner: "b"})

	if _, err := svc.AddStaff(ctx, actor(), center, staffReq(1, cabinet.RoleTeacher)); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddStaff(ctx, actor(), center, staffReq(2, cabinet.RoleAdmin)); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddStudent(ctx, actor(), center, cabinet.AddStudentRequest{Name: "Ученик П", Phone: "+992 90 333 33 31", Login: "stud31"}); err != nil {
		t.Fatal(err)
	}
	prof, err := svc.Profile(ctx, center)
	if err != nil {
		t.Fatalf("профиль: %v", err)
	}
	if prof.Profile.Students != 1 {
		t.Fatalf("учеников в профиле = %d, ожидалось 1", prof.Profile.Students)
	}
	roleCount := map[string]int{}
	for _, rc := range prof.Profile.StaffRoles {
		roleCount[rc.Key] = rc.Count
	}
	if roleCount[cabinet.RoleTeacher] != 1 || roleCount[cabinet.RoleAdmin] != 1 {
		t.Fatalf("состав по ролям неверен: %+v", prof.Profile.StaffRoles)
	}
}

func TestAccessResetReusesLogin(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	svc := newCabinet(db)
	ctx := context.Background()
	center := makeCenter(t, db, "pro", 0, 0, 0)
	staff, err := svc.AddStaff(ctx, actor(), center, staffReq(1, cabinet.RoleTeacher))
	if err != nil {
		t.Fatal(err)
	}
	// Сброс без причины — отказ.
	if _, err := svc.AccessReset(ctx, actor(), center, cabinet.AccessResetRequest{Kind: "staff", ID: staff.Staff.ID, Reason: "нет"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("сброс без основания должен отклоняться")
	}
	res, err := svc.AccessReset(ctx, actor(), center, cabinet.AccessResetRequest{Kind: "staff", ID: staff.Staff.ID, Reason: "забыл пароль"})
	if err != nil {
		t.Fatal(err)
	}
	if !res.HadAccess || res.Login != "staff01" || res.Password == "" {
		t.Fatalf("сброс должен переиспользовать логин и выдать новый пароль: %+v", res)
	}
}
