import { cn } from '@/lib/utils'

/** Общее сообщение формы (неверный вход, блокировка, успех) — над полями. */
export function FormAlert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-3 py-2 text-xs',
        tone === 'error' && 'border-rose-200 bg-rose-50 text-rose-700',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        tone === 'info' && 'border-indigo-200 bg-indigo-50 text-brand-dark',
      )}
    >
      {children}
    </div>
  )
}
