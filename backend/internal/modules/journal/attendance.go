package journal

import (
	"context"
	"strings"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// AttendanceEntry — отметка одного ученика (LRN-TCH-020).
type AttendanceEntry struct {
	StudentID int64  `json:"studentId"`
	Status    string `json:"status"`
	LateMin   int    `json:"lateMin"`
	Grade     *int   `json:"grade"`
	Tags      string `json:"tags"`
}

// SetAttendance апсертит отметки посещаемости/оценок/тегов для занятия.
func (s *Service) SetAttendance(ctx context.Context, centerID, lessonID int64, entries []AttendanceEntry) (LessonDetail, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "отмечать посещаемость"); err != nil {
			return err
		}
		lesson, err := s.repo.FindLesson(ctx, tx, centerID, lessonID)
		if err != nil {
			return err
		}
		for i, e := range entries {
			if !attStatuses[e.Status] {
				return apierr.Field("Неизвестный статус посещаемости", "status", "present | late | absent | excused")
			}
			if e.Status == AttLate && e.LateMin < 1 {
				return apierr.Field("Для статуса «Опоздал» укажите минуты", "lateMin", "От 1 минуты")
			}
			if g := e.Grade; g != nil && (*g < 0 || *g > 100) {
				return apierr.Field("Оценка — от 0 до 100", "grade", "0..100")
			}
			ok, err := s.repo.StudentInGroup(ctx, tx, centerID, lesson.GroupID, e.StudentID)
			if err != nil {
				return err
			}
			if !ok {
				return apierr.Conflict("Ученик не из этой группы")
			}
			lateMin := 0
			if e.Status == AttLate {
				lateMin = e.LateMin
			}
			att := &Attendance{LessonID: lessonID, StudentID: e.StudentID, Status: e.Status, LateMin: lateMin, Grade: e.Grade, Tags: strings.TrimSpace(e.Tags)}
			if err := s.repo.UpsertAttendance(ctx, tx, att); err != nil {
				return err
			}
			_ = i
		}
		return nil
	})
	if err != nil {
		return LessonDetail{}, err
	}
	return s.GetLesson(ctx, centerID, lessonID)
}
