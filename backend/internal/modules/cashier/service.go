// Package cashier — касса центра (CTR-FIN) и зарплаты преподавателей (CTR-PAY): приём оплат, чеки,
// скидка за баллы, кассовые смены с Z-отчётом, возвраты (сторно), схемы и начисление зарплаты.
// Деньги центра изолированы от платформы (BR-022). greenfield: поведение спроектировано от спеки.
package cashier

import (
	"strconv"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// Service реализует операции кассы и зарплат.
type Service struct {
	db    *gorm.DB
	repo  *Repository
	audit *audit.Recorder
	idem  *idempotency.Store
}

// NewService создаёт сервис кассы.
func NewService(repo *Repository, rec *audit.Recorder, idem *idempotency.Store) *Service {
	return &Service{db: repo.DB(), repo: repo, audit: rec, idem: idem}
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

// writable запрещает кассовые операции заблокированному центру (BR-012).
func writable(center *CenterInfo, what string) error {
	if center.Status != "active" {
		return apierr.Conflict("Центр заблокирован: " + what + " нельзя")
	}
	return nil
}

// defaultSettings — значения по умолчанию, если настройки кассы не заданы.
func defaultSettings(centerID int64) *CashSettings {
	return &CashSettings{CenterID: centerID, CoinRate: 10, MaxDiscountPct: 25}
}
