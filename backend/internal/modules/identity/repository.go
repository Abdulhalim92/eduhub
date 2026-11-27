package identity

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository — доступ к аккаунтам, членствам и кодам входа. Ученики/центры читаются сырым SQL.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий identity.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// DB возвращает соединение для транзакций.
func (r *Repository) DB() *gorm.DB { return r.db }

// --- OTP ---

// Otp возвращает код входа по номеру (nil — нет).
func (r *Repository) Otp(ctx context.Context, tx *gorm.DB, phone string) (*OtpCode, error) {
	var o OtpCode
	err := tx.WithContext(ctx).First(&o, "phone = ?", phone).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("identity: otp: %w", err)
	}
	return &o, nil
}

// SaveOtp вставляет/обновляет код входа (upsert по телефону).
func (r *Repository) SaveOtp(ctx context.Context, tx *gorm.DB, o *OtpCode) error {
	err := tx.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "phone"}},
		DoUpdates: clause.AssignmentColumns([]string{"code_hash", "expires_at", "attempts", "requested_at"}),
	}).Create(o).Error
	if err != nil {
		return fmt.Errorf("identity: save otp: %w", err)
	}
	return nil
}

// SaveOtpAttempts обновляет счётчик попыток.
func (r *Repository) SaveOtpAttempts(ctx context.Context, tx *gorm.DB, phone string, attempts int) error {
	err := tx.WithContext(ctx).Model(&OtpCode{}).Where("phone = ?", phone).Update("attempts", attempts).Error
	if err != nil {
		return fmt.Errorf("identity: otp attempts: %w", err)
	}
	return nil
}

// DeleteOtp гасит код после успешного входа.
func (r *Repository) DeleteOtp(ctx context.Context, tx *gorm.DB, phone string) error {
	if err := tx.WithContext(ctx).Delete(&OtpCode{}, "phone = ?", phone).Error; err != nil {
		return fmt.Errorf("identity: delete otp: %w", err)
	}
	return nil
}

// --- аккаунты ---

// AccountByPhone возвращает аккаунт по телефону (nil — нет).
func (r *Repository) AccountByPhone(ctx context.Context, tx *gorm.DB, phone string) (*Account, error) {
	var a Account
	err := tx.WithContext(ctx).First(&a, "phone = ?", phone).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("identity: account by phone: %w", err)
	}
	return &a, nil
}

// AccountByID возвращает аккаунт по id (nil — нет).
func (r *Repository) AccountByID(ctx context.Context, id int64) (*Account, error) {
	var a Account
	err := r.db.WithContext(ctx).First(&a, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("identity: account by id: %w", err)
	}
	return &a, nil
}

// CreateAccount вставляет аккаунт.
func (r *Repository) CreateAccount(ctx context.Context, tx *gorm.DB, a *Account) error {
	if err := tx.WithContext(ctx).Create(a).Error; err != nil {
		return fmt.Errorf("identity: create account: %w", err)
	}
	return nil
}

// --- авто-привязка учеников по телефону ---

// UnlinkedStudent — ученик с совпавшим телефоном, ещё не привязанный к аккаунту.
type UnlinkedStudent struct {
	ID       int64  `gorm:"column:id"`
	CenterID int64  `gorm:"column:center_id"`
	Name     string `gorm:"column:name"`
	Status   string `gorm:"column:status"`
}

// UnlinkedStudentsByDigits ищет непривязанных учеников по цифрам телефона (без форматирования).
func (r *Repository) UnlinkedStudentsByDigits(ctx context.Context, tx *gorm.DB, digits string) ([]UnlinkedStudent, error) {
	var out []UnlinkedStudent
	err := tx.WithContext(ctx).Table("students").
		Select("id, center_id, name, status").
		Where("account_id IS NULL AND regexp_replace(phone, '\\D', '', 'g') = ?", digits).
		Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("identity: unlinked students: %w", err)
	}
	return out, nil
}

// LinkStudentAccount привязывает ученика к аккаунту.
func (r *Repository) LinkStudentAccount(ctx context.Context, tx *gorm.DB, studentID, accountID int64) error {
	err := tx.WithContext(ctx).Exec("UPDATE students SET account_id = ?, updated_at = now() WHERE id = ?", accountID, studentID).Error
	if err != nil {
		return fmt.Errorf("identity: link student: %w", err)
	}
	return nil
}

// StudentForAccountCenter возвращает ученика аккаунта в центре (ok=false — нет).
func (r *Repository) StudentForAccountCenter(ctx context.Context, tx *gorm.DB, accountID, centerID int64) (id int64, status string, ok bool, err error) {
	var row struct {
		ID     int64  `gorm:"column:id"`
		Status string `gorm:"column:status"`
	}
	res := tx.WithContext(ctx).Table("students").Select("id, status").
		Where("account_id = ? AND center_id = ?", accountID, centerID).Order("id").Limit(1).Scan(&row)
	if res.Error != nil {
		return 0, "", false, fmt.Errorf("identity: student for account: %w", res.Error)
	}
	return row.ID, row.Status, res.RowsAffected > 0, nil
}

// --- членства ---

// CreateMembershipIfMissing создаёт членство, если такого (account,tenant,role) ещё нет.
func (r *Repository) CreateMembershipIfMissing(ctx context.Context, tx *gorm.DB, m *Membership) error {
	err := tx.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "account_id"}, {Name: "tenant_id"}, {Name: "role"}},
		DoNothing: true,
	}).Create(m).Error
	if err != nil {
		return fmt.Errorf("identity: create membership: %w", err)
	}
	return nil
}

// MembershipRow — членство с названием центра.
type MembershipRow struct {
	TenantID   int64  `gorm:"column:tenant_id"`
	TenantName string `gorm:"column:tenant_name"`
	Role       string `gorm:"column:role"`
	BranchID   *int64 `gorm:"column:branch_id"`
	Status     string `gorm:"column:status"`
}

// Memberships возвращает активные членства аккаунта с названиями центров.
func (r *Repository) Memberships(ctx context.Context, tx *gorm.DB, accountID int64) ([]MembershipRow, error) {
	var out []MembershipRow
	err := tx.WithContext(ctx).Table("memberships AS m").
		Select("m.tenant_id, c.name AS tenant_name, m.role, m.branch_id, m.status").
		Joins("JOIN centers c ON c.id = m.tenant_id").
		Where("m.account_id = ? AND m.status = ?", accountID, MembershipActive).
		Order("m.tenant_id, m.role").Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("identity: memberships: %w", err)
	}
	return out, nil
}

// StudentInCenter проверяет, что ученик принадлежит центру, и возвращает его имя.
func (r *Repository) StudentInCenter(ctx context.Context, tx *gorm.DB, centerID, studentID int64) (string, bool, error) {
	var name string
	res := tx.WithContext(ctx).Table("students").Select("name").
		Where("id = ? AND center_id = ?", studentID, centerID).Scan(&name)
	if res.Error != nil {
		return "", false, fmt.Errorf("identity: student in center: %w", res.Error)
	}
	return name, res.RowsAffected > 0, nil
}

// UpsertGuardian заводит/реактивирует связь опекуна с учеником.
func (r *Repository) UpsertGuardian(ctx context.Context, tx *gorm.DB, g *StudentGuardian) error {
	var existing StudentGuardian
	err := tx.WithContext(ctx).First(&existing, "student_id = ? AND account_id = ?", g.StudentID, g.AccountID).Error
	if err == nil {
		g.ID = existing.ID
		return tx.WithContext(ctx).Model(&StudentGuardian{}).Where("id = ?", existing.ID).
			Updates(map[string]any{"relation": g.Relation, "status": MembershipActive}).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("identity: find guardian: %w", err)
	}
	if cerr := tx.WithContext(ctx).Create(g).Error; cerr != nil {
		return fmt.Errorf("identity: create guardian: %w", cerr)
	}
	return nil
}

// RevokeGuardian снимает связь опекуна (status=revoked). Возвращает, была ли активная связь.
func (r *Repository) RevokeGuardian(ctx context.Context, tx *gorm.DB, centerID, studentID, accountID int64) (bool, error) {
	res := tx.WithContext(ctx).Model(&StudentGuardian{}).
		Where("tenant_id = ? AND student_id = ? AND account_id = ? AND status = ?", centerID, studentID, accountID, MembershipActive).
		Update("status", MembershipRevoked)
	if res.Error != nil {
		return false, fmt.Errorf("identity: revoke guardian: %w", res.Error)
	}
	return res.RowsAffected > 0, nil
}

// GuardianInfo — опекун ученика с данными аккаунта.
type GuardianInfo struct {
	AccountID int64     `gorm:"column:account_id"`
	Phone     string    `gorm:"column:phone"`
	Name      string    `gorm:"column:display_name"`
	Relation  string    `gorm:"column:relation"`
	Status    string    `gorm:"column:status"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

// GuardiansOfStudent возвращает опекунов ученика (активные и снятые).
func (r *Repository) GuardiansOfStudent(ctx context.Context, centerID, studentID int64) ([]GuardianInfo, error) {
	var out []GuardianInfo
	err := r.db.WithContext(ctx).Table("student_guardians AS g").
		Select("g.account_id, a.phone, a.display_name, g.relation, g.status, g.created_at").
		Joins("JOIN accounts a ON a.id = g.account_id").
		Where("g.tenant_id = ? AND g.student_id = ?", centerID, studentID).
		Order("g.status, g.id").Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("identity: guardians: %w", err)
	}
	return out, nil
}

// Membership возвращает конкретное активное членство (nil — нет).
func (r *Repository) Membership(ctx context.Context, tx *gorm.DB, accountID, tenantID int64, role string) (*MembershipRow, error) {
	var out MembershipRow
	res := tx.WithContext(ctx).Table("memberships AS m").
		Select("m.tenant_id, c.name AS tenant_name, m.role, m.branch_id, m.status").
		Joins("JOIN centers c ON c.id = m.tenant_id").
		Where("m.account_id = ? AND m.tenant_id = ? AND m.role = ? AND m.status = ?", accountID, tenantID, role, MembershipActive).
		Scan(&out)
	if res.Error != nil {
		return nil, fmt.Errorf("identity: membership: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &out, nil
}
