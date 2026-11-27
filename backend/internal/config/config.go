// Package config читает конфигурацию приложения из переменных окружения.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config — все параметры запуска сервиса.
type Config struct {
	Env           string // dev | staging | production — влияет на диагностические логи
	Port          string
	DatabaseURL   string
	JWTSecret     string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration
	BcryptCost    int
}

// IsProd сообщает, что сервис запущен в продакшене (строгие логи без диагностических секретов).
func (c Config) IsProd() bool { return c.Env == "production" }

// Load собирает конфиг из окружения, подставляя безопасные для разработки значения.
// Для JWTSecret в проде секрет обязан прийти из окружения (см. security.md).
func Load() (Config, error) {
	cfg := Config{
		Env:           env("APP_ENV", "dev"),
		Port:          env("PORT", "8080"),
		DatabaseURL:   env("DATABASE_URL", "postgres://eduhub:eduhub@127.0.0.1:5433/eduhub?sslmode=disable"),
		JWTSecret:     env("JWT_SECRET", "dev-insecure-secret-change-me"),
		JWTAccessTTL:  envDuration("JWT_ACCESS_TTL", 15*time.Minute),
		JWTRefreshTTL: envDuration("JWT_REFRESH_TTL", 720*time.Hour),
		BcryptCost:    envInt("BCRYPT_COST", 12),
	}
	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("config: JWT_SECRET обязателен")
	}
	return cfg, nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func envDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}
