package student

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает кабинет ученика (/me/*, role=student).
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик кабинета ученика.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты кабинета ученика (нужна роль student).
func (h *Handler) Register(r gin.IRouter) {
	s := auth.RequireRole(auth.RoleStudent)
	r.GET("/me/schedule", s, h.schedule)
	r.GET("/me/materials", s, h.materials)
	r.GET("/me/tests", s, h.tests)
	r.GET("/me/tests/:tid", s, h.testDetail)
	r.POST("/me/tests/:tid/submit", s, h.submitTest)
	r.GET("/me/points", s, h.points)
	r.GET("/me/finance", s, h.finance)
}

// selfCtx извлекает ученика и центр из токена (role=student).
func selfCtx(c *gin.Context) (studentID, tenantID int64, ok bool) {
	p, authed := auth.Principal(c)
	if !authed || p.Role != auth.RoleStudent || p.StudentID == nil || p.TenantID == nil {
		httpx.Fail(c, apierr.New(apierr.CodeForbidden, "Доступ только для ученика"))
		return 0, 0, false
	}
	return *p.StudentID, *p.TenantID, true
}

func (h *Handler) schedule(c *gin.Context) {
	sid, tid, ok := selfCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.ScheduleFor(c.Request.Context(), sid, tid, c.Query("from"), c.Query("to"))
	reply(c, res, err)
}

func (h *Handler) materials(c *gin.Context) {
	sid, tid, ok := selfCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Materials(c.Request.Context(), sid, tid)
	reply(c, res, err)
}

func (h *Handler) tests(c *gin.Context) {
	sid, tid, ok := selfCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Tests(c.Request.Context(), sid, tid)
	reply(c, res, err)
}

func (h *Handler) testDetail(c *gin.Context) {
	sid, tid, ok := selfCtx(c)
	if !ok {
		return
	}
	testID, perr := strconv.ParseInt(c.Param("tid"), 10, 64)
	if perr != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return
	}
	res, err := h.svc.TestDetail(c.Request.Context(), sid, tid, testID)
	reply(c, res, err)
}

func (h *Handler) submitTest(c *gin.Context) {
	sid, tid, ok := selfCtx(c)
	if !ok {
		return
	}
	testID, perr := strconv.ParseInt(c.Param("tid"), 10, 64)
	if perr != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return
	}
	var req struct {
		Answers []int `json:"answers"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return
	}
	res, err := h.svc.SubmitTest(c.Request.Context(), sid, tid, testID, req.Answers)
	reply(c, res, err)
}

func (h *Handler) points(c *gin.Context) {
	sid, tid, ok := selfCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Points(c.Request.Context(), sid, tid)
	reply(c, res, err)
}

func (h *Handler) finance(c *gin.Context) {
	sid, tid, ok := selfCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Finance(c.Request.Context(), sid, tid)
	reply(c, res, err)
}

func reply(c *gin.Context, body any, err error) {
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, body)
}
