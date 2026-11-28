export type GeoPoint = { lat: number; lng: number }

export type ModerationStatus = 'pending' | 'published' | 'returned' | 'rejected'

export type ModerationTab = 'pending' | 'processed'

export type ModerationDecision = 'published' | 'returned' | 'rejected'

export type CatalogDesc = { ru: string; tj: string; en: string }

/** Заявка на публикацию филиала в каталоге (PLT-MOD-010). */
export interface ModerationRequest {
  id: number
  centerId: number
  centerName: string
  branch: string
  address: string
  city: string
  district: string
  phone: string
  /** Когда отправлена — подпись с сервера («сегодня, 09:40»). */
  submitted: string
  submittedBy: string
  directions: string[]
  /** Точка, указанная центром. */
  gps: GeoPoint
  /** Точка по адресу (геокодер). */
  geo: GeoPoint
  desc: CatalogDesc
  status: ModerationStatus
  /** Причина возврата или отклонения. */
  reason: string
  gpsOk: boolean
  decidedAt?: string
}

export interface ModerationList {
  items: ModerationRequest[]
  meta: { pending: number; processed: number }
}

export interface ModerationDecisionPayload {
  decision: ModerationDecision
  /** Для «Вернуть» и «Отклонить» — от 5 символов (BR-017). */
  reason?: string
  desc: CatalogDesc
  gps: GeoPoint
  gpsConfirmed: boolean
}
