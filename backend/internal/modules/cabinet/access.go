package cabinet

import (
	"context"
	"strings"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/credentials"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// AccessResetRequest — тело POST /centers/{id}/access (выдать или сбросить доступ).
type AccessResetRequest struct {
	Kind   string `json:"kind"` // staff | student
	ID     int64  `json:"id"`
	Login  string `json:"login"` // нужен только при первой выдаче
	Reason string `json:"reason"`
}

// AccessResult — результат выдачи/сброса (пароль показывается один раз).
type AccessResult struct {
	Login      string `json:"login"`
	Password   string `json:"password"`
	MustChange bool   `json:"mustChange"`
	Name       string `json:"name"`
	HadAccess  bool   `json:"hadAccess"`
}

// AccessReset выдаёт сотруднику или ученику данные для входа либо сбрасывает пароль (BR-025).
func (s *Service) AccessReset(ctx context.Context, actor audit.Actor, centerID int64, req AccessResetRequest) (AccessResult, error) {
	var out AccessResult
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if req.Kind != "staff" && req.Kind != "student" {
			return apierr.Validation("Неизвестный тип пользователя", nil)
		}
		var name string
		if req.Kind == "staff" {
			st, err := s.repo.FindStaff(ctx, tx, centerID, req.ID)
			if err != nil {
				return err
			}
			name = st.Name
		} else {
			st, err := s.repo.FindStudent(ctx, tx, centerID, req.ID)
			if err != nil {
				return err
			}
			name = st.Name
		}
		if len([]rune(strings.TrimSpace(req.Reason))) < 5 {
			return apierr.Field("Укажите основание (минимум 5 символов)", "reason", "Минимум 5 символов")
		}
		if err := writable(center, "выдавать доступ"); err != nil {
			return err
		}

		existing, err := s.creds.Find(ctx, tx, req.Kind, req.ID)
		if err != nil {
			return err
		}
		login := ""
		if existing != nil {
			login = existing.Login
		} else {
			l, lerr := credentials.ValidateLogin(req.Login)
			if lerr != nil {
				return lerr
			}
			if taken, err := s.creds.LoginTaken(ctx, tx, l, req.Kind, req.ID); err != nil {
				return err
			} else if taken {
				return apierr.Field("Этот логин уже занят, придумайте другой", "login", "Логин занят")
			}
			login = l
		}

		issued, err := s.creds.Issue(ctx, tx, req.Kind, req.ID, login)
		if err != nil {
			return err
		}
		mode := "доступ выдан"
		if existing != nil {
			mode = "новый пароль"
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "access.reset", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"login": login, "mode": mode}, Reason: name + " · " + strings.TrimSpace(req.Reason),
		}); err != nil {
			return err
		}
		out = AccessResult{Login: issued.Login, Password: issued.Password, MustChange: issued.MustChange, Name: name, HadAccess: existing != nil}
		return nil
	})
	return out, err
}
