package plans

import (
	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты тарифов.
type Handler struct {
	svc *Service
}

// NewHandler создаёт HTTP-обработчик plans.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты тарифов (write — только SuperAdmin).
func (h *Handler) Register(r gin.IRouter) {
	r.GET("/plans", h.list)
	r.POST("/plans", auth.RequireRole(auth.RoleSuperAdmin), h.create)
	r.PATCH("/plans/:id", auth.RequireRole(auth.RoleSuperAdmin), h.update)
}

func (h *Handler) list(c *gin.Context) {
	res, err := h.svc.List(c.Request.Context())
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) create(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	dto, err := h.svc.Create(c.Request.Context(), auth.ActorFrom(c), req)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}

func (h *Handler) update(c *gin.Context) {
	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	dto, err := h.svc.Update(c.Request.Context(), auth.ActorFrom(c), c.Param("id"), req)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, dto)
}
