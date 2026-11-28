import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Белая карточка экрана (плитки, виджеты, таблицы) — как в прототипе. */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('rounded-2xl border border-slate-200/80 bg-card shadow-xs', className)} {...props} />
}
