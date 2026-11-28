// Package apierr — доменные ошибки, которые зеркалят фронтовый ApiError
// ({code, message, fields}) и несут HTTP-статус. Источник истины по ошибкам — сервер.
package apierr

import "net/http"

// Коды ошибок совпадают с теми, что бросает mock-слой src/js/core/api.js.
const (
	CodeValidation   = "VALIDATION"
	CodeConflict     = "CONFLICT"
	CodeNotFound     = "NOT_FOUND"
	CodeUnauthorized = "UNAUTHORIZED"
	CodeForbidden    = "FORBIDDEN"
	CodeLocked       = "LOCKED"
	CodeInternal     = "INTERNAL"
)

// Error — доменная ошибка с кодом, сообщением и пофайловыми пояснениями (fields).
type Error struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

// New создаёт ошибку без привязки к полям.
func New(code, message string) *Error {
	return &Error{Code: code, Message: message}
}

// Validation — ошибка проверки полей формы (fields: поле → сообщение).
func Validation(message string, fields map[string]string) *Error {
	return &Error{Code: CodeValidation, Message: message, Fields: fields}
}

// Field — ошибка валидации одного поля.
func Field(message, field, hint string) *Error {
	return &Error{Code: CodeValidation, Message: message, Fields: map[string]string{field: hint}}
}

// Conflict — нарушение инварианта состояния (уже существует, недопустимый переход).
func Conflict(message string) *Error { return New(CodeConflict, message) }

// NotFound — объект не найден.
func NotFound(message string) *Error { return New(CodeNotFound, message) }

// HTTPStatus сопоставляет код ошибки с HTTP-статусом.
func (e *Error) HTTPStatus() int {
	switch e.Code {
	case CodeValidation:
		return http.StatusBadRequest
	case CodeConflict:
		return http.StatusConflict
	case CodeNotFound:
		return http.StatusNotFound
	case CodeUnauthorized:
		return http.StatusUnauthorized
	case CodeForbidden:
		return http.StatusForbidden
	case CodeLocked:
		return http.StatusTooManyRequests
	default:
		return http.StatusInternalServerError
	}
}
