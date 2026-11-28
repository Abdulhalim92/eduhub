/* Демо-режим (VITE_API_MODE ≠ http), тесты и e2e: REST-запросы RTK Query обслуживает mock прототипа в памяти страницы.
   Маршруты — те же, что у сервера (backend/, ветка dev) и в таблице «метод → REST» шапки mock; ответ — JSON, ошибка — {code, message, fields}.
   Без service worker: демо работает и на телефоне по http://<ip>. Маршрута нет — 404, как у сервера (экран покажет «не подключено»). */
import { api as mock, ApiError as MockApiError } from '@/api/mock/prototype-api'

type Ctx = { params: Record<string, string>; query: URLSearchParams; body: Record<string, unknown>; authorization: string }
type Handler = (ctx: Ctx) => unknown
// mock без типов (@ts-nocheck), вызовы проверяет контракт endpoints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = mock as any

const STATUS: Record<string, number> = { VALIDATION: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, LOCKED: 429 }

const num = (q: URLSearchParams, key: string) => (q.has(key) && q.get(key) !== '' ? Number(q.get(key)) : undefined)
const str = (q: URLSearchParams, key: string) => q.get(key) ?? undefined
const id = (ctx: Ctx) => Number(ctx.params.id)

const routes: [method: string, path: string, handler: Handler][] = [
  // вход и заявка центра
  ['POST', '/auth/login', ({ body }) => m.auth.login(body)],
  ['POST', '/auth/password', ({ body }) => m.auth.changePassword(body)],
  // вход по SMS-коду (SYS-ACC-030): выбор членства — с токеном выбора в Authorization
  ['POST', '/auth/otp/request', ({ body }) => m.auth.otpRequest(body)],
  ['POST', '/auth/otp/verify', ({ body }) => m.auth.otpVerify(body)],
  ['POST', '/auth/membership', ({ body, authorization }) => m.auth.selectMembership(body, authorization)],
  ['POST', '/applications', ({ body }) => m.applications.submit(body)],
  // справочники и сводка
  ['GET', '/dictionaries', () => m.dictionaries.get()],
  ['GET', '/platform/attention', () => m.platform.attention()],
  // центры
  [
    'GET',
    '/centers',
    ({ query: q }) =>
      m.centers.list({ q: str(q, 'q'), plan: str(q, 'plan'), city: str(q, 'city'), filter: str(q, 'filter'), page: num(q, 'page'), pageSize: num(q, 'pageSize') }),
  ],
  ['GET', '/centers/activity', ({ query }) => m.centers.recentActivity({ limit: num(query, 'limit') })],
  ['GET', '/centers/expiring', ({ query }) => m.centers.expiring({ withinDays: num(query, 'withinDays') })],
  ['GET', '/centers/churn', ({ query }) => m.centers.churn({ filter: str(query, 'filter') })],
  ['POST', '/centers/remind', ({ body }) => m.centers.remind(body)],
  ['POST', '/centers/offers', ({ body }) => m.centers.sendOffer(body)],
  ['POST', '/centers/:id/invoice', ctx => m.centers.invoice(id(ctx))],
  ['PUT', '/centers/:id/manager', ctx => m.centers.setManager(id(ctx), ctx.body)],
  ['POST', '/centers/:id/contact', ctx => m.centers.markContacted(id(ctx))],
  ['POST', '/centers/:id/admin-access', ctx => m.centers.adminAccess(id(ctx), ctx.body)],
  ['GET', '/centers/:id/plan-change', ctx => m.centers.planChangeInfo(id(ctx))],
  ['POST', '/centers/:id/plan-change', ctx => m.centers.requestPlanChange(id(ctx), ctx.body)],
  // финансы и счета
  ['GET', '/centers/:id/finance', ctx => m.finance.get(id(ctx))],
  ['POST', '/centers/:id/balance/top-up', ctx => m.finance.topUp(id(ctx), ctx.body)],
  ['PUT', '/centers/:id/overdraft', ctx => m.finance.setOverdraft(id(ctx), ctx.body)],
  ['GET', '/billing/invoices/:id', ({ params }) => m.billing.get(params.id)],
  ['POST', '/billing/invoices/:id/confirm', ({ params, body }) => m.billing.confirmPayment(params.id, body)],
  ['POST', '/billing/invoices/:id/cancel', ({ params, body }) => m.billing.cancel(params.id, body)],
  ['POST', '/billing/invoices/:id/pay-online', ({ params }) => m.billing.simulateOnlinePayment(params.id)],
  ['POST', '/billing/invoices/:id/pay-from-balance', ({ params }) => m.billing.payFromBalance(params.id)],
  // SMS, тарифы, модерация, поддержка, кабинет
  ['GET', '/sms/packages', () => m.sms.packages()],
  ['POST', '/sms/sales', ({ body }) => m.sms.accrue(body)],
  [
    'GET',
    '/plans/near-limit',
    ({ query: q }) =>
      m.plans.nearLimit({ threshold: num(q, 'threshold'), metric: str(q, 'metric'), q: str(q, 'q'), plan: str(q, 'plan'), status: str(q, 'status'), sort: str(q, 'sort') }),
  ],
  ['GET', '/moderation', ({ query }) => m.moderation.list({ status: str(query, 'status') })],
  ['POST', '/moderation/:id/decision', ctx => m.moderation.decide(id(ctx), ctx.body)],
  ['POST', '/moderation/:id/requeue', ctx => m.moderation.requeue(id(ctx))],
  ['POST', '/support/sessions', ({ body }) => m.support.enter(body)],
  ['GET', '/cabinet/centers', () => m.cabinet.profileCenters()],
]

const compiled = routes.map(([method, path, handler]) => {
  const names: string[] = []
  const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, n: string) => (names.push(n), '([^/]+)'))}$`)
  return { method, re, names, handler }
})

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data ?? null), { status, headers: { 'Content-Type': 'application/json' } })

/** Путь относительно адреса api: /api/centers → /centers. */
const apiPath = (url: URL) => {
  const base = new URL(import.meta.env.VITE_API_URL ?? '/api', url.origin).pathname.replace(/\/$/, '')
  return (url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname).replace(/\/$/, '') || '/'
}

export async function mockFetch(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = apiPath(url)
  for (const r of compiled) {
    if (r.method !== request.method) continue
    const match = r.re.exec(path)
    if (!match) continue
    const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(match[i + 1])]))
    const text = request.method === 'GET' ? '' : await request.text()
    try {
      return json(await r.handler({ params, query: url.searchParams, body: text ? JSON.parse(text) : {}, authorization: request.headers.get('Authorization') ?? '' }))
    } catch (e) {
      if (e instanceof MockApiError) {
        const err = e as MockApiError & { code: string; fields: Record<string, string> }
        return json({ code: err.code, message: err.message, fields: err.fields }, STATUS[err.code] ?? 400)
      }
      return json({ code: 'INTERNAL', message: 'Внутренняя ошибка сервера' }, 500)
    }
  }
  return new Response('404 page not found', { status: 404 })
}
