package journal

import "time"

// Статусы занятия и посещаемости (LRN-TCH-020).
const (
	LessonPlanned   = "planned"
	LessonConducted = "conducted"

	AttPresent = "present"
	AttLate    = "late"
	AttAbsent  = "absent"
	AttExcused = "excused"
)

var attStatuses = map[string]bool{AttPresent: true, AttLate: true, AttAbsent: true, AttExcused: true}

// Lesson — конкретное занятие группы на дату.
type Lesson struct {
	ID          int64      `gorm:"column:id;primaryKey"`
	CenterID    int64      `gorm:"column:center_id"`
	GroupID     int64      `gorm:"column:group_id"`
	TeacherID   *int64     `gorm:"column:teacher_id"`
	Date        time.Time  `gorm:"column:date"`
	StartTime   string     `gorm:"column:start_time"`
	DurationMin int        `gorm:"column:duration_min"`
	Status      string     `gorm:"column:status"`
	AdHoc       bool       `gorm:"column:ad_hoc"`
	ConductedAt *time.Time `gorm:"column:conducted_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Lesson) TableName() string { return "lessons" }

// Attendance — отметка ученика на занятии.
type Attendance struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	LessonID  int64     `gorm:"column:lesson_id"`
	StudentID int64     `gorm:"column:student_id"`
	Status    string    `gorm:"column:status"`
	LateMin   int       `gorm:"column:late_min"`
	Grade     *int      `gorm:"column:grade"`
	Tags      string    `gorm:"column:tags"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Attendance) TableName() string { return "attendance" }

// TeacherShift — смена преподавателя с гео-чек-ином (LRN-TCH-010).
type TeacherShift struct {
	ID        int64      `gorm:"column:id;primaryKey"`
	CenterID  int64      `gorm:"column:center_id"`
	TeacherID int64      `gorm:"column:teacher_id"`
	Branch    string     `gorm:"column:branch"`
	StartedAt time.Time  `gorm:"column:started_at"`
	GPSLat    float64    `gorm:"column:gps_lat"`
	GPSLng    float64    `gorm:"column:gps_lng"`
	EndedAt   *time.Time `gorm:"column:ended_at"`
}

// TableName задаёт имя таблицы для GORM.
func (TeacherShift) TableName() string { return "teacher_shifts" }

// GroupPointBudget — бюджет бонусных баллов на группу (LRN-TCH-040).
type GroupPointBudget struct {
	GroupID   int64     `gorm:"column:group_id;primaryKey"`
	Period    string    `gorm:"column:period"` // week | month
	Amount    int       `gorm:"column:amount"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (GroupPointBudget) TableName() string { return "group_point_budgets" }

// PointGrant — факт начисления бонусных баллов (для контроля бюджета).
type PointGrant struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	CenterID  int64     `gorm:"column:center_id"`
	GroupID   int64     `gorm:"column:group_id"`
	StudentID int64     `gorm:"column:student_id"`
	LessonID  *int64    `gorm:"column:lesson_id"`
	Amount    int       `gorm:"column:amount"`
	Reason    string    `gorm:"column:reason"`
	At        time.Time `gorm:"column:at"`
}

// TableName задаёт имя таблицы для GORM.
func (PointGrant) TableName() string { return "point_grants" }

// Question — вопрос теста с вариантами и индексом правильного ответа.
type Question struct {
	Text    string   `json:"text"`
	Options []string `json:"options"`
	Correct int      `json:"correct"`
}

// Test — тест с автопроверкой (LRN-TCH-030).
type Test struct {
	ID        int64      `gorm:"column:id;primaryKey"`
	CenterID  int64      `gorm:"column:center_id"`
	GroupID   *int64     `gorm:"column:group_id"`
	LessonID  *int64     `gorm:"column:lesson_id"`
	Title     string     `gorm:"column:title"`
	Questions []Question `gorm:"column:questions;type:jsonb;serializer:json"`
	CreatedAt time.Time  `gorm:"column:created_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Test) TableName() string { return "tests" }

// TestSubmission — сдача теста учеником с автооценкой.
type TestSubmission struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	TestID    int64     `gorm:"column:test_id"`
	StudentID int64     `gorm:"column:student_id"`
	Answers   []int     `gorm:"column:answers;type:jsonb;serializer:json"`
	ScorePct  int       `gorm:"column:score_pct"`
	GradedAt  time.Time `gorm:"column:graded_at"`
}

// TableName задаёт имя таблицы для GORM.
func (TestSubmission) TableName() string { return "test_submissions" }
