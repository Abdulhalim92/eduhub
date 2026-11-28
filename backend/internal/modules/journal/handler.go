package journal

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты журнала.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик журнала.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты (администратор своего центра или SuperAdmin в режиме поддержки).
func (h *Handler) Register(r gin.IRouter) {
	both := auth.RequireRole(auth.RoleSuperAdmin, auth.RoleCenterAdmin)
	r.GET("/centers/:id/groups/:gid/lessons", both, h.lessonsRange)
	r.POST("/centers/:id/groups/:gid/lessons", both, h.openLesson)
	r.GET("/centers/:id/lessons/:lid", both, h.getLesson)
	r.PATCH("/centers/:id/lessons/:lid", both, h.conduct)
	r.PUT("/centers/:id/lessons/:lid/attendance", both, h.setAttendance)

	r.POST("/centers/:id/shifts/start", both, h.startShift)
	r.POST("/centers/:id/shifts/:sid/end", both, h.endShift)

	r.GET("/centers/:id/groups/:gid/point-budget", both, h.getBudget)
	r.PUT("/centers/:id/groups/:gid/point-budget", both, h.setBudget)
	r.POST("/centers/:id/groups/:gid/points", both, h.grantPoints)

	r.POST("/centers/:id/tests", both, h.createTest)
	r.GET("/centers/:id/tests/:tid", both, h.getTest)
	r.POST("/centers/:id/tests/:tid/submit", both, h.submitTest)
}

func (h *Handler) lessonsRange(c *gin.Context) {
	id, gid, ok := centerAndParam(c, "gid")
	if !ok {
		return
	}
	res, err := h.svc.LessonsRange(c.Request.Context(), id, gid, c.Query("from"), c.Query("to"))
	reply(c, res, err)
}

func (h *Handler) openLesson(c *gin.Context) {
	id, gid, ok := centerAndParam(c, "gid")
	if !ok {
		return
	}
	var req OpenLessonRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.OpenLesson(c.Request.Context(), id, gid, req)
	reply(c, res, err)
}

func (h *Handler) getLesson(c *gin.Context) {
	id, lid, ok := centerAndParam(c, "lid")
	if !ok {
		return
	}
	res, err := h.svc.GetLesson(c.Request.Context(), id, lid)
	reply(c, res, err)
}

func (h *Handler) conduct(c *gin.Context) {
	id, lid, ok := centerAndParam(c, "lid")
	if !ok {
		return
	}
	res, err := h.svc.Conduct(c.Request.Context(), auth.ActorFrom(c), id, lid)
	reply(c, res, err)
}

func (h *Handler) setAttendance(c *gin.Context) {
	id, lid, ok := centerAndParam(c, "lid")
	if !ok {
		return
	}
	var req struct {
		Entries []AttendanceEntry `json:"entries"`
	}
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.SetAttendance(c.Request.Context(), id, lid, req.Entries)
	reply(c, res, err)
}

func (h *Handler) startShift(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req StartShiftRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.StartShift(c.Request.Context(), auth.ActorFrom(c), id, req)
	reply(c, res, err)
}

func (h *Handler) endShift(c *gin.Context) {
	id, sid, ok := centerAndParam(c, "sid")
	if !ok {
		return
	}
	res, err := h.svc.EndShift(c.Request.Context(), id, sid)
	reply(c, res, err)
}

func (h *Handler) getBudget(c *gin.Context) {
	id, gid, ok := centerAndParam(c, "gid")
	if !ok {
		return
	}
	res, err := h.svc.GetBudget(c.Request.Context(), id, gid)
	reply(c, res, err)
}

func (h *Handler) setBudget(c *gin.Context) {
	id, gid, ok := centerAndParam(c, "gid")
	if !ok {
		return
	}
	var req BudgetRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.SetBudget(c.Request.Context(), id, gid, req)
	reply(c, res, err)
}

func (h *Handler) grantPoints(c *gin.Context) {
	id, gid, ok := centerAndParam(c, "gid")
	if !ok {
		return
	}
	var req GrantPointsRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.GrantPoints(c.Request.Context(), auth.ActorFrom(c), id, gid, req)
	reply(c, res, err)
}

func (h *Handler) createTest(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req CreateTestRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.CreateTest(c.Request.Context(), id, req)
	reply(c, res, err)
}

func (h *Handler) getTest(c *gin.Context) {
	id, tid, ok := centerAndParam(c, "tid")
	if !ok {
		return
	}
	res, err := h.svc.GetTest(c.Request.Context(), id, tid)
	reply(c, res, err)
}

func (h *Handler) submitTest(c *gin.Context) {
	id, tid, ok := centerAndParam(c, "tid")
	if !ok {
		return
	}
	var req SubmitRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.SubmitTest(c.Request.Context(), id, tid, req)
	reply(c, res, err)
}

// centerCtx читает id центра и проверяет доступ (свой центр или SuperAdmin). При ошибке сам пишет ответ.
func centerCtx(c *gin.Context) (int64, bool) {
	id, ok := idParam(c, "id")
	if !ok {
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

func centerAndParam(c *gin.Context, name string) (int64, int64, bool) {
	id, ok := centerCtx(c)
	if !ok {
		return 0, 0, false
	}
	v, ok := idParam(c, name)
	if !ok {
		return 0, 0, false
	}
	return id, v, true
}

func idParam(c *gin.Context, name string) (int64, bool) {
	v, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return 0, false
	}
	return v, true
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
