package cabinet

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/credentials"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// GroupRef — краткая ссылка на группу (для фильтров/форм).
type GroupRef struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// UsersListResponse — ответ cabinet.users.list (сотрудники + ученики одним списком).
type UsersListResponse struct {
	Center   centers.DTO       `json:"center"`
	Items    []UserRow         `json:"items"`
	Total    int               `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
	Roles    map[string]string `json:"roles"`
	Branches []string          `json:"branches"`
	Groups   []GroupRef        `json:"groups"`
}

// UsersList объединяет активных сотрудников и всех учеников центра (CTR-USR-010).
func (s *Service) UsersList(ctx context.Context, centerID int64, role, branch, q string, page, pageSize int) (UsersListResponse, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return UsersListResponse{}, err
	}
	staff, err := s.repo.ActiveStaff(ctx, centerID)
	if err != nil {
		return UsersListResponse{}, err
	}
	students, err := s.repo.StudentsByCenter(ctx, centerID)
	if err != nil {
		return UsersListResponse{}, err
	}
	groups, err := s.repo.GroupsByCenter(ctx, centerID)
	if err != nil {
		return UsersListResponse{}, err
	}
	groupByID := map[int64]Group{}
	for _, g := range groups {
		groupByID[g.ID] = g
	}
	staffIDs := make([]int64, 0, len(staff))
	for _, st := range staff {
		staffIDs = append(staffIDs, st.ID)
	}
	studentIDs := make([]int64, 0, len(students))
	for _, st := range students {
		studentIDs = append(studentIDs, st.ID)
	}
	staffAccess, err := s.creds.HasAccessMap(ctx, s.db, "staff", staffIDs)
	if err != nil {
		return UsersListResponse{}, err
	}
	studentAccess, err := s.creds.HasAccessMap(ctx, s.db, "student", studentIDs)
	if err != nil {
		return UsersListResponse{}, err
	}

	rows := make([]UserRow, 0, len(staff)+len(students))
	for _, st := range staff {
		rows = append(rows, UserRow{
			Key: "t" + itoa(st.ID), Kind: "staff", ID: st.ID, Name: st.Name, Phone: st.Phone,
			Role: st.Role, RoleLabel: staffRoleLabels[st.Role], Status: StaffActive, StatusLabel: "Активен", HasAccess: staffAccess[st.ID],
		})
	}
	for _, st := range students {
		br := ""
		if st.GroupID != nil {
			if g, ok := groupByID[*st.GroupID]; ok {
				br = g.Branch
			}
		}
		rows = append(rows, UserRow{
			Key: "s" + itoa(st.ID), Kind: "student", ID: st.ID, Name: st.Name, Phone: st.Phone,
			Role: "student", RoleLabel: "Студент", Branch: br, Status: st.Status, StatusLabel: studentStatusLabel(st.Status), HasAccess: studentAccess[st.ID],
		})
	}

	term := strings.ToLower(strings.TrimSpace(q))
	dq := digits(term)
	var filtered []UserRow
	for _, row := range rows {
		if role != "" && row.Role != role {
			continue
		}
		if branch != "" && row.Branch != branch {
			continue
		}
		if term != "" {
			nameHit := strings.Contains(strings.ToLower(row.Name), term)
			phoneHit := dq != "" && strings.Contains(digits(row.Phone), dq)
			if !nameHit && !phoneHit {
				continue
			}
		}
		filtered = append(filtered, row)
	}
	sort.SliceStable(filtered, func(i, j int) bool { return filtered[i].Name < filtered[j].Name })

	total := len(filtered)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	branchSet := map[string]bool{}
	groupRefs := []GroupRef{}
	for _, g := range groups {
		branchSet[g.Branch] = true
		if g.Status == GroupActive {
			groupRefs = append(groupRefs, GroupRef{ID: g.ID, Name: g.Name})
		}
	}
	branches := make([]string, 0, len(branchSet))
	for b := range branchSet {
		branches = append(branches, b)
	}
	sort.Strings(branches)

	return UsersListResponse{
		Center: centerDTO, Items: append([]UserRow{}, filtered[start:end]...), Total: total, Page: page, PageSize: pageSize,
		Roles:  map[string]string{"student": "Студент", RoleTeacher: "Преподаватель", RoleAdmin: "Администратор"},
		Branches: branches, Groups: groupRefs,
	}, nil
}

// AddStudentRequest — тело POST /centers/{id}/students.
type AddStudentRequest struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Login   string `json:"login"`
	GroupID *int64 `json:"groupId"`
}

// StudentResult — ученик + выданные данные для входа.
type StudentResult struct {
	Student     StudentDTO          `json:"student"`
	Credentials credentials.Issued `json:"credentials"`
}

// AddStudent добавляет ученика центра и выдаёт данные для входа (CTR-USR-010, BR-025).
func (s *Service) AddStudent(ctx context.Context, actor audit.Actor, centerID int64, req AddStudentRequest) (StudentResult, error) {
	var out StudentResult
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
		if len(phone) < 9 || len(phone) > 12 {
			fields["phone"] = "Телефон — от 9 до 12 цифр"
		}
		login, lerr := credentials.ValidateLogin(req.Login)
		if lerr != nil {
			fields["login"] = lerr.Fields["login"]
		}
		var group *Group
		if req.GroupID != nil {
			g, err := s.repo.FindGroup(ctx, tx, centerID, *req.GroupID)
			if err != nil {
				fields["groupId"] = "Выберите действующую группу"
			} else if g.Status != GroupActive {
				fields["groupId"] = "Выберите действующую группу"
			} else {
				group = g
			}
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные ученика", fields)
		}
		if err := writable(center, "добавлять учеников"); err != nil {
			return err
		}
		if dup, err := s.repo.StudentPhoneExists(ctx, tx, centerID, "+"+phone); err != nil {
			return err
		} else if dup {
			return apierr.Field("Ученик с таким телефоном уже есть", "phone", "Телефон занят")
		}
		if taken, err := s.creds.LoginTaken(ctx, tx, login, "student", 0); err != nil {
			return err
		} else if taken {
			return apierr.Field("Этот логин уже занят, придумайте другой", "login", "Логин занят")
		}
		if group != nil {
			members, err := s.repo.GroupMemberCount(ctx, tx, group.ID)
			if err != nil {
				return err
			}
			if members >= group.Capacity {
				return apierr.Field("В группе нет свободных мест", "groupId", "Мест нет")
			}
		}

		st := &Student{CenterID: centerID, Name: name, Phone: "+" + phone, Status: StudentActive, GroupID: req.GroupID, JoinedAt: time.Now().UTC()}
		if err := s.repo.CreateStudent(ctx, tx, st); err != nil {
			return err
		}
		issued, err := s.creds.Issue(ctx, tx, "student", st.ID, login)
		if err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "student.added", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"student": name, "login": login}, Reason: "Добавлен ученик: " + name,
		}); err != nil {
			return err
		}
		out = StudentResult{Student: studentDTO(*st, group, true), Credentials: issued}
		return nil
	})
	return out, err
}

// SetStudentStatus блокирует или возвращает доступ ученику с обязательной причиной (BR-011).
func (s *Service) SetStudentStatus(ctx context.Context, actor audit.Actor, centerID, studentID int64, status, reason string) (StudentDTO, error) {
	reason = strings.TrimSpace(reason)
	var out StudentDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		st, err := s.repo.FindStudent(ctx, tx, centerID, studentID)
		if err != nil {
			return err
		}
		if status != StudentActive && status != StudentBlocked {
			return apierr.Validation("Неизвестный статус", nil)
		}
		if st.Status == status {
			if status == StudentBlocked {
				return apierr.Conflict("Ученик уже заблокирован")
			}
			return apierr.Conflict("Ученик уже активен")
		}
		if len([]rune(reason)) < 5 {
			return apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
		}
		if err := writable(center, "менять доступ учеников"); err != nil {
			return err
		}
		st.Status = status
		if err := s.repo.SaveStudent(ctx, tx, st); err != nil {
			return err
		}
		action := "student.unblocked"
		if status == StudentBlocked {
			action = "student.blocked"
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: action, EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"student": st.Name, "status": studentStatusLabel(status)}, Reason: st.Name + " · " + reason,
		}); err != nil {
			return err
		}
		var group *Group
		if st.GroupID != nil {
			if g, err := s.repo.FindGroup(ctx, tx, centerID, *st.GroupID); err == nil {
				group = g
			}
		}
		out = studentDTO(*st, group, true)
		return nil
	})
	return out, err
}
