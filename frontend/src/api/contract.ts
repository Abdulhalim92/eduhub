/* Контракт данных для экранов: типы ответов и методов api.
   Источник — шапка прототипа src/js/core/api.js (таблица «метод → REST»). Методы добавляются сюда по мере переноса экранов;
   в DTO описаны поля, которые читают перенесённые экраны (mock отдаёт больше). */

/* ---------- платформа ---------- */

/** GET /platform/attention — счётчики очередей «Требует внимания». */
export interface Attention {
  totalCenters: number
  /** Филиалы, ожидающие модерации каталога. */
  moderation: number
  /** Подписка истекает в ближайшие 14 дней (BR: isExpiring). */
  expiring: number
  expiring7: number
  /** Не заходили больше 10 дней (Churn Risk). */
  churn: number
  blocked: number
  /** Использование лимита тарифа ≥ 80 % (BR-021). */
  nearLimit: number
  /** Баланс на платформе ушёл в минус. */
  overdraft: number
  pendingInvoices: number
}

/* ---------- центры ---------- */

export type CenterStatus = 'active' | 'blocked'

/** Использование лимита тарифа: сотрудники, хранилище, филиалы. */
export interface UsageItem {
  key: 'staff' | 'storage' | 'branches'
  /** Подпись с сервера («Филиалы») — для отображения; в коде сравнивать по key. */
  label: string
  used: number
  limit: number
  pct: number
}

/** Открытый счёт на смену тарифа (тариф сменится после оплаты, BR-001; при отсрочке — уже сменён, ждёт оплаты, PLT-TRF-030). */
export interface PendingPlanChange {
  invoiceId: string
  planId: string
  planName: string
  amount: number
  deferred: boolean
  dueAt: string | null
  overdue: boolean
}

/** ok — баланс ≥ 0; overdraft — в минусе; critical — использовано ≥ 80 % лимита овердрафта. */
export type FinanceStatus = 'ok' | 'overdraft' | 'critical'

/** Центр в реестре и виджетах платформы. */
export interface CenterDto {
  id: number
  name: string
  city: string
  owner: string
  phone: string
  /** Название тарифа: «Старт», «Базовый», «Про», «Бизнес». */
  plan: string
  status: CenterStatus
  /** Дней с последнего входа (0 — сегодня). */
  loginDays: number
  /** Ещё ни разу не входили (новый центр). */
  neverLogged?: boolean
  /** Уроков за последние 7 дней. */
  lessons7d: number
  /** Дней до конца подписки: < 0 — просрочена, null — не истекает (бесплатный тариф). */
  expiresIn: number | null
  /** Баланс на платформе, сомони (может быть отрицательным — овердрафт). */
  balance: number
  overdraftLimit: number
  /** Сколько центр должен платформе (баланс ниже нуля), сомони. */
  overdraftUsed: number
  /** Доступно к расходу: баланс + лимит овердрафта (BR-005). */
  available: number
  /** Доля использованного овердрафта, %; null — овердрафт не предусмотрен. */
  overdraftPct: number | null
  financeStatus: FinanceStatus
  /** Цена тарифа в месяц; 0 — бесплатный. */
  monthlyPrice: number
  /** Остаток SMS во всех пакетах центра, шт. */
  smsBalance: number
  /** [занято, лимит] сотрудников. */
  staff: [number, number]
  staffPct: number
  usage: UsageItem[]
  pendingChange: PendingPlanChange | null
  /** Владельцу отправлено напоминание о продлении подписки. */
  reminded: boolean
  /** Номер открытого счёта на продление (PLT-DSH-030); null — не выставлен. */
  invoice: string | null
  /** Ответственный менеджер платформы (риск оттока). */
  manager: string | null
  /** Менеджер отметил контакт с центром. */
  contacted: boolean
  /** Оценка риска оттока 0–100 и уровень — считает сервер; null, если центр не в зоне риска. */
  riskScore: number | null
  riskLevel: RiskLevel | null
  /** Самый загруженный лимит (по нему центр «у лимита», BR-021). */
  worst: UsageItem
  /** Владельцу отправлено предложение перейти на тариф (PLT-TRF-040); снимается при смене тарифа. */
  offer: { planId: string; planName: string } | null
  isChurn: boolean
  isExpiring: boolean
  nearLimit: boolean
}

export type RiskLevel = 'high' | 'medium' | 'low'

/** GET /centers/expiring — подписки платных тарифов, истекающие в окне (PLT-DSH-030). */
export interface ExpiringList {
  items: CenterDto[]
  meta: { count: number; within7: number; amount: number; invoiced: number; expired: number }
}

export type ChurnFilter = 'all' | 'nomanager' | 'contacted'

/** GET /centers/churn — центры в зоне риска оттока, по убыванию риска (PLT-DSH-020). */
export interface ChurnList {
  items: CenterDto[]
  meta: { total: number; high: number; mrrAtRisk: number; withoutManager: number; contacted: number; activeCenters: number }
}

export type LimitMetric = 'any' | 'staff' | 'storage' | 'branches'
export type NearLimitStatus = 'all' | 'nooffer' | 'offered' | 'pending' | 'full'
export type NearLimitSort = 'usage' | 'potential' | 'name'

export interface NearLimitParams {
  /** Порог «у лимита» долей: 0.7 | 0.8 | 0.9 | 1 (BR-021). */
  threshold: number
  metric: LimitMetric
  q: string
  plan: string
  status: NearLimitStatus
  sort: NearLimitSort
}

/** Центр у лимита: тарифы выше текущего и рекомендуемый (самый дешёвый, где нагрузка ниже порога — считает сервер). */
export interface NearLimitEntry {
  center: CenterDto
  /** Только более дорогие тарифы. */
  options: PlanOption[]
  suggestion: { id: string; name: string; price: number; delta: number } | null
  /** Загрузка по выбранной метрике (any — самый загруженный лимит), %. */
  metricPct: number
}

/** GET /plans/near-limit — сводка (meta) по порогу без фильтров, список — с фильтрами. */
export interface NearLimitList {
  items: NearLimitEntry[]
  meta: { threshold: number; total: number; full: number; offered: number; withoutOffer: number; pending: number; potential: number }
}

/** Быстрые фильтры реестра (чипы). */
export type CenterFilter = 'all' | 'overdraft' | 'expiring' | 'churn' | 'blocked'

export interface CentersListParams {
  /** Поиск по названию, городу и владельцу. */
  q?: string
  /** Название тарифа или 'all'. */
  plan?: string
  city?: string
  filter?: CenterFilter
  page?: number
  pageSize?: number
}

export interface CentersList {
  items: CenterDto[]
  /** Сколько центров подходит под фильтры. */
  total: number
  page: number
  pageSize: number
  /** Всего центров на платформе (не только в реестре демо). */
  platformTotal: number
  meta: { activeSubs: number; newMonth: number; overdraft: number }
}

/* ---------- справочники ---------- */

export interface PlanSummary {
  id: string
  name: string
  price: number
  limits: { staff: number; storageGb: number; branches: number }
  modules: Record<'payroll' | 'inventory' | 'crm' | 'geo', boolean>
}

/* ---------- финансы центра: баланс на платформе, овердрафт, счета ---------- */

/** Канал поступления денег. bank/cash/card — вне системы (подтверждает SuperAdmin), online — шлюз, balance — списание с баланса. */
export type PayChannel = 'bank' | 'cash' | 'card' | 'online' | 'balance' | 'promo'

/** Запись журнала операций по балансу (PLT-BAL-060). Неизменяема (BR-010). */
export interface LedgerEntry {
  id: number
  centerId: number
  at: string
  type: 'topup' | 'charge'
  /** > 0 — пополнение, < 0 — списание. */
  amount: number
  balanceAfter: number
  /** Способ («Безнал (Р/С)») или «Списание с баланса на платформе». */
  method: string
  /** Документ-основание или назначение счёта. */
  reference: string
  comment: string
}

export type InvoiceKind = 'renewal' | 'plan_change' | 'course' | 'trial'
export type InvoiceStatus = 'pending' | 'paid' | 'trial' | 'cancelled'

/** Счёт платформы центру. «Просрочен» — признак открытого счёта, не статус (BR-003). */
export interface InvoiceDto {
  id: string
  centerId: number
  centerName: string
  kind: InvoiceKind
  purpose: string
  amount: number
  status: InvoiceStatus
  issuedAt: string
  dueAt: string | null
  overdue: boolean
  /** Дней до срока оплаты; null — без срока. */
  daysLeft: number | null
  daysOverdue: number
  /** Смена тарифа: с какого на какой (для kind = plan_change). */
  plan?: { fromName: string; fromExpiresIn: number | null; toId: string; toName: string } | null
  /** Тариф уже сменён до оплаты (отсрочка, PLT-TRF-030); отмена счёта вернёт прежний тариф. */
  deferred?: boolean
  /** Причина, с которой счёт выставлен. */
  reason: string
  /** Можно ли оплатить с баланса на платформе (BR-005, BR-012) и что будет после; null — счёт закрыт. */
  fromBalance: {
    balance: number
    overdraftLimit: number
    available: number
    after: number
    usesOverdraft: boolean
    possible: boolean
  } | null
}

/** GET /centers/{id}/finance — панель «Финансы центра». */
export interface CenterFinance {
  center: CenterDto
  /** Последние операции, от новых к старым. */
  ledger: LedgerEntry[]
  /** Открытые (неоплаченные) счета. */
  invoices: InvoiceDto[]
}

/** Подтверждение поступления оплаты счёта вне системы (PLT-BIL-040): поля как у пополнения, сумма должна совпасть со счётом. */
export type ConfirmPaymentPayload = TopUpPayload

/** Запись журнала аудита (неизменяема, BR-010). */
export interface AuditEntry {
  id: number
  at: string
  actor: { name: string; role: string }
  action: string
  entity: { type: string; id: number | string; name: string }
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string
}

/** Тариф-кандидат при смене тарифа центра (PLT-TRF-020). */
export interface PlanOption {
  id: string
  name: string
  price: number
  /** Разница в цене с текущим тарифом, сомони/мес. */
  delta: number
  limits: { staff: number; storageGb: number; branches: number }
  /** Использование лимитов на новом тарифе. */
  after: UsageItem[]
  /** Лимиты, которые центр превысит (BR-008: такой тариф недоступен). */
  exceeded: UsageItem[]
  fits: boolean
  /** Хватает «баланса + овердрафта», чтобы сразу списать оплату (BR-005). */
  payable: boolean
  balanceAfter: number
  recommended: boolean
}

/** GET /centers/{id}/plan-change */
export interface PlanChangeInfo {
  center: CenterDto
  options: PlanOption[]
  /** Открытый счёт на смену тарифа (BR-007: один на центр); пока он есть, новую смену начать нельзя. */
  pending: InvoiceDto | null
  history: AuditEntry[]
}

export interface PlanChangePayload {
  planId: string
  reason: string
  /** Сразу списать с баланса на платформе. */
  payFromBalance?: boolean
  /** Сменить сейчас, оплата позже (решение SuperAdmin, PLT-TRF-030); нужно deferConfirmed. */
  deferPayment?: boolean
  deferConfirmed?: boolean
}

/** invoice — выставлен счёт (тариф сменится после оплаты, BR-001); paid — списано с баланса и применено; deferred — применено с отсрочкой; applied — бесплатный тариф. */
export interface PlanChangeResult {
  mode: 'invoice' | 'paid' | 'deferred' | 'applied'
  center: CenterDto
  invoice: InvoiceDto | null
}

/** Пополнение: деньги уже поступили вне системы (PLT-BAL-030). Проверки — на сервере (BR-002). */
export interface TopUpPayload {
  method: string
  reference: string
  /** Целое число сомони; null — не заполнено. */
  receivedAmount: number | null
  /** YYYY-MM-DD, не в будущем. */
  receivedOn: string
  comment: string
  confirmed: boolean
}

/** Способ оплаты: подписи для формы подтверждения оплаты и пополнения. */
export interface PayMethod {
  method: string
  channel: PayChannel
  evidence: string
  docLabel: string
  docHint: string
}

export interface Dictionaries {
  cities: string[]
  directions: string[]
  managers: string[]
  payMethods: PayMethod[]
  /** Активные тарифы (архивные не входят). */
  plans: PlanSummary[]
}

/* ---------- SMS-пакеты (PLT-SMS) ---------- */

export interface SmsPackage {
  id: string
  sms: number
  price: number
  description: string
  active: boolean
  /** Продано пакетов и скольким центрам. */
  sold: number
  centers: number
}

/** balance — списать с баланса на платформе (BR-005); manual — деньги получены вне системы (BR-002); bonus — бесплатно с причиной (BR-011). */
export type SmsAccrueMode = 'balance' | 'manual' | 'bonus'

export interface SmsAccruePayload {
  centerId: number
  packageId: string
  mode: SmsAccrueMode
  /** manual: способ, документ, дата, сумма (= цене пакета), подтверждение. */
  method?: string
  reference?: string
  receivedOn?: string
  receivedAmount?: number
  confirmed?: boolean
  /** bonus: причина бесплатного начисления. */
  reason?: string
}

export interface SmsSale {
  id: string
  centerId: number
  /** Название центра. */
  center: string
  packageId: string
  sms: number
  remaining: number
  price: number
  boughtAt: string
  status: 'paid' | 'bonus'
  method: string
  reference: string
  reason: string
  low: boolean
  usedPct: number
}

/* ---------- вход и восстановление (SYS-ACC-010, SYS-ACC-030) ---------- */

/** Пользователь после входа. cabinet — есть веб-кабинет (владелец и администратор центра); остальные роли работают в мобильном приложении. */
export interface Session {
  login: string
  role: string
  roleLabel: string
  name: string
  centerId: number
  centerName: string
  /** Пароль временный — до входа его нужно сменить. */
  mustChange: boolean
  cabinet: boolean
}

/** Код восстановления отправлен (ответ одинаковый для любого логина). demoCode — только в моке, SMS-шлюза нет. */
export interface ResetRequested {
  expiresIn: number
  resendIn: number
  demoCode?: string
}

/* ---------- заявка центра на подключение (PLT-CTR-070) ---------- */

export interface CenterApplicationPayload {
  centerName: string
  city: string
  direction: string
  ownerName: string
  phone: string
  email: string
  comment: string
  consent: boolean
}

export interface CenterApplication {
  id: string
  status: 'new'
  createdAt: string
}

/* ---------- доступ ---------- */

/** Выданные данные для входа: пароль временный, показывается один раз и нигде не хранится в открытом виде (BR-025). */
export interface IssuedCredentials {
  login: string
  password: string
  mustChange: boolean
  /** Кому выданы (владелец центра). */
  name: string
  /** Доступ уже был — это сброс пароля, логин прежний. */
  hadAccess: boolean
}

/* ---------- кабинет центра ---------- */

/** Центр в переключателе кабинета (GET /cabinet/centers). logo — путь или URL (см. lib/assets). */
export interface CabinetCenter {
  id: number
  name: string
  city: string
  owner: string
  plan: string
  status: CenterStatus
  direction: string
  logo: string
}

export type GeoPoint = { lat: number; lng: number }
export type ModerationStatus = 'pending' | 'published' | 'returned' | 'rejected'
export type ModerationTab = 'pending' | 'processed'
export type ModerationDecision = 'published' | 'returned' | 'rejected'
export type CatalogDesc = { ru: string; tj: string; en: string }

/** Заявка на публикацию филиала в каталоге (PLT-MOD-010). */
export interface ModerationRequest {
  id: number
  centerId: number
  centerName: string
  branch: string
  address: string
  city: string
  district: string
  phone: string
  /** Когда отправлена — подпись с сервера («сегодня, 09:40»). */
  submitted: string
  submittedBy: string
  directions: string[]
  /** Точка, указанная центром. */
  gps: GeoPoint
  /** Точка по адресу (геокодер). */
  geo: GeoPoint
  desc: CatalogDesc
  status: ModerationStatus
  /** Причина возврата или отклонения. */
  reason: string
  gpsOk: boolean
  decidedAt?: string
}

export interface ModerationList {
  items: ModerationRequest[]
  meta: { pending: number; processed: number }
}

export interface ModerationDecisionPayload {
  decision: ModerationDecision
  /** Для «Вернуть» и «Отклонить» — от 5 символов (BR-017). */
  reason?: string
  desc: CatalogDesc
  gps: GeoPoint
  gpsConfirmed: boolean
}

/* ---------- методы ---------- */

export interface Api {
  auth: {
    /** POST /auth/login — UNAUTHORIZED (одно сообщение для логина и пароля), LOCKED (5 попыток), FORBIDDEN (доступ закрыт). */
    login(payload: { login: string; password: string }): Promise<Session>
    /** POST /auth/password — смена временного пароля; VALIDATION с fields.newPassword. */
    changePassword(payload: { login: string; password: string; newPassword: string }): Promise<Session>
    /** POST /auth/reset — отправить SMS-код; TOO_EARLY — повторно через 60 с. */
    requestReset(payload: { login: string }): Promise<ResetRequested>
    /** POST /auth/reset/confirm — VALIDATION с fields: code, newPassword. */
    confirmReset(payload: { login: string; code: string; newPassword: string }): Promise<{ ok: true; login: string }>
  }
  applications: {
    /** POST /applications — заявка центра; VALIDATION с fields: centerName, city, direction, ownerName, phone, email, consent. */
    submit(payload: CenterApplicationPayload): Promise<CenterApplication>
  }
  dictionaries: {
    /** GET /dictionaries */
    get(): Promise<Dictionaries>
  }
  platform: {
    /** GET /platform/attention */
    attention(): Promise<Attention>
  }
  centers: {
    /** GET /centers?q=&plan=&city=&filter=&page=&pageSize= */
    list(params?: CentersListParams): Promise<CentersList>
    /** GET /centers/activity?limit= — последние активные центры для главной. */
    recentActivity(params?: { limit?: number }): Promise<{ items: CenterDto[] }>
    /** GET /centers/expiring?withinDays= */
    expiring(params: { withinDays: number }): Promise<ExpiringList>
    /** GET /centers/churn?filter= */
    churn(params: { filter: ChurnFilter }): Promise<ChurnList>
    /** POST /centers/remind — напоминание владельцам о продлении. */
    remind(params: { ids: number[] }): Promise<{ updated: number }>
    /** POST /centers/{id}/invoice — счёт на продление; CONFLICT — счёт уже есть или открыт счёт на смену тарифа; VALIDATION — бесплатный тариф. */
    invoice(centerId: number): Promise<CenterDto>
    /** POST /centers/offers — предложение перейти на тариф; без planId — рекомендуемый. Пропускаются заблокированные, без тарифа выше и с открытым счётом. */
    sendOffer(params: { ids: number[]; planId?: string }): Promise<{ sent: number; skipped: number }>
    /** PUT /centers/{id}/manager — null снимает менеджера. */
    setManager(centerId: number, payload: { manager: string | null }): Promise<CenterDto>
    /** POST /centers/{id}/contact — менеджер связался с центром. */
    markContacted(centerId: number): Promise<CenterDto>
    /** POST /centers/{id}/admin-access — выдать или сбросить данные для входа владельца центра; основание ≥ 5 символов (SYS-ACC-020). */
    adminAccess(centerId: number, payload: { reason: string }): Promise<IssuedCredentials>
    /** GET /centers/{id}/plan-change */
    planChangeInfo(centerId: number): Promise<PlanChangeInfo>
    /** POST /centers/{id}/plan-change — VALIDATION с fields: plan, reason, payment; CONFLICT — уже есть счёт, тот же тариф, центр заблокирован. */
    requestPlanChange(centerId: number, payload: PlanChangePayload): Promise<PlanChangeResult>
  }
  finance: {
    /** GET /centers/{id}/finance */
    get(centerId: number): Promise<CenterFinance>
    /** POST /centers/{id}/balance/top-up — VALIDATION с fields: method, reference, receivedOn, receivedAmount, confirmed. */
    topUp(centerId: number, payload: TopUpPayload): Promise<CenterDto>
    /** PUT /centers/{id}/overdraft — VALIDATION с fields: limit (ниже использованного — BR-006), reason (BR-011). */
    setOverdraft(centerId: number, payload: { limit: number | null; reason: string }): Promise<CenterDto>
  }
  billing: {
    /** GET /billing/invoices/{id} */
    get(invoiceId: string): Promise<InvoiceDto>
    /** POST /billing/invoices/{id}/confirm — VALIDATION с fields: method, reference, receivedOn, receivedAmount, confirmed; CONFLICT — счёт уже закрыт. */
    confirmPayment(invoiceId: string, payload: ConfirmPaymentPayload): Promise<InvoiceDto>
    /** POST /billing/invoices/{id}/cancel — причина обязательна (BR-004, BR-011); отсроченная смена тарифа откатывается. */
    cancel(invoiceId: string, payload: { reason: string }): Promise<InvoiceDto>
    /** МОК платёжного шлюза: на проде это webhook шлюза, из интерфейса не вызывается (INT-PAY-010). */
    simulateOnlinePayment(invoiceId: string): Promise<InvoiceDto>
    /** POST /billing/invoices/{id}/pay-from-balance — в пределах «баланс + овердрафт» (BR-005); CONFLICT, если счёт закрыт или центр заблокирован. */
    payFromBalance(invoiceId: string): Promise<InvoiceDto>
  }
  sms: {
    /** GET /sms/packages */
    packages(): Promise<{ items: SmsPackage[]; meta: { total: number; revenue: number; low: number } }>
    /** POST /sms/sales — VALIDATION с fields: packageId, mode, method, reference, receivedOn, receivedAmount, confirmed, reason; CONFLICT — центр заблокирован (BR-012). */
    accrue(payload: SmsAccruePayload): Promise<SmsSale>
  }
  plans: {
    /** GET /plans/near-limit?threshold=&metric=&q=&plan=&status=&sort= */
    nearLimit(params: NearLimitParams): Promise<NearLimitList>
  }
  moderation: {
    /** GET /moderation?status= — pending: на проверке; processed: остальные. */
    list(params: { status: ModerationTab }): Promise<ModerationList>
    /** POST /moderation/{id}/decision — VALIDATION (условия публикации BR-017, причина), CONFLICT — заявка уже обработана. */
    decide(id: number, payload: ModerationDecisionPayload): Promise<ModerationRequest>
    /** POST /moderation/{id}/requeue — вернуть обработанную заявку в очередь. */
    requeue(id: number): Promise<ModerationRequest>
  }
  support: {
    /** POST /support/sessions — вход SuperAdmin в кабинет центра; пишется в журнал аудита (PLT-CTR-050, NFR-SEC-030). */
    enter(params: { centerId: number }): Promise<{ ok: true }>
  }
  cabinet: {
    /** GET /cabinet/centers — центры с профилем (переключатель кабинета в демо). */
    profileCenters(): Promise<{ items: CabinetCenter[] }>
  }
}

/** Ошибка api: код (VALIDATION, CONFLICT, NOT_FOUND …), сообщение для пользователя и ошибки по полям формы. */
export interface ApiErrorShape extends Error {
  code: string
  fields: Record<string, string>
}
