package cabinet

import (
	"context"

	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
)

// RoleCount — число активных сотрудников по роли (для профиля).
type RoleCount struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Count int    `json:"count"`
}

// ProfileCard — карточка центра (CTR-PRF-010).
type ProfileCard struct {
	Direction   string      `json:"direction"`
	Description string      `json:"description"`
	FoundedYear *int        `json:"foundedYear"`
	Students    int         `json:"students"`
	Logo        string      `json:"logo"`
	Banner      string      `json:"banner"`
	StaffRoles  []RoleCount `json:"staffRoles"`
}

// ProfileResponse — ответ cabinet.profile. Показатели/лимиты/баланс — в center (centerDto).
type ProfileResponse struct {
	Center  centers.DTO `json:"center"`
	Profile ProfileCard `json:"profile"`
}

// Profile возвращает профиль центра (CTR-PRF-010).
func (s *Service) Profile(ctx context.Context, centerID int64) (ProfileResponse, error) {
	p, err := s.repo.Profile(ctx, centerID)
	if err != nil {
		return ProfileResponse{}, err
	}
	if p == nil {
		return ProfileResponse{}, apierr.NotFound("Профиль центра не заполнен")
	}
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return ProfileResponse{}, err
	}
	students, err := s.repo.StudentsByCenter(ctx, centerID)
	if err != nil {
		return ProfileResponse{}, err
	}
	staff, err := s.repo.ActiveStaff(ctx, centerID)
	if err != nil {
		return ProfileResponse{}, err
	}
	byRole := map[string]int{}
	for _, st := range staff {
		byRole[st.Role]++
	}
	roles := []RoleCount{
		{Key: RoleTeacher, Label: "Преподаватели", Count: byRole[RoleTeacher]},
		{Key: RoleAdmin, Label: "Администраторы", Count: byRole[RoleAdmin]},
	}
	return ProfileResponse{
		Center: centerDTO,
		Profile: ProfileCard{
			Direction: p.Direction, Description: p.Description, FoundedYear: p.FoundedYear,
			Students: len(students), Logo: p.Logo, Banner: p.Banner, StaffRoles: roles,
		},
	}, nil
}

// ProfileCentersResponse — ответ cabinet.profileCenters (переключатель кабинетов).
type ProfileCentersResponse struct {
	Items []ProfileCenterItem `json:"items"`
}

// ProfileCenterItem — центр в переключателе.
type ProfileCenterItem struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	City      string `json:"city"`
	Owner     string `json:"owner"`
	Plan      string `json:"plan"`
	Status    string `json:"status"`
	Direction string `json:"direction"`
	Logo      string `json:"logo"`
}

// ProfileCenters возвращает центры с профилем (переключатель в eduhub.html).
func (s *Service) ProfileCenters(ctx context.Context) (ProfileCentersResponse, error) {
	rows, err := s.repo.ProfileCenters(ctx)
	if err != nil {
		return ProfileCentersResponse{}, err
	}
	items := make([]ProfileCenterItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, ProfileCenterItem{
			ID: r.ID, Name: r.Name, City: r.City, Owner: r.Owner, Plan: r.PlanName,
			Status: r.Status, Direction: r.Direction, Logo: r.Logo,
		})
	}
	return ProfileCentersResponse{Items: items}, nil
}
