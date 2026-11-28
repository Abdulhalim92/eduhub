/* Общее для всех запросов: ошибка api и текст ошибки для пользователя.
   Сами запросы — в api-папке своего экрана (features/<экран>/api/<экран>Api.ts) поверх baseApi. */
export { errorMessage, isApiError, type ApiError } from './errors'
