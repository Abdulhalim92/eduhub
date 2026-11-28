/* «Риск оттока» (PLT-DSH-020): центры, не заходившие больше 10 дней, по убыванию риска. Прототип: src/js/views/platform/churn.js.
   Оценку и уровень риска считает сервер (riskScore, riskLevel); экран показывает факты из DTO как причины.
   Главное действие — «Связались» (у центра с контактом всегда есть менеджер — правило в api). Быстрый фильтр и уровень — в адресе. */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import type { CenterDto, RiskLevel } from '@/features/centers/api/types'
import type { ChurnFilter } from '@/features/platform/churn/api/types'
import { isShowingPrevious } from '@/api/query-state'
import { useGetDictionariesQuery } from '@/features/dictionaries/api/dictionariesApi'
import { FilterChip, FilterSelect } from '@/components/filters'
import { Fact, ListEmpty, ListSkeleton } from '@/components/list-states'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Panel } from '@/components/Panel'
import { ProgressBar } from '@/components/ProgressBar'
import { QueryError } from '@/components/QueryError'
import { RowActions, type RowAction } from '@/components/RowActions'
import { StatTile } from '@/components/StatTile'
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge'
import { dataTableClass } from '@/components/table-styles'
import { Button } from '@/components/ui/button'
import { compact, useCenterActions } from '@/features/centers/use-center-actions'
import { expiryLabel } from '@/features/centers/expiry-label'
import { useLoginLabel } from '@/features/centers/use-login-label'
import { formatMoney, formatNumber } from '@/lib/format'
import { PAGE_SIZE } from '@/lib/pager'
import { paginate, useUrlFilters } from '@/lib/use-url-filters'
import { MQ, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { useGetChurnQuery, useMarkCenterContactedMutation, useSetCenterManagerMutation } from './api/churnApi'

const CHIPS = ['all', 'nomanager', 'contacted'] as const satisfies readonly ChurnFilter[]
const LEVELS = ['high', 'medium', 'low'] as const satisfies readonly RiskLevel[]
const RISK_TONE: Record<RiskLevel, { badge: BadgeTone; bar: string; text: string }> = {
  high: { badge: 'rose', bar: 'bg-rose-500', text: 'text-rose-600' },
  medium: { badge: 'amber', bar: 'bg-amber-500', text: 'text-amber-600' },
  low: { badge: 'slate', bar: 'bg-slate-400', text: 'text-slate-500' },
}

export function ChurnScreen() {
  const { t } = useTranslation()
  const f = useUrlFilters({ filter: 'all', risk: 'all' }, { filter: CHIPS, risk: ['all', ...LEVELS] })
  const filter = f.values.filter as ChurnFilter
  const risk = f.values.risk
  const query = useGetChurnQuery(filter)
  const data = query.data
  const managers = useGetDictionariesQuery().data?.managers ?? []
  const actions = useCenterActions()
  const [setCenterManager, managerState] = useSetCenterManagerMutation()
  const [markCenterContacted, contact] = useMarkCenterContactedMutation()
  const contactingId = contact.isLoading ? contact.originalArgs : undefined
  const fail = (e: unknown) => toast.error(errorMessage(e, t('common.saveError')))
  const wide = useMediaQuery(MQ.xl)

  const filtered = (data?.items ?? []).filter(c => risk === 'all' || c.riskLevel === risk)
  const pageData = paginate(filtered, f.page, PAGE_SIZE)

  const changeManager = (c: CenterDto, manager: string | null) =>
    setCenterManager({ centerId: c.id, manager })
      .unwrap()
      .then(() => toast.success(manager ? t('churn.managerSet', { manager, name: c.name }) : t('churn.managerCleared', { name: c.name })), fail)
  const markContacted = (c: CenterDto) =>
    markCenterContacted(c.id)
      .unwrap()
      .then(() => toast.success(t('churn.contactedToast', { name: c.name })), fail)

  const primary = (c: CenterDto) =>
    c.contacted ? (
      <Button size="sm" variant="outline" disabled>
        {t('churn.contactedDone')}
      </Button>
    ) : (
      <Button size="sm" onClick={() => markContacted(c)} disabled={contactingId === c.id}>
        {t('churn.markContacted')}
      </Button>
    )
  const menu = (c: CenterDto): RowAction[] =>
    compact([actions.item.enter(c), actions.item.modules(c), actions.item.finance(c), actions.item.planChange(c)])
  const managerSelect = (c: CenterDto) => (
    <ManagerSelect c={c} managers={managers} disabled={managerState.isLoading && managerState.originalArgs?.centerId === c.id} onChange={m => changeManager(c, m)} />
  )

  let body: ReactNode
  if (query.error && !data) body = <QueryError error={query.error} onRetry={() => query.refetch()} />
  else if (!data) body = <ListSkeleton cards={!wide} />
  else if (!pageData.items.length) body = <ListEmpty text={t('churn.empty')} onReset={f.isFiltered() ? () => f.reset() : undefined} />
  else {
    const props = { items: pageData.items, primary, menu, managerSelect }
    body = wide ? <ChurnTable {...props} /> : <ChurnCards {...props} />
  }

  const meta = data?.meta
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('churn.title')} subtitle={t('churn.subtitle')} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {meta ? (
          <>
            <StatTile
              label={t('churn.tiles.total')}
              value={formatNumber(meta.total)}
              sub={t('churn.tiles.totalSub', { pct: meta.activeCenters ? Math.round((meta.total / meta.activeCenters) * 100) : 0 })}
              valueClassName={meta.total ? 'text-amber-600' : undefined}
            />
            <StatTile
              label={t('churn.tiles.high')}
              value={formatNumber(meta.high)}
              sub={t('churn.tiles.highSub')}
              valueClassName={meta.high ? 'text-rose-600' : undefined}
            />
            <StatTile label={t('churn.tiles.mrr')} value={formatMoney(meta.mrrAtRisk)} sub={t('churn.tiles.mrrSub')} />
            <StatTile
              label={t('churn.tiles.noManager')}
              value={formatNumber(meta.withoutManager)}
              sub={meta.withoutManager ? t('churn.tiles.noManagerSub') : t('churn.tiles.allAssigned')}
              valueClassName={meta.withoutManager ? 'text-rose-600' : undefined}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)
        )}
      </div>
      <Panel className="flex min-h-96 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('churn.quick')}>
            {CHIPS.map(chip => (
              <FilterChip key={chip} active={filter === chip} onClick={() => f.set('filter', chip)}>
                {t(`churn.chips.${chip}`, { count: meta ? (chip === 'all' ? meta.total : chip === 'nomanager' ? meta.withoutManager : meta.contacted) : 0 })}
              </FilterChip>
            ))}
          </div>
          <FilterSelect label={t('churn.risk')} value={risk} onChange={v => f.set('risk', v)}>
            <option value="all">{t('churn.riskAny')}</option>
            {LEVELS.map(l => (
              <option key={l} value={l}>
                {t(`churn.levels.${l}`)}
              </option>
            ))}
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
            note={risk !== 'all' ? t('churn.totalByChip', { count: data.items.length }) : undefined}
            onPage={f.setPage}
          />
        )}
      </Panel>
      {actions.ui}
    </div>
  )
}

/* ---------- содержимое ячеек ---------- */

function Reasons({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  const r: string[] = [t('churn.reasons.days', { count: c.loginDays })]
  if (c.lessons7d === 0) r.push(t('churn.reasons.noLessons'))
  else if (c.lessons7d < 5) r.push(t('churn.reasons.fewLessons'))
  if (c.isExpiring && c.expiresIn !== null) r.push(t('churn.reasons.expiring', { when: expiryLabel(t, c.expiresIn) }))
  return <div className="mt-1 text-[11px] text-amber-700">{r.join(' · ')}</div>
}

function CenterInfo({ c }: { c: CenterDto }) {
  return (
    <>
      <div className="font-semibold text-heading">{c.name}</div>
      <div className="text-[11px] text-slate-400">
        {c.owner} · <span className="whitespace-nowrap">{c.phone}</span>
      </div>
      <Reasons c={c} />
    </>
  )
}

function LastLogin({ c }: { c: CenterDto }) {
  const label = useLoginLabel()
  return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-amber-700">{label(c)}</span>
}

function RiskInfo({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  if (!c.riskLevel) return <span className="text-slate-400">—</span>
  const tone = RISK_TONE[c.riskLevel]
  return (
    <div className="w-36">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge tone={tone.badge}>{t(`churn.levels.${c.riskLevel}`)}</StatusBadge>
        <span className={cn('text-[11px] font-semibold tabular-nums', tone.text)}>{t('churn.score', { score: c.riskScore ?? 0 })}</span>
      </div>
      <ProgressBar pct={c.riskScore ?? 0} barClassName={tone.bar} />
    </div>
  )
}

function ManagerSelect({
  c,
  managers,
  disabled,
  onChange,
}: {
  c: CenterDto
  managers: string[]
  disabled: boolean
  onChange: (manager: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-start gap-1.5">
      <select
        value={c.manager ?? ''}
        disabled={disabled}
        aria-label={t('churn.managerFor', { name: c.name })}
        onChange={e => onChange(e.target.value || null)}
        className={cn(
          'w-full max-w-48 cursor-pointer rounded-xl border bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-brand focus:outline-none disabled:opacity-60',
          c.manager ? 'border-slate-200' : 'border-rose-300',
        )}
      >
        <option value="">{t('churn.noManager')}</option>
        {managers.map(m => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        {/* менеджер, которого уже нет в справочнике, — показать, а не подменять */}
        {c.manager && !managers.includes(c.manager) && <option value={c.manager}>{c.manager}</option>}
      </select>
      {c.contacted && <StatusBadge tone="emerald">{t('churn.contactedToday')}</StatusBadge>}
    </div>
  )
}

type ViewProps = {
  items: CenterDto[]
  primary: (c: CenterDto) => ReactNode
  menu: (c: CenterDto) => RowAction[]
  managerSelect: (c: CenterDto) => ReactNode
}

function Actions({ c, primary, menu }: { c: CenterDto } & Pick<ViewProps, 'primary' | 'menu'>) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-end gap-2">
      {primary(c)}
      <RowActions label={t('common.actionsFor', { name: c.name })} actions={menu(c)} />
    </div>
  )
}

function ChurnTable({ items, managerSelect, ...rest }: ViewProps) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto">
      <table className={dataTableClass}>
        <thead>
          <tr>
            <th scope="col">{t('churn.columns.center')}</th>
            <th scope="col">{t('churn.columns.lastLogin')}</th>
            <th scope="col" className="text-right whitespace-normal!">{t('churn.columns.lessons')}</th>
            <th scope="col">{t('churn.columns.risk')}</th>
            <th scope="col">{t('churn.columns.manager')}</th>
            <th scope="col" className="text-right">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {items.map(c => (
            <tr key={c.id} className="transition hover:bg-slate-50">
              <td className="min-w-56 py-3.5 whitespace-normal!">
                <CenterInfo c={c} />
              </td>
              <td className="py-3.5">
                <LastLogin c={c} />
              </td>
              <td className="py-3.5 text-right tabular-nums">{c.lessons7d}</td>
              <td className="py-3.5">
                <RiskInfo c={c} />
              </td>
              <td className="w-48 py-3.5">{managerSelect(c)}</td>
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

function ChurnCards({ items, managerSelect, ...rest }: ViewProps) {
  const { t } = useTranslation()
  return (
    <ul className="divide-y divide-slate-100 text-slate-700">
      {items.map(c => (
        <li key={c.id}>
          <article aria-label={c.name} className="flex flex-col gap-3 px-4 py-4 sm:px-6">
            <div className="text-xs">
              <CenterInfo c={c} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Fact label={t('churn.columns.risk')} className="col-span-2 sm:col-span-1">
                <RiskInfo c={c} />
              </Fact>
              <Fact label={t('churn.columns.lastLogin')}>
                <LastLogin c={c} />
              </Fact>
              <Fact label={t('churn.columns.lessons')}>
                <span className="tabular-nums">{c.lessons7d}</span>
              </Fact>
              <Fact label={t('churn.columns.manager')} className="col-span-2 sm:col-span-1">
                {managerSelect(c)}
              </Fact>
            </dl>
            <Actions c={c} {...rest} />
          </article>
        </li>
      ))}
    </ul>
  )
}
