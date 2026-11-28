import { Menu } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useShell } from './shell-context'

/** Верхняя панель 64px: слева (кнопка меню на узких экранах) заголовок или крошки, справа действия. */
export function Header({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const { t } = useTranslation()
  const { openNav } = useShell()
  return (
    <header className="z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 2xl:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={openNav}
          aria-label={t('layout.openMenu')}
          className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <div className="min-w-0">{children}</div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  )
}
