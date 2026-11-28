// Package finance — баланс на платформе и овердрафт центра (PLT-BAL). Пополнение и смена
// лимита овердрафта двигают деньги/права, поэтому идут в транзакции с аудитом (money.md).
package finance

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/internal/ledger"
	"github.com/line/eduhub-backend/internal/modules/billing"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// overdraftMaxSomoni — потолок лимита овердрафта.
const overdraftMaxSomoni = 100_000

// LedgerDTO — проводка для ответа. Деньги — целые сомони.
type LedgerDTO struct {
	ID           int64       `json:"id"`
	At           time.Time   `json:"at"`
	Type         string      `json:"type"`
	Amount       money.Diram `json:"amount"`
	BalanceAfter money.Diram `json:"balanceAfter"`
	Method       string      `json:"method"`
	Reference    string      `json:"reference"`
	InvoiceID    *string     `json:"invoiceId"`
	Comment      string      `json:"comment"`
}

// Response — ответ finance.get.
type Response struct {
	Center   centers.DTO          `json:"center"`
	Ledger   []LedgerDTO          `json:"ledger"`
	Invoices []billing.InvoiceDTO `json:"invoices"`
}

// SetOverdraftRequest — тело PUT /centers/{id}/overdraft.
type SetOverdraftRequest struct {
	Limit  *int64 `json:"limit"` // сомони
	Reason string `json:"reason"`
}

// Repository читает проводки и обновляет лимит овердрафта.
type Repository struct{ db *gorm.DB }

// NewRepository создаёт репозиторий finance.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// Ledger возвращает последние проводки центра (новые сверху).
func (r *Repository) Ledger(ctx context.Context, centerID int64, limit int) ([]ledger.Entry, error) {
	var out []ledger.Entry
	err := r.db.WithContext(ctx).Where("center_id = ?", centerID).
		Order("at DESC, id DESC").Limit(limit).Find(&out).Error
	if err != nil {
		return nil, fmt.Errorf("finance: ledger: %w", err)
	}
	return out, nil
}

type overdraftRow struct {
	BalanceDiram        money.Diram `gorm:"column:balance_diram"`
	OverdraftLimitDiram money.Diram `gorm:"column:overdraft_limit_diram"`
}

// LockCenterOverdraft блокирует строку центра и читает баланс и текущий лимит.
func (r *Repository) LockCenterOverdraft(ctx context.Context, tx *gorm.DB, centerID int64) (overdraftRow, error) {
	var row overdraftRow
	res := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Table("centers").Select("balance_diram", "overdraft_limit_diram").
		Where("id = ?", centerID).Scan(&row)
	if res.Error != nil {
		return overdraftRow{}, fmt.Errorf("finance: lock overdraft: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return overdraftRow{}, apierr.NotFound("Центр не найден")
	}
	return row, nil
}

// SetOverdraft обновляет лимит овердрафта (в транзакции).
func (r *Repository) SetOverdraft(ctx context.Context, tx *gorm.DB, centerID int64, limit money.Diram) error {
	err := tx.WithContext(ctx).Exec(
		"UPDATE centers SET overdraft_limit_diram = ?, updated_at = now() WHERE id = ?", int64(limit), centerID).Error
	if err != nil {
		return fmt.Errorf("finance: set overdraft: %w", err)
	}
	return nil
}

// Service реализует операции баланса и овердрафта.
type Service struct {
	db      *gorm.DB
	repo    *Repository
	centers *centers.Service
	billing *billing.Service
	audit   *audit.Recorder
	idem    *idempotency.Store
}

// NewService создаёт сервис finance.
func NewService(repo *Repository, centersSvc *centers.Service, billingSvc *billing.Service, rec *audit.Recorder, idem *idempotency.Store) *Service {
	return &Service{db: repo.db, repo: repo, centers: centersSvc, billing: billingSvc, audit: rec, idem: idem}
}

// Get возвращает баланс центра, журнал проводок и открытые счета (PLT-BAL-010).
func (s *Service) Get(ctx context.Context, centerID int64) (Response, error) {
	centerDTO, err := s.centers.DTOByID(ctx, centerID)
	if err != nil {
		return Response{}, err
	}
	entries, err := s.repo.Ledger(ctx, centerID, 15)
	if err != nil {
		return Response{}, err
	}
	invoices, err := s.billing.OpenInvoiceDTOs(ctx, centerID)
	if err != nil {
		return Response{}, err
	}
	out := Response{Center: centerDTO, Ledger: make([]LedgerDTO, 0, len(entries)), Invoices: invoices}
	for _, e := range entries {
		out.Ledger = append(out.Ledger, LedgerDTO{
			ID: e.ID, At: e.At, Type: e.Type, Amount: e.AmountDiram, BalanceAfter: e.BalanceAfterDiram,
			Method: e.Method, Reference: e.Reference, InvoiceID: e.InvoiceID, Comment: e.Comment,
		})
	}
	return out, nil
}

// TopUp пополняет баланс: деньги уже поступили вне системы (PLT-BAL-030, BR-002). Идемпотентно.
func (s *Service) TopUp(ctx context.Context, actor audit.Actor, centerID int64, in billing.EvidenceInput, idemKey string) (centers.DTO, error) {
	return idempotency.Do(ctx, s.db, s.idem, "finance.top-up:"+strconv.FormatInt(centerID, 10), idemKey, func(tx *gorm.DB) (centers.DTO, error) {
		fields, _ := billing.ValidateEvidence(in, nil, nil)
		if len(fields) > 0 {
			return centers.DTO{}, apierr.Validation("Проверьте данные пополнения", fields)
		}
		amount := money.FromSomoni(in.ReceivedAmount)
		newBalance, err := ledger.TopUp(ctx, tx, centerID, amount, ledger.Meta{
			Method: in.Method, Reference: in.Reference, ActorName: actor.Name, Comment: in.Comment,
		})
		if err != nil {
			return centers.DTO{}, err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "balance.topup", EntityType: "center", EntityID: strconv.FormatInt(centerID, 10),
			After: map[string]any{"balance": newBalance.Somoni()}, Reason: in.Method + " · " + in.Reference,
		}); err != nil {
			return centers.DTO{}, err
		}
		return s.centers.DTOByIDTx(ctx, tx, centerID)
	})
}

// SetOverdraft меняет лимит овердрафта: причина обязательна, не ниже использованного (PLT-BAL-050, BR-006/011).
func (s *Service) SetOverdraft(ctx context.Context, actor audit.Actor, centerID int64, req SetOverdraftRequest) (centers.DTO, error) {
	var out centers.DTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		row, err := s.repo.LockCenterOverdraft(ctx, tx, centerID)
		if err != nil {
			return err
		}
		fields := map[string]string{}
		usedSomoni := int64(0)
		if row.BalanceDiram < 0 {
			usedSomoni = (-row.BalanceDiram).Somoni()
		}
		switch {
		case req.Limit == nil || *req.Limit < 0 || *req.Limit > overdraftMaxSomoni:
			fields["limit"] = fmt.Sprintf("Лимит — целое число сомони от 0 до %d", overdraftMaxSomoni)
		case *req.Limit < usedSomoni:
			fields["limit"] = fmt.Sprintf("Центр уже использовал %d сомони овердрафта: лимит не может быть ниже. Сначала пополните баланс", usedSomoni)
		case *req.Limit == row.OverdraftLimitDiram.Somoni():
			fields["limit"] = "Лимит не изменился"
		}
		if len([]rune(strings.TrimSpace(req.Reason))) < 5 {
			fields["reason"] = "Укажите причину (минимум 5 символов)"
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные", fields)
		}
		before := row.OverdraftLimitDiram.Somoni()
		if err := s.repo.SetOverdraft(ctx, tx, centerID, money.FromSomoni(*req.Limit)); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "overdraft.changed", EntityType: "center", EntityID: strconv.FormatInt(centerID, 10),
			Before: map[string]any{"overdraftLimit": before}, After: map[string]any{"overdraftLimit": *req.Limit}, Reason: strings.TrimSpace(req.Reason),
		}); err != nil {
			return err
		}
		out, err = s.centers.DTOByIDTx(ctx, tx, centerID)
		return err
	})
	return out, err
}

// Handler обслуживает маршруты баланса.
type Handler struct{ svc *Service }

// NewHandler создаёт обработчик finance.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты (только SuperAdmin).
func (h *Handler) Register(r gin.IRouter) {
	admin := auth.RequireRole(auth.RoleSuperAdmin)
	r.GET("/centers/:id/finance", admin, h.get)
	r.POST("/centers/:id/balance/top-up", admin, h.topUp)
	r.PUT("/centers/:id/overdraft", admin, h.setOverdraft)
}

func (h *Handler) get(c *gin.Context) {
	id, err := idParam(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) topUp(c *gin.Context) {
	id, err := idParam(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var in billing.EvidenceInput
	if err := c.ShouldBindJSON(&in); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.TopUp(c.Request.Context(), auth.ActorFrom(c), id, in, c.GetHeader("Idempotency-Key"))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) setOverdraft(c *gin.Context) {
	id, err := idParam(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req SetOverdraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.SetOverdraft(c.Request.Context(), auth.ActorFrom(c), id, req)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func idParam(c *gin.Context) (int64, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return 0, apierr.New(apierr.CodeValidation, "Некорректный идентификатор центра")
	}
	return id, nil
}
