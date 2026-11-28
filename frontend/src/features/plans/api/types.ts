import type { InvoiceDto } from '@/features/billing/api/types'
import type { CenterDto, UsageItem } from '@/features/centers/api/types'

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
