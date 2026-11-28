/* «Центры у лимита» (PLT-TRF-040, BR-021): рабочее место менеджера по допродажам. Прототип: src/js/views/platform/limits.js.
   Слева список с фильтрами и массовым предложением, справа карточка выбранного центра; уже 1280 px карточка открывается панелью.
   Порог, метрика, тариф, статус, порядок, поиск и страница — в адресе. Правила (кто у лимита, рекомендуемый тариф, вместимость) — в api. */
import { useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage, type LimitMetric, type NearLimitEntry, type NearLimitSort, type NearLimitStatus, type PlanOption } from '@/api'
import { useSendOffer } from '@/api/mutations'
import { useDictionaries, useNearLimit } from '@/api/queries'
import { FilterChip, FilterSelect, SearchInput } from '@/components/filters'
import { ListEmpty, ListSkeleton } from '@/components/list-states'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Panel } from '@/components/Panel'
import { QueryError } from '@/components/QueryError'
import { StatTile } from '@/components/StatTile'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCenterActions } from '@/features/centers/use-center-actions'
import { formatMoney, formatNumber } from '@/lib/format'
import { PAGE_SIZE } from '@/lib/pager'
import { paginate, useUrlFilters } from '@/lib/use-url-filters'
import { MQ, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { LIMIT_TONE, limitLevel } from './limit-tone'
import { LimitDetail, UsagePill } from './LimitDetail'

const THRESHOLDS = ['70', '80', '90', '100'] as const
const METRICS = ['any', 'staff', 'storage', 'branches'] as const satisfies readonly LimitMetric[]
const STATUSES = ['all', 'nooffer', 'offered', 'pending', 'full'] as const satisfies readonly NearLimitStatus[]
const SORTS = ['usage', 'potential', 'name'] as const satisfies readonly NearLimitSort[]

export function LimitsScreen() {
  const { t } = useTranslation()
  const f = useUrlFilters(
    { th: '80', metric: 'any', plan: 'all', status: 'all', sort: 'usage', q: '' },
    { th: THRESHOLDS, metric: METRICS, status: STATUSES, sort: SORTS },
  )
  const v = f.values
  const thresholdPct = Number(v.th)
  const query = useNearLimit({
    threshold: thresholdPct / 100,
    metric: v.metric as LimitMetric,
    q: v.q,
    plan: v.plan,
    status: v.status as NearLimitStatus,
    sort: v.sort as NearLimitSort,
  })
  const data = query.data
  const plans = useDictionaries().data?.plans ?? []
  const actions = useCenterActions()
  const offer = useSendOffer()
  const wide = useMediaQuery(MQ.xl)

  const items = data?.items ?? []
  const ids = new Set(items.map(e => e.center.id))
  // отметки и выбор живут только для центров, которые остались в выдаче
  const [checkedRaw, setChecked] = useState<Set<number>>(new Set())
  const checked = new Set([...checkedRaw].filter(id => ids.has(id)))
  const [selRaw, setSel] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const selId = selRaw !== null && ids.has(selRaw) ? selRaw : wide ? (items[0]?.center.id ?? null) : null
  const selected = items.find(e => e.center.id === selId) ?? null
  const [picked, setPicked] = useState<Record<number, string>>({})
  const pickedOf = (e: NearLimitEntry): PlanOption | null =>
    e.options.find(o => o.id === picked[e.center.id]) ?? e.options.find(o => o.recommended) ?? e.options[0] ?? null

  const pageData = paginate(items, f.page, PAGE_SIZE)
  // порог и метрика меняют смысл выборки — отметки сбрасываются (прототип)
  const setFilter = (key: Parameters<typeof f.set>[0], value: string) => {
    if (key === 'th' || key === 'metric') setChecked(new Set())
    f.set(key, value)
  }

  const open = (id: number) => {
    setSel(id)
    if (!wide) setSheetOpen(true)
  }
  const toggle = (id: number, on: boolean) =>
    setChecked(prev => {
      const next = new Set([...prev].filter(x => ids.has(x)))
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const sendBulk = () =>
    offer.mutate(
      { ids: [...checked] },
      {
        onSuccess: r => {
          toast.success(r.skipped ? t('limits.bulkSkipped', { sent: r.sent, skipped: r.skipped }) : t('limits.bulkDone', { sent: r.sent }))
          setChecked(new Set())
        },
        onError: e => toast.error(errorMessage(e, t('common.saveError'))),
      },
    )
  const sendOne = (e: NearLimitEntry, o: PlanOption) =>
    offer.mutate(
      { ids: [e.center.id], planId: o.id },
      {
        onSuccess: () => toast.success(t('limits.detail.offerDone', { name: e.center.name, plan: o.name })),
        onError: err => toast.error(errorMessage(err, t('common.saveError'))),
      },
    )
  const issue = (e: NearLimitEntry, o: PlanOption) => {
    const w = e.center.worst
    setSheetOpen(false)
    actions.openPlanChange(e.center.id, {
      planId: o.id,
      reason: t('limits.detail.reason', { label: w.label.replace(', ГБ', ''), used: w.used, limit: w.limit, pct: w.pct }),
    })
  }

  const detail = (e: NearLimitEntry, inSheet = false) => (
    <LimitDetail
      entry={e}
      nameHidden={inSheet}
      thresholdPct={thresholdPct}
      picked={pickedOf(e)}
      onPick={planId => setPicked(p => ({ ...p, [e.center.id]: planId }))}
      onIssue={o => issue(e, o)}
      onOffer={o => sendOne(e, o)}
      offerPending={offer.isPending}
      onConfirmPayment={id => actions.confirmPayment(id)}
      onPlanChange={() => {
        setSheetOpen(false)
        actions.openPlanChange(e.center.id)
      }}
      onEnter={() => actions.enter(e.center)}
      onModules={() => {
        setSheetOpen(false)
        actions.openModules(e.center)
      }}
    />
  )

  let list: ReactNode
  if (query.error && !data) list = <QueryError error={query.error} onRetry={() => query.refetch()} />
  else if (!data) list = <ListSkeleton cards />
  else if (!items.length) list = <ListEmpty text={t('limits.empty')} onReset={f.isFiltered() ? () => f.reset() : undefined} />
  else
    list = (
      <ul className="divide-y divide-slate-100">
        {pageData.items.map(e => (
          <LimitRow
            key={e.center.id}
            e={e}
            thresholdPct={thresholdPct}
            selected={wide && e.center.id === selId}
            checked={checked.has(e.center.id)}
            onCheck={on => toggle(e.center.id, on)}
            onOpen={() => open(e.center.id)}
          />
        ))}
      </ul>
    )

  const m = data?.meta
  const statusCount = (s: NearLimitStatus) =>
    !m ? null : s === 'nooffer' ? m.withoutOffer : s === 'offered' ? m.offered : s === 'pending' ? m.pending : s === 'full' ? m.full : null
  const allChecked = items.length > 0 && checked.size === items.length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('limits.title')}
        subtitle={t('limits.subtitle')}
        actions={
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="text-[11px] font-semibold text-slate-500" id="limits-threshold">
              {t('limits.threshold')}
            </span>
            <div className="flex gap-1.5" role="group" aria-labelledby="limits-threshold">
              {THRESHOLDS.map(th => (
                <FilterChip key={th} active={v.th === th} onClick={() => setFilter('th', th)}>
                  {t('limits.thresholdChip', { pct: th })}
                </FilterChip>
              ))}
            </div>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {m ? (
          <>
            <StatTile
              label={t('limits.tiles.total')}
              value={formatNumber(m.total)}
              sub={t('limits.tiles.totalSub', { pct: m.threshold })}
              valueClassName={m.total ? 'text-amber-600' : 'text-emerald-600'}
            />
            <StatTile
              label={t('limits.tiles.full')}
              value={formatNumber(m.full)}
              sub={t('limits.tiles.fullSub')}
              valueClassName={m.full ? 'text-rose-600' : undefined}
            />
            <StatTile
              label={t('limits.tiles.offered')}
              value={t('limits.tiles.offeredValue', { offered: m.offered, total: m.total })}
              sub={m.withoutOffer ? t('limits.tiles.withoutOffer', { count: m.withoutOffer }) : t('limits.tiles.allOffered')}
            />
            <StatTile label={t('limits.tiles.potential')} value={formatMoney(m.potential)} sub={t('limits.tiles.potentialSub')} valueClassName="text-emerald-600" />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={v.q} onChange={q => f.set('q', q)} placeholder={t('limits.searchPlaceholder')} label={t('limits.search')} />
        <FilterSelect label={t('limits.metric')} value={v.metric} onChange={x => setFilter('metric', x)}>
          {METRICS.map(x => (
            <option key={x} value={x}>
              {t(`limits.metrics.${x}`)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t('limits.plan')} value={v.plan} onChange={x => f.set('plan', x)}>
          <option value="all">{t('limits.allPlans')}</option>
          {plans.map(p => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t('limits.sort')} value={v.sort} onChange={x => f.set('sort', x)}>
          {SORTS.map(x => (
            <option key={x} value={x}>
              {t(`limits.sorts.${x}`)}
            </option>
          ))}
        </FilterSelect>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('limits.status')}>
          {STATUSES.map(s => {
            const n = statusCount(s)
            const label = t(`limits.statuses.${s}`)
            return (
              <FilterChip key={s} active={v.status === s} onClick={() => f.set('status', s)}>
                {n === null ? label : t('limits.statusChip', { label, count: n })}
              </FilterChip>
            )
          })}
        </div>
        {f.isFiltered() && (
          <button type="button" onClick={() => f.reset()} className="text-xs font-semibold text-brand hover:underline">
            {t('common.resetFilters')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <Panel className="flex flex-col overflow-hidden xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={allChecked}
                disabled={!items.length}
                onChange={e => setChecked(e.target.checked ? new Set(ids) : new Set())}
                aria-label={t('limits.checkAll')}
                className="size-4 accent-brand"
              />
              <span>
                {checked.size ? (
                  <Trans i18nKey="limits.picked" values={{ count: checked.size, total: items.length }} components={{ b: <strong /> }} />
                ) : (
                  <Trans i18nKey="limits.found" values={{ count: items.length }} components={{ b: <strong /> }} />
                )}
              </span>
            </label>
            {checked.size ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setChecked(new Set())}>
                  {t('limits.uncheck')}
                </Button>
                <Button size="sm" onClick={sendBulk} disabled={offer.isPending}>
                  {t('limits.bulkOffer', { count: checked.size })}
                </Button>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">{t('limits.bulkHint')}</span>
            )}
          </div>
          <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')} aria-busy={query.isFetching}>
            {list}
          </div>
          {data && items.length > 0 && <Pager page={pageData.page} total={pageData.total} onPage={f.setPage} />}
        </Panel>
        {wide && (
          <Panel className="p-5 xl:sticky xl:top-4 xl:col-span-5">
            {selected ? detail(selected) : <p className="py-8 text-center text-xs text-slate-400">{t('limits.selectHint')}</p>}
          </Panel>
        )}
      </div>

      {!wide && (
        <Sheet open={sheetOpen && !!selected} onOpenChange={o => !o && setSheetOpen(false)}>
          <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
            <SheetHeader className="border-b border-slate-100 px-6 py-4">
              <SheetTitle className="text-base font-extrabold text-heading">{selected?.center.name}</SheetTitle>
              <SheetDescription>
                {selected && (
                  <>
                    {selected.center.city} · {selected.center.owner} · <span className="whitespace-nowrap">{selected.center.phone}</span>
                  </>
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain p-5 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] sm:p-6">
              {selected && detail(selected, true)}
            </div>
          </SheetContent>
        </Sheet>
      )}
      {actions.ui}
    </div>
  )
}

function LimitRow({
  e,
  thresholdPct,
  selected,
  checked,
  onCheck,
  onOpen,
}: {
  e: NearLimitEntry
  thresholdPct: number
  selected: boolean
  checked: boolean
  onCheck: (on: boolean) => void
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const c = e.center
  const tone = LIMIT_TONE[limitLevel(e.metricPct, thresholdPct)]
  return (
    <li
      aria-current={selected || undefined}
      className={cn('flex items-center gap-3 border-l-4 py-3 pr-4 pl-3 transition', selected ? 'border-brand bg-brand-light/60' : 'border-transparent hover:bg-slate-50')}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={ev => onCheck(ev.target.checked)}
        aria-label={t('limits.check', { name: c.name })}
        className="size-4 shrink-0 accent-brand"
      />
      {/* вся строка — кнопка открытия карточки; чекбокс вне её */}
      <button type="button" onClick={onOpen} aria-label={t('limits.open', { name: c.name })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-bold text-heading">{c.name}</span>
            <span className="text-[11px] whitespace-nowrap text-slate-400">{c.plan}</span>
          </div>
          <div className="truncate text-[11px] text-slate-400">
            {c.city} · {c.owner}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {c.usage.map(u => (
              <UsagePill key={u.key} u={u} thresholdPct={thresholdPct} />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className={cn('text-sm font-extrabold tabular-nums', tone.text)}>{e.metricPct}%</span>
          {c.pendingChange ? (
            <StatusBadge tone="amber">{t('limits.pending')}</StatusBadge>
          ) : c.offer ? (
            <StatusBadge tone="indigo">{t('limits.offered')}</StatusBadge>
          ) : e.suggestion ? (
            <span className="text-[11px] text-slate-500">{t('limits.toPlan', { plan: e.suggestion.name })}</span>
          ) : (
            <span className="text-[11px] text-slate-400">{t('limits.topPlan')}</span>
          )}
        </div>
      </button>
    </li>
  )
}
