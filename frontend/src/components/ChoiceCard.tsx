/* Карточка выбора одного варианта (способ оплаты пакета, тариф, способ оплаты смены тарифа).
   Ставится внутрь контейнера с role="radiogroup"; недоступный вариант объясняет причину текстом внутри. */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = { checked: boolean; disabled?: boolean; onSelect: () => void; title: ReactNode; aside?: ReactNode; children?: ReactNode }

export function ChoiceCard({ checked, disabled, onSelect, title, aside, children }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border p-3 text-left transition',
        checked ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white',
        disabled ? 'cursor-not-allowed opacity-60' : !checked && 'hover:border-brand/50',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-brand' : 'border-slate-300')} aria-hidden>
            {checked && <span className="size-2 rounded-full bg-brand" />}
          </span>
          <span className="text-xs font-bold text-heading">{title}</span>
        </span>
        {aside}
      </span>
      {children && <span className="mt-1.5 block pl-6 text-[11px] leading-relaxed text-slate-500">{children}</span>}
    </button>
  )
}
