/* Ошибка api в одном виде для всех экранов: {code, message, fields} — как отдаёт сервер (backend/pkg/apierr) и mock.
   Обычный объект, а не класс: RTK Query хранит ошибки в store, им нужна сериализуемость. */

export interface ApiError {
  /** VALIDATION, CONFLICT, NOT_FOUND, UNAUTHORIZED, FORBIDDEN, LOCKED, INTERNAL; на клиенте — NETWORK, NOT_IMPLEMENTED. */
  code: string
  /** Текст для пользователя (с сервера). */
  message: string
  /** Ошибки по полям формы: поле → сообщение. */
  fields: Record<string, string>
  /** HTTP-статус; 0 — ответа не было (сеть). */
  status: number
}

export const isApiError = (e: unknown): e is ApiError =>
  typeof e === 'object' && e !== null && typeof (e as ApiError).code === 'string' && typeof (e as ApiError).message === 'string'

/** Текст ошибки для пользователя: сообщение сервера или общий текст при сбое сети. */
export const errorMessage = (e: unknown, fallback: string) => (isApiError(e) && e.code !== 'INTERNAL' ? e.message : fallback)
