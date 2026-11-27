package identity

import (
	"context"
	"log/slog"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// otpTTLMinutes и otpLockMinutes — срок жизни кода и длительность блокировки после серии неверных попыток.
const (
	otpTTLMinutes  = 5
	otpLockMinutes = 15
)

// SmsSender отправляет код входа. Реальный провайдер подключается позже (Q-NNN); в dev/тестах — заглушка.
type SmsSender interface {
	Send(ctx context.Context, phone, code string) error
}

// LogSender — заглушка отправки SMS. Телефон маскируется; код пишется в лог только вне продакшена
// (ShowCode=true для dev/стенда), чтобы не оставлять секрет в проде (security.md).
type LogSender struct{ ShowCode bool }

// Send логирует факт отправки; код — только при ShowCode (dev/стенд).
func (s LogSender) Send(_ context.Context, phone, code string) error {
	if s.ShowCode {
		slog.Info("otp (dev stub)", "phone", maskPhone(phone), "code", code)
		return nil
	}
	slog.Info("otp sent", "phone", maskPhone(phone))
	return nil
}

// maskPhone прячет середину номера (оставляет код страны и 2 последние цифры).
func maskPhone(phone string) string {
	if len(phone) <= 5 {
		return "***"
	}
	return phone[:4] + "***" + phone[len(phone)-2:]
}

// Service реализует вход по OTP, выбор членства и профиль /me.
type Service struct {
	db     *gorm.DB
	repo   *Repository
	tokens *auth.TokenService
	sms    SmsSender
	audit  *audit.Recorder
}

// NewService создаёт сервис identity.
func NewService(repo *Repository, tokens *auth.TokenService, sms SmsSender, rec *audit.Recorder) *Service {
	return &Service{db: repo.DB(), repo: repo, tokens: tokens, sms: sms, audit: rec}
}

// RequestOtp выдаёт код входа по SMS. Ответ одинаков независимо от существования номера (SYS-ACC-030).
func (s *Service) RequestOtp(ctx context.Context, phone string) error {
	norm := normalizePhone(phone)
	if norm == "" {
		return apierr.Field("Укажите номер телефона", "phone", "Номер обязателен")
	}
	now := time.Now().UTC()
	return s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.repo.Otp(ctx, tx, norm)
		if err != nil {
			return err
		}
		if existing != nil {
			if existing.Attempts >= otpMaxAttempts && now.Before(existing.ExpiresAt) {
				return apierr.New(apierr.CodeLocked, "Слишком много попыток. Повторите позже")
			}
			if now.Sub(existing.RequestedAt) < otpResendWindow*time.Second {
				return apierr.New(apierr.CodeLocked, "Код уже отправлен. Повторите через минуту")
			}
		}
		code, err := genCode()
		if err != nil {
			return err
		}
		hash, err := hashCode(code)
		if err != nil {
			return err
		}
		o := &OtpCode{Phone: norm, CodeHash: hash, ExpiresAt: now.Add(otpTTLMinutes * time.Minute), Attempts: 0, RequestedAt: now}
		if err := s.repo.SaveOtp(ctx, tx, o); err != nil {
			return err
		}
		return s.sms.Send(ctx, norm, code)
	})
}

// VerifyOtp проверяет код, при успехе создаёт/находит аккаунт, привязывает учеников и выдаёт результат.
func (s *Service) VerifyOtp(ctx context.Context, phone, code string) (VerifyResult, error) {
	norm := normalizePhone(phone)
	if norm == "" || code == "" {
		return VerifyResult{}, apierr.New(apierr.CodeUnauthorized, "Неверный код")
	}
	now := time.Now().UTC()
	// Проверку кода и учёт попыток делаем вне общей транзакции успеха: иначе откат при ошибке
	// (возврат UNAUTHORIZED) отменил бы инкремент попыток, и блокировка никогда бы не копилась.
	o, err := s.repo.Otp(ctx, s.db, norm)
	if err != nil {
		return VerifyResult{}, err
	}
	if o == nil || now.After(o.ExpiresAt) {
		return VerifyResult{}, apierr.New(apierr.CodeUnauthorized, "Неверный код")
	}
	if o.Attempts >= otpMaxAttempts {
		return VerifyResult{}, apierr.New(apierr.CodeLocked, "Слишком много попыток. Повторите позже")
	}
	if !checkCode(o.CodeHash, code) {
		o.Attempts++
		if o.Attempts >= otpMaxAttempts {
			o.ExpiresAt = now.Add(otpLockMinutes * time.Minute) // блокировка номера (BR-025)
			if err := s.repo.SaveOtp(ctx, s.db, o); err != nil {
				return VerifyResult{}, err
			}
		} else if err := s.repo.SaveOtpAttempts(ctx, s.db, norm, o.Attempts); err != nil {
			return VerifyResult{}, err
		}
		return VerifyResult{}, apierr.New(apierr.CodeUnauthorized, "Неверный код")
	}

	var out VerifyResult
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.DeleteOtp(ctx, tx, norm); err != nil {
			return err
		}

		account, err := s.getOrCreateAccount(ctx, tx, norm)
		if err != nil {
			return err
		}
		if account.Status != AccountActive {
			return apierr.New(apierr.CodeForbidden, "Доступ закрыт. Обратитесь к центру")
		}
		if err := s.autoLinkStudents(ctx, tx, account.ID, norm); err != nil {
			return err
		}
		rows, err := s.repo.Memberships(ctx, tx, account.ID)
		if err != nil {
			return err
		}
		if len(rows) == 1 {
			sess, err := s.buildSession(ctx, tx, account, rows[0])
			if err != nil {
				return err
			}
			out = VerifyResult{Session: sess}
			return nil
		}
		token, err := s.tokens.IssueAccountSelect(account.ID, account.Phone, account.DisplayName)
		if err != nil {
			return err
		}
		out = VerifyResult{SelectToken: token, Memberships: toMembershipDTOs(rows)}
		return nil
	})
	return out, err
}

// SelectMembership выпускает рабочий токен для выбранного членства (после VerifyOtp с несколькими ролями).
func (s *Service) SelectMembership(ctx context.Context, accountID, tenantID int64, role string) (MobileSession, error) {
	var out MobileSession
	err := s.db.Transaction(func(tx *gorm.DB) error {
		account, err := s.repo.AccountByID(ctx, accountID)
		if err != nil {
			return err
		}
		if account == nil || account.Status != AccountActive {
			return apierr.New(apierr.CodeForbidden, "Доступ закрыт")
		}
		m, err := s.repo.Membership(ctx, tx, accountID, tenantID, role)
		if err != nil {
			return err
		}
		if m == nil {
			return apierr.NotFound("Членство не найдено")
		}
		sess, err := s.buildSession(ctx, tx, account, *m)
		if err != nil {
			return err
		}
		out = *sess
		return nil
	})
	return out, err
}

// Me возвращает профиль аккаунта и его членства.
func (s *Service) Me(ctx context.Context, accountID int64, currentTenant *int64, currentRole string) (MeResponse, error) {
	account, err := s.repo.AccountByID(ctx, accountID)
	if err != nil {
		return MeResponse{}, err
	}
	if account == nil {
		return MeResponse{}, apierr.NotFound("Аккаунт не найден")
	}
	rows, err := s.repo.Memberships(ctx, s.db, accountID)
	if err != nil {
		return MeResponse{}, err
	}
	resp := MeResponse{
		AccountID: account.ID, Phone: account.Phone, Name: account.DisplayName,
		Locale: account.Locale, Memberships: toMembershipDTOs(rows),
	}
	if currentTenant != nil {
		for _, m := range rows {
			if m.TenantID == *currentTenant && m.Role == currentRole {
				dto := membershipToDTO(m)
				resp.Current = &dto
				break
			}
		}
		if currentRole == RoleStudent {
			if id, _, ok, err := s.repo.StudentForAccountCenter(ctx, s.db, accountID, *currentTenant); err != nil {
				return MeResponse{}, err
			} else if ok {
				resp.StudentID = &id
			}
		}
	}
	return resp, nil
}

func (s *Service) getOrCreateAccount(ctx context.Context, tx *gorm.DB, phone string) (*Account, error) {
	account, err := s.repo.AccountByPhone(ctx, tx, phone)
	if err != nil {
		return nil, err
	}
	if account != nil {
		return account, nil
	}
	now := time.Now().UTC()
	account = &Account{Phone: phone, DisplayName: "", Locale: "ru", Status: AccountActive, CreatedAt: now, UpdatedAt: now}
	if err := s.repo.CreateAccount(ctx, tx, account); err != nil {
		return nil, err
	}
	return account, nil
}

// autoLinkStudents привязывает учеников с таким же телефоном к аккаунту и заводит членство student.
func (s *Service) autoLinkStudents(ctx context.Context, tx *gorm.DB, accountID int64, phone string) error {
	students, err := s.repo.UnlinkedStudentsByDigits(ctx, tx, digitsOnly(phone))
	if err != nil {
		return err
	}
	for _, st := range students {
		if err := s.repo.LinkStudentAccount(ctx, tx, st.ID, accountID); err != nil {
			return err
		}
		m := &Membership{AccountID: accountID, TenantID: st.CenterID, Role: RoleStudent, Status: MembershipActive, CreatedBy: "otp-autolink", CreatedAt: time.Now().UTC()}
		if err := s.repo.CreateMembershipIfMissing(ctx, tx, m); err != nil {
			return err
		}
		// Имя аккаунта — по имени ученика, если ещё не задано.
		if err := tx.WithContext(ctx).Model(&Account{}).Where("id = ? AND display_name = ''", accountID).
			Update("display_name", st.Name).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) buildSession(ctx context.Context, tx *gorm.DB, account *Account, m MembershipRow) (*MobileSession, error) {
	var studentID *int64
	if m.Role == RoleStudent {
		id, status, ok, err := s.repo.StudentForAccountCenter(ctx, tx, account.ID, m.TenantID)
		if err != nil {
			return nil, err
		}
		if ok {
			if status == "blocked" {
				return nil, apierr.New(apierr.CodeForbidden, "Ученик заблокирован. Обратитесь к центру")
			}
			studentID = &id
		}
	}
	// account может обновиться (имя) при авто-привязке — перечитаем имя из переданного значения.
	name := account.DisplayName
	if name == "" {
		if fresh, err := s.repo.AccountByID(ctx, account.ID); err == nil && fresh != nil {
			name = fresh.DisplayName
		}
	}
	access, refresh, err := s.tokens.IssueMembership(auth.Membership{
		AccountID: account.ID, TenantID: m.TenantID, Role: m.Role, Name: name, Phone: account.Phone, StudentID: studentID,
	})
	if err != nil {
		return nil, err
	}
	return &MobileSession{
		AccountID: account.ID, Phone: account.Phone, Name: name, TenantID: m.TenantID, TenantName: m.TenantName,
		Role: m.Role, StudentID: studentID, Token: access, RefreshToken: refresh,
	}, nil
}

func toMembershipDTOs(rows []MembershipRow) []MembershipDTO {
	out := make([]MembershipDTO, 0, len(rows))
	for _, m := range rows {
		out = append(out, membershipToDTO(m))
	}
	return out
}

func membershipToDTO(m MembershipRow) MembershipDTO {
	return MembershipDTO{TenantID: m.TenantID, TenantName: m.TenantName, Role: m.Role, BranchID: m.BranchID}
}
