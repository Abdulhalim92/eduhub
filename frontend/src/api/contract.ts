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
  isChurn: boolean
  isExpiring: boolean
  nearLimit: boolean
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

/* ---------- методы ---------- */

export interface Api {
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
