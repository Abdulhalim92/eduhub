---
name: service-scaffold
description: "[Go] Используй при создании каркаса Go-бэкенда (модульный монолит, Clean Architecture) в backend/."
---

# Каркас Go-бэкенда (модульный монолит, Clean Architecture)

Бэкенд «Линии» — один Go-сервис в `backend/` (свой `go.mod`), прототип в корне репозитория не трогаем. Микросервисов, брокера и gRPC нет; появятся — скилл расширяем, а не угадываем заранее.

## При вызове

1. Уточни: что создаём (весь каркас или новый модуль внутри него), нужен ли outbox (только если есть исходящие события: webhook оплаты, SMS).
2. Покажи структуру ниже пользователю и спроси про правки до генерации кода.
3. Детали реализации — в `references/`:
   - `main-skeleton.md` — `main.go`, `app.go`, `config.go`, `observability`
   - `makefile.md` — таргеты
   - `dockerfile.md` — production Dockerfile (k8s-фрагмент по необходимости)

---

## Структура директорий

```
backend/
├── cmd/liniya/main.go             # Тонкий: только точка входа, делегирует в app.New()
├── internal/
│   ├── app/app.go                 # Composition root: сборка зависимостей + Run(ctx)
│   ├── config/config.go           # ENV + Validate(), fail-fast
│   ├── domain/
│   │   ├── <module>/              # tenant, billing, learning, ... (границы — по спецификации)
│   │   │   ├── model.go           # Сущности, value objects, доменные ошибки
│   │   │   └── repository.go      # Интерфейс репозитория (определён в domain)
│   │   └── errors.go              # Общие доменные ошибки (код + сообщение + поля, как ApiError)
│   ├── service/<module>.go        # Бизнес-логика; правила BR-NNN живут здесь, не в handler
│   ├── repository/postgres/       # PostgreSQL-реализации; outbox.go — только если нужен outbox
│   ├── transport/http/
│   │   ├── router.go              # Маршруты + middleware (request_id, auth, recover)
│   │   └── <module>_handler.go
│   ├── dto/<module>.go            # Transport DTO: валидация синтаксиса на границе
│   └── observability/setup.go     # slog, OTel, Prometheus
├── migrations/                    # SQL: YYYYMMDDHHMMSS_описание.sql
├── Dockerfile  Makefile  .env.example  .golangci.yml
└── go.mod
```

Мультитенантность: `tenant_id` приходит из токена в middleware, попадает в `ctx`, репозитории всегда фильтруют по нему. Запрос без tenant-фильтра — баг.

---

## Направление зависимостей

```
transport → service → domain ← repository
              ↑
      domain не знает ни о ком
      dto — только в transport, не проникает в service/domain
```

**Запрещено:**
- Импорт `internal/repository` из `domain`
- Импорт `internal/transport` из `service`
- `dto` в `service` или `domain`

---

## Порядок инициализации (app.go)

```
1. config.Load() → config.Validate()     // fail-fast на старте
2. slog logger (JSON всегда, текст только локально)
3. observability.Setup(ctx)
4. postgres.Connect(ctx) + ping          // с retry, но не бесконечно
5. repositories := postgres.NewRepositories(db)
6. services := service.NewServices(repositories)
7. transport := http.NewServer(cfg, services)
8. errgroup.Go: HTTP server (+ outbox relay, если есть)
9. <-ctx.Done()  // SIGINT/SIGTERM
10. Graceful shutdown (таймаут 30s): stop HTTP → drain → close DB
```

**Критично:** shutdown в обратном порядке к инициализации. HTTP закрывается первым, чтобы in-flight запросы не упали на закрытой БД.

---

## Health endpoints

| Endpoint | Назначение | Проверяет |
|---|---|---|
| `GET /healthz` | Liveness | Процесс жив |
| `GET /readyz` | Readiness | БД доступна |
| `GET /metrics` | Prometheus | RED-метрики |

---

## go.mod (зависимости по необходимости)

```
go 1.26

require (
    golang.org/x/sync                    // errgroup
    github.com/jackc/pgx/v5
    github.com/jmoiron/sqlx
    go.opentelemetry.io/otel             // tracing
    github.com/prometheus/client_golang  // metrics
)
```

HTTP-роутер выбирается на этапе плана (stdlib `net/http` с `ServeMux` достаточно для старта); без согласования не добавлять.

---

## Чеклист

### Структура
- [ ] `main.go` тонкий (≤ 15 строк), сборка в `internal/app/`
- [ ] `domain/` без импортов из `repository`, `transport`
- [ ] `dto/` только в `transport`
- [ ] Доменные ошибки в `domain/errors.go`, коды совместимы с `ApiError` прототипа

### Инициализация
- [ ] `config.Validate()` на старте
- [ ] Go 1.26 в `go.mod`

### API и транспорт
- [ ] `request_id` в middleware, пробрасывается в slog
- [ ] `tenant_id` из токена в `ctx`, все запросы к БД фильтруют по нему
- [ ] Идемпотентность мутаций с деньгами (Idempotency-Key + storage, см. `money.md`)
- [ ] `context.WithTimeout` на внешних вызовах (платёжный шлюз, SMS)

### Outbox (если есть исходящие события)
- [ ] Таблица `outbox_events` + relay-воркер
- [ ] Обработчик входящих webhook идемпотентный (dedup по id события)

### Observability и безопасность
- [ ] slog структурный, без PII и данных карт, с `request_id`
- [ ] RED-метрики на каждом handler
- [ ] Dockerfile: multi-stage, distroless nonroot, `CGO_ENABLED=0`
- [ ] `govulncheck ./...` в CI
- [ ] CI: fmt → vet → lint → test -race → vuln → build
