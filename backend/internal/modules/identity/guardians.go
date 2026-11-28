package identity

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// GuardianDTO — опекун ученика (для администратора центра).
type GuardianDTO struct {
	AccountID int64     `json:"accountId"`
	Phone     string    `json:"phone"`
	Name      string    `json:"name"`
	Relation  string    `json:"relation"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

// AttachGuardianInput — тело привязки опекуна к ученику.
type AttachGuardianInput struct {
	Phone    string `json:"phone"`
	Relation string `json:"relation"`
}

// AttachGuardian привязывает родителя/опекуна к ученику: заводит аккаунт по телефону, членство parent
// и связь опеки. Вход родителя — по OTP (пароль не выдаётся). Доступ — администратор центра.
func (s *Service) AttachGuardian(ctx context.Context, actor audit.Actor, centerID, studentID int64, in AttachGuardianInput) (GuardianDTO, error) {
	phone := normalizePhone(in.Phone)
	if phone == "" {
		return GuardianDTO{}, apierr.Field("Укажите номер телефона родителя", "phone", "Телефон обязателен")
	}
	var out GuardianDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		studentName, ok, err := s.repo.StudentInCenter(ctx, tx, centerID, studentID)
		if err != nil {
			return err
		}
		if !ok {
			return apierr.NotFound("Ученик не найден в этом центре")
		}
		account, err := s.getOrCreateAccount(ctx, tx, phone)
		if err != nil {
			return err
		}
		m := &Membership{AccountID: account.ID, TenantID: centerID, Role: RoleParent, Status: MembershipActive, CreatedBy: actor.Name, CreatedAt: time.Now().UTC()}
		if err := s.repo.CreateMembershipIfMissing(ctx, tx, m); err != nil {
			return err
		}
		g := &StudentGuardian{
			TenantID: centerID, StudentID: studentID, AccountID: account.ID,
			Relation: strings.TrimSpace(in.Relation), Status: MembershipActive, CreatedBy: actor.Name, CreatedAt: time.Now().UTC(),
		}
		if err := s.repo.UpsertGuardian(ctx, tx, g); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "guardian.attached", EntityType: "student", EntityID: strconv.FormatInt(studentID, 10), EntityName: studentName,
			After: map[string]any{"account": account.ID, "relation": g.Relation}, Reason: "Привязан родитель к ученику",
		}); err != nil {
			return err
		}
		out = GuardianDTO{AccountID: account.ID, Phone: account.Phone, Name: account.DisplayName, Relation: g.Relation, Status: g.Status, CreatedAt: g.CreatedAt}
		return nil
	})
	return out, err
}

// DetachGuardian снимает связь опекуна с учеником (членство parent не трогаем). Доступ — администратор центра.
func (s *Service) DetachGuardian(ctx context.Context, actor audit.Actor, centerID, studentID, accountID int64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		studentName, ok, err := s.repo.StudentInCenter(ctx, tx, centerID, studentID)
		if err != nil {
			return err
		}
		if !ok {
			return apierr.NotFound("Ученик не найден в этом центре")
		}
		revoked, err := s.repo.RevokeGuardian(ctx, tx, centerID, studentID, accountID)
		if err != nil {
			return err
		}
		if !revoked {
			return apierr.NotFound("Связь опекуна не найдена")
		}
		return s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "guardian.detached", EntityType: "student", EntityID: strconv.FormatInt(studentID, 10), EntityName: studentName,
			Before: map[string]any{"account": accountID}, Reason: "Снята связь родителя с учеником",
		})
	})
}

// ListGuardians возвращает опекунов ученика (для администратора центра).
func (s *Service) ListGuardians(ctx context.Context, centerID, studentID int64) ([]GuardianDTO, error) {
	if _, ok, err := s.repo.StudentInCenter(ctx, s.db, centerID, studentID); err != nil {
		return nil, err
	} else if !ok {
		return nil, apierr.NotFound("Ученик не найден в этом центре")
	}
	rows, err := s.repo.GuardiansOfStudent(ctx, centerID, studentID)
	if err != nil {
		return nil, err
	}
	out := make([]GuardianDTO, 0, len(rows))
	for _, g := range rows {
		out = append(out, GuardianDTO(g))
	}
	return out, nil
}
