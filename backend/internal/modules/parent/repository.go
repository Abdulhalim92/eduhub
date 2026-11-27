package parent

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// Repository — чтение связей опеки и сводки детей.
type Repository struct {
	db *gorm.DB
}

// NewRepository создаёт репозиторий кабинета родителя.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// ChildRow — ребёнок с центром и группой.
type ChildRow struct {
	StudentID  int64  `gorm:"column:student_id"`
	Name       string `gorm:"column:name"`
	Status     string `gorm:"column:status"`
	TenantID   int64  `gorm:"column:tenant_id"`
	CenterName string `gorm:"column:center_name"`
	GroupID    *int64 `gorm:"column:group_id"`
	GroupName  string `gorm:"column:group_name"`
	Course     string `gorm:"column:course"`
}

// Children возвращает детей, привязанных к аккаунту родителя (активные связи).
func (r *Repository) Children(ctx context.Context, accountID int64) ([]ChildRow, error) {
	var out []ChildRow
	err := r.db.WithContext(ctx).Table("student_guardians AS g").
		Select(`g.student_id, s.name, s.status, s.center_id AS tenant_id, c.name AS center_name,
			s.group_id, COALESCE(gr.name, '') AS group_name, COALESCE(gr.course, '') AS course`).
		Joins("JOIN students s ON s.id = g.student_id").
		Joins("JOIN centers c ON c.id = s.center_id").
		Joins("LEFT JOIN groups gr ON gr.id = s.group_id").
		Where("g.account_id = ? AND g.status = 'active'", accountID).
		Order("s.center_id, s.id").Scan(&out).Error
	if err != nil {
		return nil, fmt.Errorf("parent: children: %w", err)
	}
	return out, nil
}

// GuardianTenant возвращает центр ребёнка, если у аккаунта есть активная связь опеки (ok=false — нет).
func (r *Repository) GuardianTenant(ctx context.Context, accountID, studentID int64) (int64, bool, error) {
	var tenantID int64
	res := r.db.WithContext(ctx).Table("student_guardians").Select("tenant_id").
		Where("account_id = ? AND student_id = ? AND status = 'active'", accountID, studentID).
		Limit(1).Scan(&tenantID)
	if res.Error != nil {
		return 0, false, fmt.Errorf("parent: guardian tenant: %w", res.Error)
	}
	return tenantID, res.RowsAffected > 0, nil
}
