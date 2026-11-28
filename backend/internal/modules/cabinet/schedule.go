package cabinet

import (
	"context"
	"sort"

	"github.com/line/eduhub-backend/internal/modules/centers"
)

// ScheduleLesson — занятие в недельной сетке.
type ScheduleLesson struct {
	GroupID   int64  `json:"groupId"`
	Group     string `json:"group"`
	Course    string `json:"course"`
	Branch    string `json:"branch"`
	TeacherID *int64 `json:"teacherId"`
	Teacher   string `json:"teacher"`
	Start     string `json:"start"`
	End       string `json:"end"`
	Members   int    `json:"members"`
	Capacity  int    `json:"capacity"`
}

// ScheduleDay — один день недели с занятиями.
type ScheduleDay struct {
	Day     string           `json:"day"`
	Index   int              `json:"index"`
	Lessons []ScheduleLesson `json:"lessons"`
}

// ScheduleResponse — ответ cabinet.schedule (CTR-SCH-010).
type ScheduleResponse struct {
	Center  centers.DTO   `json:"center"`
	Days    []ScheduleDay `json:"days"`
	Totals  ScheduleTotal `json:"totals"`
	Options struct {
		Branches []string   `json:"branches"`
		Teachers []GroupRef `json:"teachers"`
	} `json:"options"`
}

// ScheduleTotal — итоги расписания.
type ScheduleTotal struct {
	Groups  int `json:"groups"`
	Lessons int `json:"lessons"`
}

// Schedule возвращает недельную сетку занятий активных групп центра (CTR-SCH-010).
func (s *Service) Schedule(ctx context.Context, centerID int64, branch string, teacherID *int64) (ScheduleResponse, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return ScheduleResponse{}, err
	}
	groups, err := s.repo.ActiveGroups(ctx, centerID, branch, teacherID)
	if err != nil {
		return ScheduleResponse{}, err
	}
	counts, err := s.repo.MemberCounts(ctx, centerID)
	if err != nil {
		return ScheduleResponse{}, err
	}
	names, err := s.teacherNames(ctx, centerID)
	if err != nil {
		return ScheduleResponse{}, err
	}
	days := make([]ScheduleDay, len(weekDays))
	lessonsTotal := 0
	for i, label := range weekDays {
		day := ScheduleDay{Day: label, Index: i, Lessons: []ScheduleLesson{}}
		for _, g := range groups {
			if !containsInt(g.DayList(), i) {
				continue
			}
			day.Lessons = append(day.Lessons, ScheduleLesson{
				GroupID: g.ID, Group: g.Name, Course: g.Course, Branch: g.Branch, TeacherID: g.TeacherID,
				Teacher: teacherNameFor(names, g.TeacherID), Start: g.StartTime, End: addMinutes(g.StartTime, g.DurationMin),
				Members: counts[g.ID], Capacity: g.Capacity,
			})
		}
		sort.SliceStable(day.Lessons, func(a, b int) bool { return day.Lessons[a].Start < day.Lessons[b].Start })
		lessonsTotal += len(day.Lessons)
		days[i] = day
	}
	teachers, err := s.repo.Teachers(ctx, centerID)
	if err != nil {
		return ScheduleResponse{}, err
	}
	branches, err := s.repo.Branches(ctx, centerID)
	if err != nil {
		return ScheduleResponse{}, err
	}
	res := ScheduleResponse{Center: centerDTO, Days: days, Totals: ScheduleTotal{Groups: len(groups), Lessons: lessonsTotal}}
	res.Options.Branches = branches
	for _, t := range teachers {
		res.Options.Teachers = append(res.Options.Teachers, GroupRef{ID: t.ID, Name: t.Name})
	}
	return res, nil
}

func containsInt(xs []int, v int) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}
