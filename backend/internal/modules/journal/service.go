// Package journal — электронный журнал (LRN-TCH): занятия, посещаемость, смены преподавателей,
// бонусные баллы и тесты с автопроверкой. Область спроектирована от спеки (в прототипе отсутствует).
package journal

import (
	"context"
	"strconv"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// ConductHook вызывается при переводе занятия в «Проведён» в той же транзакции: списание
// оплаченных уроков у присутствовавших и начисление зарплаты. Реализуется модулем cashier и
// внедряется через SetConductHook — journal не импортирует cashier (нет цикла). nil — без побочек.
type ConductHook interface {
	OnConducted(ctx context.Context, tx *gorm.DB, lesson Lesson, presentStudentIDs []int64) error
}

// Service реализует операции журнала.
type Service struct {
	db    *gorm.DB
	repo  *Repository
	audit *audit.Recorder
	hook  ConductHook
}

// NewService создаёт сервис журнала.
func NewService(repo *Repository, rec *audit.Recorder) *Service {
	return &Service{db: repo.DB(), repo: repo, audit: rec}
}

// SetConductHook подключает побочки «Проведён» (вызывается при сборке сервера).
func (s *Service) SetConductHook(h ConductHook) { s.hook = h }

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

// writable запрещает мутации для заблокированного центра (BR-012).
func writable(center *CenterInfo, what string) error {
	if center.Status != "active" {
		return apierr.Conflict("Центр заблокирован: " + what + " нельзя")
	}
	return nil
}
