/* Таблица реестра центров (PLT-CTR-010). Все признаки — из DTO (isExpiring, financeStatus, staffPct …): правила живут в api, экран их не пересчитывает.
   «Действия» — главная кнопка и меню строки; их задаёт экран (только работающие действия). */
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CenterDto, CentersList } from '@/api'
import { ProgressBar } from '@/components/ProgressBar'
import { QueryError } from '@/components/QueryError'
import { RowActions, type RowAction } from '@/components/RowActions'
import { StatusBadge } from '@/components/StatusBadge'
import { dataTableClass } from '@/components/table-styles'
import { CenterStatusBadge } from '@/features/centers/CenterStatusBadge'
import { useLoginLabel } from '@/features/centers/use-login-label'
import { formatDay, formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const COLS = 8

const expiryLabel = (t: TFunction, d: number) =>
  d < 0 ? t('center.expiry.overdue', { count: -d }) : d === 0 ? t('center.expiry.today') : t('center.expiry.in', { count: d })

function NameCell({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  const loginLabel = useLoginLabel()
  const pc = c.pendingChange
  return (
    <td className="min-w-44 py-4 whitespace-normal!">
      <div className="font-semibold text-heading">{c.name}</div>
      <div className="text-[11px] text-slate-400">{t('centers.row.cityOwner', { city: c.city, owner: c.owner })}</div>
      <div className="text-[11px] text-slate-400">{t('centers.row.login', { value: loginLabel(c) })}</div>
      {pc && (
        <div className={cn('mt-0.5 text-[11px]', pc.deferred && pc.overdue ? 'font-medium text-rose-600' : 'text-amber-600')}>
          {!pc.deferred
            ? t('centers.row.planPending', { plan: pc.planName })
            : pc.overdue
              ? t('centers.row.planOverdue')
              : t('centers.row.planDueBy', { date: pc.dueAt ? formatDay(pc.dueAt) : '—' })}
        </div>
      )}
    </td>
  )
}

function PlanCell({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  const branches = c.usage.find(u => u.key === 'branches')
  return (
    <td className="py-4">
      <div className="font-medium text-slate-800">
        {c.plan}
        {!c.monthlyPrice && <span className="font-normal text-slate-400"> {t('centers.row.free')}</span>}
      </div>
      {branches && (
        <div className="text-[11px] text-slate-400 tabular-nums">{t('centers.row.branches', { used: branches.used, limit: branches.limit })}</div>
      )}
    </td>
  )
}

function StaffCell({ c }: { c: CenterDto }) {
  const [used, limit] = c.staff
  return (
    <td className="py-4">
      <div className={cn('font-medium tabular-nums', used >= limit ? 'text-amber-600' : 'text-slate-800')}>
        {used}/{limit}
      </div>
      <ProgressBar
        pct={c.staffPct}
        className="w-20"
        barClassName={c.staffPct >= 100 ? 'bg-rose-500' : c.staffPct >= 80 ? 'bg-amber-500' : 'bg-brand'}
      />
    </td>
  )
}

function OverdraftCell({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  const pct = c.overdraftPct ?? 0
  const badge =
    c.financeStatus === 'critical' ? (
      <StatusBadge tone="rose">{t('center.finance.critical')}</StatusBadge>
    ) : c.financeStatus === 'overdraft' ? (
      <StatusBadge tone="amber">{t('center.finance.overdraft')}</StatusBadge>
    ) : null
  return (
    <td className="py-4 whitespace-normal!">
      {!c.overdraftLimit ? (
        <div className="text-slate-400">{t('centers.row.overdraftNone')}</div>
      ) : !c.overdraftUsed ? (
        <>
          <div className="text-[11px] text-slate-500">{t('centers.row.overdraftLimit', { value: formatMoney(c.overdraftLimit) })}</div>
          <div className="text-[11px] text-slate-400">{t('centers.row.overdraftIdle')}</div>
        </>
      ) : (
        <>
          <div className={cn('text-[11px] font-semibold', pct >= 80 ? 'text-rose-600' : 'text-amber-600')}>
            {t('centers.row.overdraftUsed', { value: formatMoney(c.overdraftUsed) })}
          </div>
          <div className="text-[11px] text-slate-400">{t('centers.row.overdraftOf', { value: formatMoney(c.overdraftLimit) })}</div>
          <ProgressBar pct={pct} barClassName={pct >= 80 ? 'bg-rose-500' : 'bg-amber-500'} />
        </>
      )}
      {badge && <div className="mt-1.5">{badge}</div>}
    </td>
  )
}

function CenterRow({ c, actions, primary }: { c: CenterDto; actions: RowAction[]; primary: ReactNode }) {
  const { t } = useTranslation()
  return (
    <tr className="transition hover:bg-slate-50">
      <NameCell c={c} />
      <PlanCell c={c} />
      <StaffCell c={c} />
      <td className={cn('py-4 text-right tabular-nums', c.smsBalance ? 'text-slate-800' : 'text-slate-400')}>
        {c.smsBalance ? t('common.count.pcs', { value: formatNumber(c.smsBalance) }) : t('centers.row.smsNone')}
      </td>
      <td className="py-4 text-right">
        <div className={cn('font-semibold tabular-nums', c.balance < 0 ? 'text-rose-600' : 'text-heading')}>{formatMoney(c.balance)}</div>
        <div className="text-[11px] text-slate-400">{t('centers.row.available', { value: formatMoney(c.available) })}</div>
      </td>
      <OverdraftCell c={c} />
      <td className="max-w-32 py-4 whitespace-normal!">
        <CenterStatusBadge center={c} />
        {c.isExpiring && c.expiresIn !== null && (
          <div className={cn('mt-1 text-[11px]', c.expiresIn <= 3 ? 'text-rose-600' : 'text-amber-600')}>
            {t('centers.row.subscription', { value: expiryLabel(t, c.expiresIn) })}
          </div>
        )}
      </td>
      <td className="py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {primary}
          <RowActions label={t('common.actionsFor', { name: c.name })} actions={actions} />
        </div>
      </td>
    </tr>
  )
}

type Props = {
  data: CentersList | undefined
  error: unknown
  isPending: boolean
  isRefreshing: boolean
  onRetry: () => void
  onReset: () => void
  actionsFor: (c: CenterDto) => RowAction[]
  /** Главное действие строки (ui-principles: одно главное + меню). */
  primaryFor: (c: CenterDto) => ReactNode
}

export function CentersTable({ data, error, isPending, isRefreshing, onRetry, onReset, actionsFor, primaryFor }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 overflow-x-auto">
      <table className={cn(dataTableClass, 'min-w-208 transition-opacity', isRefreshing && 'opacity-60')} aria-busy={isPending || isRefreshing}>
        <thead>
          <tr>
            <th scope="col">{t('centers.columns.name')}</th>
            <th scope="col">{t('centers.columns.plan')}</th>
            <th scope="col" className="whitespace-normal!">{t('centers.columns.staff')}</th>
            <th scope="col" className="text-right whitespace-normal!">{t('centers.columns.sms')}</th>
            <th scope="col" className="text-right whitespace-normal!">{t('centers.columns.balance')}</th>
            <th scope="col">{t('centers.columns.overdraft')}</th>
            <th scope="col">{t('centers.columns.status')}</th>
            <th scope="col" className="text-right">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {error && !data ? (
            <tr>
              <td colSpan={COLS}>
                <QueryError error={error} onRetry={onRetry} />
              </td>
            </tr>
          ) : isPending || !data ? (
            Array.from({ length: 6 }, (_, i) => (
              <tr key={i} data-testid="skeleton-row">
                {Array.from({ length: COLS }, (_, j) => (
                  <td key={j} className="py-4">
                    <div className="h-3 animate-pulse rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.items.length ? (
            data.items.map(c => <CenterRow key={c.id} c={c} actions={actionsFor(c)} primary={primaryFor(c)} />)
          ) : (
            <tr>
              <td colSpan={COLS} className="py-14 text-center text-slate-400">
                <p>{t('centers.empty')}</p>
                <button type="button" onClick={onReset} className="mt-2 text-xs font-semibold text-brand hover:underline">
                  {t('common.resetFilters')}
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
