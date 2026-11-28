/* «Модерация каталога» (PLT-MOD-010…030, BR-017): очередь заявок на публикацию филиалов и проверка выбранной.
   Прототип: src/js/views/platform/moderation.js. Вкладка — в адресе; правки модератора (описания, координаты, подтверждение пина)
   живут черновиком по заявке до решения и уходят на сервер вместе с ним. Уже 1280 px заявка открывается панелью. */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage, type CatalogDesc, type GeoPoint, type ModerationDecision, type ModerationRequest, type ModerationTab } from '@/api'
import { useModerationDecide, useModerationRequeue } from '@/api/mutations'
import { useModeration } from '@/api/queries'
import { FilterChip } from '@/components/filters'
import { ListEmpty, ListSkeleton } from '@/components/list-states'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Panel } from '@/components/Panel'
import { QueryError } from '@/components/QueryError'
import { StatusBadge } from '@/components/StatusBadge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PAGE_SIZE } from '@/lib/pager'
import { paginate, useUrlFilters } from '@/lib/use-url-filters'
import { MQ, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { DESC_MIN, distanceM, GPS_MISMATCH_M } from './geo'
import { ModerationDetail } from './ModerationDetail'
import { MOD_STATUS_TONE } from './status'

const TABS = ['pending', 'processed'] as const satisfies readonly ModerationTab[]
type Draft = { desc: CatalogDesc; gps: GeoPoint; gpsOk: boolean }

export function ModerationScreen() {
  const { t } = useTranslation()
  const f = useUrlFilters({ tab: 'pending' }, { tab: TABS })
  const tab = f.values.tab as ModerationTab
  const query = useModeration(tab)
  const data = query.data
  const decide = useModerationDecide()
  const requeue = useModerationRequeue()
  const wide = useMediaQuery(MQ.xl)

  const items = data?.items ?? []
  const [selRaw, setSel] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const selId = selRaw !== null && items.some(r => r.id === selRaw) ? selRaw : wide ? (items[0]?.id ?? null) : null
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const view = (r: ModerationRequest): ModerationRequest => {
    const d = drafts[r.id]
    return d ? { ...r, desc: d.desc, gps: d.gps, gpsOk: d.gpsOk } : r
  }
  const selected = items.find(r => r.id === selId)
  const sel = selected ? view(selected) : null
  const edit = (r: ModerationRequest, patch: (d: Draft) => Draft) =>
    setDrafts(all => {
      const base = all[r.id] ?? { desc: { ...r.desc }, gps: { ...r.gps }, gpsOk: false }
      return { ...all, [r.id]: patch(base) }
    })
  const dropDraft = (id: number) =>
    setDrafts(all => {
      const next = { ...all }
      delete next[id]
      return next
    })

  const pageData = paginate(items, f.page, PAGE_SIZE)

  const switchTab = (next: ModerationTab) => {
    setSel(null)
    f.set('tab', next)
  }
  const open = (id: number) => {
    setSel(id)
    if (!wide) setSheetOpen(true)
  }
  const onDecide = (decision: ModerationDecision, reason = '') => {
    if (!selected || !sel) return
    decide.mutate(
      { id: selected.id, decision, reason, desc: sel.desc, gps: sel.gps, gpsConfirmed: sel.gpsOk },
      {
        onSuccess: () => {
          if (decision === 'published') toast.success(t('moderation.published', { branch: selected.branch, center: selected.centerName }))
          else if (decision === 'returned') toast(t('moderation.returned'))
          else toast(t('moderation.rejected'))
          dropDraft(selected.id)
          setSel(null)
          setSheetOpen(false)
        },
        onError: e => toast.error(errorMessage(e, t('common.saveError'))),
      },
    )
  }
  const onRequeue = () => {
    if (!selected) return
    const id = selected.id
    requeue.mutate(id, {
      onSuccess: () => {
        toast(t('moderation.requeued'))
        dropDraft(id)
        setSel(id)
        setSheetOpen(false)
        f.set('tab', 'pending')
      },
      onError: e => toast.error(errorMessage(e, t('common.saveError'))),
    })
  }

  const detail = sel && (
    <ModerationDetail
      r={sel}
      onDesc={(lang, value) => edit(sel, d => ({ ...d, desc: { ...d.desc, [lang]: value } }))}
      // ручная правка координат сбрасывает подтверждение пина (PLT-MOD-020, критерий 1)
      onCoord={(key, value) => edit(sel, d => ({ ...d, gps: { ...d.gps, [key]: value }, gpsOk: false }))}
      onGpsOk={ok => edit(sel, d => ({ ...d, gpsOk: ok }))}
      onDecide={onDecide}
      onRequeue={onRequeue}
      busy={decide.isPending || requeue.isPending}
    />
  )

  let list: ReactNode
  if (query.error && !data) list = <QueryError error={query.error} onRetry={() => query.refetch()} />
  else if (!data) list = <ListSkeleton cards />
  else if (!items.length) list = <ListEmpty text={tab === 'pending' ? t('moderation.emptyPending') : t('moderation.emptyProcessed')} />
  else
    list = (
      <ul className="flex flex-col gap-2 px-4 pb-4 sm:px-5">
        {pageData.items.map(raw => (
          <RequestCard key={raw.id} r={view(raw)} selected={wide && raw.id === selId} onOpen={() => open(raw.id)} />
        ))}
      </ul>
    )

  const count = data ? (tab === 'pending' ? data.meta.pending : data.meta.processed) : 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('moderation.title')} subtitle={t('moderation.subtitle')} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <Panel className="flex flex-col overflow-hidden xl:col-span-5">
          <div className="flex flex-col gap-3 px-4 pt-5 pb-3 sm:px-5">
            <h2 className="text-base font-bold text-heading">{t('moderation.listTitle', { count })}</h2>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('moderation.tabs')}>
              <FilterChip active={tab === 'pending'} onClick={() => switchTab('pending')}>
                {t('moderation.tabPending', { count: data?.meta.pending ?? 0 })}
              </FilterChip>
              <FilterChip active={tab === 'processed'} onClick={() => switchTab('processed')}>
                {t('moderation.tabProcessed', { count: data?.meta.processed ?? 0 })}
              </FilterChip>
            </div>
          </div>
          <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')} aria-busy={query.isFetching}>
            {list}
          </div>
          {pageData.total > PAGE_SIZE && <Pager page={pageData.page} total={pageData.total} onPage={f.setPage} />}
        </Panel>
        {wide && (
          <Panel className="p-6 xl:sticky xl:top-4 xl:col-span-7">
            {detail ?? <p className="py-8 text-center text-xs text-slate-400">{t('moderation.selectHint')}</p>}
          </Panel>
        )}
      </div>

      {!wide && (
        <Sheet open={sheetOpen && !!sel} onOpenChange={o => !o && setSheetOpen(false)}>
          <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
            <SheetHeader className="border-b border-slate-100 px-6 py-4">
              <SheetTitle className="text-base font-extrabold text-heading">{sel && `${sel.centerName} — ${sel.branch}`}</SheetTitle>
              <SheetDescription>{sel && `${sel.address}, ${sel.city}`}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain p-5 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))]">{detail}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function RequestCard({ r, selected, onOpen }: { r: ModerationRequest; selected: boolean; onOpen: () => void }) {
  const { t } = useTranslation()
  const pending = r.status === 'pending'
  const gpsWarn = pending && distanceM(r.gps, r.geo) > GPS_MISMATCH_M
  const noTj = pending && r.desc.tj.trim().length < DESC_MIN
  const name = `${r.centerName} — ${r.branch}`
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('moderation.open', { name })}
        aria-current={selected || undefined}
        className={cn(
          'w-full rounded-xl border p-4 text-left transition',
          selected ? 'border-brand bg-brand-light/50 ring-2 ring-brand/15' : 'border-slate-200 bg-white hover:border-brand/50',
        )}
      >
        <div className="text-sm leading-snug font-bold text-heading">{name}</div>
        <div className="mt-1 text-xs text-slate-600">
          {r.address}, {r.city}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">{t('moderation.directions', { value: r.directions.join(', ') })}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={MOD_STATUS_TONE[r.status]}>{t(`moderation.status.${r.status}`)}</StatusBadge>
          {gpsWarn && <StatusBadge tone="amber">{t('moderation.gpsWarn')}</StatusBadge>}
          {noTj && <StatusBadge tone="rose">{t('moderation.noTj')}</StatusBadge>}
          <span className="ml-auto text-[11px] text-slate-400">{r.submitted}</span>
        </div>
      </button>
    </li>
  )
}
