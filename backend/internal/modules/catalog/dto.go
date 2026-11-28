package catalog

import "time"

// BranchDTO — карточка филиала в каталоге.
type BranchDTO struct {
	CenterID   int64    `json:"centerId"`
	Center     string   `json:"center"`
	Branch     string   `json:"branch"`
	City       string   `json:"city"`
	District   string   `json:"district"`
	Address    string   `json:"address"`
	Phone      string   `json:"phone"`
	Lat        float64  `json:"lat"`
	Lng        float64  `json:"lng"`
	DescRu     string   `json:"descRu"`
	DescTj     string   `json:"descTj"`
	Direction  string   `json:"direction"`
	DistanceKm *float64 `json:"distanceKm,omitempty"`
}

// FiltersDTO — доступные значения фильтров каталога.
type FiltersDTO struct {
	Directions []string `json:"directions"`
	Cities     []string `json:"cities"`
}

// LeadDTO — заявка на пробный урок.
type LeadDTO struct {
	ID        int64     `json:"id"`
	TenantID  int64     `json:"tenantId"`
	GroupID   *int64    `json:"groupId,omitempty"`
	Name      string    `json:"name"`
	Phone     string    `json:"phone"`
	Source    string    `json:"source"`
	Note      string    `json:"note"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

func leadToDTO(l *Lead) LeadDTO {
	return LeadDTO{
		ID: l.ID, TenantID: l.TenantID, GroupID: l.GroupID, Name: l.Name, Phone: l.Phone,
		Source: l.Source, Note: l.Note, Status: l.Status, CreatedAt: l.CreatedAt,
	}
}

// CreateLeadInput — тело публичной заявки на пробный урок.
type CreateLeadInput struct {
	TenantID int64  `json:"tenantId"`
	GroupID  *int64 `json:"groupId"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Note     string `json:"note"`
}
