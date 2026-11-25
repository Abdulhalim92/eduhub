import { cn } from '@/lib/utils'

/** Поле ввода диалога; красная рамка — при ошибке (прототип: inputCls). */
export const inputClass = (error?: unknown) =>
  cn(
    'w-full rounded-xl border bg-white px-3 py-2.5 text-xs focus:border-brand focus:outline-none',
    error ? 'border-rose-400' : 'border-slate-200',
  )

/** aria-атрибуты для input внутри Field: id, признак ошибки, связь с текстом ошибки и подсказкой. */
export const fieldAria = (id: string, error?: string, hint?: boolean) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined,
})
