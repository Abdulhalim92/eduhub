import type { CenterDto } from '@/features/centers/api/types'

/** GET /centers/expiring — подписки платных тарифов, истекающие в окне (PLT-DSH-030). */
export interface ExpiringList {
  items: CenterDto[]
  meta: { count: number; within7: number; amount: number; invoiced: number; expired: number }
}
