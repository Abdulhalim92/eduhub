/* Выбор способа, которым деньги поступили вне системы (пополнение, оплата пакета SMS, подтверждение оплаты счёта). */
import type { PayMethod } from '@/features/dictionaries/api/types'
import { cn } from '@/lib/utils'
import { PAY_CHANNEL_UI } from './pay-channels'

type Props = { methods: PayMethod[]; value: string; onChange: (method: string) => void; label: string; error?: string }

export function MethodPicker({ methods, value, onChange, label, error }: Props) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[11px] font-semibold text-slate-600">
        {label} <span className="text-rose-500">*</span>
      </legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {methods.map(m => {
          const on = m.method === value
          const { icon: Icon, tone } = PAY_CHANNEL_UI[m.channel]
          return (
            <button
              key={m.method}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(m.method)}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white hover:border-brand/50',
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', tone)} aria-hidden>
                  <Icon className="size-4" />
                </span>
                <span className="text-xs font-bold text-heading">{m.method}</span>
              </span>
              <span className="mt-1.5 block text-[11px] text-slate-500">{m.evidence}</span>
            </button>
          )
        })}
      </div>
      {error && (
        <span role="alert" className="text-[11px] text-rose-600">
          {error}
        </span>
      )}
    </fieldset>
  )
}
