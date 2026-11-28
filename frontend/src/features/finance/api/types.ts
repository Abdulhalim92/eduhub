import type { InvoiceDto } from '@/features/billing/api/types'
import type { CenterDto } from '@/features/centers/api/types'

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

/** GET /centers/{id}/finance — панель «Финансы центра». */
export interface CenterFinance {
  center: CenterDto
  /** Последние операции, от новых к старым. */
  ledger: LedgerEntry[]
  /** Открытые (неоплаченные) счета. */
  invoices: InvoiceDto[]
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
