package journal

import (
	"context"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// LessonsRange возвращает занятия группы в диапазоне: слоты расписания + сохранённые занятия (гибрид).
func (s *Service) LessonsRange(ctx context.Context, centerID, groupID int64, fromStr, toStr string) (LessonsRangeResponse, error) {
	group, err := s.repo.Group(ctx, s.db, centerID, groupID)
	if err != nil {
		return LessonsRangeResponse{}, err
	}
	from, to, err := parseRange(fromStr, toStr)
	if err != nil {
		return LessonsRangeResponse{}, err
	}
	stored, err := s.repo.LessonsInRange(ctx, groupID, from, to)
	if err != nil {
		return LessonsRangeResponse{}, err
	}
	byDate := map[string]Lesson{}
	for _, l := range stored {
		byDate[l.Date.Format(dateLayout)] = l
	}
	days := parseDays(group.Days)

	slots := []LessonSlot{}
	seen := map[string]bool{}
	// Слоты по расписанию группы в пределах периода действия.
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if group.StartsAt != nil && d.Before(dayOf(*group.StartsAt)) {
			continue
		}
		if group.EndsAt != nil && d.After(dayOf(*group.EndsAt)) {
			continue
		}
		if !containsInt(days, weekdayIndex(int(d.Weekday()))) {
			continue
		}
		key := d.Format(dateLayout)
		seen[key] = true
		slot := LessonSlot{Date: key, Weekday: weekdayIndex(int(d.Weekday())), StartTime: group.StartTime, Status: LessonPlanned}
		if l, ok := byDate[key]; ok {
			id := l.ID
			slot.LessonID, slot.Status, slot.AdHoc, slot.Stored = &id, l.Status, l.AdHoc, true
		}
		slots = append(slots, slot)
	}
	// Внеплановые сохранённые занятия вне дат расписания.
	for _, l := range stored {
		key := l.Date.Format(dateLayout)
		if seen[key] {
			continue
		}
		id := l.ID
		slots = append(slots, LessonSlot{Date: key, Weekday: weekdayIndex(int(l.Date.Weekday())), StartTime: l.StartTime, Status: l.Status, LessonID: &id, AdHoc: l.AdHoc, Stored: true})
	}
	sortSlots(slots)
	return LessonsRangeResponse{GroupID: groupID, From: from.Format(dateLayout), To: to.Format(dateLayout), Slots: slots}, nil
}

// OpenLessonRequest — тело открытия/создания занятия.
type OpenLessonRequest struct {
	Date      string `json:"date"`
	TeacherID *int64 `json:"teacherId"`
	AdHoc     bool   `json:"adHoc"`
}

// OpenLesson открывает занятие на дату (upsert по группе+дате). Дата вне расписания требует adHoc.
func (s *Service) OpenLesson(ctx context.Context, centerID, groupID int64, req OpenLessonRequest) (LessonDTO, error) {
	var out LessonDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "открывать занятия"); err != nil {
			return err
		}
		group, err := s.repo.Group(ctx, tx, centerID, groupID)
		if err != nil {
			return err
		}
		date, derr := time.Parse(dateLayout, req.Date)
		if derr != nil {
			return apierr.Field("Укажите дату занятия", "date", "Формат ГГГГ-ММ-ДД")
		}
		date = dayOf(date)
		onSchedule := containsInt(parseDays(group.Days), weekdayIndex(int(date.Weekday())))
		if !onSchedule && !req.AdHoc {
			return apierr.Field("Эта дата не по расписанию группы — отметьте внеплановое занятие", "date", "Вне расписания (нужен adHoc)")
		}
		// Уже открыто — возвращаем существующее.
		if existing, err := s.repo.LessonByGroupDate(ctx, tx, groupID, date); err != nil {
			return err
		} else if existing != nil {
			out = lessonToDTO(*existing)
			return nil
		}
		teacher := group.TeacherID
		if req.TeacherID != nil {
			if ok, err := s.repo.TeacherExists(ctx, tx, centerID, *req.TeacherID); err != nil {
				return err
			} else if !ok {
				return apierr.Field("Выберите преподавателя центра", "teacherId", "Неизвестный преподаватель")
			}
			teacher = req.TeacherID
		}
		l := &Lesson{
			CenterID: centerID, GroupID: groupID, TeacherID: teacher, Date: date, StartTime: group.StartTime,
			DurationMin: group.DurationMin, Status: LessonPlanned, AdHoc: !onSchedule,
		}
		if err := s.repo.CreateLesson(ctx, tx, l); err != nil {
			return err
		}
		out = lessonToDTO(*l)
		return nil
	})
	return out, err
}

// GetLesson возвращает занятие с ростером и отметками.
func (s *Service) GetLesson(ctx context.Context, centerID, lessonID int64) (LessonDetail, error) {
	l, err := s.repo.FindLesson(ctx, s.db, centerID, lessonID)
	if err != nil {
		return LessonDetail{}, err
	}
	roster, err := s.repo.GroupRoster(ctx, l.GroupID)
	if err != nil {
		return LessonDetail{}, err
	}
	marks, err := s.repo.AttendanceForLesson(ctx, lessonID)
	if err != nil {
		return LessonDetail{}, err
	}
	byStudent := map[int64]Attendance{}
	for _, m := range marks {
		byStudent[m.StudentID] = m
	}
	students := make([]AttendanceDTO, 0, len(roster))
	for _, r := range roster {
		dto := AttendanceDTO{StudentID: r.ID, Name: r.Name, Status: AttAbsent}
		if m, ok := byStudent[r.ID]; ok {
			dto.Status, dto.LateMin, dto.Grade, dto.Tags = m.Status, m.LateMin, m.Grade, m.Tags
		}
		students = append(students, dto)
	}
	return LessonDetail{Lesson: lessonToDTO(*l), Students: students}, nil
}

// Conduct переводит занятие в «Проведён» (идемпотентно). Побочки (зарплата/списание урока) — хук (нет модулей).
func (s *Service) Conduct(ctx context.Context, actor audit.Actor, centerID, lessonID int64) (LessonDTO, error) {
	var out LessonDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "проводить занятия"); err != nil {
			return err
		}
		l, err := s.repo.FindLesson(ctx, tx, centerID, lessonID)
		if err != nil {
			return err
		}
		if l.Status == LessonConducted {
			out = lessonToDTO(*l)
			return nil
		}
		now := time.Now().UTC()
		l.Status = LessonConducted
		l.ConductedAt = &now
		if err := s.repo.SaveLesson(ctx, tx, l); err != nil {
			return err
		}
		// Побочки «Проведён» (списание оплаченных уроков + начисление зарплаты) — через хук cashier.
		if s.hook != nil {
			present, err := s.repo.PresentStudentIDs(ctx, tx, l.ID)
			if err != nil {
				return err
			}
			if err := s.hook.OnConducted(ctx, tx, *l, present); err != nil {
				return err
			}
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "lesson.conducted", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"lesson": l.ID, "group": l.GroupID, "date": l.Date.Format(dateLayout)}, Reason: "Занятие проведено",
		}); err != nil {
			return err
		}
		out = lessonToDTO(*l)
		return nil
	})
	return out, err
}

func dayOf(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func parseRange(fromStr, toStr string) (time.Time, time.Time, error) {
	from := dayOf(time.Now().UTC())
	to := from.AddDate(0, 0, 30)
	if fromStr != "" {
		v, err := time.Parse(dateLayout, fromStr)
		if err != nil {
			return time.Time{}, time.Time{}, apierr.Field("Некорректная дата from", "from", "Формат ГГГГ-ММ-ДД")
		}
		from = dayOf(v)
	}
	if toStr != "" {
		v, err := time.Parse(dateLayout, toStr)
		if err != nil {
			return time.Time{}, time.Time{}, apierr.Field("Некорректная дата to", "to", "Формат ГГГГ-ММ-ДД")
		}
		to = dayOf(v)
	}
	if to.Before(from) {
		to = from
	}
	// Ограничим окно 120 днями, чтобы не генерировать слишком много слотов.
	if to.After(from.AddDate(0, 0, 120)) {
		to = from.AddDate(0, 0, 120)
	}
	return from, to, nil
}

func sortSlots(slots []LessonSlot) {
	for i := 1; i < len(slots); i++ {
		for j := i; j > 0 && slots[j-1].Date > slots[j].Date; j-- {
			slots[j-1], slots[j] = slots[j], slots[j-1]
		}
	}
}
