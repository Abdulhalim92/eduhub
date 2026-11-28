package billing

import (
	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты счетов и смены тарифа.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик billing.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты (все — SuperAdmin).
func (h *Handler) Register(r gin.IRouter) {
	admin := auth.RequireRole(auth.RoleSuperAdmin)
	r.GET("/billing/invoices", admin, h.list)
	r.POST("/billing/invoices/remind", admin, h.remind)
	r.GET("/billing/invoices/:id", admin, h.get)
	r.POST("/billing/invoices/:id/confirm", admin, h.confirm)
	r.POST("/billing/invoices/:id/pay-from-balance", admin, h.payFromBalance)
	r.POST("/billing/invoices/:id/pay-online", admin, h.payOnline)
	r.POST("/billing/invoices/:id/cancel", admin, h.cancel)

	// Смена тарифа и продление (TRF) — операции над центром, живут в денежном модуле.
	r.GET("/centers/:id/plan-change", admin, h.planChangeInfo)
	r.POST("/centers/:id/plan-change", admin, h.requestPlanChange)
	r.POST("/centers/:id/invoice", admin, h.renewalInvoice)
}

func idemKey(c *gin.Context) string { return c.GetHeader("Idempotency-Key") }

func (h *Handler) list(c *gin.Context) {
	res, err := h.svc.List(c.Request.Context(), c.Query("status"), c.Query("kind"), c.Query("q"))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) get(c *gin.Context) {
	dto, err := h.svc.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}

func (h *Handler) remind(c *gin.Context) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.Remind(c.Request.Context(), auth.ActorFrom(c), req.IDs)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) confirm(c *gin.Context) {
	var in EvidenceInput
	if err := c.ShouldBindJSON(&in); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	dto, err := h.svc.ConfirmPayment(c.Request.Context(), auth.ActorFrom(c), c.Param("id"), in, idemKey(c))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}

func (h *Handler) payFromBalance(c *gin.Context) {
	dto, err := h.svc.PayFromBalance(c.Request.Context(), auth.ActorFrom(c), c.Param("id"), idemKey(c))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}

func (h *Handler) payOnline(c *gin.Context) {
	dto, err := h.svc.PayOnline(c.Request.Context(), c.Param("id"), idemKey(c))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}

func (h *Handler) cancel(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	dto, err := h.svc.Cancel(c.Request.Context(), auth.ActorFrom(c), c.Param("id"), req.Reason)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}

func (h *Handler) planChangeInfo(c *gin.Context) {
	id, err := centerIDParam(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.PlanChangeInfo(c.Request.Context(), id)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) requestPlanChange(c *gin.Context) {
	id, err := centerIDParam(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req PlanChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.RequestPlanChange(c.Request.Context(), auth.ActorFrom(c), id, req, idemKey(c))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) renewalInvoice(c *gin.Context) {
	id, err := centerIDParam(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.RenewalInvoice(c.Request.Context(), auth.ActorFrom(c), id)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}
