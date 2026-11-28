// Package middleware — общие HTTP-перехватчики: request_id, восстановление после
// паники, структурное логирование (slog) и CORS для локального прототипа.
package middleware

import (
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/line/eduhub-backend/pkg/apierr"
)

// RequestIDKey — ключ request_id в контексте и заголовке.
const RequestIDKey = "request_id"

// RequestID присваивает каждому запросу идентификатор (из заголовка или новый).
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-Id")
		if id == "" {
			id = uuid.NewString()
		}
		c.Set(RequestIDKey, id)
		c.Header("X-Request-Id", id)
		c.Next()
	}
}

// Logger пишет структурную строку на каждый запрос с request_id (без PII).
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		slog.Info("http",
			"request_id", c.GetString(RequestIDKey),
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"dur_ms", time.Since(start).Milliseconds(),
		)
	}
}

// Recover ловит панику, логирует и отдаёт INTERNAL без утечки стека наружу.
func Recover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("panic recovered",
					"request_id", c.GetString(RequestIDKey),
					"error", r,
				)
				c.AbortWithStatusJSON(http.StatusInternalServerError, &apierr.Error{
					Code:    apierr.CodeInternal,
					Message: "Внутренняя ошибка сервера",
				})
			}
		}()
		c.Next()
	}
}

// RateLimit ограничивает число запросов с одного IP в минуту (фиксированное окно, в памяти экземпляра).
// Для публичных эндпоинтов (/auth/*, /catalog/*): защита от перебора и спама (security.md, ADR 0023).
// При нескольких экземплярах выносится в Redis — пока достаточно памяти процесса.
func RateLimit(perMinute int) gin.HandlerFunc {
	type bucket struct {
		count int
		reset time.Time
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()
		mu.Lock()
		b := buckets[ip]
		if b == nil || now.After(b.reset) {
			b = &bucket{reset: now.Add(time.Minute)}
			buckets[ip] = b
		}
		b.count++
		over := b.count > perMinute
		if len(buckets) > 10000 { // периодическая чистка истёкших окон
			for k, v := range buckets {
				if now.After(v.reset) {
					delete(buckets, k)
				}
			}
		}
		mu.Unlock()
		if over {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, &apierr.Error{
				Code:    apierr.CodeLocked,
				Message: "Слишком много запросов, повторите позже",
			})
			return
		}
		c.Next()
	}
}

// CORS разрешает запросы с file://-прототипа (Origin: null) и localhost.
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id, Idempotency-Key")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
