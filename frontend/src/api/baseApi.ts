/* Один createApi на всё приложение. Запросы экранов к нему добавляются в их собственных файлах
   (features/<экран>/api/<экран>Api.ts → baseApi.injectEndpoints): новый маршрут сервера — новый endpoint в файле своего экрана.

   Источник данных задаёт VITE_API_MODE:
   - http — сервер «Линия» (backend/ ветки dev): VITE_API_URL, по умолчанию /api (Vite проксирует на :8080);
   - mock (по умолчанию) — те же REST-запросы обслуживает mock прототипа в памяти страницы (src/mocks/mock-fetch.ts):
     демо без сервера, тесты, e2e. Экраны и endpoints от режима не зависят. */
import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { clearSession, getToken } from '@/lib/session'
import type { ApiError } from './errors'

export const API_MODE: 'http' | 'mock' = import.meta.env.VITE_API_MODE === 'http' ? 'http' : 'mock'

const NOT_IMPLEMENTED = 'Раздел ещё не подключён к серверу'
const NETWORK = 'Нет связи с сервером. Проверьте соединение и повторите.'

/** Абсолютный адрес: в тестах (jsdom, Node fetch) относительный URL не принимается. */
const baseUrl = () => new URL(import.meta.env.VITE_API_URL ?? '/api', window.location.origin).toString().replace(/\/?$/, '/')

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/', // настоящий адрес подставляется в baseQuery: window ещё может быть недоступен при импорте модуля
  prepareHeaders: headers => {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
  // mock-режим: запрос не уходит в сеть, его обслуживает mock прототипа (импорт — только когда нужен)
  fetchFn: async (input, init) => {
    if (API_MODE === 'http') return fetch(input, init)
    const { mockFetch } = await import('@/mocks/mock-fetch')
    return mockFetch(input instanceof Request ? input : new Request(input, init))
  },
})

function toApiError(error: FetchBaseQueryError): ApiError {
  const { status } = error
  const body = ('data' in error && typeof error.data === 'object' && error.data !== null ? error.data : {}) as Partial<ApiError>
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') return { code: 'NETWORK', message: NETWORK, fields: {}, status: 0 }
  // ответ не JSON (например, «404 page not found» от gin) — смотрим на HTTP-статус
  const http = typeof status === 'number' ? status : 'originalStatus' in error ? error.originalStatus : 0
  if (typeof body.code === 'string' && typeof body.message === 'string') return { code: body.code, message: body.message, fields: body.fields ?? {}, status: http }
  // маршрута на сервере ещё нет (ответ gin «404 page not found» без тела ошибки)
  if (http === 404) return { code: 'NOT_IMPLEMENTED', message: NOT_IMPLEMENTED, fields: {}, status: http }
  return { code: 'INTERNAL', message: 'Внутренняя ошибка сервера', fields: {}, status: http }
}

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (args, api, extra) => {
  const req = typeof args === 'string' ? { url: args } : args
  const hadToken = !!getToken()
  const res = await rawBaseQuery({ ...req, url: baseUrl() + req.url.replace(/^\//, '') }, api, extra)
  if (!res.error) return { data: res.data }
  const error = toApiError(res.error)
  // токен истёк или отозван — сессия закончилась: на вход (неверный пароль при входе тоже 401, но токена тогда нет)
  if (error.code === 'UNAUTHORIZED' && hadToken) {
    clearSession()
    if (!window.location.pathname.startsWith('/login')) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
  }
  return { error }
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Center', 'Attention', 'Finance', 'Invoice', 'PlanChange', 'Sms', 'Moderation', 'Dictionaries', 'CabinetCenters'],
  // данные экрана свежие 30 с: переход туда-обратно не дёргает сервер
  refetchOnMountOrArgChange: 30,
  endpoints: () => ({}),
})

/** Теги, которые устаревают после операции с деньгами или тарифом центра: списки центров, сводка, финансы, счета, тариф, SMS. */
export const centerMoneyTags = (centerId: number) =>
  [
    { type: 'Center', id: 'LIST' },
    { type: 'Center', id: centerId },
    'Attention',
    { type: 'Finance', id: centerId },
    { type: 'PlanChange', id: centerId },
    'Invoice',
    'Sms',
    'CabinetCenters',
  ] as const

/** Списки центров и сводка «Требует внимания» (менеджер, контакт, напоминание, предложение). */
export const centerListTags = ['Attention', { type: 'Center', id: 'LIST' }] as const
