package cashier

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты кассы и зарплат.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик кассы.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты (администратор своего центра или SuperAdmin в режиме поддержки).
func (h *Handler) Register(r gin.IRouter) {
	both := auth.RequireRole(auth.RoleSuperAdmin, auth.RoleCenterAdmin)

	r.GET("/centers/:id/cash/settings", both, h.getSettings)
	r.PUT("/centers/:id/cash/settings", both, h.updateSettings)

	r.POST("/centers/:id/cash/shifts", both, h.openShift)
	r.POST("/centers/:id/cash/shifts/:sid/close", both, h.closeShift)
	r.GET("/centers/:id/cash/shifts/:sid", both, h.getShift)

	r.POST("/centers/:id/payments", both, h.charge)
	r.GET("/centers/:id/payments", both, h.listPayments)
	r.POST("/centers/:id/payments/:pid/refund", both, h.refund)

	r.GET("/centers/:id/salary/schemes", both, h.listSchemes)
	r.PUT("/centers/:id/salary/schemes", both, h.upsertScheme)
	r.GET("/centers/:id/salary/accruals", both, h.listAccruals)
}

func idemKey(c *gin.Context) string { return c.GetHeader("Idempotency-Key") }

func (h *Handler) getSettings(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.GetSettings(c.Request.Context(), id)
	reply(c, res, err)
}

func (h *Handler) updateSettings(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req UpdateSettingsRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.UpdateSettings(c.Request.Context(), auth.ActorFrom(c), id, req)
	reply(c, res, err)
}

func (h *Handler) openShift(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req OpenShiftRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.OpenShift(c.Request.Context(), auth.ActorFrom(c), id, req)
	reply(c, res, err)
}

func (h *Handler) closeShift(c *gin.Context) {
	id, sid, ok := centerAndParam(c, "sid")
	if !ok {
		return
	}
	res, err := h.svc.CloseShift(c.Request.Context(), auth.ActorFrom(c), id, sid)
	reply(c, res, err)
}

func (h *Handler) getShift(c *gin.Context) {
	id, sid, ok := centerAndParam(c, "sid")
	if !ok {
		return
	}
	res, err := h.svc.GetShift(c.Request.Context(), id, sid)
	reply(c, res, err)
}

func (h *Handler) charge(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req ChargeRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.Charge(c.Request.Context(), auth.ActorFrom(c), id, req, idemKey(c))
	reply(c, res, err)
}

func (h *Handler) listPayments(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.ListPayments(c.Request.Context(), id, c.Query("status"))
	reply(c, res, err)
}

func (h *Handler) refund(c *gin.Context) {
	id, pid, ok := centerAndParam(c, "pid")
	if !ok {
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.Refund(c.Request.Context(), auth.ActorFrom(c), id, pid, req.Reason)
	reply(c, res, err)
}

func (h *Handler) listSchemes(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	teacherID, _ := strconv.ParseInt(c.Query("teacherId"), 10, 64)
	res, err := h.svc.ListSchemes(c.Request.Context(), id, teacherID)
	reply(c, res, err)
}

func (h *Handler) upsertScheme(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req UpsertSchemeRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.UpsertScheme(c.Request.Context(), auth.ActorFrom(c), id, req)
	reply(c, res, err)
}

func (h *Handler) listAccruals(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	teacherID, _ := strconv.ParseInt(c.Query("teacherId"), 10, 64)
	res, err := h.svc.ListAccruals(c.Request.Context(), id, teacherID, c.Query("from"), c.Query("to"))
	reply(c, res, err)
}

// centerCtx читает id центра и проверяет доступ (свой центр или SuperAdmin). При ошибке сам пишет ответ.
func centerCtx(c *gin.Context) (int64, bool) {
	id, ok := idParam(c, "id")
	if !ok {
		return 0, false
	}
	p, authed := auth.Principal(c)
	if !authed {
		httpx.Fail(c, apierr.New(apierr.CodeUnauthorized, "Требуется авторизация"))
		return 0, false
	}
	if p.Role == auth.RoleSuperAdmin {
		return id, true
	}
	if p.Role == auth.RoleCenterAdmin && p.TenantID != nil && *p.TenantID == id {
		return id, true
	}
	httpx.Fail(c, apierr.New(apierr.CodeForbidden, "Нет доступа к этому центру"))
	return 0, false
}

func centerAndParam(c *gin.Context, name string) (int64, int64, bool) {
	id, ok := centerCtx(c)
	if !ok {
		return 0, 0, false
	}
	v, ok := idParam(c, name)
	if !ok {
		return 0, 0, false
	}
	return id, v, true
}

func idParam(c *gin.Context, name string) (int64, bool) {
	v, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return 0, false
	}
	return v, true
}

func bindJSON(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return false
	}
	return true
}

func reply(c *gin.Context, body any, err error) {
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, body)
}
