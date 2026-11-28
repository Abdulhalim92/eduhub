package moderation

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты модерации и заявок филиалов.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик модерации.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты.
func (h *Handler) Register(r gin.IRouter) {
	admin := auth.RequireRole(auth.RoleSuperAdmin)
	r.GET("/moderation", admin, h.list)
	r.POST("/moderation/:id/decision", admin, h.decide)
	r.POST("/moderation/:id/requeue", admin, h.requeue)

	both := auth.RequireRole(auth.RoleSuperAdmin, auth.RoleCenterAdmin)
	r.GET("/geocode", both, h.geocode)
	r.GET("/centers/:id/branches", both, h.branches)
	r.POST("/centers/:id/branches", both, h.submit)
	r.PUT("/centers/:id/branches/:bid", both, h.resubmit)
}

func (h *Handler) list(c *gin.Context) {
	res, err := h.svc.List(c.Request.Context(), c.Query("status"))
	reply(c, res, err)
}

func (h *Handler) decide(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var in DecideInput
	if !bindJSON(c, &in) {
		return
	}
	res, err := h.svc.Decide(c.Request.Context(), auth.ActorFrom(c), id, in)
	reply(c, res, err)
}

func (h *Handler) requeue(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.Requeue(c.Request.Context(), auth.ActorFrom(c), id)
	reply(c, res, err)
}

func (h *Handler) geocode(c *gin.Context) {
	res, err := h.svc.Geocode(c.Query("city"), c.Query("address"))
	reply(c, res, err)
}

func (h *Handler) branches(c *gin.Context) {
	id, err := centerCtx(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.CenterBranches(c.Request.Context(), id)
	reply(c, res, err)
}

func (h *Handler) submit(c *gin.Context) {
	id, err := centerCtx(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var in BranchInput
	if !bindJSON(c, &in) {
		return
	}
	res, err := h.svc.Submit(c.Request.Context(), auth.ActorFrom(c), id, in)
	reply(c, res, err)
}

func (h *Handler) resubmit(c *gin.Context) {
	id, err := centerCtx(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	bid, err := int64Param(c, "bid")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var in BranchInput
	if !bindJSON(c, &in) {
		return
	}
	res, err := h.svc.Resubmit(c.Request.Context(), auth.ActorFrom(c), id, bid, in)
	reply(c, res, err)
}

// centerCtx читает id центра и проверяет доступ (свой центр или SuperAdmin в режиме поддержки).
func centerCtx(c *gin.Context) (int64, error) {
	id, err := int64Param(c, "id")
	if err != nil {
		return 0, err
	}
	p, ok := auth.Principal(c)
	if !ok {
		return 0, apierr.New(apierr.CodeUnauthorized, "Требуется авторизация")
	}
	if p.Role == auth.RoleSuperAdmin {
		return id, nil
	}
	if p.Role == auth.RoleCenterAdmin && p.TenantID != nil && *p.TenantID == id {
		return id, nil
	}
	return 0, apierr.New(apierr.CodeForbidden, "Нет доступа к этому центру")
}

func int64Param(c *gin.Context, name string) (int64, error) {
	v, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil {
		return 0, apierr.New(apierr.CodeValidation, "Некорректный идентификатор")
	}
	return v, nil
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
