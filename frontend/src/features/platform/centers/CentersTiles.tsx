import { useTranslation } from 'react-i18next'
import type { CentersPage } from './api/types'
import { StatTile } from '@/components/StatTile'
import { formatNumber } from '@/lib/format'

/** Плитки реестра (PLT-CTR-010): всего на платформе, активные подписки, новые за месяц, в овердрафте. */
export function CentersTiles({ data }: { data: CentersPage | undefined }) {
  const { t } = useTranslation()
  const v = (n: number | undefined) => (n === undefined ? '—' : formatNumber(n))
  const overdraft = data?.tiles.overdraft
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatTile label={t('centers.tiles.total')} value={v(data?.platformTotal)} sub={t('centers.tiles.totalSub')} />
      <StatTile label={t('centers.tiles.subscriptions')} value={v(data?.tiles.activeSubs)} sub={t('centers.tiles.subscriptionsSub')} />
      <StatTile
        label={t('centers.tiles.newMonth')}
        value={data ? t('centers.tiles.newMonthValue', { count: data.tiles.newMonth }) : '—'}
        sub={t('centers.tiles.newMonthSub')}
        valueClassName="text-emerald-600"
      />
      <StatTile
        label={t('centers.tiles.overdraft')}
        value={v(overdraft)}
        sub={overdraft ? t('centers.tiles.overdraftSub') : t('centers.tiles.overdraftNone')}
        valueClassName={overdraft === undefined ? undefined : overdraft ? 'text-rose-600' : 'text-emerald-600'}
      />
    </div>
  )
}
