/* Тёмный сайдбар (общий для платформы и кабинета центра): шапка, меню, подвал. Цвета — роли --sidebar-* из theme.css. */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { NavItem } from '@/app/navigation'
import { cn } from '@/lib/utils'

/** Один и тот же сайдбар: постоянный слева на широких экранах и в шторке мобильного меню (AppShell). */
export function Sidebar({ header, children, footer }: { header: ReactNode; children: ReactNode; footer: ReactNode }) {
  const { t } = useTranslation()
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
        {header}
        <nav aria-label={t('layout.mainNav')} className="flex flex-col gap-1 text-[13px]">
          {children}
        </nav>
      </div>
      <div className="flex flex-col gap-3 border-t border-white/10 pt-3">{footer}</div>
    </aside>
  )
}

/** search — параметры адреса, которые нужно сохранить при переходе (центр и режим поддержки кабинета). */
export function SidebarLink({ item, active, search = '' }: { item: NavItem; active: boolean; search?: string }) {
  const { t } = useTranslation()
  const Icon = item.icon
  return (
    <Link
      to={item.to + search}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2 text-left transition',
        active
          ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
          : 'font-medium hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{t(item.title)}</span>
    </Link>
  )
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export function SidebarUser({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
        {initials(name)}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-xs font-semibold text-white">{name}</div>
        <div className="truncate text-[10px] text-sidebar-muted">{role}</div>
      </div>
    </div>
  )
}
