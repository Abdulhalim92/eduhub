// Package cabinet — операционное ядро кабинета центра (CTR-*): профиль, сотрудники, ученики,
// группы, расписание, дашборд. Работает в контуре одного центра; данные для входа — BR-025.
package cabinet

import (
	"context"
	"strconv"
	"strings"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/credentials"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// Service реализует операции кабинета центра.
type Service struct {
	db      *gorm.DB
	repo    *Repository
	centers *centers.Service
	creds   *credentials.Store
	audit   *audit.Recorder
}

// NewService создаёт сервис кабинета.
func NewService(repo *Repository, centersSvc *centers.Service, creds *credentials.Store, rec *audit.Recorder) *Service {
	return &Service{db: repo.DB(), repo: repo, centers: centersSvc, creds: creds, audit: rec}
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func contains(xs []string, v string) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}

func digits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// writable запрещает мутации для заблокированного центра (BR-012).
func writable(center *CenterRow, what string) error {
	if center.Status != "active" {
		return apierr.Conflict("Центр заблокирован: " + what + " нельзя")
	}
	return nil
}

// teacherNames строит карту id преподавателя → имя (включая уволенных для истории групп).
func (s *Service) teacherNames(ctx context.Context, centerID int64) (map[int64]string, error) {
	var rows []Staff
	if err := s.db.WithContext(ctx).Where("center_id = ? AND role = ?", centerID, RoleTeacher).Find(&rows).Error; err != nil {
		return nil, err
	}
	m := make(map[int64]string, len(rows))
	for _, t := range rows {
		m[t.ID] = t.Name
	}
	return m, nil
}

func teacherNameFor(m map[int64]string, id *int64) string {
	if id == nil {
		return "—"
	}
	if name, ok := m[*id]; ok {
		return name
	}
	return "—"
}
