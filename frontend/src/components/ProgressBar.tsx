import { cn } from '@/lib/utils'

/** Тонкая полоса заполнения (лимиты, овердрафт). Значение и смысл дублируются текстом рядом — полоса только наглядность. */
export function ProgressBar({ pct, className, barClassName }: { pct: number; className?: string; barClassName: string }) {
  return (
    <div className={cn('mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200', className)} aria-hidden>
      <div className={cn('h-full', barClassName)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}
