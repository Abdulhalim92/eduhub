/* Сообщение об оплате зависит от того, что оплатили (прототип: payments.js paidToast). */
import type { TFunction } from 'i18next'
import type { InvoiceDto } from '@/api'

export function paidMessage(t: TFunction, inv: InvoiceDto): string {
  if (inv.kind === 'plan_change' && inv.plan) return t('billing.paid.plan', { id: inv.id, name: inv.centerName, plan: inv.plan.toName })
  if (inv.kind === 'renewal') return t('billing.paid.renewal', { id: inv.id, name: inv.centerName })
  return t('billing.paid.other', { id: inv.id })
}
