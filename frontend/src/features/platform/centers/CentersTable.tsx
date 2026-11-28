/* Реестр центров (PLT-CTR-010): таблица от 1280 px, на ноутбуках поуже, планшетах и телефонах — карточки с теми же данными и действиями.
   Все признаки — из DTO (isExpiring, financeStatus, staffPct …): правила живут в api, экран их не пересчитывает.
   «Действия» — главная кнопка и меню; их задаёт экран (только работающие действия). */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CenterDto } from '@/features/centers/api/types'
import type { CentersPage } from './api/types'
import { ProgressBar } from '@/components/ProgressBar'
import { QueryError } from '@/components/QueryError'
import { RowActions, type RowAction } from '@/components/RowActions'
import { StatusBadge } from '@/components/StatusBadge'
import { dataTableClass } from '@/components/table-styles'
import { CenterStatusBadge } from '@/features/centers/CenterStatusBadge'
import { expiryLabel } from '@/features/centers/expiry-label'
import { useLoginLabel } from '@/features/centers/use-login-label'
import { formatDay, formatMoney, formatNumber } from '@/lib/format'
import { MQ, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

const COLS = 8

/* ---------- содержимое ячеек: одно и то же в таблице и в карточке ---------- */

function NameInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  const loginLabel = useLoginLabel()
  const pc = c.pendingChange
  return (
    <>
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
    </>
  )
}

function PlanInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  const branches = c.usage.find(u => u.key === 'branches')
  return (
    <>
      <div className="font-medium text-slate-800">
        {c.plan}
        {!c.monthlyPrice && <span className="font-normal text-slate-400"> {t('centers.row.free')}</span>}
      </div>
      {branches && <div className="text-[11px] text-slate-400 tabular-nums">{t('centers.row.branches', { used: branches.used, limit: branches.limit })}</div>}
    </>
  )
}

function StaffInfo({ c }: { c: CenterDto }) {
  const [used, limit] = c.staff
  return (
    <>
      <div className={cn('font-medium tabular-nums', used >= limit ? 'text-amber-600' : 'text-slate-800')}>
        {used}/{limit}
      </div>
      <ProgressBar pct={c.staffPct} className="w-20" barClassName={c.staffPct >= 100 ? 'bg-rose-500' : c.staffPct >= 80 ? 'bg-amber-500' : 'bg-brand'} />
    </>
  )
}

function SmsInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  return (
    <span className={cn('tabular-nums', c.smsBalance ? 'text-slate-800' : 'text-slate-400')}>
      {c.smsBalance ? t('common.count.pcs', { value: formatNumber(c.smsBalance) }) : t('centers.row.smsNone')}
    </span>
  )
}

function BalanceInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  return (
    <>
      <div className={cn('font-semibold tabular-nums', c.balance < 0 ? 'text-rose-600' : 'text-heading')}>{formatMoney(c.balance)}</div>
      <div className="text-[11px] text-slate-400">{t('centers.row.available', { value: formatMoney(c.available) })}</div>
    </>
  )
}

function OverdraftInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  const pct = c.overdraftPct ?? 0
  return (
    <>
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
      {c.financeStatus !== 'ok' && (
        <div className="mt-1.5">
          <StatusBadge tone={c.financeStatus === 'critical' ? 'rose' : 'amber'} wrap>
            {c.financeStatus === 'critical' ? t('center.finance.critical') : t('center.finance.overdraft')}
          </StatusBadge>
        </div>
      )}
    </>
  )
}

function StatusInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  return (
    <>
      <CenterStatusBadge center={c} />
      {c.isExpiring && c.expiresIn !== null && (
        <div className={cn('mt-1 text-[11px]', c.expiresIn <= 3 ? 'text-rose-600' : 'text-amber-600')}>
          {t('centers.row.subscription', { value: expiryLabel(t, c.expiresIn) })}
        </div>
      )}
    </>
  )
}

type RowProps = { c: CenterDto; actions: RowAction[]; primary: ReactNode }

function Actions({ c, actions, primary }: RowProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-end gap-2">
      {primary}
      <RowActions label={t('common.actionsFor', { name: c.name })} actions={actions} />
    </div>
  )
}

/* ---------- таблица (от 1280 px) ---------- */

function CenterRow(p: RowProps) {
  const { c } = p
  return (
    <tr className="transition hover:bg-slate-50">
      <td className="min-w-36 py-4 whitespace-normal!">
        <NameInfo c={c} />
      </td>
      {/* «(бесплатно)» переносится на вторую строку — столбец не раздувает таблицу */}
      <td className="max-w-28 py-4 whitespace-normal!">
        <PlanInfo c={c} />
      </td>
      <td className="py-4">
        <StaffInfo c={c} />
      </td>
      <td className="py-4 text-right">
        <SmsInfo c={c} />
      </td>
      <td className="py-4 text-right">
        <BalanceInfo c={c} />
      </td>
      <td className="max-w-40 py-4 whitespace-normal!">
        <OverdraftInfo c={c} />
      </td>
      <td className="max-w-32 py-4 whitespace-normal!">
        <StatusInfo c={c} />
      </td>
      <td className="py-4 text-right">
        <Actions {...p} />
      </td>
    </tr>
  )
}

/* ---------- карточка (уже 1280 px) ---------- */

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="mb-1 text-[10px] font-semibold tracking-wide text-table-head-text uppercase">{label}</dt>
      <dd className="text-xs">{children}</dd>
    </div>
  )
}

function CenterCard(p: RowProps) {
  const { t } = useTranslation()
  const { c } = p
  return (
    <li>
      <article aria-label={c.name} className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-6">
        <div className="flex items-start justify-between gap-3 text-xs">
          <div className="min-w-0">
            <NameInfo c={c} />
          </div>
          <div className="shrink-0 text-right">
            <StatusInfo c={c} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          <Fact label={t('centers.columns.plan')}>
            <PlanInfo c={c} />
          </Fact>
          <Fact label={t('centers.columns.staff')}>
            <StaffInfo c={c} />
          </Fact>
          <Fact label={t('centers.columns.sms')}>
            <SmsInfo c={c} />
          </Fact>
          <Fact label={t('centers.columns.balance')}>
            <BalanceInfo c={c} />
          </Fact>
          <Fact label={t('centers.columns.overdraft')} className="col-span-2 sm:col-span-1">
            <OverdraftInfo c={c} />
          </Fact>
        </dl>
        <Actions {...p} />
      </article>
    </li>
  )
}

type Props = {
  data: CentersPage | undefined
  error: unknown
  isPending: boolean
  isRefreshing: boolean
  onRetry: () => void
  onReset: () => void
  actionsFor: (c: CenterDto) => RowAction[]
  /** Главное действие строки (ui-principles: одно главное + меню). */
  primaryFor: (c: CenterDto) => ReactNode
}

export function CentersTable(props: Props) {
  const wide = useMediaQuery(MQ.xl)
  return wide ? <TableView {...props} /> : <CardsView {...props} />
}

function Empty({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="py-14 text-center text-slate-400">
      <p>{t('centers.empty')}</p>
      <button type="button" onClick={onReset} className="mt-2 text-xs font-semibold text-brand hover:underline">
        {t('common.resetFilters')}
      </button>
    </div>
  )
}

function TableView({ data, error, isPending, isRefreshing, onRetry, onReset, actionsFor, primaryFor }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 overflow-x-auto">
      {/* ячейки чуть плотнее общего стиля: 8 столбцов должны поместиться на ноутбуке 1280 px */}
      <table
        className={cn(dataTableClass, '[&_td]:px-2.5 [&_th]:px-2.5', 'transition-opacity', isRefreshing && 'opacity-60')}
        aria-busy={isPending || isRefreshing}
      >
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
              <td colSpan={COLS}>
                <Empty onReset={onReset} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function CardsView({ data, error, isPending, isRefreshing, onRetry, onReset, actionsFor, primaryFor }: Props) {
  if (error && !data) return <QueryError error={error} onRetry={onRetry} />
  if (isPending || !data)
    return (
      <div className="flex flex-col gap-3 p-4 sm:p-6" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} data-testid="skeleton-row" className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  if (!data.items.length) return <Empty onReset={onReset} />
  return (
    <ul className={cn('flex-1 divide-y divide-slate-100 text-slate-700 transition-opacity', isRefreshing && 'opacity-60')} aria-busy={isRefreshing}>
      {data.items.map(c => (
        <CenterCard key={c.id} c={c} actions={actionsFor(c)} primary={primaryFor(c)} />
      ))}
    </ul>
  )
}
