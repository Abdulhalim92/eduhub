package journal

import "time"

const dateLayout = "2006-01-02"

// LessonDTO — занятие для ответа.
type LessonDTO struct {
	ID          int64      `json:"id"`
	GroupID     int64      `json:"groupId"`
	TeacherID   *int64     `json:"teacherId"`
	Date        string     `json:"date"`
	StartTime   string     `json:"startTime"`
	DurationMin int        `json:"durationMin"`
	Status      string     `json:"status"`
	AdHoc       bool       `json:"adHoc"`
	ConductedAt *time.Time `json:"conductedAt"`
}

func lessonToDTO(l Lesson) LessonDTO {
	return LessonDTO{
		ID: l.ID, GroupID: l.GroupID, TeacherID: l.TeacherID, Date: l.Date.Format(dateLayout),
		StartTime: l.StartTime, DurationMin: l.DurationMin, Status: l.Status, AdHoc: l.AdHoc, ConductedAt: l.ConductedAt,
	}
}

// LessonSlot — строка расписания журнала: запланированный слот или сохранённое занятие.
type LessonSlot struct {
	Date      string `json:"date"`
	Weekday   int    `json:"weekday"`
	StartTime string `json:"startTime"`
	Status    string `json:"status"`     // planned | conducted
	LessonID  *int64 `json:"lessonId"`   // null — слот ещё не открыт
	AdHoc     bool   `json:"adHoc"`
	Stored    bool   `json:"stored"`
}

// AttendanceDTO — отметка ученика на занятии.
type AttendanceDTO struct {
	StudentID int64  `json:"studentId"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	LateMin   int    `json:"lateMin"`
	Grade     *int   `json:"grade"`
	Tags      string `json:"tags"`
}

// LessonDetail — занятие с ростером и отметками.
type LessonDetail struct {
	Lesson   LessonDTO       `json:"lesson"`
	Students []AttendanceDTO `json:"students"`
}

// LessonsRangeResponse — ответ списка занятий группы в диапазоне дат.
type LessonsRangeResponse struct {
	GroupID int64        `json:"groupId"`
	From    string       `json:"from"`
	To      string       `json:"to"`
	Slots   []LessonSlot `json:"slots"`
}
