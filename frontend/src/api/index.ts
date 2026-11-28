/* Единственная точка доступа экранов к данным. Сейчас за ней mock из прототипа (в памяти страницы, сбрасывается при перезагрузке);
   при подключении бэкенда меняется только этот файл — экраны и хуки запросов остаются прежними. */
import type { Api, ApiErrorShape } from './contract'
import { api as mockApi, ApiError as MockApiError, apiConfig } from './mock/prototype-api'

export const api = mockApi as unknown as Api

/** Задержка имитации сети, мс (в тестах — 0). */
export { apiConfig }

export const isApiError = (e: unknown): e is ApiErrorShape => e instanceof MockApiError

/** Текст ошибки для пользователя: сообщение сервера или общий текст при сбое сети. */
export const errorMessage = (e: unknown, fallback: string) => (isApiError(e) ? e.message : fallback)

export type * from './contract'
