package cabinet

import (
	"context"
	"sort"

	"github.com/line/eduhub-backend/internal/modules/centers"
)

var branchStatusLabel = map[string]string{"published": "Активен", "pending": "На модерации", "returned": "Возвращён", "rejected": "Отклонён"}

// DashboardKPI — ключевые показатели кабинета.
type DashboardKPI struct {
	Students        int `json:"students"`
	StudentsBlocked int `json:"studentsBlocked"`
	Teachers        int `json:"teachers"`
	GroupsActive    int `json:"groupsActive"`
	GroupsTotal     int `json:"groupsTotal"`
	Branches        int `json:"branches"`
	BranchesActive  int `json:"branchesActive"`
}

// DashboardBranch — филиал на дашборде.
type DashboardBranch struct {
	Name        string `json:"name"`
	Address     string `json:"address"`
	Status      string `json:"status"`
	StatusLabel string `json:"statusLabel"`
}

// WeekPoint — посещаемость по дню недели (демонстрационная).
type WeekPoint struct {
	Day     string `json:"day"`
	Percent int    `json:"percent"`
}

// DashboardResponse — ответ cabinet.dashboard (CTR-DSH-010).
type DashboardResponse struct {
	Center   centers.DTO       `json:"center"`
	KPIs     DashboardKPI      `json:"kpis"`
	Branches []DashboardBranch `json:"branches"`
	LowFill  []GroupDTO        `json:"lowFill"`
	Week     []WeekPoint       `json:"week"`
}

// Dashboard возвращает показатели центра, филиалы и группы с низкой заполненностью (CTR-DSH-010).
func (s *Service) Dashboard(ctx context.Context, centerID int64) (DashboardResponse, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return DashboardResponse{}, err
	}
	students, err := s.repo.StudentsByCenter(ctx, centerID)
	if err != nil {
		return DashboardResponse{}, err
	}
	groups, err := s.repo.GroupsByCenter(ctx, centerID)
	if err != nil {
		return DashboardResponse{}, err
	}
	teachers, err := s.repo.Teachers(ctx, centerID)
	if err != nil {
		return DashboardResponse{}, err
	}
	counts, err := s.repo.MemberCounts(ctx, centerID)
	if err != nil {
		return DashboardResponse{}, err
	}
	names, err := s.teacherNames(ctx, centerID)
	if err != nil {
		return DashboardResponse{}, err
	}
	branchRows, err := s.repo.BranchRows(ctx, centerID)
	if err != nil {
		return DashboardResponse{}, err
	}

	kpi := DashboardKPI{Teachers: len(teachers)}
	for _, st := range students {
		kpi.Students++
		if st.Status == StudentBlocked {
			kpi.StudentsBlocked++
		}
	}
	lowFill := []GroupDTO{}
	for _, g := range groups {
		kpi.GroupsTotal++
		if g.Status == GroupActive {
			kpi.GroupsActive++
			dto := groupDTO(g, counts[g.ID], teacherNameFor(names, g.TeacherID))
			if dto.LowFill {
				lowFill = append(lowFill, dto)
			}
		}
	}
	sort.SliceStable(lowFill, func(a, b int) bool {
		return fillRatio(lowFill[a]) < fillRatio(lowFill[b])
	})
	if len(lowFill) > 3 {
		lowFill = lowFill[:3]
	}

	branches := make([]DashboardBranch, 0, len(branchRows))
	for _, b := range branchRows {
		label := branchStatusLabel[b.Status]
		if label == "" {
			label = "—"
		}
		branches = append(branches, DashboardBranch{Name: b.Branch, Address: b.Address, Status: b.Status, StatusLabel: label})
		if b.Status == "published" {
			kpi.BranchesActive++
		}
	}
	kpi.Branches = len(branches)

	week := make([]WeekPoint, len(weekDays))
	for i, d := range weekDays {
		week[i] = WeekPoint{Day: d, Percent: 70 + int((centerID*53+int64(i)*17)%26)}
	}
	return DashboardResponse{Center: centerDTO, KPIs: kpi, Branches: branches, LowFill: lowFill, Week: week}, nil
}

func fillRatio(g GroupDTO) float64 {
	if g.Capacity == 0 {
		return 0
	}
	return float64(g.Members) / float64(g.Capacity)
}
