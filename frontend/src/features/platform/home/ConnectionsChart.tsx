/* Динамика подключений по месяцам (демо). Одна величина — одна ось: линия «выручки» прототипа делила ось с подключениями
   и не имела данных, поэтому не перенесена (выручка — в плитке KPI).
   Прогнозный месяц: светлее, с пунктирной обводкой и подписью «прогноз» в легенде и подсказке; значения продублированы скрытой таблицей. */
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { Panel } from '@/components/Panel'
import { formatNumber } from '@/lib/format'
import { CONNECTIONS_DEMO } from './home-demo'

type Point = (typeof CONNECTIONS_DEMO)[number]

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const { t } = useTranslation()
  const p = payload?.[0]?.payload as Point | undefined
  if (!active || !p) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-bold text-heading tabular-nums">{formatNumber(p.value)}</div>
      <div className="text-slate-500">
        {p.month}
        {p.forecast && ` · ${t('home.chart.forecastMark')}`}
      </div>
    </div>
  )
}

export function ConnectionsChart() {
  const { t } = useTranslation()
  return (
    <Panel className="flex flex-col p-6 lg:col-span-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-heading">{t('home.chart.title')}</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{t('home.chart.subtitle')}</p>
        </div>
        <ul className="flex items-center gap-4 text-xs text-slate-600">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-brand" aria-hidden />
            {t('home.chart.fact')}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs border border-dashed border-brand bg-indigo-300" aria-hidden />
            {t('home.chart.forecast')}
          </li>
        </ul>
      </div>

      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={CONNECTIONS_DEMO} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} className="[&_line]:stroke-slate-100" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ className: 'fill-slate-400 text-[11px]' }} />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
              tick={{ className: 'fill-slate-400 text-[10px]' }}
            />
            <Tooltip content={ChartTooltip} cursor={{ className: 'fill-slate-100/60' }} isAnimationActive={false} />
            <Bar dataKey="value" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {CONNECTIONS_DEMO.map(p => (
                <Cell
                  key={p.month}
                  className={p.forecast ? 'fill-indigo-300 stroke-brand' : 'fill-brand'}
                  strokeDasharray={p.forecast ? '3 2' : undefined}
                  strokeWidth={p.forecast ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* табличное представление тех же значений — для экранных чтецов */}
      <table className="sr-only">
        <caption>{t('home.chart.tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('home.chart.month')}</th>
            <th scope="col">{t('home.chart.value')}</th>
          </tr>
        </thead>
        <tbody>
          {CONNECTIONS_DEMO.map(p => (
            <tr key={p.month}>
              <td>{p.forecast ? `${p.month} (${t('home.chart.forecastMark')})` : p.month}</td>
              <td>{formatNumber(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
