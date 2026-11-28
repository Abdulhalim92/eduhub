/* Расстояние между точкой центра и точкой геокодера (BR-017: больше 150 м — «GPS расходится»).
   Считается на клиенте, потому что модератор правит координаты до отправки решения; сервер проверяет условия публикации сам. */
import type { CatalogDesc, GeoPoint } from '@/features/platform/moderation/api/types'

export const GPS_MISMATCH_M = 150
/** Минимальная длина описания RU и TJ для публикации (BR-017). */
export const DESC_MIN = 20

export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** «38.5601° N» */
export const formatCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`

/** Что мешает публикации (UX-подсказка до отправки; источник истины — api.moderation.decide). */
export function publishBlockers(desc: CatalogDesc, gpsOk: boolean): ('ru' | 'tj' | 'gps')[] {
  const b: ('ru' | 'tj' | 'gps')[] = []
  if (desc.ru.trim().length < DESC_MIN) b.push('ru')
  if (desc.tj.trim().length < DESC_MIN) b.push('tj')
  if (!gpsOk) b.push('gps')
  return b
}
