import { Panel } from '@/components/Panel'
import { cn } from '@/lib/utils'

/** Плитка показателя: подпись, крупное значение, пояснение (прототип: ui.js tile). */
export function StatTile({
  label,
  value,
  sub,
  valueClassName,
  subClassName,
}: {
  label: string
  value: string
  sub: string
  valueClassName?: string
  subClassName?: string
}) {
  return (
    <Panel className="p-4 transition hover:border-brand/40 sm:p-5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cn('mt-2 text-2xl font-extrabold text-heading sm:text-3xl', valueClassName)}>{value}</div>
      <div className={cn('mt-2 text-[11px] text-slate-500 sm:text-xs', subClassName)}>{sub}</div>
    </Panel>
  )
}
