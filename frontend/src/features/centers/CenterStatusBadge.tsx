/* Статус центра (прототип: ui.js centerStatus). Правило — из флагов DTO (status, isChurn), не пересчитывается здесь. */
import { useTranslation } from 'react-i18next'
import type { CenterDto } from '@/features/centers/api/types'
import { StatusBadge } from '@/components/StatusBadge'

export function CenterStatusBadge({ center }: { center: Pick<CenterDto, 'status' | 'isChurn'> }) {
  const { t } = useTranslation()
  if (center.status === 'blocked') return <StatusBadge tone="rose">{t('center.status.blocked')}</StatusBadge>
  if (center.isChurn) return <StatusBadge tone="amber">{t('center.status.churn')}</StatusBadge>
  return <StatusBadge tone="emerald">{t('center.status.active')}</StatusBadge>
}
