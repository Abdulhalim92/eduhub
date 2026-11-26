/* Подвал реестра: «Показано a–b из N · примечание» и кнопки страниц (кнопки — только если страниц больше одной). */
import { useTranslation } from 'react-i18next'
import { PAGE_SIZE, pageCount, pagerNumbers } from '@/lib/pager'
import { cn } from '@/lib/utils'

type Props = { page: number; total: number; pageSize?: number; note?: string; onPage: (page: number) => void }

export function Pager({ page, total, pageSize = PAGE_SIZE, note, onPage }: Props) {
  const { t } = useTranslation()
  const pages = pageCount(total, pageSize)
  const p = Math.min(page, pages)
  const from = (p - 1) * pageSize + 1
  const to = Math.min(total, p * pageSize)
  const summary = total ? t('common.pager.shown', { from, to, total }) : t('common.pager.empty')

  const btn = 'h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40'
  const idle = 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 sm:px-6 text-xs text-slate-500">
      <span>
        {summary}
        {note && ` · ${note}`}
      </span>
      {pages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label={t('common.pager.pages')}>
          <button type="button" className={cn(btn, idle)} disabled={p <= 1} onClick={() => onPage(p - 1)} aria-label={t('common.pager.prev')}>
            ←
          </button>
          {pagerNumbers(p, pages).map((n, i) =>
            n ? (
              <button
                key={n}
                type="button"
                className={cn(btn, n === p ? 'border-brand bg-brand text-white' : idle)}
                aria-current={n === p ? 'page' : undefined}
                aria-label={t('common.pager.page', { n })}
                onClick={() => onPage(n)}
              >
                {n}
              </button>
            ) : (
              <span key={`gap-${i}`} className="px-1 text-slate-400" aria-hidden>
                …
              </span>
            ),
          )}
          <button type="button" className={cn(btn, idle)} disabled={p >= pages} onClick={() => onPage(p + 1)} aria-label={t('common.pager.next')}>
            →
          </button>
        </nav>
      )}
    </div>
  )
}
