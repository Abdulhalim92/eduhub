import type { ReactNode } from 'react'

/** Верхняя панель 64px: слева заголовок или крошки, справа действия. */
export function Header({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <header className="z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-8">
      <div className="min-w-0">{children}</div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  )
}
