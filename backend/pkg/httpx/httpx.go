// Package httpx — общие помощники transport-слоя: единый формат ответов об
// ошибках (совместимый с фронтовым ApiError) и разбор пагинации.
package httpx

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/line/eduhub-backend/pkg/apierr"
)

// DefaultPageSize и MaxPageSize ограничивают пагинацию списков.
const (
	DefaultPageSize = 10
	MaxPageSize     = 100
)

// Fail отправляет доменную ошибку в формате {code, message, fields}.
// Любая не-apierr ошибка превращается в INTERNAL без утечки деталей наружу.
func Fail(c *gin.Context, err error) {
	var ae *apierr.Error
	if errors.As(err, &ae) {
		c.JSON(ae.HTTPStatus(), ae)
		return
	}
	c.JSON(http.StatusInternalServerError, &apierr.Error{
		Code:    apierr.CodeInternal,
		Message: "Внутренняя ошибка сервера",
	})
}

// OK отправляет успешный ответ 200 с телом.
func OK(c *gin.Context, body any) {
	c.JSON(http.StatusOK, body)
}

// Page — разобранные параметры пагинации.
type Page struct {
	Page     int
	PageSize int
}

// Offset — сдвиг для SQL LIMIT/OFFSET.
func (p Page) Offset() int { return (p.Page - 1) * p.PageSize }

// ParsePage читает query-параметры page и pageSize с безопасными границами.
func ParsePage(c *gin.Context) Page {
	page := atoiDefault(c.Query("page"), 1)
	if page < 1 {
		page = 1
	}
	size := atoiDefault(c.Query("pageSize"), DefaultPageSize)
	if size < 1 {
		size = DefaultPageSize
	}
	if size > MaxPageSize {
		size = MaxPageSize
	}
	return Page{Page: page, PageSize: size}
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
