/* Состояния экрана-списка: загрузка (скелет строк/карточек) и пусто (текст + «Сбросить фильтры», если что-то отфильтровано). */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function ListSkeleton({ cards }: { cards?: boolean }) {
  return cards ? (
    <div className="flex flex-col gap-3 p-4 sm:p-6" aria-busy>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} data-testid="skeleton-row" className="h-28 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-4 px-6 py-5" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} data-testid="skeleton-row" className="h-4 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  )
}

export function ListEmpty({ text, onReset }: { text: string; onReset?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="py-14 text-center text-slate-400">
      <p>{text}</p>
      {onReset && (
        <button type="button" onClick={onReset} className="mt-2 text-xs font-semibold text-brand hover:underline">
          {t('common.resetFilters')}
        </button>
      )}
    </div>
  )
}

/** Подпись и значение в карточке (карточный вид таблицы на узких экранах). */
export function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="mb-1 text-[10px] font-semibold tracking-wide text-table-head-text uppercase">{label}</dt>
      <dd className="text-xs">{children}</dd>
    </div>
  )
}
