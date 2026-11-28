package cabinet

import (
	"fmt"
	"strings"
	"time"
)

// StaffDTO — сотрудник для ответа.
type StaffDTO struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	RoleLabel string    `json:"roleLabel"`
	Phone     string    `json:"phone"`
	Status    string    `json:"status"`
	HiredAt   time.Time `json:"hiredAt"`
	HasAccess bool      `json:"hasAccess"`
}

func staffDTO(s Staff, hasAccess bool) StaffDTO {
	return StaffDTO{ID: s.ID, Name: s.Name, Role: s.Role, RoleLabel: staffRoleLabels[s.Role], Phone: s.Phone, Status: s.Status, HiredAt: s.HiredAt, HasAccess: hasAccess}
}

// StudentDTO — ученик для ответа (stuDto).
type StudentDTO struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Phone       string    `json:"phone"`
	Status      string    `json:"status"`
	StatusLabel string    `json:"statusLabel"`
	JoinedAt    time.Time `json:"joinedAt"`
	Coin        int       `json:"coin"`
	HasAccess   bool      `json:"hasAccess"`
	GroupID     *int64    `json:"groupId"`
	Group       string    `json:"group"`
	Branch      string    `json:"branch"`
}

func studentStatusLabel(status string) string {
	if status == StudentBlocked {
		return "Заблокирован"
	}
	return "Активен"
}

func studentDTO(s Student, grp *Group, hasAccess bool) StudentDTO {
	dto := StudentDTO{
		ID: s.ID, Name: s.Name, Phone: s.Phone, Status: s.Status, StatusLabel: studentStatusLabel(s.Status),
		JoinedAt: s.JoinedAt, Coin: s.Coin, HasAccess: hasAccess, GroupID: s.GroupID,
	}
	if grp != nil {
		dto.Group = grp.Name
		dto.Branch = grp.Branch
	}
	return dto
}

// GroupDTO — группа для ответа (grpDto).
type GroupDTO struct {
	ID          int64      `json:"id"`
	Name        string     `json:"name"`
	Course      string     `json:"course"`
	Branch      string     `json:"branch"`
	TeacherID   *int64     `json:"teacherId"`
	Teacher     string     `json:"teacher"`
	Status      string     `json:"status"`
	StatusLabel string     `json:"statusLabel"`
	Days        []int      `json:"days"`
	StartTime   string     `json:"startTime"`
	DurationMin int        `json:"durationMin"`
	EndTime     string     `json:"endTime"`
	Schedule    string     `json:"schedule"`
	HWPoints    int        `json:"hwPoints"`
	VisitPoints int        `json:"visitPoints"`
	ExamDay     int        `json:"examDay"`
	ExamDayLabel string    `json:"examDayLabel"`
	ExamPoints  int        `json:"examPoints"`
	StartsAt    *time.Time `json:"startsAt"`
	EndsAt      *time.Time `json:"endsAt"`
	Capacity    int        `json:"capacity"`
	Members     int        `json:"members"`
	LowFill     bool       `json:"lowFill"`
}

func groupDTO(g Group, members int, teacher string) GroupDTO {
	days := g.DayList()
	labels := make([]string, 0, len(days))
	for _, d := range days {
		labels = append(labels, dayLabel(d))
	}
	status := "Активна"
	if g.Status == GroupArchived {
		status = "В архиве"
	}
	return GroupDTO{
		ID: g.ID, Name: g.Name, Course: g.Course, Branch: g.Branch, TeacherID: g.TeacherID, Teacher: teacher,
		Status: g.Status, StatusLabel: status, Days: days, StartTime: g.StartTime, DurationMin: g.DurationMin,
		EndTime: addMinutes(g.StartTime, g.DurationMin), Schedule: strings.Join(labels, ", "),
		HWPoints: g.HWPoints, VisitPoints: g.VisitPoints, ExamDay: g.ExamDay, ExamDayLabel: dayLabel(g.ExamDay),
		ExamPoints: g.ExamPoints, StartsAt: g.StartsAt, EndsAt: g.EndsAt, Capacity: g.Capacity, Members: members,
		LowFill: g.Status == GroupActive && g.Capacity > 0 && float64(members)/float64(g.Capacity) < 0.5,
	}
}

// UserRow — строка объединённого списка пользователей (сотрудники + ученики, CTR-USR).
type UserRow struct {
	Key         string `json:"key"`
	Kind        string `json:"kind"` // staff | student
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	Role        string `json:"role"`
	RoleLabel   string `json:"roleLabel"`
	Branch      string `json:"branch"`
	Status      string `json:"status"`
	StatusLabel string `json:"statusLabel"`
	HasAccess   bool   `json:"hasAccess"`
}

func dayLabel(d int) string {
	if d >= 0 && d < len(weekDays) {
		return weekDays[d]
	}
	return "—"
}

func toMinutes(hhmm string) int {
	var h, m int
	if _, err := fmt.Sscanf(hhmm, "%d:%d", &h, &m); err != nil {
		return 0
	}
	return h*60 + m
}

func addMinutes(start string, minutes int) string {
	total := toMinutes(start) + minutes
	return fmt.Sprintf("%02d:%02d", total/60%24, total%60)
}
