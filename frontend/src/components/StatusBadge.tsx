/* Цветная метка статуса с точкой (прототип: ui.js badge/TONES). Цвет не единственный носитель смысла — всегда с текстом. */
import { cn } from '@/lib/utils'

const TONES = {
  emerald: ['border-emerald-200 bg-emerald-100 text-emerald-800', 'bg-emerald-500'],
  amber: ['border-amber-200 bg-amber-100 text-amber-800', 'bg-amber-500'],
  rose: ['border-rose-200 bg-rose-100 text-rose-700', 'bg-rose-500'],
  slate: ['border-slate-200 bg-slate-100 text-slate-600', 'bg-slate-400'],
  indigo: ['border-indigo-200 bg-indigo-100 text-brand', 'bg-brand'],
} as const

export type BadgeTone = keyof typeof TONES

/** wrap — длинная метка может переноситься (узкие столбцы таблиц). */
export function StatusBadge({ tone, children, wrap }: { tone: BadgeTone; children: string; wrap?: boolean }) {
  const [box, dot] = TONES[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', wrap ? 'leading-tight' : 'whitespace-nowrap', box)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden />
      {children}
    </span>
  )
}
