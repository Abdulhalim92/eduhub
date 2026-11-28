package cabinet

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

var timeRe = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

// GroupInput — тело создания/правки группы.
type GroupInput struct {
	Name        string `json:"name"`
	Course      string `json:"course"`
	Branch      string `json:"branch"`
	TeacherID   int64  `json:"teacherId"`
	Schedule    string `json:"schedule"`
	StartTime   string `json:"startTime"`
	DurationMin int    `json:"durationMin"`
	HWPoints    int    `json:"hwPoints"`
	VisitPoints int    `json:"visitPoints"`
	ExamDay     int    `json:"examDay"`
	ExamPoints  int    `json:"examPoints"`
	Capacity    int    `json:"capacity"`
	StartsAt    string `json:"startsAt"`
	EndsAt      string `json:"endsAt"`
	Status      string `json:"status"`
}

// GroupOptions — справочники для форм групп.
type GroupOptions struct {
	Courses   []string   `json:"courses"`
	Branches  []string   `json:"branches"`
	Teachers  []GroupRef `json:"teachers"`
	Schedules []string   `json:"schedules"`
	Days      []string   `json:"days"`
}

// GroupsListResponse — ответ cabinet.groups.list.
type GroupsListResponse struct {
	Center   centers.DTO  `json:"center"`
	Items    []GroupDTO   `json:"items"`
	Total    int          `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"pageSize"`
	Options  GroupOptions `json:"options"`
}

// GroupResponse — ответ cabinet.groups.get (группа, состав, доступные ученики).
type GroupResponse struct {
	Center    centers.DTO  `json:"center"`
	Group     GroupDTO     `json:"group"`
	Students  []StudentDTO `json:"students"`
	Available []GroupRef   `json:"available"`
	Options   GroupOptions `json:"options"`
}

func (s *Service) groupOptions(ctx context.Context, centerID int64) (GroupOptions, error) {
	groups, err := s.repo.GroupsByCenter(ctx, centerID)
	if err != nil {
		return GroupOptions{}, err
	}
	courseSet := map[string]bool{}
	for _, g := range groups {
		courseSet[g.Course] = true
	}
	courses := make([]string, 0, len(courseSet))
	for c := range courseSet {
		courses = append(courses, c)
	}
	sort.Strings(courses)
	branches, err := s.repo.Branches(ctx, centerID)
	if err != nil {
		return GroupOptions{}, err
	}
	teachers, err := s.repo.Teachers(ctx, centerID)
	if err != nil {
		return GroupOptions{}, err
	}
	refs := make([]GroupRef, 0, len(teachers))
	for _, t := range teachers {
		refs = append(refs, GroupRef{ID: t.ID, Name: t.Name})
	}
	return GroupOptions{Courses: courses, Branches: branches, Teachers: refs, Schedules: scheduleKeys, Days: weekDays}, nil
}

// GroupsList возвращает группы центра по фильтрам.
func (s *Service) GroupsList(ctx context.Context, centerID int64, course, branch string, teacherID *int64, status string, page, pageSize int) (GroupsListResponse, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return GroupsListResponse{}, err
	}
	list, total, err := s.repo.GroupsList(ctx, centerID, course, branch, teacherID, status, (page-1)*pageSize, pageSize)
	if err != nil {
		return GroupsListResponse{}, err
	}
	counts, err := s.repo.MemberCounts(ctx, centerID)
	if err != nil {
		return GroupsListResponse{}, err
	}
	names, err := s.teacherNames(ctx, centerID)
	if err != nil {
		return GroupsListResponse{}, err
	}
	items := make([]GroupDTO, 0, len(list))
	for _, g := range list {
		items = append(items, groupDTO(g, counts[g.ID], teacherNameFor(names, g.TeacherID)))
	}
	opts, err := s.groupOptions(ctx, centerID)
	if err != nil {
		return GroupsListResponse{}, err
	}
	return GroupsListResponse{Center: centerDTO, Items: items, Total: total, Page: page, PageSize: pageSize, Options: opts}, nil
}

// GroupGet возвращает группу, её состав и доступных для добавления учеников.
func (s *Service) GroupGet(ctx context.Context, centerID, groupID int64) (GroupResponse, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return GroupResponse{}, err
	}
	g, err := s.repo.FindGroup(ctx, s.db, centerID, groupID)
	if err != nil {
		return GroupResponse{}, err
	}
	names, err := s.teacherNames(ctx, centerID)
	if err != nil {
		return GroupResponse{}, err
	}
	members, err := s.repo.StudentsInGroup(ctx, centerID, groupID)
	if err != nil {
		return GroupResponse{}, err
	}
	studentDTOs := make([]StudentDTO, 0, len(members))
	for _, st := range members {
		studentDTOs = append(studentDTOs, studentDTO(st, g, false))
	}
	avail, err := s.repo.AvailableStudents(ctx, centerID, groupID)
	if err != nil {
		return GroupResponse{}, err
	}
	availRefs := make([]GroupRef, 0, len(avail))
	for _, st := range avail {
		availRefs = append(availRefs, GroupRef{ID: st.ID, Name: st.Name})
	}
	opts, err := s.groupOptions(ctx, centerID)
	if err != nil {
		return GroupResponse{}, err
	}
	return GroupResponse{Center: centerDTO, Group: groupDTO(*g, len(members), teacherNameFor(names, g.TeacherID)), Students: studentDTOs, Available: availRefs, Options: opts}, nil
}

// buildGroup проверяет данные группы (groupFields, BR-024) и заполняет поля target.
func (s *Service) buildGroup(ctx context.Context, tx *gorm.DB, centerID int64, in GroupInput, partial bool, excludeID int64, target *Group) error {
	fields := map[string]string{}
	name := strings.TrimSpace(in.Name)
	course := strings.TrimSpace(in.Course)
	if n := len([]rune(name)); n < 3 || n > 60 {
		fields["name"] = "Название — от 3 до 60 символов"
	}
	if n := len([]rune(course)); n < 2 || n > 60 {
		fields["course"] = "Укажите курс"
	}
	if strings.TrimSpace(in.Branch) == "" {
		fields["branch"] = "Выберите филиал"
	}
	if ok, err := s.repo.TeacherExists(ctx, tx, centerID, in.TeacherID); err != nil {
		return err
	} else if !ok {
		fields["teacherId"] = "Выберите преподавателя центра"
	}
	days, okSched := schedules[in.Schedule]
	if !okSched {
		fields["schedule"] = "Выберите дни занятий"
	}
	checkInt(fields, "hwPoints", in.HWPoints, 0, 100, "Баллы за ДЗ — от 0 до 100")
	checkInt(fields, "visitPoints", in.VisitPoints, 0, 100, "Баллы за посещение — от 0 до 100")
	checkInt(fields, "examPoints", in.ExamPoints, 0, 1000, "Баллы за экзамен — от 0 до 1000")
	checkInt(fields, "capacity", in.Capacity, 1, 50, "Мест — от 1 до 50")
	checkInt(fields, "examDay", in.ExamDay, 0, 6, "Выберите день экзамена")
	if !timeRe.MatchString(in.StartTime) {
		fields["startTime"] = "Укажите время начала в формате ЧЧ:ММ"
	}
	if in.DurationMin < 30 || in.DurationMin > 240 {
		fields["durationMin"] = "Длительность — от 30 до 240 минут"
	} else if _, ok := fields["startTime"]; !ok && toMinutes(in.StartTime)+in.DurationMin > 24*60 {
		fields["durationMin"] = "Занятие должно закончиться до полуночи"
	}
	startsAt, err1 := time.Parse("2006-01-02", in.StartsAt)
	if err1 != nil {
		fields["startsAt"] = "Укажите дату начала"
	}
	endsAt, err2 := time.Parse("2006-01-02", in.EndsAt)
	if err2 != nil {
		fields["endsAt"] = "Укажите дату окончания"
	} else if err1 == nil && !endsAt.After(startsAt) {
		fields["endsAt"] = "Окончание должно быть позже начала"
	}
	status := GroupActive
	if partial && in.Status != "" {
		if in.Status != GroupActive && in.Status != GroupArchived {
			fields["status"] = "Неизвестный статус"
		} else {
			status = in.Status
		}
	} else if partial {
		status = target.Status
	}

	// BR-024: у преподавателя нет пересекающихся по времени занятий активных групп.
	if len(fields) == 0 && status == GroupActive {
		clash, err := s.teacherClash(ctx, tx, centerID, in.TeacherID, excludeID, days, in.StartTime, in.DurationMin)
		if err != nil {
			return err
		}
		if clash != "" {
			fields["startTime"] = clash
		}
	}
	if len(fields) > 0 {
		return apierr.Validation("Проверьте данные группы", fields)
	}

	target.Name, target.Course, target.Branch = name, course, strings.TrimSpace(in.Branch)
	tid := in.TeacherID
	target.TeacherID = &tid
	target.Days = daysToCSV(days)
	target.StartTime, target.DurationMin = in.StartTime, in.DurationMin
	target.HWPoints, target.VisitPoints, target.ExamPoints = in.HWPoints, in.VisitPoints, in.ExamPoints
	target.ExamDay, target.Capacity = in.ExamDay, in.Capacity
	target.StartsAt, target.EndsAt = &startsAt, &endsAt
	target.Status = status
	return nil
}

func (s *Service) teacherClash(ctx context.Context, tx *gorm.DB, centerID, teacherID, excludeID int64, days []int, startTime string, durationMin int) (string, error) {
	groups, err := s.repo.TeacherActiveGroups(ctx, tx, centerID, teacherID, excludeID)
	if err != nil {
		return "", err
	}
	a, b := toMinutes(startTime), toMinutes(startTime)+durationMin
	for _, g := range groups {
		if !dayOverlap(days, g.DayList()) {
			continue
		}
		ga := toMinutes(g.StartTime)
		gb := ga + g.DurationMin
		if a < gb && ga < b {
			return fmt.Sprintf("Преподаватель занят: «%s» в это время (%s–%s)", g.Name, g.StartTime, addMinutes(g.StartTime, g.DurationMin)), nil
		}
	}
	return "", nil
}

func dayOverlap(a, b []int) bool {
	set := map[int]bool{}
	for _, d := range a {
		set[d] = true
	}
	for _, d := range b {
		if set[d] {
			return true
		}
	}
	return false
}

func checkInt(fields map[string]string, key string, v, lo, hi int, msg string) {
	if v < lo || v > hi {
		fields[key] = msg
	}
}

// GroupCreate создаёт группу (CTR-GRP-010, BR-024).
func (s *Service) GroupCreate(ctx context.Context, centerID int64, in GroupInput) (GroupDTO, error) {
	var out GroupDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "создавать группы"); err != nil {
			return err
		}
		g := &Group{CenterID: centerID, Status: GroupActive}
		if err := s.buildGroup(ctx, tx, centerID, in, false, 0, g); err != nil {
			return err
		}
		if err := s.repo.CreateGroup(ctx, tx, g); err != nil {
			return err
		}
		names, err := s.teacherNames(ctx, centerID)
		if err != nil {
			return err
		}
		out = groupDTO(*g, 0, teacherNameFor(names, g.TeacherID))
		return nil
	})
	return out, err
}

// GroupUpdate меняет группу (CTR-GRP-010, BR-024).
func (s *Service) GroupUpdate(ctx context.Context, centerID, groupID int64, in GroupInput) (GroupDTO, error) {
	var out GroupDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		g, err := s.repo.FindGroup(ctx, tx, centerID, groupID)
		if err != nil {
			return err
		}
		if err := writable(center, "менять группы"); err != nil {
			return err
		}
		members, err := s.repo.GroupMemberCount(ctx, tx, groupID)
		if err != nil {
			return err
		}
		if err := s.buildGroup(ctx, tx, centerID, in, true, groupID, g); err != nil {
			return err
		}
		if g.Capacity < members {
			return apierr.Field(fmt.Sprintf("В группе уже %d учеников", members), "capacity", fmt.Sprintf("Не меньше текущего состава (%d)", members))
		}
		if err := s.repo.SaveGroup(ctx, tx, g); err != nil {
			return err
		}
		names, err := s.teacherNames(ctx, centerID)
		if err != nil {
			return err
		}
		out = groupDTO(*g, members, teacherNameFor(names, g.TeacherID))
		return nil
	})
	return out, err
}

// AddStudentToGroup добавляет ученика в группу (вместимость, активность, архив — CTR-GRP-010).
func (s *Service) AddStudentToGroup(ctx context.Context, centerID, groupID, studentID int64) (StudentDTO, error) {
	var out StudentDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		g, err := s.repo.FindGroup(ctx, tx, centerID, groupID)
		if err != nil {
			return err
		}
		st, err := s.repo.FindStudent(ctx, tx, centerID, studentID)
		if err != nil {
			return err
		}
		if err := writable(center, "менять состав групп"); err != nil {
			return err
		}
		if g.Status != GroupActive {
			return apierr.Conflict("Группа в архиве: состав менять нельзя")
		}
		if st.Status != StudentActive {
			return apierr.Conflict("Ученик заблокирован")
		}
		if st.GroupID != nil && *st.GroupID == g.ID {
			return apierr.Conflict("Ученик уже в этой группе")
		}
		members, err := s.repo.GroupMemberCount(ctx, tx, groupID)
		if err != nil {
			return err
		}
		if members >= g.Capacity {
			return apierr.Conflict(fmt.Sprintf("В группе нет свободных мест (%d из %d)", g.Capacity, g.Capacity))
		}
		st.GroupID = &g.ID
		if err := s.repo.SaveStudent(ctx, tx, st); err != nil {
			return err
		}
		out = studentDTO(*st, g, false)
		return nil
	})
	return out, err
}

// RemoveStudentFromGroup убирает ученика из группы.
func (s *Service) RemoveStudentFromGroup(ctx context.Context, centerID, groupID, studentID int64) (StudentDTO, error) {
	var out StudentDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		g, err := s.repo.FindGroup(ctx, tx, centerID, groupID)
		if err != nil {
			return err
		}
		st, err := s.repo.FindStudent(ctx, tx, centerID, studentID)
		if err != nil {
			return err
		}
		if err := writable(center, "менять состав групп"); err != nil {
			return err
		}
		if st.GroupID == nil || *st.GroupID != g.ID {
			return apierr.Conflict("Ученика нет в этой группе")
		}
		st.GroupID = nil
		if err := s.repo.SaveStudent(ctx, tx, st); err != nil {
			return err
		}
		out = studentDTO(*st, nil, false)
		return nil
	})
	return out, err
}
