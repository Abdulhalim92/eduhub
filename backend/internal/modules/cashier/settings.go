package cashier

import (
	"context"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// GetSettings возвращает настройки кассы центра (значения по умолчанию, если не заданы).
func (s *Service) GetSettings(ctx context.Context, centerID int64) (SettingsDTO, error) {
	if _, err := s.repo.Center(ctx, s.db, centerID); err != nil {
		return SettingsDTO{}, err
	}
	set, err := s.repo.Settings(ctx, s.db, centerID)
	if err != nil {
		return SettingsDTO{}, err
	}
	if set == nil {
		set = defaultSettings(centerID)
	}
	return settingsToDTO(set), nil
}

// UpdateSettingsRequest — тело настроек кассы.
type UpdateSettingsRequest struct {
	CoinRate       int `json:"coinRate"`
	MaxDiscountPct int `json:"maxDiscountPct"`
}

// UpdateSettings задаёт курс баллов и потолок скидки центра.
func (s *Service) UpdateSettings(ctx context.Context, actor audit.Actor, centerID int64, req UpdateSettingsRequest) (SettingsDTO, error) {
	if req.CoinRate < 1 {
		return SettingsDTO{}, apierr.Field("Курс баллов — минимум 1 балл за сомони", "coinRate", "Минимум 1")
	}
	if req.MaxDiscountPct < 0 || req.MaxDiscountPct > 100 {
		return SettingsDTO{}, apierr.Field("Потолок скидки — от 0 до 100%", "maxDiscountPct", "0..100")
	}
	var out SettingsDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		set := &CashSettings{CenterID: centerID, CoinRate: req.CoinRate, MaxDiscountPct: req.MaxDiscountPct, CreatedAt: now, UpdatedAt: now}
		if err := s.repo.UpsertSettings(ctx, tx, set); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "cash.settings_updated", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"coinRate": req.CoinRate, "maxDiscountPct": req.MaxDiscountPct}, Reason: "Настройки кассы изменены",
		}); err != nil {
			return err
		}
		out = settingsToDTO(set)
		return nil
	})
	return out, err
}
