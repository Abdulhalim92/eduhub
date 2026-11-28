package cabinet

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты кабинета центра.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик кабинета.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты (администратор своего центра или SuperAdmin в режиме поддержки).
func (h *Handler) Register(r gin.IRouter) {
	both := auth.RequireRole(auth.RoleSuperAdmin, auth.RoleCenterAdmin)
	r.GET("/cabinet/centers", both, h.profileCenters)
	r.GET("/centers/:id/profile", both, h.profile)
	r.GET("/centers/:id/dashboard", both, h.dashboard)
	r.GET("/centers/:id/schedule", both, h.schedule)

	r.GET("/centers/:id/staff", both, h.staffList)
	r.POST("/centers/:id/staff", both, h.staffAdd)
	r.DELETE("/centers/:id/staff/:sid", both, h.staffRemove)

	r.GET("/centers/:id/users", both, h.usersList)
	r.POST("/centers/:id/students", both, h.studentAdd)
	r.PATCH("/centers/:id/students/:sid/status", both, h.studentStatus)

	r.GET("/centers/:id/groups", both, h.groupsList)
	r.GET("/centers/:id/groups/:gid", both, h.groupGet)
	r.POST("/centers/:id/groups", both, h.groupCreate)
	r.PATCH("/centers/:id/groups/:gid", both, h.groupUpdate)
	r.POST("/centers/:id/groups/:gid/students", both, h.groupAddStudent)
	r.DELETE("/centers/:id/groups/:gid/students/:sid", both, h.groupRemoveStudent)

	r.POST("/centers/:id/access", both, h.accessReset)

	r.GET("/centers/:id/rewards", both, h.rewardsList)
	r.POST("/centers/:id/rewards", both, h.rewardCreate)
	r.PATCH("/centers/:id/rewards/:rid", both, h.rewardUpdate)

	r.GET("/centers/:id/coin-rules", both, h.coinRulesList)
	r.POST("/centers/:id/coin-rules", both, h.coinRuleCreate)
	r.PATCH("/centers/:id/coin-rules/:crid", both, h.coinRuleUpdate)

	r.GET("/centers/:id/analytics", both, h.analytics)
	r.POST("/centers/:id/students/:sid/coin", both, h.grantCoin)
}

func (h *Handler) rewardsList(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	p := httpx.ParsePage(c)
	res, err := h.svc.RewardsList(c.Request.Context(), id, c.Query("status"), optIntQuery(c, "priceFrom"), optIntQuery(c, "priceTo"), p.Page, p.PageSize)
	reply(c, res, err)
}

func (h *Handler) rewardCreate(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req RewardRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.CreateReward(c.Request.Context(), id, req)
	reply(c, res, err)
}

func (h *Handler) rewardUpdate(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	rid, ok := idParam(c, "rid")
	if !ok {
		return
	}
	var req RewardRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.UpdateReward(c.Request.Context(), id, rid, req)
	reply(c, res, err)
}

func (h *Handler) coinRulesList(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	p := httpx.ParsePage(c)
	res, err := h.svc.CoinRulesList(c.Request.Context(), id, c.Query("scope"), p.Page, p.PageSize)
	reply(c, res, err)
}

func (h *Handler) coinRuleCreate(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req CoinRuleRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.CreateCoinRule(c.Request.Context(), id, req)
	reply(c, res, err)
}

func (h *Handler) coinRuleUpdate(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	crid, ok := idParam(c, "crid")
	if !ok {
		return
	}
	var req CoinRuleRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.UpdateCoinRule(c.Request.Context(), id, crid, req)
	reply(c, res, err)
}

func (h *Handler) analytics(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	p := httpx.ParsePage(c)
	res, err := h.svc.Analytics(c.Request.Context(), id, optInt(c, "groupId"), optIntQuery(c, "coinFrom"), optIntQuery(c, "coinTo"), c.Query("q"), p.Page, p.PageSize)
	reply(c, res, err)
}

func (h *Handler) grantCoin(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	sid, ok := idParam(c, "sid")
	if !ok {
		return
	}
	var req struct {
		Amount int    `json:"amount"`
		Reason string `json:"reason"`
	}
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.GrantCoin(c.Request.Context(), auth.ActorFrom(c), id, sid, req.Amount, req.Reason)
	reply(c, res, err)
}

func (h *Handler) profileCenters(c *gin.Context) {
	res, err := h.svc.ProfileCenters(c.Request.Context())
	reply(c, res, err)
}

func (h *Handler) profile(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Profile(c.Request.Context(), id)
	reply(c, res, err)
}

func (h *Handler) dashboard(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Dashboard(c.Request.Context(), id)
	reply(c, res, err)
}

func (h *Handler) schedule(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	res, err := h.svc.Schedule(c.Request.Context(), id, c.Query("branch"), optInt(c, "teacherId"))
	reply(c, res, err)
}

func (h *Handler) staffList(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	p := httpx.ParsePage(c)
	res, err := h.svc.StaffList(c.Request.Context(), id, c.Query("role"), c.Query("q"), p.Page, p.PageSize)
	reply(c, res, err)
}

func (h *Handler) staffAdd(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req AddStaffRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.AddStaff(c.Request.Context(), auth.ActorFrom(c), id, req)
	reply(c, res, err)
}

func (h *Handler) staffRemove(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	sid, ok := idParam(c, "sid")
	if !ok {
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.RemoveStaff(c.Request.Context(), auth.ActorFrom(c), id, sid, req.Reason)
	reply(c, res, err)
}

func (h *Handler) usersList(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	p := httpx.ParsePage(c)
	res, err := h.svc.UsersList(c.Request.Context(), id, c.Query("role"), c.Query("branch"), c.Query("q"), p.Page, p.PageSize)
	reply(c, res, err)
}

func (h *Handler) studentAdd(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req AddStudentRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.AddStudent(c.Request.Context(), auth.ActorFrom(c), id, req)
	reply(c, res, err)
}

func (h *Handler) studentStatus(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	sid, ok := idParam(c, "sid")
	if !ok {
		return
	}
	var req struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.SetStudentStatus(c.Request.Context(), auth.ActorFrom(c), id, sid, req.Status, req.Reason)
	reply(c, res, err)
}

func (h *Handler) groupsList(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	p := httpx.ParsePage(c)
	res, err := h.svc.GroupsList(c.Request.Context(), id, c.Query("course"), c.Query("branch"), optInt(c, "teacherId"), c.Query("status"), p.Page, p.PageSize)
	reply(c, res, err)
}

func (h *Handler) groupGet(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	gid, ok := idParam(c, "gid")
	if !ok {
		return
	}
	res, err := h.svc.GroupGet(c.Request.Context(), id, gid)
	reply(c, res, err)
}

func (h *Handler) groupCreate(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var in GroupInput
	if !bindJSON(c, &in) {
		return
	}
	res, err := h.svc.GroupCreate(c.Request.Context(), id, in)
	reply(c, res, err)
}

func (h *Handler) groupUpdate(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	gid, ok := idParam(c, "gid")
	if !ok {
		return
	}
	var in GroupInput
	if !bindJSON(c, &in) {
		return
	}
	res, err := h.svc.GroupUpdate(c.Request.Context(), id, gid, in)
	reply(c, res, err)
}

func (h *Handler) groupAddStudent(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	gid, ok := idParam(c, "gid")
	if !ok {
		return
	}
	var req struct {
		StudentID int64 `json:"studentId"`
	}
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.AddStudentToGroup(c.Request.Context(), id, gid, req.StudentID)
	reply(c, res, err)
}

func (h *Handler) groupRemoveStudent(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	gid, ok := idParam(c, "gid")
	if !ok {
		return
	}
	sid, ok := idParam(c, "sid")
	if !ok {
		return
	}
	res, err := h.svc.RemoveStudentFromGroup(c.Request.Context(), id, gid, sid)
	reply(c, res, err)
}

func (h *Handler) accessReset(c *gin.Context) {
	id, ok := centerCtx(c)
	if !ok {
		return
	}
	var req AccessResetRequest
	if !bindJSON(c, &req) {
		return
	}
	res, err := h.svc.AccessReset(c.Request.Context(), auth.ActorFrom(c), id, req)
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

func idParam(c *gin.Context, name string) (int64, bool) {
	v, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректный идентификатор"))
		return 0, false
	}
	return v, true
}

func optInt(c *gin.Context, name string) *int64 {
	s := c.Query(name)
	if s == "" {
		return nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil
	}
	return &v
}

func optIntQuery(c *gin.Context, name string) *int {
	s := c.Query(name)
	if s == "" {
		return nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &v
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
