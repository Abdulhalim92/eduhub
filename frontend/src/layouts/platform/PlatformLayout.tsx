/* Кабинет платформы (SuperAdmin). Прототип: index.html (сайдбар — nav.js, шапка — router.js renderBreadcrumbs). */
import { Building, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DEMO_SESSION } from '@/app/demo-session'
import { PLATFORM_NAV } from '@/app/navigation'
import { useActiveNavPath, useScreen } from '@/app/route-handle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AppShell } from '../shared/AppShell'
import { Header } from '../shared/Header'
import { Sidebar, SidebarLink, SidebarUser } from '../shared/Sidebar'
import { useNavGroups } from './use-nav-groups'

export function PlatformLayout() {
  return <AppShell sidebar={<PlatformSidebar />} header={<PlatformHeader />} />
}

function PlatformSidebar() {
  const { t } = useTranslation()
  const activePath = useActiveNavPath()
  const { isOpen, toggle } = useNavGroups(PLATFORM_NAV, activePath)

  return (
    <Sidebar
      header={<PlatformLogo />}
      footer={<SidebarUser name={DEMO_SESSION.platform.name} role={t('layout.roles.superAdmin')} />}
    >
      {PLATFORM_NAV.map((g, i) => {
        const open = isOpen(g)
        const listId = `nav-group-${g.id}`
        return (
          <div key={g.id} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => toggle(g)}
              aria-expanded={open}
              aria-controls={listId}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-bold tracking-wider text-sidebar-muted uppercase transition hover:bg-white/10 hover:text-white',
                i > 0 && 'mt-1',
              )}
            >
              {t(`nav.groups.${g.id}`)}
              <ChevronDown className={cn('size-3.5 transition-transform', !open && '-rotate-90')} aria-hidden />
            </button>
            <div id={listId} hidden={!open} className="flex flex-col gap-1">
              {g.items.map(item => (
                <SidebarLink key={item.to} item={item} active={item.to === activePath} />
              ))}
            </div>
          </div>
        )
      })}
    </Sidebar>
  )
}

function PlatformLogo() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between px-2 py-1">
      <Link to="/platform" className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center gap-0.5 rounded-lg bg-sidebar-primary" aria-hidden>
          <span className="h-4 w-1 rounded-full bg-white" />
          <span className="h-5 w-1 rounded-full bg-white" />
          <span className="h-3.5 w-1 rounded-full bg-white" />
        </span>
        <span className="text-xl font-extrabold tracking-tight text-white">{t('app.name')}</span>
      </Link>
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">{t('app.version')}</span>
    </div>
  )
}

function PlatformHeader() {
  const { t } = useTranslation()
  const screen = useScreen()
  return (
    <Header
      actions={
        <Button variant="outline" size="sm" asChild>
          {/* на телефоне — только значок, подпись остаётся для экранных чтецов */}
          <Link to="/center" aria-label={t('layout.toCenterCabinet')}>
            <Building aria-hidden />
            <span className="hidden sm:inline">{t('layout.toCenterCabinet')}</span>
          </Link>
        </Button>
      }
    >
      {/* на телефоне — только текущий экран: начало цепочки не помещается */}
      <nav aria-label={t('layout.breadcrumbs')} className="flex min-w-0 items-center gap-2 text-sm whitespace-nowrap text-slate-500">
        <span className="hidden items-center gap-2 sm:flex">
          {t('layout.platform')}
          {screen?.parent && (
            <>
              <span className="text-slate-300" aria-hidden>/</span>
              <Link to={screen.parent.to} className="transition hover:text-brand">
                {t(screen.parent.title)}
              </Link>
            </>
          )}
          {screen && <span className="text-slate-300" aria-hidden>/</span>}
        </span>
        {screen && (
          <span aria-current="page" className="truncate font-semibold text-slate-900">
            {t(screen.title)}
          </span>
        )}
      </nav>
    </Header>
  )
}
