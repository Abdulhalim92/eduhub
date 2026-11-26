import type { ReactNode } from 'react'

/** Заголовок экрана с подзаголовком и главной кнопкой справа (docs/design/ui-principles.md → «Компоновка»). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-heading sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
