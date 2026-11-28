package parent

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает кабинет родителя (/me/children*, role=parent).
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик кабинета родителя.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты кабинета родителя (нужна роль parent).
func (h *Handler) Register(r gin.IRouter) {
	p := auth.RequireRole(auth.RoleParent)
	r.GET("/me/children", p, h.children)
	r.GET("/me/children/:sid/finance", p, h.childFinance)
	r.GET("/me/children/:sid/schedule", p, h.childSchedule)
}

// accountCtx извлекает аккаунт родителя из токена.
func accountCtx(c *gin.Context) (int64, bool) {
	pr, ok := auth.Principal(c)
	if !ok || pr.Role != auth.RoleParent || pr.AccountID == nil {
		httpx.Fail(c, apierr.New(apierr.CodeForbidden, "Доступ только для родителя"))
		return 0, false
	}
	return *pr.AccountID, true
}

func childID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("sid"), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return 0, false
	}
	return id, true
}

func (h *Handler) children(c *gin.Context) {
	acc, ok := accountCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Children(c.Request.Context(), acc)
	reply(c, res, err)
}

func (h *Handler) childFinance(c *gin.Context) {
	acc, ok := accountCtx(c)
	if !ok {
		return
	}
	sid, ok := childID(c)
	if !ok {
		return
	}
	res, err := h.svc.ChildFinance(c.Request.Context(), acc, sid)
	reply(c, res, err)
}

func (h *Handler) childSchedule(c *gin.Context) {
	acc, ok := accountCtx(c)
	if !ok {
		return
	}
	sid, ok := childID(c)
	if !ok {
		return
	}
	res, err := h.svc.ChildSchedule(c.Request.Context(), acc, sid, c.Query("from"), c.Query("to"))
	reply(c, res, err)
}

func reply(c *gin.Context, body any, err error) {
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, body)
}
