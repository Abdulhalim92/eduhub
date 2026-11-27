// Package server собирает HTTP-роутер из модулей и middleware.
package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/internal/config"
	"github.com/line/eduhub-backend/internal/credentials"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/internal/middleware"
	"github.com/line/eduhub-backend/internal/modules/billing"
	"github.com/line/eduhub-backend/internal/modules/cabinet"
	"github.com/line/eduhub-backend/internal/modules/cashier"
	"github.com/line/eduhub-backend/internal/modules/catalog"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/internal/modules/dictionaries"
	"github.com/line/eduhub-backend/internal/modules/finance"
	"github.com/line/eduhub-backend/internal/modules/identity"
	"github.com/line/eduhub-backend/internal/modules/journal"
	"github.com/line/eduhub-backend/internal/modules/marketplace"
	"github.com/line/eduhub-backend/internal/modules/moderation"
	"github.com/line/eduhub-backend/internal/modules/plans"
	"github.com/line/eduhub-backend/internal/modules/sms"
	"github.com/line/eduhub-backend/internal/modules/student"
	"gorm.io/gorm"
)

// New собирает gin-движок со всеми маршрутами.
func New(cfg config.Config, db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.RequestID(), middleware.Logger(), middleware.Recover(), middleware.CORS())

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	rec := audit.New()
	idem := idempotency.New(db)
	tokens := auth.NewTokenService(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)

	// Публичные маршруты входа.
	authSvc := auth.NewService(db, auth.NewRepository(db), tokens, rec, cfg.BcryptCost)
	auth.NewHandler(authSvc).Register(r)

	// Мобильный контур (ТЗ v2.5): аккаунт по телефону + членства + вход по OTP.
	identitySvc := identity.NewService(identity.NewRepository(db), tokens, identity.LogSender{}, rec)
	identityH := identity.NewHandler(identitySvc)
	identityH.RegisterPublic(r) // /auth/otp/*

	// Публичный каталог филиалов и заявки на пробный урок (LRN-CAT-010, CTR-CRM-010).
	catalogH := catalog.NewHandler(catalog.NewService(catalog.NewRepository(db), rec))
	catalogH.RegisterPublic(r) // /catalog/*

	// Защищённые маршруты: требуется валидный токен.
	api := r.Group("/", auth.Middleware(tokens))

	identityH.RegisterProtected(api) // /auth/membership, /me
	catalogH.RegisterProtected(api)  // управление заявками центра

	dictionaries.NewHandler(dictionaries.NewService(db)).Register(api)

	plansSvc := plans.NewService(plans.NewRepository(db), rec)
	plans.NewHandler(plansSvc).Register(api)

	centersSvc := centers.NewService(centers.NewRepository(db), rec)
	centers.NewHandler(centersSvc).Register(api)

	// Денежное ядро: счета/оплата/смена тарифа и баланс/овердрафт.
	billingSvc := billing.NewService(billing.NewRepository(db), rec, idem)
	billing.NewHandler(billingSvc).Register(api)

	financeSvc := finance.NewService(finance.NewRepository(db), centersSvc, billingSvc, rec, idem)
	finance.NewHandler(financeSvc).Register(api)

	// Маркетплейс методик: передача курса при оплате счёта подключается в billing через granter.
	marketplaceSvc := marketplace.NewService(marketplace.NewRepository(db), billingSvc, rec)
	billingSvc.SetCourseGranter(marketplaceSvc)
	marketplace.NewHandler(marketplaceSvc).Register(api)

	// SMS-пакеты: каталог, начисление (с баланса/вручную/бонус), история продаж.
	sms.NewHandler(sms.NewService(sms.NewRepository(db), rec, idem)).Register(api)

	// Модерация каталога: очередь заявок филиалов и решения; подача заявок из кабинета центра.
	moderation.NewHandler(moderation.NewService(moderation.NewRepository(db), rec)).Register(api)

	// Кабинет центра: профиль, сотрудники, ученики, группы, расписание, дашборд, выдача доступа.
	creds := credentials.New(cfg.BcryptCost)
	cabinet.NewHandler(cabinet.NewService(cabinet.NewRepository(db), centersSvc, creds, rec)).Register(api)

	// Электронный журнал: занятия, посещаемость, смены, баллы за успехи, тесты.
	journalSvc := journal.NewService(journal.NewRepository(db), rec)
	journal.NewHandler(journalSvc).Register(api)

	// Касса центра и зарплаты (изолированы от платформы, BR-022). Хук списывает оплаченные уроки
	// и начисляет зарплату при «Проведён» занятия — внедряется в журнал.
	cashierRepo := cashier.NewRepository(db)
	cashier.NewHandler(cashier.NewService(cashierRepo, rec, idem)).Register(api)
	journalSvc.SetConductHook(cashier.NewHook(cashierRepo, rec))

	// Кабинет ученика (LRN-PRN-030, role=student): расписание и оценивание тестов — из журнала.
	student.NewHandler(student.NewService(student.NewRepository(db), journalSvc, journalSvc)).Register(api)

	return r
}
