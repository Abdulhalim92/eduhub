package identity

import (
	"strconv"

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

	// Привязка опекунов к ученику — администратор своего центра или SuperAdmin.
	admin := auth.RequireRole(auth.RoleSuperAdmin, auth.RoleCenterAdmin)
	r.GET("/centers/:id/students/:sid/guardians", admin, h.listGuardians)
	r.POST("/centers/:id/students/:sid/guardians", admin, h.attachGuardian)
	r.DELETE("/centers/:id/students/:sid/guardians/:aid", admin, h.detachGuardian)
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

func (h *Handler) listGuardians(c *gin.Context) {
	id, sid, ok := guardianParams(c)
	if !ok {
		return
	}
	res, err := h.svc.ListGuardians(c.Request.Context(), id, sid)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) attachGuardian(c *gin.Context) {
	id, sid, ok := guardianParams(c)
	if !ok {
		return
	}
	var req AttachGuardianInput
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.AttachGuardian(c.Request.Context(), auth.ActorFrom(c), id, sid, req)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, res)
}

func (h *Handler) detachGuardian(c *gin.Context) {
	id, sid, ok := guardianParams(c)
	if !ok {
		return
	}
	aid, err := strconv.ParseInt(c.Param("aid"), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return
	}
	if err := h.svc.DetachGuardian(c.Request.Context(), auth.ActorFrom(c), id, sid, aid); err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, gin.H{"status": "revoked"})
}

// guardianParams читает id центра и ученика с проверкой доступа к центру.
func guardianParams(c *gin.Context) (centerID, studentID int64, ok bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return 0, 0, false
	}
	p, authed := auth.Principal(c)
	if !authed {
		httpx.Fail(c, apierr.New(apierr.CodeUnauthorized, "Требуется авторизация"))
		return 0, 0, false
	}
	allowed := p.Role == auth.RoleSuperAdmin ||
		(p.Role == auth.RoleCenterAdmin && p.TenantID != nil && *p.TenantID == id)
	if !allowed {
		httpx.Fail(c, apierr.New(apierr.CodeForbidden, "Нет доступа к этому центру"))
		return 0, 0, false
	}
	sid, err := strconv.ParseInt(c.Param("sid"), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return 0, 0, false
	}
	return id, sid, true
}
