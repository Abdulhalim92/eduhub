package identity

import (
	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает вход по OTP, выбор членства и профиль /me.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик identity.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterPublic подключает публичные маршруты входа (без токена).
func (h *Handler) RegisterPublic(r gin.IRoutes) {
	r.POST("/auth/otp/request", h.otpRequest)
	r.POST("/auth/otp/verify", h.otpVerify)
}

// RegisterProtected подключает маршруты, требующие токен (выбор членства — токеном выбора; /me — любой аккаунт).
func (h *Handler) RegisterProtected(r gin.IRouter) {
	r.POST("/auth/membership", h.selectMembership)
	r.GET("/me", h.me)
}

func (h *Handler) otpRequest(c *gin.Context) {
	var req OtpRequestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	if err := h.svc.RequestOtp(c.Request.Context(), req.Phone); err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, gin.H{"status": "sent"})
}

func (h *Handler) otpVerify(c *gin.Context) {
	var req OtpVerifyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.VerifyOtp(c.Request.Context(), req.Phone, req.Code)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) selectMembership(c *gin.Context) {
	p, ok := auth.Principal(c)
	if !ok || p.AccountID == nil {
		httpx.Fail(c, apierr.New(apierr.CodeUnauthorized, "Требуется токен выбора членства"))
		return
	}
	var req SelectMembershipInput
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	sess, err := h.svc.SelectMembership(c.Request.Context(), *p.AccountID, req.TenantID, req.Role)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, sess)
}

func (h *Handler) me(c *gin.Context) {
	p, ok := auth.Principal(c)
	if !ok || p.AccountID == nil {
		httpx.Fail(c, apierr.New(apierr.CodeUnauthorized, "Требуется авторизация"))
		return
	}
	res, err := h.svc.Me(c.Request.Context(), *p.AccountID, p.TenantID, p.Role)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}
