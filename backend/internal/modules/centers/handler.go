package centers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты центров.
type Handler struct {
	svc *Service
}

// NewHandler создаёт HTTP-обработчик центров.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты центров (только SuperAdmin).
func (h *Handler) Register(r gin.IRouter) {
	admin := auth.RequireRole(auth.RoleSuperAdmin)
	r.GET("/centers", admin, h.list)
	r.GET("/centers/name-available", admin, h.nameAvailable)
	r.PUT("/centers/:id/manager", admin, h.setManager)
	r.POST("/centers/:id/contact", admin, h.markContacted)
}

func (h *Handler) list(c *gin.Context) {
	page := httpx.ParsePage(c)
	res, err := h.svc.List(c.Request.Context(), ListQuery{
		Q:        c.Query("q"),
		Plan:     c.Query("plan"),
		City:     c.Query("city"),
		Filter:   c.Query("filter"),
		Page:     page.Page,
		PageSize: page.PageSize,
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) nameAvailable(c *gin.Context) {
	available, err := h.svc.NameAvailable(c.Request.Context(), c.Query("name"))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, gin.H{"available": available})
}

func (h *Handler) setManager(c *gin.Context) {
	id, err := idParam(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req SetManagerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	dto, err := h.svc.SetManager(c.Request.Context(), auth.ActorFrom(c), id, req.Manager)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}

func (h *Handler) markContacted(c *gin.Context) {
	id, err := idParam(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	dto, err := h.svc.MarkContacted(c.Request.Context(), id)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}

func idParam(c *gin.Context) (int64, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return 0, apierr.New(apierr.CodeValidation, "Некорректный идентификатор центра")
	}
	return id, nil
}
