import { useTranslation } from 'react-i18next'
import { StatTile } from '@/components/StatTile'
import { formatMoney, formatNumber } from '@/lib/format'
import { KPI_DEMO as k } from './home-demo'

const POSITIVE = 'font-medium text-emerald-600'

export function KpiTiles() {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatTile label={t('home.kpi.centers')} value={formatNumber(k.centers)} sub={t('home.kpi.centersSub', { count: k.centersNewMonth })} subClassName={POSITIVE} />
      <StatTile label={t('home.kpi.subscriptions')} value={formatNumber(k.subscriptions)} sub={t('home.kpi.subscriptionsSub', { pct: k.conversionPct })} />
      <StatTile label={t('home.kpi.revenue')} value={formatMoney(k.revenue)} sub={t('home.kpi.revenueSub', { pct: k.revenueGrowthPct })} subClassName={POSITIVE} />
      <StatTile
        label={t('home.kpi.sms')}
        value={t('common.count.pcs', { value: formatNumber(k.smsSent) })}
        sub={t('home.kpi.smsSub', { value: formatNumber(k.smsLeft) })}
      />
    </div>
  )
}
