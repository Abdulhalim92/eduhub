package auth

import (
	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает публичные маршруты входа.
type Handler struct {
	svc *Service
}

// NewHandler создаёт HTTP-обработчик auth.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает публичные маршруты (без проверки токена).
func (h *Handler) Register(r gin.IRoutes) {
	r.POST("/auth/login", h.login)
	r.POST("/auth/password", h.changePassword)
}

func (h *Handler) login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	sess, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, sess)
}

func (h *Handler) changePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	sess, err := h.svc.ChangePassword(c.Request.Context(), req)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, sess)
}
