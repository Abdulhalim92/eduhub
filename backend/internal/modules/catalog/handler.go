package catalog

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает публичный каталог и заявки.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик каталога.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterPublic подключает публичные маршруты каталога (без токена).
func (h *Handler) RegisterPublic(r gin.IRoutes) {
	r.GET("/catalog/branches", h.branches)
	r.GET("/catalog/filters", h.filters)
	r.POST("/catalog/leads", h.createLead)
}

// RegisterProtected подключает управление заявками для центра (center_admin/superadmin).
func (h *Handler) RegisterProtected(r gin.IRouter) {
	both := auth.RequireRole(auth.RoleSuperAdmin, auth.RoleCenterAdmin)
	r.GET("/centers/:id/leads", both, h.leads)
	r.POST("/centers/:id/leads/:lid/:action", both, h.transition)
}

func (h *Handler) branches(c *gin.Context) {
	f := BranchFilter{Direction: c.Query("direction"), City: c.Query("city"), Query: c.Query("q")}
	lat := parseFloat(c.Query("lat"))
	lng := parseFloat(c.Query("lng"))
	if (lat == nil) != (lng == nil) { // нужны обе координаты или ни одной
		lat, lng = nil, nil
	}
	res, err := h.svc.Branches(c.Request.Context(), lat, lng, f)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) filters(c *gin.Context) {
	res, err := h.svc.Filters(c.Request.Context())
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) createLead(c *gin.Context) {
	var req CreateLeadInput
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.CreateLead(c.Request.Context(), req)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) leads(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Leads(c.Request.Context(), id, c.Query("status"))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) transition(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	lid, err := strconv.ParseInt(c.Param("lid"), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return
	}
	res, err := h.svc.Transition(c.Request.Context(), auth.ActorFrom(c), id, lid, c.Param("action"))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

// centerCtx читает id центра и проверяет доступ (свой центр или SuperAdmin).
func centerCtx(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
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

func parseFloat(s string) *float64 {
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &v
}
