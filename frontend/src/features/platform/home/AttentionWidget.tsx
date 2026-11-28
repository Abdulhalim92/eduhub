/* «Требует внимания»: счётчики очередей из api.platform.attention, каждая карточка ведёт в свою очередь (PLT-DSH-010, критерий 1). */
import { ChevronRight, Clock, LayoutGrid, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Attention } from '@/api'
import { useAttention } from '@/api/queries'
import { Panel } from '@/components/Panel'
import { QueryError } from '@/components/QueryError'
import { cn } from '@/lib/utils'

type Queue = {
  id: 'moderation' | 'expiring' | 'churn' | 'limits'
  to: string
  icon: LucideIcon
  tone: string
  count: (a: Attention) => number
}

const QUEUES: Queue[] = [
  { id: 'moderation', to: '/platform/moderation', icon: LayoutGrid, tone: 'bg-emerald-100 text-emerald-600', count: a => a.moderation },
  { id: 'expiring', to: '/platform/expiring', icon: Clock, tone: 'bg-rose-100 text-rose-500', count: a => a.expiring },
  { id: 'churn', to: '/platform/churn', icon: TriangleAlert, tone: 'bg-amber-100 text-amber-600', count: a => a.churn },
  { id: 'limits', to: '/platform/limits', icon: TrendingUp, tone: 'bg-indigo-100 text-brand', count: a => a.nearLimit },
]

export function AttentionWidget() {
  const { t } = useTranslation()
  const { data, error, isPending, refetch } = useAttention()
  const total = data ? QUEUES.reduce((s, q) => s + q.count(data), 0) : null

  return (
    <Panel className="flex flex-col p-4 sm:p-5 lg:col-span-4" aria-labelledby="attention-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="attention-title" className="text-sm font-bold text-heading">
          {t('home.attention.title')}
        </h2>
        {total !== null && (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-bold text-brand"
            aria-label={t('home.attention.total', { count: total })}
          >
            {total}
          </span>
        )}
      </div>

      {error ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : (
        <ul className="flex flex-col gap-3">
          {QUEUES.map(q => {
            const Icon = q.icon
            return (
              <li key={q.id}>
                <Link
                  to={q.to}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-brand"
                >
                  <span className="flex items-center gap-3">
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', q.tone)} aria-hidden>
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-xs font-bold text-heading transition group-hover:text-brand">
                        {t(`home.attention.${q.id}.title`)}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {isPending ? (
                          <span className="mt-1 block h-3 w-40 animate-pulse rounded bg-slate-200" />
                        ) : (
                          t(`home.attention.${q.id}.text`, { count: q.count(data) })
                        )}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
