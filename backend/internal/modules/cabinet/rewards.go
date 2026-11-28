package cabinet

import (
	"context"
	"strings"

	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// RewardDTO — поощрение для ответа (rewardDto).
type RewardDTO struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Price       int    `json:"price"`
	Status      string `json:"status"`
	StatusLabel string `json:"statusLabel"`
}

func rewardToDTO(r Reward) RewardDTO {
	label := "Активен"
	if r.Status == RewardArchived {
		label = "В архиве"
	}
	return RewardDTO{ID: r.ID, Name: r.Name, Category: r.Category, Price: r.Price, Status: r.Status, StatusLabel: label}
}

// RewardsListResponse — ответ cabinet.rewards.list.
type RewardsListResponse struct {
	Center     centers.DTO `json:"center"`
	Items      []RewardDTO `json:"items"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"pageSize"`
	Categories []string    `json:"categories"`
}

// RewardsList возвращает каталог поощрений центра по фильтрам (CTR-RWD-010).
func (s *Service) RewardsList(ctx context.Context, centerID int64, status string, priceFrom, priceTo *int, page, pageSize int) (RewardsListResponse, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return RewardsListResponse{}, err
	}
	list, total, err := s.repo.RewardsList(ctx, centerID, status, priceFrom, priceTo, (page-1)*pageSize, pageSize)
	if err != nil {
		return RewardsListResponse{}, err
	}
	items := make([]RewardDTO, 0, len(list))
	for _, r := range list {
		items = append(items, rewardToDTO(r))
	}
	return RewardsListResponse{Center: centerDTO, Items: items, Total: total, Page: page, PageSize: pageSize, Categories: rewardCategories}, nil
}

// RewardRequest — тело создания/правки поощрения (поля опциональны при правке).
type RewardRequest struct {
	Name     *string `json:"name"`
	Category *string `json:"category"`
	Price    *int    `json:"price"`
	Status   *string `json:"status"`
}

// validateReward проверяет итоговые поля награды (rewardFields).
func validateReward(name, category string, price int, status string) *apierr.Error {
	fields := map[string]string{}
	if n := len([]rune(strings.TrimSpace(name))); n < 3 || n > 80 {
		fields["name"] = "Название — от 3 до 80 символов"
	}
	if !contains(rewardCategories, category) {
		fields["category"] = "Выберите категорию"
	}
	if price < 1 || price > 100000 {
		fields["price"] = "Цена — целое число coin от 1 до 100 000"
	}
	if status != RewardActive && status != RewardArchived {
		fields["status"] = "Неизвестный статус"
	}
	if len(fields) > 0 {
		return apierr.Validation("Проверьте данные поощрения", fields)
	}
	return nil
}

// CreateReward добавляет поощрение (CTR-RWD-010).
func (s *Service) CreateReward(ctx context.Context, centerID int64, req RewardRequest) (RewardDTO, error) {
	var out RewardDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "добавлять поощрения"); err != nil {
			return err
		}
		name := deref(req.Name)
		category := deref(req.Category)
		price := 0
		if req.Price != nil {
			price = *req.Price
		}
		if verr := validateReward(name, category, price, RewardActive); verr != nil {
			return verr
		}
		rw := &Reward{CenterID: centerID, Name: strings.TrimSpace(name), Category: category, Price: price, Status: RewardActive}
		if err := s.repo.CreateReward(ctx, tx, rw); err != nil {
			return err
		}
		out = rewardToDTO(*rw)
		return nil
	})
	return out, err
}

// UpdateReward меняет поощрение, переносит в архив или возвращает (CTR-RWD-010).
func (s *Service) UpdateReward(ctx context.Context, centerID, rewardID int64, req RewardRequest) (RewardDTO, error) {
	var out RewardDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		rw, err := s.repo.FindReward(ctx, tx, centerID, rewardID)
		if err != nil {
			return err
		}
		if err := writable(center, "менять поощрения"); err != nil {
			return err
		}
		name := rw.Name
		if req.Name != nil {
			name = *req.Name
		}
		category := rw.Category
		if req.Category != nil {
			category = *req.Category
		}
		price := rw.Price
		if req.Price != nil {
			price = *req.Price
		}
		status := rw.Status
		if req.Status != nil {
			status = *req.Status
		}
		if verr := validateReward(name, category, price, status); verr != nil {
			return verr
		}
		rw.Name, rw.Category, rw.Price, rw.Status = strings.TrimSpace(name), category, price, status
		if err := s.repo.SaveReward(ctx, tx, rw); err != nil {
			return err
		}
		out = rewardToDTO(*rw)
		return nil
	})
	return out, err
}
