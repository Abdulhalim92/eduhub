import type { CenterStatus } from '@/features/centers/api/types'

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
