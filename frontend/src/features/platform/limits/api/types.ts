import type { CenterDto } from '@/features/centers/api/types'
import type { PlanOption } from '@/features/plans/api/types'

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
