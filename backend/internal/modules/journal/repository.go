package journal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository — доступ к данным журнала. Группы/ученики/сотрудники/филиалы читаются сырым SQL.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий журнала.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// CenterInfo — срез центра (статус, название) для проверок и аудита.
type CenterInfo struct {
	ID     int64  `gorm:"column:id"`
	Name   string `gorm:"column:name"`
	Status string `gorm:"column:status"`
}

// Center читает срез центра или NOT_FOUND.
func (r *Repository) Center(ctx context.Context, tx *gorm.DB, id int64) (*CenterInfo, error) {
	var c CenterInfo
	res := tx.WithContext(ctx).Table("centers").Select("id, name, status").Where("id = ?", id).Scan(&c)
	if res.Error != nil {
		return nil, fmt.Errorf("journal: center: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &c, nil
}

// GroupRow — срез группы (расписание, преподаватель, период).
type GroupRow struct {
	ID          int64      `gorm:"column:id"`
	CenterID    int64      `gorm:"column:center_id"`
	Name        string     `gorm:"column:name"`
	Status      string     `gorm:"column:status"`
	TeacherID   *int64     `gorm:"column:teacher_id"`
	Days        string     `gorm:"column:days"`
	StartTime   string     `gorm:"column:start_time"`
	DurationMin int        `gorm:"column:duration_min"`
	StartsAt    *time.Time `gorm:"column:starts_at"`
	EndsAt      *time.Time `gorm:"column:ends_at"`
}

// Group читает срез группы центра или NOT_FOUND.
func (r *Repository) Group(ctx context.Context, tx *gorm.DB, centerID, groupID int64) (*GroupRow, error) {
	var g GroupRow
	res := tx.WithContext(ctx).Table("groups").
		Select("id, center_id, name, status, teacher_id, days, start_time, duration_min, starts_at, ends_at").
		Where("id = ? AND center_id = ?", groupID, centerID).Scan(&g)
	if res.Error != nil {
		return nil, fmt.Errorf("journal: group: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Группа не найдена")
	}
	return &g, nil
}

// Roster — ученик группы (для ростера посещаемости).
type Roster struct {
	ID     int64  `gorm:"column:id"`
	Name   string `gorm:"column:name"`
	Status string `gorm:"column:status"`
}

// GroupRoster возвращает учеников группы.
func (r *Repository) GroupRoster(ctx context.Context, groupID int64) ([]Roster, error) {
	var out []Roster
	err := r.db.WithContext(ctx).Table("students").Select("id, name, status").
		Where("group_id = ?", groupID).Order("name").Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("journal: roster: %w", err)
	}
	return out, nil
}

// StudentInGroup сообщает, состоит ли ученик в группе центра.
func (r *Repository) StudentInGroup(ctx context.Context, tx *gorm.DB, centerID, groupID, studentID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Table("students").
		Where("id = ? AND center_id = ? AND group_id = ?", studentID, centerID, groupID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("journal: student in group: %w", err)
	}
	return n > 0, nil
}

// StudentActive сообщает, что ученик центра активен (для начисления баллов/тестов).
func (r *Repository) StudentActive(ctx context.Context, tx *gorm.DB, centerID, studentID int64) (bool, bool, error) {
	var row struct {
		Status string `gorm:"column:status"`
	}
	res := tx.WithContext(ctx).Table("students").Select("status").Where("id = ? AND center_id = ?", studentID, centerID).Scan(&row)
	if res.Error != nil {
		return false, false, fmt.Errorf("journal: student active: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return false, false, nil
	}
	return true, row.Status == "active", nil
}

// TeacherExists проверяет активного преподавателя центра.
func (r *Repository) TeacherExists(ctx context.Context, tx *gorm.DB, centerID, teacherID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Table("staff").
		Where("id = ? AND center_id = ? AND role = 'teacher' AND status = 'active'", teacherID, centerID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("journal: teacher exists: %w", err)
	}
	return n > 0, nil
}

// BranchCoords возвращает координаты филиала центра (из заявок модерации); ok=false — координат нет.
func (r *Repository) BranchCoords(ctx context.Context, centerID int64, branch string) (lat, lng float64, ok bool, err error) {
	var row struct {
		Lat float64 `gorm:"column:gps_lat"`
		Lng float64 `gorm:"column:gps_lng"`
	}
	res := r.db.WithContext(ctx).Table("branch_submissions").Select("gps_lat, gps_lng").
		Where("center_id = ? AND branch = ?", centerID, branch).Order("id DESC").Limit(1).Scan(&row)
	if res.Error != nil {
		return 0, 0, false, fmt.Errorf("journal: branch coords: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return 0, 0, false, nil
	}
	return row.Lat, row.Lng, true, nil
}

// AddStudentCoin атомарно начисляет coin ученику и возвращает новый остаток.
func (r *Repository) AddStudentCoin(ctx context.Context, tx *gorm.DB, studentID, amount int64) (int, error) {
	var coin int
	err := tx.WithContext(ctx).Raw(
		"UPDATE students SET coin = coin + ?, updated_at = now() WHERE id = ? RETURNING coin", amount, studentID).Scan(&coin).Error
	if err != nil {
		return 0, fmt.Errorf("journal: add student coin: %w", err)
	}
	return coin, nil
}

// --- занятия ---

// FindLesson возвращает занятие центра или NOT_FOUND.
func (r *Repository) FindLesson(ctx context.Context, tx *gorm.DB, centerID, id int64) (*Lesson, error) {
	var l Lesson
	err := tx.WithContext(ctx).First(&l, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Занятие не найдено")
	}
	if err != nil {
		return nil, fmt.Errorf("journal: find lesson: %w", err)
	}
	return &l, nil
}

// LessonByGroupDate возвращает занятие группы на дату (nil — нет).
func (r *Repository) LessonByGroupDate(ctx context.Context, tx *gorm.DB, groupID int64, date time.Time) (*Lesson, error) {
	var l Lesson
	err := tx.WithContext(ctx).First(&l, "group_id = ? AND date = ?", groupID, date).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("journal: lesson by date: %w", err)
	}
	return &l, nil
}

// CreateLesson вставляет занятие.
func (r *Repository) CreateLesson(ctx context.Context, tx *gorm.DB, l *Lesson) error {
	if err := tx.WithContext(ctx).Create(l).Error; err != nil {
		return fmt.Errorf("journal: create lesson: %w", err)
	}
	return nil
}

// SaveLesson сохраняет изменения занятия.
func (r *Repository) SaveLesson(ctx context.Context, tx *gorm.DB, l *Lesson) error {
	if err := tx.WithContext(ctx).Save(l).Error; err != nil {
		return fmt.Errorf("journal: save lesson: %w", err)
	}
	return nil
}

// LessonsInRange возвращает сохранённые занятия группы в диапазоне дат.
func (r *Repository) LessonsInRange(ctx context.Context, groupID int64, from, to time.Time) ([]Lesson, error) {
	var out []Lesson
	err := r.db.WithContext(ctx).Where("group_id = ? AND date >= ? AND date <= ?", groupID, from, to).
		Order("date").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("journal: lessons in range: %w", err)
	}
	return out, nil
}

// --- посещаемость ---

// AttendanceForLesson возвращает отметки занятия.
func (r *Repository) AttendanceForLesson(ctx context.Context, lessonID int64) ([]Attendance, error) {
	var out []Attendance
	err := r.db.WithContext(ctx).Where("lesson_id = ?", lessonID).Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("journal: attendance: %w", err)
	}
	return out, nil
}

// PresentStudentIDs возвращает id учеников, присутствовавших на занятии (present|late).
func (r *Repository) PresentStudentIDs(ctx context.Context, tx *gorm.DB, lessonID int64) ([]int64, error) {
	var ids []int64
	err := tx.WithContext(ctx).Table("attendance").
		Where("lesson_id = ? AND status IN ?", lessonID, []string{AttPresent, AttLate}).
		Pluck("student_id", &ids).Error
	if err != nil {
		return nil, fmt.Errorf("journal: present students: %w", err)
	}
	return ids, nil
}

// UpsertAttendance вставляет/обновляет отметку (lesson_id, student_id).
func (r *Repository) UpsertAttendance(ctx context.Context, tx *gorm.DB, a *Attendance) error {
	err := tx.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "lesson_id"}, {Name: "student_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"status", "late_min", "grade", "tags", "updated_at"}),
	}).Create(a).Error
	if err != nil {
		return fmt.Errorf("journal: upsert attendance: %w", err)
	}
	return nil
}

// --- смены ---

// CreateShift вставляет смену.
func (r *Repository) CreateShift(ctx context.Context, tx *gorm.DB, s *TeacherShift) error {
	if err := tx.WithContext(ctx).Create(s).Error; err != nil {
		return fmt.Errorf("journal: create shift: %w", err)
	}
	return nil
}

// FindShift возвращает смену центра или NOT_FOUND.
func (r *Repository) FindShift(ctx context.Context, tx *gorm.DB, centerID, id int64) (*TeacherShift, error) {
	var s TeacherShift
	err := tx.WithContext(ctx).First(&s, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Смена не найдена")
	}
	if err != nil {
		return nil, fmt.Errorf("journal: find shift: %w", err)
	}
	return &s, nil
}

// SaveShift сохраняет изменения смены.
func (r *Repository) SaveShift(ctx context.Context, tx *gorm.DB, s *TeacherShift) error {
	if err := tx.WithContext(ctx).Save(s).Error; err != nil {
		return fmt.Errorf("journal: save shift: %w", err)
	}
	return nil
}

// --- баллы ---

// Budget возвращает бюджет баллов группы (nil — не задан).
func (r *Repository) Budget(ctx context.Context, tx *gorm.DB, groupID int64) (*GroupPointBudget, error) {
	var b GroupPointBudget
	err := tx.WithContext(ctx).First(&b, "group_id = ?", groupID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("journal: budget: %w", err)
	}
	return &b, nil
}

// UpsertBudget задаёт бюджет баллов группы.
func (r *Repository) UpsertBudget(ctx context.Context, tx *gorm.DB, b *GroupPointBudget) error {
	err := tx.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "group_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"period", "amount", "updated_at"}),
	}).Create(b).Error
	if err != nil {
		return fmt.Errorf("journal: upsert budget: %w", err)
	}
	return nil
}

// SpentSince возвращает сумму начисленных баллов группе с момента since.
func (r *Repository) SpentSince(ctx context.Context, tx *gorm.DB, groupID int64, since time.Time) (int, error) {
	var sum *int64
	err := tx.WithContext(ctx).Table("point_grants").Select("SUM(amount)").
		Where("group_id = ? AND at >= ?", groupID, since).Scan(&sum).Error
	if err != nil {
		return 0, fmt.Errorf("journal: spent since: %w", err)
	}
	if sum == nil {
		return 0, nil
	}
	return int(*sum), nil
}

// CreatePointGrant фиксирует начисление баллов.
func (r *Repository) CreatePointGrant(ctx context.Context, tx *gorm.DB, g *PointGrant) error {
	if err := tx.WithContext(ctx).Create(g).Error; err != nil {
		return fmt.Errorf("journal: create point grant: %w", err)
	}
	return nil
}

// --- тесты ---

// CreateTest вставляет тест.
func (r *Repository) CreateTest(ctx context.Context, tx *gorm.DB, t *Test) error {
	if err := tx.WithContext(ctx).Create(t).Error; err != nil {
		return fmt.Errorf("journal: create test: %w", err)
	}
	return nil
}

// FindTest возвращает тест центра или NOT_FOUND.
func (r *Repository) FindTest(ctx context.Context, tx *gorm.DB, centerID, id int64) (*Test, error) {
	var t Test
	err := tx.WithContext(ctx).First(&t, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Тест не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("journal: find test: %w", err)
	}
	return &t, nil
}

// UpsertSubmission вставляет/обновляет сдачу теста (пересдача).
func (r *Repository) UpsertSubmission(ctx context.Context, tx *gorm.DB, s *TestSubmission) error {
	err := tx.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "test_id"}, {Name: "student_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"answers", "score_pct", "graded_at"}),
	}).Create(s).Error
	if err != nil {
		return fmt.Errorf("journal: upsert submission: %w", err)
	}
	return nil
}
