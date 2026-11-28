# Скелеты main.go и app.go

Путь модуля: `github.com/<org>/liniya/backend`; сервис один, `<service>` = `liniya`.

## cmd/<service>/main.go (тонкий)

```go
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/<org>/<service>/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := app.New().Run(ctx); err != nil {
		slog.Error("сервис завершился с ошибкой", "error", err)
		os.Exit(1)
	}
}
```

---

## internal/app/app.go (composition root)

```go
package app

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/<org>/<service>/internal/config"
	"github.com/<org>/<service>/internal/observability"
	"github.com/<org>/<service>/internal/repository/postgres"
	"github.com/<org>/<service>/internal/service"
	"github.com/<org>/<service>/internal/transport/http"
)

const shutdownTimeout = 30 * time.Second

type App struct{}

func New() *App { return &App{} }

func (a *App) Run(ctx context.Context) error {
	// 1. Конфиг
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("загрузка конфига: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return fmt.Errorf("невалидный конфиг: %w", err)
	}

	// 2. Logger
	setupLogger(cfg.Env)

	// 3. Observability
	shutdown, err := observability.Setup(ctx, cfg.ServiceName, cfg.OTelEndpoint)
	if err != nil {
		return fmt.Errorf("observability: %w", err)
	}
	defer shutdown(context.Background())

	// 4. PostgreSQL
	db, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("postgres: %w", err)
	}
	defer db.Close()

	// 5–6. Repos → Services
	repos    := postgres.NewRepositories(db)
	services := service.NewServices(repos)

	// 7. Transport
	httpServer := httptransport.NewServer(cfg.HTTPAddr, services)

	// 8. Запуск в errgroup
	g, gCtx := errgroup.WithContext(ctx)

	g.Go(func() error { return httpServer.ListenAndServe() })
	g.Go(func() error {
		<-gCtx.Done()
		return a.shutdown(httpServer, db)
	})

	return g.Wait()
}

func (a *App) shutdown(srv *http.Server, db *sqlx.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	slog.Info("завершение работы...")

	// Порядок важен: сначала HTTP, потом БД
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("ошибка остановки HTTP", "error", err)
	}
	db.Close()

	slog.Info("сервис остановлен")
	return nil
}

func setupLogger(env string) {
	level := slog.LevelInfo
	opts := &slog.HandlerOptions{Level: level}

	var handler slog.Handler
	if env == "local" {
		handler = slog.NewTextHandler(os.Stderr, opts)
	} else {
		handler = slog.NewJSONHandler(os.Stderr, opts)
	}
	slog.SetDefault(slog.New(handler))
}
```

---

## internal/config/config.go

```go
package config

import (
	"errors"
	"os"
)

type Config struct {
	Env          string // local | dev | prod
	ServiceName  string
	HTTPAddr     string
	DatabaseURL  string
	OTelEndpoint string
}

func Load() (*Config, error) {
	return &Config{
		Env:         getEnv("ENV", "local"),
		ServiceName: getEnv("SERVICE_NAME", ""),
		HTTPAddr:    getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL: mustGetEnv("DATABASE_URL"),
		OTelEndpoint: getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
	}, nil
}

func (c *Config) Validate() error {
	var errs []error
	if c.ServiceName == "" {
		errs = append(errs, errors.New("SERVICE_NAME обязателен"))
	}
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL обязателен"))
	}
	return errors.Join(errs...)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("обязательная переменная окружения не задана: " + key)
	}
	return v
}
```

---

## internal/observability/setup.go

```go
package observability

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func Setup(ctx context.Context, serviceName, endpoint string) (func(context.Context) error, error) {
	exp, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
		)),
	)
	otel.SetTracerProvider(tp)

	return tp.Shutdown, nil
}
```
