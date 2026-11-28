import type { CenterDto } from '@/features/centers/api/types'

export type ChurnFilter = 'all' | 'nomanager' | 'contacted'

/** GET /centers/churn — центры в зоне риска оттока, по убыванию риска (PLT-DSH-020). */
export interface ChurnList {
  items: CenterDto[]
  meta: { total: number; high: number; mrrAtRisk: number; withoutManager: number; contacted: number; activeCenters: number }
}
