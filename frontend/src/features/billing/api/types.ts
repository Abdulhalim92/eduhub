import type { TopUpPayload } from '@/features/finance/api/types'

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

/** Подтверждение поступления оплаты счёта вне системы (PLT-BIL-040): поля как у пополнения, сумма должна совпасть со счётом. */
export type ConfirmPaymentPayload = TopUpPayload
