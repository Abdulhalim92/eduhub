import type { CenterDto } from '@/features/centers/api/types'

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

/** Страница реестра для экрана. */
export interface CentersPage {
  items: CenterDto[]
  total: number
  platformTotal: number
  /** Плитки над реестром. */
  tiles: CentersList['meta']
}
