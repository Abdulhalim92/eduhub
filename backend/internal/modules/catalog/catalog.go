package catalog

import (
	"context"
	"math"
	"sort"

	"github.com/line/eduhub-backend/internal/audit"
	"gorm.io/gorm"
)

// Service реализует публичный каталог и заявки на пробный урок.
type Service struct {
	db    *gorm.DB
	repo  *Repository
	audit *audit.Recorder
}

// NewService создаёт сервис каталога.
func NewService(repo *Repository, rec *audit.Recorder) *Service {
	return &Service{db: repo.DB(), repo: repo, audit: rec}
}

// Branches возвращает опубликованные филиалы; при наличии координат считает и сортирует по удалённости.
func (s *Service) Branches(ctx context.Context, lat, lng *float64, f BranchFilter) ([]BranchDTO, error) {
	rows, err := s.repo.PublishedBranches(ctx, f)
	if err != nil {
		return nil, err
	}
	out := make([]BranchDTO, 0, len(rows))
	for i := range rows {
		b := rows[i]
		dto := BranchDTO{
			CenterID: b.CenterID, Center: b.Center, Branch: b.Branch, City: b.City, District: b.District,
			Address: b.Address, Phone: b.Phone, Lat: b.Lat, Lng: b.Lng, DescRu: b.DescRu, DescTj: b.DescTj,
			Direction: b.Direction,
		}
		if lat != nil && lng != nil {
			d := haversineKm(*lat, *lng, b.Lat, b.Lng)
			dto.DistanceKm = &d
		}
		out = append(out, dto)
	}
	if lat != nil && lng != nil {
		sort.SliceStable(out, func(i, j int) bool {
			return *out[i].DistanceKm < *out[j].DistanceKm
		})
	}
	return out, nil
}

// Filters возвращает доступные направления и города каталога.
func (s *Service) Filters(ctx context.Context) (FiltersDTO, error) {
	dirs, err := s.repo.Directions(ctx)
	if err != nil {
		return FiltersDTO{}, err
	}
	cities, err := s.repo.Cities(ctx)
	if err != nil {
		return FiltersDTO{}, err
	}
	return FiltersDTO{Directions: dirs, Cities: cities}, nil
}

// haversineKm возвращает расстояние между точками в километрах.
func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const earthKm = 6371.0
	rad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := rad(lat2 - lat1)
	dLng := rad(lng2 - lng1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rad(lat1))*math.Cos(rad(lat2))*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return math.Round(earthKm*c*10) / 10
}
