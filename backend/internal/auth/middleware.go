package auth

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/httpx"
)

// principalKey — ключ claims в gin-контексте.
const principalKey = "principal"

// Middleware проверяет Bearer-токен и кладёт claims в контекст.
func Middleware(tokens *TokenService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			httpx.Fail(c, apierr.New(apierr.CodeUnauthorized, "Требуется авторизация"))
			c.Abort()
			return
		}
		claims, err := tokens.Verify(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			httpx.Fail(c, err)
			c.Abort()
			return
		}
		c.Set(principalKey, claims)
		c.Next()
	}
}

// RequireRole пропускает только перечисленные роли (RBAC, security.md).
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		p, ok := Principal(c)
		if !ok || !allowed[p.Role] {
			httpx.Fail(c, apierr.New(apierr.CodeForbidden, "Недостаточно прав"))
			c.Abort()
			return
		}
		c.Next()
	}
}

// Principal возвращает claims текущего запроса.
func Principal(c *gin.Context) (*Claims, bool) {
	v, ok := c.Get(principalKey)
	if !ok {
		return nil, false
	}
	claims, ok := v.(*Claims)
	return claims, ok
}

// ActorFrom строит актора аудита из claims и метаданных запроса (IP, устройство).
func ActorFrom(c *gin.Context) audit.Actor {
	a := audit.Actor{
		IP:     c.ClientIP(),
		Device: c.Request.UserAgent(),
	}
	if p, ok := Principal(c); ok {
		a.Name = p.Name
		a.Role = RoleLabel(p.Role)
	}
	return a
}
