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
