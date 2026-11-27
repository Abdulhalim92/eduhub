package sms

import (
	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты SMS-биллинга.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик sms.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты (только SuperAdmin).
func (h *Handler) Register(r gin.IRouter) {
	admin := auth.RequireRole(auth.RoleSuperAdmin)
	r.GET("/sms/packages", admin, h.packages)
	r.PUT("/sms/packages/:id", admin, h.updatePackage)
	r.GET("/sms/sales", admin, h.sales)
	r.POST("/sms/sales", admin, h.accrue)
}

func (h *Handler) packages(c *gin.Context) {
	res, err := h.svc.Packages(c.Request.Context())
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) sales(c *gin.Context) {
	page := httpx.ParsePage(c)
	res, err := h.svc.Sales(c.Request.Context(), c.Query("q"), c.Query("status"), c.Query("packageId"), page.Page, page.PageSize)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) accrue(c *gin.Context) {
	var req AccrueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.Accrue(c.Request.Context(), auth.ActorFrom(c), req, c.GetHeader("Idempotency-Key"))
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) updatePackage(c *gin.Context) {
	var req UpdatePackageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.UpdatePackage(c.Request.Context(), auth.ActorFrom(c), c.Param("id"), req)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}
