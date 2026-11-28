package cashier

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository — доступ к данным кассы и зарплат. Центры/группы/ученики/преподаватели читаются сырым SQL.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий кассы.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// CenterInfo — срез центра (статус, название).
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
		return nil, fmt.Errorf("cashier: center: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &c, nil
}

// StudentInCenter сообщает статус ученика центра (ok=false — нет).
func (r *Repository) StudentInCenter(ctx context.Context, tx *gorm.DB, centerID, studentID int64) (status string, ok bool, err error) {
	var row struct {
		Status string `gorm:"column:status"`
	}
	res := tx.WithContext(ctx).Table("students").Select("status").Where("id = ? AND center_id = ?", studentID, centerID).Scan(&row)
	if res.Error != nil {
		return "", false, fmt.Errorf("cashier: student: %w", res.Error)
	}
	return row.Status, res.RowsAffected > 0, nil
}

// GroupInCenter сообщает, что группа принадлежит центру.
func (r *Repository) GroupInCenter(ctx context.Context, tx *gorm.DB, centerID, groupID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Table("groups").Where("id = ? AND center_id = ?", groupID, centerID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("cashier: group: %w", err)
	}
	return n > 0, nil
}

// TeacherExists проверяет активного преподавателя центра.
func (r *Repository) TeacherExists(ctx context.Context, tx *gorm.DB, centerID, teacherID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Table("staff").
		Where("id = ? AND center_id = ? AND role = 'teacher' AND status = 'active'", teacherID, centerID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("cashier: teacher: %w", err)
	}
	return n > 0, nil
}

// StudentCoin возвращает текущий баланс баллов ученика.
func (r *Repository) StudentCoin(ctx context.Context, tx *gorm.DB, studentID int64) (int, error) {
	var coin int
	err := tx.WithContext(ctx).Table("students").Select("coin").Where("id = ?", studentID).Scan(&coin).Error
	if err != nil {
		return 0, fmt.Errorf("cashier: student coin: %w", err)
	}
	return coin, nil
}

// StudentCoinForUpdate блокирует строку ученика и возвращает баланс баллов (защита от гонки списаний).
func (r *Repository) StudentCoinForUpdate(ctx context.Context, tx *gorm.DB, studentID int64) (int, error) {
	var coin int
	err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Table("students").Select("coin").Where("id = ?", studentID).Scan(&coin).Error
	if err != nil {
		return 0, fmt.Errorf("cashier: lock student coin: %w", err)
	}
	return coin, nil
}

// SpendStudentCoin списывает баллы ученика (для скидки).
func (r *Repository) SpendStudentCoin(ctx context.Context, tx *gorm.DB, studentID int64, amount int) error {
	err := tx.WithContext(ctx).Exec("UPDATE students SET coin = coin - ?, updated_at = now() WHERE id = ?", amount, studentID).Error
	if err != nil {
		return fmt.Errorf("cashier: spend coin: %w", err)
	}
	return nil
}

// --- настройки ---

// Settings возвращает настройки кассы центра (nil — не заданы).
func (r *Repository) Settings(ctx context.Context, tx *gorm.DB, centerID int64) (*CashSettings, error) {
	var s CashSettings
	err := tx.WithContext(ctx).First(&s, "center_id = ?", centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("cashier: settings: %w", err)
	}
	return &s, nil
}

// UpsertSettings задаёт настройки кассы центра.
func (r *Repository) UpsertSettings(ctx context.Context, tx *gorm.DB, s *CashSettings) error {
	err := tx.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "center_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"coin_rate", "max_discount_pct", "updated_at"}),
	}).Create(s).Error
	if err != nil {
		return fmt.Errorf("cashier: upsert settings: %w", err)
	}
	return nil
}

// --- смены ---

// CreateShift открывает смену.
func (r *Repository) CreateShift(ctx context.Context, tx *gorm.DB, s *CashShift) error {
	if err := tx.WithContext(ctx).Create(s).Error; err != nil {
		return fmt.Errorf("cashier: create shift: %w", err)
	}
	return nil
}

// FindShift возвращает смену центра или NOT_FOUND.
func (r *Repository) FindShift(ctx context.Context, tx *gorm.DB, centerID, id int64) (*CashShift, error) {
	var s CashShift
	err := tx.WithContext(ctx).First(&s, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Смена не найдена")
	}
	if err != nil {
		return nil, fmt.Errorf("cashier: find shift: %w", err)
	}
	return &s, nil
}

// SaveShift сохраняет изменения смены.
func (r *Repository) SaveShift(ctx context.Context, tx *gorm.DB, s *CashShift) error {
	if err := tx.WithContext(ctx).Save(s).Error; err != nil {
		return fmt.Errorf("cashier: save shift: %w", err)
	}
	return nil
}

// OpenShift возвращает открытую смену центра (nil — нет открытой).
func (r *Repository) OpenShift(ctx context.Context, tx *gorm.DB, centerID int64) (*CashShift, error) {
	var s CashShift
	err := tx.WithContext(ctx).Where("center_id = ? AND status = ?", centerID, ShiftOpen).Order("id DESC").First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("cashier: open shift: %w", err)
	}
	return &s, nil
}

// --- оплаты ---

// NextReceiptNo выдаёт следующий номер чека.
func (r *Repository) NextReceiptNo(ctx context.Context, tx *gorm.DB) (string, error) {
	var n int64
	if err := tx.WithContext(ctx).Raw("SELECT nextval('receipt_no_seq')").Scan(&n).Error; err != nil {
		return "", fmt.Errorf("cashier: next receipt: %w", err)
	}
	return "R-" + strconv.FormatInt(n, 10), nil
}

// CreatePayment вставляет чек.
func (r *Repository) CreatePayment(ctx context.Context, tx *gorm.DB, p *Payment) error {
	if err := tx.WithContext(ctx).Create(p).Error; err != nil {
		return fmt.Errorf("cashier: create payment: %w", err)
	}
	return nil
}

// FindPayment возвращает чек центра или NOT_FOUND.
func (r *Repository) FindPayment(ctx context.Context, tx *gorm.DB, centerID, id int64) (*Payment, error) {
	var p Payment
	err := tx.WithContext(ctx).First(&p, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Чек не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("cashier: find payment: %w", err)
	}
	return &p, nil
}

// SavePayment сохраняет изменения чека.
func (r *Repository) SavePayment(ctx context.Context, tx *gorm.DB, p *Payment) error {
	if err := tx.WithContext(ctx).Save(p).Error; err != nil {
		return fmt.Errorf("cashier: save payment: %w", err)
	}
	return nil
}

// Payments возвращает чеки центра (новые сверху).
func (r *Repository) Payments(ctx context.Context, centerID int64) ([]Payment, error) {
	var out []Payment
	err := r.db.WithContext(ctx).Where("center_id = ?", centerID).Order("id DESC").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cashier: payments: %w", err)
	}
	return out, nil
}

// PaymentsInShift возвращает чеки смены (для Z-отчёта).
func (r *Repository) PaymentsInShift(ctx context.Context, shiftID int64) ([]Payment, error) {
	var out []Payment
	err := r.db.WithContext(ctx).Where("shift_id = ?", shiftID).Order("id").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cashier: payments in shift: %w", err)
	}
	return out, nil
}

// --- оплаченные уроки ---

// AddLessons изменяет оплаченные уроки (ученик, группа); остаток не ниже 0. Возвращает новый остаток.
func (r *Repository) AddLessons(ctx context.Context, tx *gorm.DB, studentID, groupID int64, delta int) (int, error) {
	err := tx.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "student_id"}, {Name: "group_id"}},
		DoUpdates: clause.Assignments(map[string]any{"paid": gorm.Expr("GREATEST(lesson_balances.paid + ?, 0)", delta), "updated_at": time.Now().UTC()}),
	}).Create(&LessonBalance{StudentID: studentID, GroupID: groupID, Paid: maxInt(delta, 0)}).Error
	if err != nil {
		return 0, fmt.Errorf("cashier: add lessons: %w", err)
	}
	var paid int
	if err := tx.WithContext(ctx).Table("lesson_balances").Select("paid").
		Where("student_id = ? AND group_id = ?", studentID, groupID).Scan(&paid).Error; err != nil {
		return 0, fmt.Errorf("cashier: lesson balance: %w", err)
	}
	return paid, nil
}

// LessonBalance возвращает оплаченные уроки (ученик, группа).
func (r *Repository) LessonBalance(ctx context.Context, studentID, groupID int64) (int, error) {
	var paid int
	err := r.db.WithContext(ctx).Table("lesson_balances").Select("COALESCE(paid,0)").
		Where("student_id = ? AND group_id = ?", studentID, groupID).Scan(&paid).Error
	if err != nil {
		return 0, fmt.Errorf("cashier: get lesson balance: %w", err)
	}
	return paid, nil
}

// --- зарплаты ---

// SchemeFor возвращает схему для (преподаватель, группа) или дефолтную (group_id NULL); nil — нет.
func (r *Repository) SchemeFor(ctx context.Context, tx *gorm.DB, teacherID int64, groupID *int64) (*SalaryScheme, error) {
	if groupID != nil {
		var s SalaryScheme
		err := tx.WithContext(ctx).First(&s, "teacher_id = ? AND group_id = ?", teacherID, *groupID).Error
		if err == nil {
			return &s, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("cashier: scheme for group: %w", err)
		}
	}
	var s SalaryScheme
	err := tx.WithContext(ctx).First(&s, "teacher_id = ? AND group_id IS NULL", teacherID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("cashier: default scheme: %w", err)
	}
	return &s, nil
}

// UpsertScheme задаёт схему (teacher, group). Уникальность — по функциональному индексу
// (teacher_id, COALESCE(group_id,0)), поэтому ищем существующую вручную и обновляем либо создаём.
func (r *Repository) UpsertScheme(ctx context.Context, tx *gorm.DB, s *SalaryScheme) error {
	var existing SalaryScheme
	err := tx.WithContext(ctx).Where("teacher_id = ? AND group_id IS NOT DISTINCT FROM ?", s.TeacherID, s.GroupID).First(&existing).Error
	if err == nil {
		s.ID = existing.ID
		s.CreatedAt = existing.CreatedAt
		if uerr := tx.WithContext(ctx).Model(&SalaryScheme{}).Where("id = ?", existing.ID).Updates(map[string]any{
			"type": s.Type, "rate_diram": s.RateDiram, "percent": s.Percent,
			"lesson_price_diram": s.LessonPriceDiram, "updated_at": time.Now().UTC(),
		}).Error; uerr != nil {
			return fmt.Errorf("cashier: update scheme: %w", uerr)
		}
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("cashier: find scheme: %w", err)
	}
	if cerr := tx.WithContext(ctx).Create(s).Error; cerr != nil {
		return fmt.Errorf("cashier: create scheme: %w", cerr)
	}
	return nil
}

// Schemes возвращает схемы преподавателя (или все центра, если teacherID=0).
func (r *Repository) Schemes(ctx context.Context, centerID, teacherID int64) ([]SalaryScheme, error) {
	q := r.db.WithContext(ctx).Where("center_id = ?", centerID)
	if teacherID != 0 {
		q = q.Where("teacher_id = ?", teacherID)
	}
	var out []SalaryScheme
	if err := q.Order("id").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("cashier: schemes: %w", err)
	}
	return out, nil
}

// HasAccrual сообщает, начислена ли уже зарплата за занятие (идемпотентность «Проведён»).
func (r *Repository) HasAccrual(ctx context.Context, tx *gorm.DB, lessonID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Model(&SalaryAccrual{}).Where("lesson_id = ?", lessonID).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("cashier: has accrual: %w", err)
	}
	return n > 0, nil
}

// CreateAccrual вставляет начисление зарплаты.
func (r *Repository) CreateAccrual(ctx context.Context, tx *gorm.DB, a *SalaryAccrual) error {
	if err := tx.WithContext(ctx).Create(a).Error; err != nil {
		return fmt.Errorf("cashier: create accrual: %w", err)
	}
	return nil
}

// Accruals возвращает начисления преподавателя в диапазоне дат.
func (r *Repository) Accruals(ctx context.Context, centerID, teacherID int64, from, to *time.Time) ([]SalaryAccrual, error) {
	q := r.db.WithContext(ctx).Where("center_id = ?", centerID)
	if teacherID != 0 {
		q = q.Where("teacher_id = ?", teacherID)
	}
	if from != nil {
		q = q.Where("at >= ?", *from)
	}
	if to != nil {
		q = q.Where("at <= ?", *to)
	}
	var out []SalaryAccrual
	if err := q.Order("at DESC, id DESC").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("cashier: accruals: %w", err)
	}
	return out, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
