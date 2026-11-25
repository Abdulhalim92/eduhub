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
    <Panel className="p-5 transition hover:border-brand/40">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cn('mt-2 text-3xl font-extrabold text-heading', valueClassName)}>{value}</div>
      <div className={cn('mt-2 text-xs text-slate-500', subClassName)}>{sub}</div>
    </Panel>
  )
}
