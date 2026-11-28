package cabinet

import (
	"context"
	"errors"
	"fmt"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository — доступ к данным кабинета центра (профиль, сотрудники, ученики, группы).
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий кабинета.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// CenterRow — срез центра для проверок кабинета (статус, тариф, лимиты, использование).
type CenterRow struct {
	ID            int64  `gorm:"column:id"`
	Name          string `gorm:"column:name"`
	Owner         string `gorm:"column:owner"`
	Status        string `gorm:"column:status"`
	PlanName      string `gorm:"column:plan_name"`
	StaffUsed     int    `gorm:"column:staff_used"`
	LimitStaff    int    `gorm:"column:limit_staff"`
	LimitBranches int    `gorm:"column:limit_branches"`
}

// Center читает срез центра с лимитами тарифа.
func (r *Repository) Center(ctx context.Context, tx *gorm.DB, id int64) (*CenterRow, error) {
	var c CenterRow
	res := tx.WithContext(ctx).Raw(`
		SELECT c.id, c.name, c.owner, c.status, c.staff_used,
		       p.name AS plan_name, p.limit_staff, p.limit_branches
		FROM centers c JOIN plans p ON p.id = c.plan_id WHERE c.id = ?`, id).Scan(&c)
	if res.Error != nil {
		return nil, fmt.Errorf("cabinet: center: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, apierr.NotFound("Центр не найден")
	}
	return &c, nil
}

// IncStaffUsed изменяет кэш использованных сотрудников (в транзакции).
func (r *Repository) IncStaffUsed(ctx context.Context, tx *gorm.DB, centerID int64, delta int) error {
	err := tx.WithContext(ctx).Exec(
		"UPDATE centers SET staff_used = staff_used + ?, updated_at = now() WHERE id = ?", delta, centerID).Error
	if err != nil {
		return fmt.Errorf("cabinet: inc staff used: %w", err)
	}
	return nil
}

// Branches возвращает филиалы центра (из заявок модерации) либо «Главный филиал».
func (r *Repository) Branches(ctx context.Context, centerID int64) ([]string, error) {
	var names []string
	err := r.db.WithContext(ctx).Table("branch_submissions").
		Distinct("branch").Where("center_id = ?", centerID).Order("branch").Pluck("branch", &names).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: branches: %w", err)
	}
	if len(names) == 0 {
		return []string{"Главный филиал"}, nil
	}
	return names, nil
}

// BranchRow — филиал центра для дашборда (из заявок модерации).
type BranchRow struct {
	Branch  string `gorm:"column:branch"`
	Address string `gorm:"column:address"`
	Status  string `gorm:"column:status"`
}

// BranchRows возвращает заявки филиалов центра (название, адрес, статус) для дашборда.
func (r *Repository) BranchRows(ctx context.Context, centerID int64) ([]BranchRow, error) {
	var out []BranchRow
	err := r.db.WithContext(ctx).Table("branch_submissions").
		Select("branch, address, status").Where("center_id = ?", centerID).Order("id").Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: branch rows: %w", err)
	}
	return out, nil
}

// --- профиль ---

// Profile возвращает профиль центра (nil — не заполнен).
func (r *Repository) Profile(ctx context.Context, centerID int64) (*CenterProfile, error) {
	var p CenterProfile
	err := r.db.WithContext(ctx).First(&p, "center_id = ?", centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("cabinet: profile: %w", err)
	}
	return &p, nil
}

// ProfileCentersRow — строка переключателя кабинетов.
type ProfileCentersRow struct {
	ID        int64  `gorm:"column:id"`
	Name      string `gorm:"column:name"`
	City      string `gorm:"column:city"`
	Owner     string `gorm:"column:owner"`
	PlanName  string `gorm:"column:plan_name"`
	Status    string `gorm:"column:status"`
	Direction string `gorm:"column:direction"`
	Logo      string `gorm:"column:logo"`
}

// ProfileCenters возвращает центры с заполненным профилем (переключатель).
func (r *Repository) ProfileCenters(ctx context.Context) ([]ProfileCentersRow, error) {
	var rows []ProfileCentersRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT c.id, c.name, c.city, c.owner, p.name AS plan_name, c.status,
		       cp.direction, cp.logo
		FROM center_profiles cp
		JOIN centers c ON c.id = cp.center_id
		JOIN plans p ON p.id = c.plan_id
		ORDER BY c.id`).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: profile centers: %w", err)
	}
	return rows, nil
}

// --- сотрудники ---

// StaffList возвращает активных сотрудников центра по фильтрам и общее число.
func (r *Repository) StaffList(ctx context.Context, centerID int64, role, q string, offset, limit int) ([]Staff, int, error) {
	base := r.db.WithContext(ctx).Model(&Staff{}).Where("center_id = ? AND status = ?", centerID, StaffActive)
	if role != "" {
		base = base.Where("role = ?", role)
	}
	if q != "" {
		like := "%" + q + "%"
		base = base.Where("name ILIKE ? OR phone ILIKE ?", like, like)
	}
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("cabinet: staff count: %w", err)
	}
	var out []Staff
	if err := base.Order("name").Offset(offset).Limit(limit).Find(&out).Error; err != nil {
		return nil, 0, fmt.Errorf("cabinet: staff list: %w", err)
	}
	return out, int(total), nil
}

// ActiveStaff возвращает всех активных сотрудников центра (для users-списка и счётчиков ролей).
func (r *Repository) ActiveStaff(ctx context.Context, centerID int64) ([]Staff, error) {
	var out []Staff
	err := r.db.WithContext(ctx).Where("center_id = ? AND status = ?", centerID, StaffActive).Order("name").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: active staff: %w", err)
	}
	return out, nil
}

// Teachers возвращает активных преподавателей центра (id+имя) для групп/расписания.
func (r *Repository) Teachers(ctx context.Context, centerID int64) ([]Staff, error) {
	var out []Staff
	err := r.db.WithContext(ctx).Where("center_id = ? AND status = ? AND role = ?", centerID, StaffActive, RoleTeacher).Order("name").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: teachers: %w", err)
	}
	return out, nil
}

// FindStaff возвращает активного сотрудника центра или NOT_FOUND.
func (r *Repository) FindStaff(ctx context.Context, tx *gorm.DB, centerID, id int64) (*Staff, error) {
	var s Staff
	err := tx.WithContext(ctx).First(&s, "id = ? AND center_id = ? AND status = ?", id, centerID, StaffActive).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Сотрудник не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("cabinet: find staff: %w", err)
	}
	return &s, nil
}

// StaffPhoneExists сообщает, есть ли активный сотрудник центра с таким телефоном.
func (r *Repository) StaffPhoneExists(ctx context.Context, tx *gorm.DB, centerID int64, phone string) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Model(&Staff{}).Where("center_id = ? AND status = ? AND phone = ?", centerID, StaffActive, phone).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("cabinet: staff phone: %w", err)
	}
	return n > 0, nil
}

// CreateStaff вставляет сотрудника.
func (r *Repository) CreateStaff(ctx context.Context, tx *gorm.DB, s *Staff) error {
	if err := tx.WithContext(ctx).Create(s).Error; err != nil {
		return fmt.Errorf("cabinet: create staff: %w", err)
	}
	return nil
}

// SaveStaff сохраняет изменения сотрудника.
func (r *Repository) SaveStaff(ctx context.Context, tx *gorm.DB, s *Staff) error {
	if err := tx.WithContext(ctx).Save(s).Error; err != nil {
		return fmt.Errorf("cabinet: save staff: %w", err)
	}
	return nil
}

// --- ученики ---

// StudentsByCenter возвращает учеников центра.
func (r *Repository) StudentsByCenter(ctx context.Context, centerID int64) ([]Student, error) {
	var out []Student
	err := r.db.WithContext(ctx).Where("center_id = ?", centerID).Order("name").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: students: %w", err)
	}
	return out, nil
}

// StudentsInGroup возвращает учеников группы.
func (r *Repository) StudentsInGroup(ctx context.Context, centerID, groupID int64) ([]Student, error) {
	var out []Student
	err := r.db.WithContext(ctx).Where("center_id = ? AND group_id = ?", centerID, groupID).Order("name").Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: students in group: %w", err)
	}
	return out, nil
}

// AvailableStudents возвращает активных учеников центра не из группы g (до 150).
func (r *Repository) AvailableStudents(ctx context.Context, centerID, groupID int64) ([]Student, error) {
	var out []Student
	err := r.db.WithContext(ctx).
		Where("center_id = ? AND status = ? AND (group_id IS NULL OR group_id <> ?)", centerID, StudentActive, groupID).
		Order("name").Limit(150).Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: available students: %w", err)
	}
	return out, nil
}

// FindStudent возвращает ученика центра или NOT_FOUND.
func (r *Repository) FindStudent(ctx context.Context, tx *gorm.DB, centerID, id int64) (*Student, error) {
	var s Student
	err := tx.WithContext(ctx).First(&s, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Ученик не найден")
	}
	if err != nil {
		return nil, fmt.Errorf("cabinet: find student: %w", err)
	}
	return &s, nil
}

// StudentPhoneExists сообщает, есть ли у центра ученик с таким телефоном.
func (r *Repository) StudentPhoneExists(ctx context.Context, tx *gorm.DB, centerID int64, phone string) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Model(&Student{}).Where("center_id = ? AND phone = ?", centerID, phone).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("cabinet: student phone: %w", err)
	}
	return n > 0, nil
}

// CreateStudent вставляет ученика.
func (r *Repository) CreateStudent(ctx context.Context, tx *gorm.DB, s *Student) error {
	if err := tx.WithContext(ctx).Create(s).Error; err != nil {
		return fmt.Errorf("cabinet: create student: %w", err)
	}
	return nil
}

// SaveStudent сохраняет изменения ученика.
func (r *Repository) SaveStudent(ctx context.Context, tx *gorm.DB, s *Student) error {
	if err := tx.WithContext(ctx).Save(s).Error; err != nil {
		return fmt.Errorf("cabinet: save student: %w", err)
	}
	return nil
}

// MemberCounts возвращает число учеников по группам центра (group_id → count).
func (r *Repository) MemberCounts(ctx context.Context, centerID int64) (map[int64]int, error) {
	var rows []struct {
		GroupID int64 `gorm:"column:group_id"`
		N       int   `gorm:"column:n"`
	}
	err := r.db.WithContext(ctx).Model(&Student{}).
		Select("group_id, count(*) AS n").
		Where("center_id = ? AND group_id IS NOT NULL", centerID).Group("group_id").Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: member counts: %w", err)
	}
	m := make(map[int64]int, len(rows))
	for _, row := range rows {
		m[row.GroupID] = row.N
	}
	return m, nil
}

// GroupMemberCount возвращает число учеников в одной группе (в транзакции).
func (r *Repository) GroupMemberCount(ctx context.Context, tx *gorm.DB, groupID int64) (int, error) {
	var n int64
	err := tx.WithContext(ctx).Model(&Student{}).Where("group_id = ?", groupID).Count(&n).Error
	if err != nil {
		return 0, fmt.Errorf("cabinet: group member count: %w", err)
	}
	return int(n), nil
}

// --- награды (CTR-RWD) ---

// RewardsList возвращает награды центра по фильтрам и общее число.
func (r *Repository) RewardsList(ctx context.Context, centerID int64, status string, priceFrom, priceTo *int, offset, limit int) ([]Reward, int, error) {
	base := r.db.WithContext(ctx).Model(&Reward{}).Where("center_id = ?", centerID)
	if status != "" {
		base = base.Where("status = ?", status)
	}
	if priceFrom != nil {
		base = base.Where("price >= ?", *priceFrom)
	}
	if priceTo != nil {
		base = base.Where("price <= ?", *priceTo)
	}
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("cabinet: rewards count: %w", err)
	}
	var out []Reward
	if err := base.Order("id").Offset(offset).Limit(limit).Find(&out).Error; err != nil {
		return nil, 0, fmt.Errorf("cabinet: rewards list: %w", err)
	}
	return out, int(total), nil
}

// FindReward возвращает награду центра или NOT_FOUND.
func (r *Repository) FindReward(ctx context.Context, tx *gorm.DB, centerID, id int64) (*Reward, error) {
	var rw Reward
	err := tx.WithContext(ctx).First(&rw, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Поощрение не найдено")
	}
	if err != nil {
		return nil, fmt.Errorf("cabinet: find reward: %w", err)
	}
	return &rw, nil
}

// CreateReward вставляет награду.
func (r *Repository) CreateReward(ctx context.Context, tx *gorm.DB, rw *Reward) error {
	if err := tx.WithContext(ctx).Create(rw).Error; err != nil {
		return fmt.Errorf("cabinet: create reward: %w", err)
	}
	return nil
}

// SaveReward сохраняет изменения награды.
func (r *Repository) SaveReward(ctx context.Context, tx *gorm.DB, rw *Reward) error {
	if err := tx.WithContext(ctx).Save(rw).Error; err != nil {
		return fmt.Errorf("cabinet: save reward: %w", err)
	}
	return nil
}

// --- автоправила coin (CTR-CIN) ---

// CoinRulesList возвращает правила центра по области и общее число.
func (r *Repository) CoinRulesList(ctx context.Context, centerID int64, scope string, offset, limit int) ([]CoinRule, int, error) {
	base := r.db.WithContext(ctx).Model(&CoinRule{}).Where("center_id = ?", centerID)
	if scope != "" {
		base = base.Where("scope = ?", scope)
	}
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("cabinet: coin rules count: %w", err)
	}
	var out []CoinRule
	if err := base.Order("id").Offset(offset).Limit(limit).Find(&out).Error; err != nil {
		return nil, 0, fmt.Errorf("cabinet: coin rules list: %w", err)
	}
	return out, int(total), nil
}

// FindCoinRule возвращает правило центра или NOT_FOUND.
func (r *Repository) FindCoinRule(ctx context.Context, tx *gorm.DB, centerID, id int64) (*CoinRule, error) {
	var cr CoinRule
	err := tx.WithContext(ctx).First(&cr, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Правило не найдено")
	}
	if err != nil {
		return nil, fmt.Errorf("cabinet: find coin rule: %w", err)
	}
	return &cr, nil
}

// CreateCoinRule вставляет правило.
func (r *Repository) CreateCoinRule(ctx context.Context, tx *gorm.DB, cr *CoinRule) error {
	if err := tx.WithContext(ctx).Create(cr).Error; err != nil {
		return fmt.Errorf("cabinet: create coin rule: %w", err)
	}
	return nil
}

// SaveCoinRule сохраняет изменения правила.
func (r *Repository) SaveCoinRule(ctx context.Context, tx *gorm.DB, cr *CoinRule) error {
	if err := tx.WithContext(ctx).Save(cr).Error; err != nil {
		return fmt.Errorf("cabinet: save coin rule: %w", err)
	}
	return nil
}

// AddStudentCoin атомарно начисляет coin ученику и возвращает новый остаток.
func (r *Repository) AddStudentCoin(ctx context.Context, tx *gorm.DB, studentID int64, amount int) (int, error) {
	var coin int
	err := tx.WithContext(ctx).Raw(
		"UPDATE students SET coin = coin + ?, updated_at = now() WHERE id = ? RETURNING coin", amount, studentID).Scan(&coin).Error
	if err != nil {
		return 0, fmt.Errorf("cabinet: add student coin: %w", err)
	}
	return coin, nil
}

// --- группы ---

// GroupsList возвращает группы центра по фильтрам и общее число.
func (r *Repository) GroupsList(ctx context.Context, centerID int64, course, branch string, teacherID *int64, status string, offset, limit int) ([]Group, int, error) {
	base := r.db.WithContext(ctx).Model(&Group{}).Where("center_id = ?", centerID)
	if course != "" {
		base = base.Where("course = ?", course)
	}
	if branch != "" {
		base = base.Where("branch = ?", branch)
	}
	if teacherID != nil {
		base = base.Where("teacher_id = ?", *teacherID)
	}
	if status != "" {
		base = base.Where("status = ?", status)
	}
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("cabinet: groups count: %w", err)
	}
	var out []Group
	if err := base.Order("id").Offset(offset).Limit(limit).Find(&out).Error; err != nil {
		return nil, 0, fmt.Errorf("cabinet: groups list: %w", err)
	}
	return out, int(total), nil
}

// ActiveGroups возвращает активные группы центра (для расписания), с опциональными фильтрами.
func (r *Repository) ActiveGroups(ctx context.Context, centerID int64, branch string, teacherID *int64) ([]Group, error) {
	base := r.db.WithContext(ctx).Where("center_id = ? AND status = ?", centerID, GroupActive)
	if branch != "" {
		base = base.Where("branch = ?", branch)
	}
	if teacherID != nil {
		base = base.Where("teacher_id = ?", *teacherID)
	}
	var out []Group
	if err := base.Order("start_time").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("cabinet: active groups: %w", err)
	}
	return out, nil
}

// GroupsByCenter возвращает все группы центра (для опций/курсов).
func (r *Repository) GroupsByCenter(ctx context.Context, centerID int64) ([]Group, error) {
	var out []Group
	if err := r.db.WithContext(ctx).Where("center_id = ?", centerID).Order("id").Find(&out).Error; err != nil {
		return nil, fmt.Errorf("cabinet: groups by center: %w", err)
	}
	return out, nil
}

// FindGroup возвращает группу центра или NOT_FOUND.
func (r *Repository) FindGroup(ctx context.Context, tx *gorm.DB, centerID, id int64) (*Group, error) {
	var g Group
	err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&g, "id = ? AND center_id = ?", id, centerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apierr.NotFound("Группа не найдена")
	}
	if err != nil {
		return nil, fmt.Errorf("cabinet: find group: %w", err)
	}
	return &g, nil
}

// TeacherActiveGroups возвращает активные группы преподавателя (для проверки пересечения, BR-024).
func (r *Repository) TeacherActiveGroups(ctx context.Context, tx *gorm.DB, centerID, teacherID, excludeID int64) ([]Group, error) {
	var out []Group
	err := tx.WithContext(ctx).
		Where("center_id = ? AND status = ? AND teacher_id = ? AND id <> ?", centerID, GroupActive, teacherID, excludeID).
		Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("cabinet: teacher groups: %w", err)
	}
	return out, nil
}

// TeacherExists проверяет, что это активный преподаватель центра.
func (r *Repository) TeacherExists(ctx context.Context, tx *gorm.DB, centerID, teacherID int64) (bool, error) {
	var n int64
	err := tx.WithContext(ctx).Model(&Staff{}).
		Where("id = ? AND center_id = ? AND role = ? AND status = ?", teacherID, centerID, RoleTeacher, StaffActive).Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("cabinet: teacher exists: %w", err)
	}
	return n > 0, nil
}

// CreateGroup вставляет группу.
func (r *Repository) CreateGroup(ctx context.Context, tx *gorm.DB, g *Group) error {
	if err := tx.WithContext(ctx).Create(g).Error; err != nil {
		return fmt.Errorf("cabinet: create group: %w", err)
	}
	return nil
}

// SaveGroup сохраняет изменения группы.
func (r *Repository) SaveGroup(ctx context.Context, tx *gorm.DB, g *Group) error {
	if err := tx.WithContext(ctx).Save(g).Error; err != nil {
		return fmt.Errorf("cabinet: save group: %w", err)
	}
	return nil
}
