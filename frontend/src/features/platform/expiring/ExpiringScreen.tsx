/* «Истекающие подписки» (PLT-DSH-030): центры платных тарифов, которым скоро продлевать подписку.
   Прототип: src/js/views/platform/expiring.js. Окно, тариф и счёт — в адресе; список приходит целиком, страницы по 10 — на клиенте.
   Главное действие строки — «Выставить счёт», а если счёт уже есть — «Подтвердить оплату» (после оплаты центр уходит из списка). */
import { Bell } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import type { CenterDto } from '@/features/centers/api/types'
import { isShowingPrevious } from '@/api/query-state'
import { FilterChip, FilterSelect } from '@/components/filters'
import { Fact, ListEmpty, ListSkeleton } from '@/components/list-states'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Panel } from '@/components/Panel'
import { QueryError } from '@/components/QueryError'
import { RowActions, type RowAction } from '@/components/RowActions'
import { StatTile } from '@/components/StatTile'
import { StatusBadge } from '@/components/StatusBadge'
import { dataTableClass } from '@/components/table-styles'
import { Button } from '@/components/ui/button'
import { compact, useCenterActions } from '@/features/centers/use-center-actions'
import { expiryLabel } from '@/features/centers/expiry-label'
import { formatDayFromNow, formatMoney, formatNumber } from '@/lib/format'
import { PAGE_SIZE } from '@/lib/pager'
import { paginate, useUrlFilters } from '@/lib/use-url-filters'
import { MQ, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { useGetExpiringQuery, useIssueRenewalInvoiceMutation, useRemindCentersMutation } from './api/expiringApi'

const WINDOWS = ['7', '14', '30'] as const
const INVOICE = ['all', 'yes', 'no'] as const

export function ExpiringScreen() {
  const { t } = useTranslation()
  const f = useUrlFilters({ days: '14', plan: 'all', inv: 'all' }, { days: WINDOWS, inv: INVOICE })
  const { days, plan, inv } = f.values
  const query = useGetExpiringQuery(Number(days))
  const data = query.data
  const actions = useCenterActions()
  const [remindCenters, { isLoading: reminding }] = useRemindCentersMutation()
  const [issueRenewalInvoice, issue] = useIssueRenewalInvoiceMutation()
  const issuingId = issue.isLoading ? issue.originalArgs : undefined
  const fail = (e: unknown) => toast.error(errorMessage(e, t('common.saveError')))
  const wide = useMediaQuery(MQ.xl)

  const plans = useMemo(() => [...new Set((data?.items ?? []).map(c => c.plan))], [data])
  const filtered = (data?.items ?? []).filter(
    c => (plan === 'all' || c.plan === plan) && (inv === 'all' || (inv === 'yes' ? !!c.invoice : !c.invoice)),
  )
  const pageData = paginate(filtered, f.page, PAGE_SIZE)
  const listFiltered = f.isFiltered(['plan', 'inv'])

  const remindAll = () => {
    const ids = (data?.items ?? []).filter(c => !c.reminded).map(c => c.id)
    if (!ids.length) return void toast(t('expiring.remindAllNone'))
    remindCenters(ids)
      .unwrap()
      .then(count => toast.success(t('expiring.remindAllDone', { count })), fail)
  }
  const remindOne = (c: CenterDto) =>
    remindCenters([c.id])
      .unwrap()
      .then(() => toast.success(t('expiring.remindDone', { name: c.name })), fail)
  const issueInvoice = (c: CenterDto) =>
    issueRenewalInvoice(c.id)
      .unwrap()
      .then(r => toast.success(t('expiring.issued', { id: r.invoice ?? '', name: c.name, amount: formatMoney(c.monthlyPrice) })), fail)

  const primary = (c: CenterDto) =>
    c.invoice ? (
      <Button size="sm" onClick={() => actions.confirmPayment(c.invoice)}>
        {t('expiring.confirmPayment')}
      </Button>
    ) : (
      <Button size="sm" variant="outline" onClick={() => issueInvoice(c)} disabled={issuingId === c.id}>
        {issuingId === c.id ? t('expiring.issuing') : t('expiring.issueInvoice')}
      </Button>
    )
  const menu = (c: CenterDto): RowAction[] =>
    compact([
      {
        label: t('expiring.remind'),
        hint: c.reminded ? t('expiring.remindedHint') : t('expiring.remindHint'),
        icon: Bell,
        disabled: c.reminded,
        onSelect: () => remindOne(c),
      },
      actions.item.finance(c),
      actions.item.planChange(c),
    ])

  let body: ReactNode
  if (query.error && !data) body = <QueryError error={query.error} onRetry={() => query.refetch()} />
  else if (!data) body = <ListSkeleton cards={!wide} />
  else if (!pageData.items.length)
    body = listFiltered ? <ListEmpty text={t('expiring.emptyFiltered')} onReset={() => f.reset(['plan', 'inv'])} /> : <ListEmpty text={t('expiring.emptyWindow')} />
  else body = wide ? <ExpiringTable items={pageData.items} primary={primary} menu={menu} /> : <ExpiringCards items={pageData.items} primary={primary} menu={menu} />

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('expiring.title')}
        subtitle={t('expiring.subtitle')}
        actions={
          <Button size="lg" onClick={remindAll} disabled={!data || reminding}>
            <Bell aria-hidden />
            {t('expiring.remindAll')}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {data ? (
          <>
            <StatTile
              label={t('expiring.tiles.within7')}
              value={formatNumber(data.meta.within7)}
              sub={t('expiring.tiles.within7Sub')}
              valueClassName={data.meta.within7 ? 'text-rose-600' : undefined}
            />
            <StatTile label={t('expiring.tiles.count')} value={formatNumber(data.meta.count)} sub={t('expiring.tiles.countSub', { days })} />
            <StatTile label={t('expiring.tiles.amount')} value={formatMoney(data.meta.amount)} sub={t('expiring.tiles.amountSub')} />
            <StatTile
              label={t('expiring.tiles.invoiced')}
              value={t('expiring.tiles.invoicedValue', { invoiced: data.meta.invoiced, count: data.meta.count })}
              sub={data.meta.expired ? t('expiring.tiles.expired', { count: data.meta.expired }) : t('expiring.tiles.noExpired')}
              subClassName={data.meta.expired ? 'font-medium text-rose-600' : undefined}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)
        )}
      </div>
      <Panel className="flex min-h-96 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('expiring.window')}>
            {WINDOWS.map(w => (
              <FilterChip key={w} active={days === w} onClick={() => f.set('days', w)}>
                {t('expiring.windowChip', { days: w })}
              </FilterChip>
            ))}
          </div>
          <FilterSelect label={t('expiring.plan')} value={plan} onChange={v => f.set('plan', v)}>
            <option value="all">{t('expiring.allPlans')}</option>
            {plans.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {/* тариф из ссылки, которого нет в окне, — показать выбранным, а не подменять */}
            {plan !== 'all' && !plans.includes(plan) && <option value={plan}>{plan}</option>}
          </FilterSelect>
          <FilterSelect label={t('expiring.invoice')} value={inv} onChange={v => f.set('inv', v)}>
            <option value="all">{t('expiring.invoiceAny')}</option>
            <option value="yes">{t('expiring.invoiceYes')}</option>
            <option value="no">{t('expiring.invoiceNo')}</option>
          </FilterSelect>
          {f.isFiltered() && (
            <button type="button" onClick={() => f.reset()} className="text-xs font-semibold text-brand hover:underline">
              {t('common.resetFilters')}
            </button>
          )}
        </div>
        <div className={cn('flex-1 transition-opacity', isShowingPrevious(query) && 'opacity-60')} aria-busy={query.isFetching}>
          {body}
        </div>
        {data && pageData.total > 0 && (
          <Pager
            page={pageData.page}
            total={pageData.total}
            note={listFiltered ? t('expiring.totalInWindow', { count: data.items.length }) : undefined}
            onPage={f.setPage}
          />
        )}
      </Panel>
      {actions.ui}
    </div>
  )
}

/* ---------- содержимое ячеек: одно и то же в таблице и карточке ---------- */

function CenterInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="font-semibold text-heading">{c.name}</div>
      <div className="text-[11px] text-slate-400">{t('centers.row.cityOwner', { city: c.city, owner: c.owner })}</div>
    </>
  )
}

function ExpiresInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  const d = c.expiresIn ?? 0
  return (
    <>
      <div className={cn('font-semibold', d < 0 ? 'text-rose-600' : d <= 7 ? 'text-amber-600' : 'text-slate-700')}>{expiryLabel(t, d)}</div>
      <div className="text-[11px] text-slate-400">{formatDayFromNow(d)}</div>
    </>
  )
}

function WorkInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={c.reminded ? 'emerald' : 'slate'}>{c.reminded ? t('expiring.reminded') : t('expiring.notReminded')}</StatusBadge>
      {c.invoice && <StatusBadge tone="indigo">{t('expiring.invoiceBadge', { id: c.invoice })}</StatusBadge>}
    </div>
  )
}

type ViewProps = { items: CenterDto[]; primary: (c: CenterDto) => ReactNode; menu: (c: CenterDto) => RowAction[] }

function Actions({ c, primary, menu }: { c: CenterDto } & Omit<ViewProps, 'items'>) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-end gap-2">
      {primary(c)}
      <RowActions label={t('common.actionsFor', { name: c.name })} actions={menu(c)} />
    </div>
  )
}

function ExpiringTable({ items, ...rest }: ViewProps) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto">
      <table className={dataTableClass}>
        <thead>
          <tr>
            <th scope="col">{t('expiring.columns.center')}</th>
            <th scope="col">{t('expiring.columns.plan')}</th>
            <th scope="col">{t('expiring.columns.expires')}</th>
            <th scope="col" className="text-right">{t('expiring.columns.amount')}</th>
            <th scope="col">{t('expiring.columns.work')}</th>
            <th scope="col" className="text-right">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {items.map(c => (
            <tr key={c.id} className="transition hover:bg-slate-50">
              <td className="min-w-40 py-3.5 whitespace-normal!">
                <CenterInfo c={c} />
              </td>
              <td className="py-3.5 font-medium text-slate-800">{c.plan}</td>
              <td className="py-3.5">
                <ExpiresInfo c={c} />
              </td>
              <td className="py-3.5 text-right font-semibold text-heading tabular-nums">{formatMoney(c.monthlyPrice)}</td>
              <td className="max-w-56 py-3.5 whitespace-normal!">
                <WorkInfo c={c} />
              </td>
              <td className="py-3.5 text-right">
                <Actions c={c} {...rest} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExpiringCards({ items, ...rest }: ViewProps) {
  const { t } = useTranslation()
  return (
    <ul className="divide-y divide-slate-100 text-slate-700">
      {items.map(c => (
        <li key={c.id}>
          <article aria-label={c.name} className="flex flex-col gap-3 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3 text-xs">
              <div className="min-w-0">
                <CenterInfo c={c} />
              </div>
              <div className="shrink-0 text-right">
                <ExpiresInfo c={c} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Fact label={t('expiring.columns.plan')}>
                <span className="font-medium text-slate-800">{c.plan}</span>
              </Fact>
              <Fact label={t('expiring.columns.amount')}>
                <span className="font-semibold text-heading tabular-nums">{formatMoney(c.monthlyPrice)}</span>
              </Fact>
              <Fact label={t('expiring.columns.work')} className="col-span-2 sm:col-span-1">
                <WorkInfo c={c} />
              </Fact>
            </dl>
            <Actions c={c} {...rest} />
          </article>
        </li>
      ))}
    </ul>
  )
}
