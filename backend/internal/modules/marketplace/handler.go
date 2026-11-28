package marketplace

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// Handler обслуживает маршруты маркетплейса, страницы курса и кабинетные курсы.
type Handler struct {
	svc *Service
}

// NewHandler создаёт обработчик маркетплейса.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register подключает маршруты.
func (h *Handler) Register(r gin.IRouter) {
	admin := auth.RequireRole(auth.RoleSuperAdmin)
	// Платформенная сторона — только SuperAdmin.
	r.GET("/marketplace/courses", admin, h.list)
	r.POST("/marketplace/courses", admin, h.create)
	r.PUT("/marketplace/courses/:id/price", admin, h.setPrice)
	r.POST("/marketplace/courses/:id/publish", admin, h.publish)
	r.POST("/marketplace/courses/:id/unpublish", admin, h.unpublish)
	r.POST("/marketplace/courses/:id/grants", admin, h.sell)
	r.GET("/marketplace/courses/:id/buyers", admin, h.buyers)
	r.POST("/marketplace/access/:id/revoke", admin, h.revoke)
	r.GET("/marketplace/requests", admin, h.requestsList)
	r.POST("/marketplace/requests/:id/process", admin, h.requestProcess)

	// Страница и программа курса — SuperAdmin (платформенные) или администратор центра (свои).
	both := auth.RequireRole(auth.RoleSuperAdmin, auth.RoleCenterAdmin)
	r.GET("/courses/:id", both, h.getCourse)
	r.PATCH("/courses/:id", both, h.updateCourse)
	r.POST("/courses/:id/modules", both, h.addModule)
	r.PATCH("/courses/:id/modules/:mid", both, h.renameModule)
	r.DELETE("/courses/:id/modules/:mid", both, h.removeModule)
	r.POST("/courses/:id/lessons", both, h.addLesson)
	r.PATCH("/courses/:id/lessons/:lid", both, h.renameLesson)
	r.DELETE("/courses/:id/lessons/:lid", both, h.removeLesson)
	r.POST("/courses/:id/materials", both, h.addMaterial)
	r.DELETE("/courses/:id/materials/:matid", both, h.removeMaterial)

	// Кабинет центра — администратор своего центра или SuperAdmin (режим поддержки).
	r.GET("/centers/:id/courses", both, h.centerCourses)
	r.GET("/centers/:id/courses/catalog", both, h.catalog)
	r.POST("/centers/:id/courses", both, h.createOwn)
	r.GET("/centers/:id/course-requests", both, h.centerRequests)
	r.POST("/centers/:id/course-requests", both, h.createRequest)
	r.DELETE("/centers/:id/course-requests/:rid", both, h.cancelRequest)
	r.POST("/centers/:id/course-requests/:rid/pay-online", both, h.payRequestOnline)
}

func caller(c *gin.Context) Caller {
	p, _ := auth.Principal(c)
	if p != nil && p.Role == auth.RoleSuperAdmin {
		return Caller{SuperAdmin: true}
	}
	if p != nil {
		return Caller{CenterID: p.TenantID}
	}
	return Caller{}
}

// authorizeCenter пропускает SuperAdmin (поддержка) или администратора этого же центра.
func authorizeCenter(c *gin.Context, centerID int64) error {
	p, ok := auth.Principal(c)
	if !ok {
		return apierr.New(apierr.CodeUnauthorized, "Требуется авторизация")
	}
	if p.Role == auth.RoleSuperAdmin {
		return nil
	}
	if p.Role == auth.RoleCenterAdmin && p.TenantID != nil && *p.TenantID == centerID {
		return nil
	}
	return apierr.New(apierr.CodeForbidden, "Нет доступа к этому центру")
}

func int64Param(c *gin.Context, name string) (int64, error) {
	v, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil {
		return 0, apierr.New(apierr.CodeValidation, "Некорректный идентификатор")
	}
	return v, nil
}

func bind(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		httpx.Fail(c, apierr.New(apierr.CodeValidation, "Некорректное тело запроса"))
		return false
	}
	return true
}

// --- платформа ---

func (h *Handler) list(c *gin.Context) {
	res, err := h.svc.List(c.Request.Context(), c.Query("q"), c.Query("direction"), c.Query("status"))
	reply(c, res, err)
}

func (h *Handler) create(c *gin.Context) {
	var req struct {
		Title     string `json:"title"`
		Direction string `json:"direction"`
		Price     *int64 `json:"price"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.Create(c.Request.Context(), auth.ActorFrom(c), req.Title, req.Direction, req.Price)
	reply(c, res, err)
}

func (h *Handler) setPrice(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Price  *int64 `json:"price"`
		Reason string `json:"reason"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.SetPrice(c.Request.Context(), auth.ActorFrom(c), id, req.Price, req.Reason)
	reply(c, res, err)
}

func (h *Handler) publish(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.Publish(c.Request.Context(), auth.ActorFrom(c), id)
	reply(c, res, err)
}

func (h *Handler) unpublish(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.Unpublish(c.Request.Context(), auth.ActorFrom(c), id, req.Reason)
	reply(c, res, err)
}

func (h *Handler) sell(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		CenterID int64  `json:"centerId"`
		Mode     string `json:"mode"`
		Reason   string `json:"reason"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.Sell(c.Request.Context(), auth.ActorFrom(c), req.CenterID, id, req.Mode, req.Reason)
	reply(c, res, err)
}

func (h *Handler) buyers(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.Buyers(c.Request.Context(), id)
	reply(c, res, err)
}

func (h *Handler) revoke(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.Revoke(c.Request.Context(), auth.ActorFrom(c), id, req.Reason)
	reply(c, res, err)
}

func (h *Handler) requestsList(c *gin.Context) {
	var courseID int64
	if v := c.Query("courseId"); v != "" {
		courseID, _ = strconv.ParseInt(v, 10, 64)
	}
	res, err := h.svc.RequestsList(c.Request.Context(), c.Query("status"), courseID)
	reply(c, res, err)
}

func (h *Handler) requestProcess(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.Process(c.Request.Context(), auth.ActorFrom(c), id, req.Action, req.Reason)
	reply(c, res, err)
}

// --- страница и программа курса ---

func (h *Handler) getCourse(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.GetCourse(c.Request.Context(), id, caller(c))
	reply(c, res, err)
}

func (h *Handler) updateCourse(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Title       string `json:"title"`
		Direction   string `json:"direction"`
		Description string `json:"description"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.UpdateCourse(c.Request.Context(), auth.ActorFrom(c), id, caller(c), req.Title, req.Direction, req.Description)
	reply(c, res, err)
}

func (h *Handler) addModule(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Title string `json:"title"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.AddModule(c.Request.Context(), auth.ActorFrom(c), id, caller(c), req.Title)
	reply(c, res, err)
}

func (h *Handler) renameModule(c *gin.Context) {
	id, mid, err := twoIDs(c, "id", "mid")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Title string `json:"title"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.RenameModule(c.Request.Context(), auth.ActorFrom(c), id, mid, caller(c), req.Title)
	reply(c, res, err)
}

func (h *Handler) removeModule(c *gin.Context) {
	id, mid, err := twoIDs(c, "id", "mid")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.RemoveModule(c.Request.Context(), auth.ActorFrom(c), id, mid, caller(c))
	reply(c, res, err)
}

func (h *Handler) addLesson(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		ModuleID int64  `json:"moduleId"`
		Title    string `json:"title"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.AddLesson(c.Request.Context(), auth.ActorFrom(c), id, req.ModuleID, caller(c), req.Title)
	reply(c, res, err)
}

func (h *Handler) renameLesson(c *gin.Context) {
	id, lid, err := twoIDs(c, "id", "lid")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Title string `json:"title"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.RenameLesson(c.Request.Context(), auth.ActorFrom(c), id, lid, caller(c), req.Title)
	reply(c, res, err)
}

func (h *Handler) removeLesson(c *gin.Context) {
	id, lid, err := twoIDs(c, "id", "lid")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.RemoveLesson(c.Request.Context(), auth.ActorFrom(c), id, lid, caller(c))
	reply(c, res, err)
}

func (h *Handler) addMaterial(c *gin.Context) {
	id, err := int64Param(c, "id")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		LessonID  int64  `json:"lessonId"`
		Type      string `json:"type"`
		Name      string `json:"name"`
		Questions int    `json:"questions"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.AddMaterial(c.Request.Context(), auth.ActorFrom(c), id, req.LessonID, caller(c), req.Type, req.Name, req.Questions)
	reply(c, res, err)
}

func (h *Handler) removeMaterial(c *gin.Context) {
	id, matid, err := twoIDs(c, "id", "matid")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.RemoveMaterial(c.Request.Context(), auth.ActorFrom(c), id, matid, caller(c))
	reply(c, res, err)
}

// --- кабинет центра ---

func (h *Handler) centerCourses(c *gin.Context) {
	id, err := centerCtx(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.CenterCourses(c.Request.Context(), id)
	reply(c, res, err)
}

func (h *Handler) catalog(c *gin.Context) {
	id, err := centerCtx(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.Catalog(c.Request.Context(), id)
	reply(c, gin.H{"items": res}, err)
}

func (h *Handler) createOwn(c *gin.Context) {
	id, err := centerCtx(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		Title       string `json:"title"`
		Direction   string `json:"direction"`
		Description string `json:"description"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.CreateOwn(c.Request.Context(), id, req.Title, req.Direction, req.Description)
	reply(c, res, err)
}

func (h *Handler) centerRequests(c *gin.Context) {
	id, err := centerCtx(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.CenterRequests(c.Request.Context(), id)
	reply(c, gin.H{"items": res}, err)
}

func (h *Handler) createRequest(c *gin.Context) {
	id, err := centerCtx(c)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	var req struct {
		CourseID int64  `json:"courseId"`
		Note     string `json:"note"`
	}
	if !bind(c, &req) {
		return
	}
	res, err := h.svc.CreateRequest(c.Request.Context(), auth.ActorFrom(c), id, req.CourseID, req.Note)
	reply(c, res, err)
}

func (h *Handler) cancelRequest(c *gin.Context) {
	id, rid, err := twoIDs(c, "id", "rid")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	if err := authorizeCenter(c, id); err != nil {
		httpx.Fail(c, err)
		return
	}
	if err := h.svc.CancelRequest(c.Request.Context(), id, rid); err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, gin.H{"ok": true})
}

func (h *Handler) payRequestOnline(c *gin.Context) {
	id, rid, err := twoIDs(c, "id", "rid")
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	if err := authorizeCenter(c, id); err != nil {
		httpx.Fail(c, err)
		return
	}
	res, err := h.svc.PayRequestOnline(c.Request.Context(), id, rid)
	reply(c, res, err)
}

// centerCtx читает id центра из пути и проверяет доступ (свой центр или SuperAdmin).
func centerCtx(c *gin.Context) (int64, error) {
	id, err := int64Param(c, "id")
	if err != nil {
		return 0, err
	}
	if err := authorizeCenter(c, id); err != nil {
		return 0, err
	}
	return id, nil
}

func twoIDs(c *gin.Context, a, b string) (int64, int64, error) {
	x, err := int64Param(c, a)
	if err != nil {
		return 0, 0, err
	}
	y, err := int64Param(c, b)
	if err != nil {
		return 0, 0, err
	}
	return x, y, nil
}

func reply(c *gin.Context, body any, err error) {
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	httpx.OK(c, body)
}
