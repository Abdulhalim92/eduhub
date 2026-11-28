/* Срок подписки словами (прототип: ui.js expiryLabel): «просрочено 2 дня», «сегодня», «через 5 дней». */
import type { TFunction } from 'i18next'

export const expiryLabel = (t: TFunction, d: number) =>
  d < 0 ? t('center.expiry.overdue', { count: -d }) : d === 0 ? t('center.expiry.today') : t('center.expiry.in', { count: d })
