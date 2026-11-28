package cabinet

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/credentials"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

const nearLimitPct = 0.8

// StaffMeta — использование лимита сотрудников тарифа (CTR-STF-010, BR-023).
type StaffMeta struct {
	Used      int    `json:"used"`
	Limit     int    `json:"limit"`
	CanAdd    bool   `json:"canAdd"`
	NearLimit bool   `json:"nearLimit"`
	PlanName  string `json:"planName"`
}

// StaffListResponse — ответ cabinet.staff.list.
type StaffListResponse struct {
	Center   centers.DTO       `json:"center"`
	Items    []StaffDTO        `json:"items"`
	Total    int               `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
	Roles    map[string]string `json:"roles"`
	Counts   map[string]int    `json:"counts"`
	Meta     StaffMeta         `json:"meta"`
}

// StaffList возвращает сотрудников центра и использование лимита тарифа.
func (s *Service) StaffList(ctx context.Context, centerID int64, role, q string, page, pageSize int) (StaffListResponse, error) {
	center, err := s.repo.Center(ctx, s.db, centerID)
	if err != nil {
		return StaffListResponse{}, err
	}
	list, total, err := s.repo.StaffList(ctx, centerID, role, strings.TrimSpace(q), (page-1)*pageSize, pageSize)
	if err != nil {
		return StaffListResponse{}, err
	}
	all, err := s.repo.ActiveStaff(ctx, centerID)
	if err != nil {
		return StaffListResponse{}, err
	}
	counts := map[string]int{RoleTeacher: 0, RoleAdmin: 0}
	for _, st := range all {
		counts[st.Role]++
	}
	ids := make([]int64, 0, len(list))
	for _, st := range list {
		ids = append(ids, st.ID)
	}
	access, err := s.creds.HasAccessMap(ctx, s.db, "staff", ids)
	if err != nil {
		return StaffListResponse{}, err
	}
	items := make([]StaffDTO, 0, len(list))
	for _, st := range list {
		items = append(items, staffDTO(st, access[st.ID]))
	}
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return StaffListResponse{}, err
	}
	return StaffListResponse{
		Center: centerDTO, Items: items, Total: total, Page: page, PageSize: pageSize,
		Roles: staffRoleLabels, Counts: counts,
		Meta: StaffMeta{
			Used: center.StaffUsed, Limit: center.LimitStaff,
			CanAdd:    center.Status == "active" && center.StaffUsed < center.LimitStaff,
			NearLimit: center.LimitStaff > 0 && float64(center.StaffUsed)/float64(center.LimitStaff) >= nearLimitPct,
			PlanName:  center.PlanName,
		},
	}, nil
}

// AddStaffRequest — тело POST /centers/{id}/staff.
type AddStaffRequest struct {
	Name  string `json:"name"`
	Role  string `json:"role"`
	Phone string `json:"phone"`
	Login string `json:"login"`
}

// StaffResult — сотрудник + выданные данные для входа (пароль показывается один раз).
type StaffResult struct {
	Staff       StaffDTO            `json:"staff"`
	Credentials credentials.Issued `json:"credentials"`
}

// AddStaff добавляет сотрудника в пределах лимита тарифа (CTR-STF-010, BR-023/025).
func (s *Service) AddStaff(ctx context.Context, actor audit.Actor, centerID int64, req AddStaffRequest) (StaffResult, error) {
	var out StaffResult
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		name := strings.TrimSpace(req.Name)
		phone := digits(req.Phone)
		fields := map[string]string{}
		if n := len([]rune(name)); n < 3 || n > 60 {
			fields["name"] = "ФИО — от 3 до 60 символов"
		}
		if staffRoleLabels[req.Role] == "" {
			fields["role"] = "Выберите роль"
		}
		if len(phone) < 9 || len(phone) > 12 {
			fields["phone"] = "Телефон — от 9 до 12 цифр"
		}
		login, lerr := credentials.ValidateLogin(req.Login)
		if lerr != nil {
			fields["login"] = lerr.Fields["login"]
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные сотрудника", fields)
		}
		if err := writable(center, "добавлять сотрудников"); err != nil {
			return err
		}
		if dup, err := s.repo.StaffPhoneExists(ctx, tx, centerID, "+"+phone); err != nil {
			return err
		} else if dup {
			return apierr.Field("Сотрудник с таким телефоном уже есть", "phone", "Телефон занят")
		}
		if taken, err := s.creds.LoginTaken(ctx, tx, login, "staff", 0); err != nil {
			return err
		} else if taken {
			return apierr.Field("Этот логин уже занят, придумайте другой", "login", "Логин занят")
		}
		if center.StaffUsed >= center.LimitStaff {
			return apierr.Conflict("Лимит сотрудников тарифа «" + center.PlanName + "» исчерпан (" + strconv.Itoa(center.LimitStaff) + "). Смените тариф или уволите кого-то из текущих")
		}

		st := &Staff{CenterID: centerID, Name: name, Role: req.Role, Phone: "+" + phone, Status: StaffActive, HiredAt: time.Now().UTC()}
		if err := s.repo.CreateStaff(ctx, tx, st); err != nil {
			return err
		}
		if err := s.repo.IncStaffUsed(ctx, tx, centerID, 1); err != nil {
			return err
		}
		issued, err := s.creds.Issue(ctx, tx, "staff", st.ID, login)
		if err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "staff.added", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"name": name, "role": staffRoleLabels[req.Role], "login": login}, Reason: "Добавлен сотрудник: " + name,
		}); err != nil {
			return err
		}
		out = StaffResult{Staff: staffDTO(*st, true), Credentials: issued}
		return nil
	})
	return out, err
}

// RemoveStaff увольняет сотрудника с обязательной причиной; место и логин освобождаются (BR-011/023/025).
func (s *Service) RemoveStaff(ctx context.Context, actor audit.Actor, centerID, staffID int64, reason string) (StaffDTO, error) {
	reason = strings.TrimSpace(reason)
	var out StaffDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		st, err := s.repo.FindStaff(ctx, tx, centerID, staffID)
		if err != nil {
			return err
		}
		if len([]rune(reason)) < 5 {
			return apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
		}
		if err := writable(center, "увольнять сотрудников"); err != nil {
			return err
		}
		now := time.Now().UTC()
		st.Status = StaffDismissed
		st.DismissedAt = &now
		if err := s.repo.SaveStaff(ctx, tx, st); err != nil {
			return err
		}
		if err := s.repo.IncStaffUsed(ctx, tx, centerID, -1); err != nil {
			return err
		}
		if err := s.creds.Delete(ctx, tx, "staff", st.ID); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "staff.removed", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			Before: map[string]any{"name": st.Name, "role": staffRoleLabels[st.Role]}, Reason: st.Name + " · " + reason,
		}); err != nil {
			return err
		}
		out = staffDTO(*st, false)
		return nil
	})
	return out, err
}
