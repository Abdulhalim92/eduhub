/* Кабинет учебного центра. Прототип: eduhub.html + src/js/core/center-app.js.
   Центр и режим поддержки — в адресе (?center=&support=1, см. CabinetProvider); все ссылки меню их сохраняют. */
import { ArrowLeft, ArrowRight, Building, Radio } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router'
import { CENTER_NAV } from '@/app/navigation'
import { useActiveNavPath, useScreen } from '@/app/route-handle'
import { Button } from '@/components/ui/button'
import { useCabinet } from '@/features/cabinet/cabinet-context'
import { CabinetProvider } from '@/features/cabinet/CabinetProvider'
import { assetUrl } from '@/lib/assets'
import { AppShell } from '../shared/AppShell'
import { Header } from '../shared/Header'
import { Sidebar, SidebarLink, SidebarUser } from '../shared/Sidebar'

export function CenterLayout() {
  return (
    <CabinetProvider>
      <AppShell banner={<SupportBanner />} sidebar={<CenterSidebar />} header={<CenterHeader />} />
    </CabinetProvider>
  )
}

/** /center → профиль центра с сохранением ?center=&support= (относительный Navigate их бы потерял). */
export function CabinetIndexRedirect() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: 'profile', search }} replace />
}

/** Режим поддержки (PLT-CTR-050): всегда виден, пока SuperAdmin в кабинете центра; выход — в реестр центров. */
function SupportBanner() {
  const { t } = useTranslation()
  const { support, center } = useCabinet()
  if (!support) return null
  return (
    <div role="region" aria-label={t('layout.support.label')} className="z-40 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-slate-900 px-6 py-2 text-white">
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <Radio className="size-4 animate-pulse text-orange-500" aria-hidden />
        <span className="font-semibold text-orange-400">{t('layout.support.title')}</span>
        <span className="hidden text-slate-500 sm:inline" aria-hidden>·</span>
        <span className="text-slate-300">{t('layout.support.text', { name: center?.name ?? '…' })}</span>
      </div>
      <Link
        to="/platform/centers"
        className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-600/30 px-3 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-600/50"
      >
        {t('layout.support.exit')}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  )
}

function CenterSidebar() {
  const { t } = useTranslation()
  const activePath = useActiveNavPath()
  const { center, search } = useCabinet()
  return (
    <Sidebar
      header={
        <div className="flex items-center gap-3 px-2 py-2">
          {center ? (
            <img src={assetUrl(center.logo)} alt="" className="size-10 shrink-0 rounded-xl bg-white" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10" aria-hidden>
              <Building className="size-5 text-white" />
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold text-white">{center?.name ?? t('layout.centerCabinet')}</div>
            {center && <div className="truncate text-[11px] text-sidebar-muted">{t('layout.planOf', { plan: center.plan })}</div>}
          </div>
        </div>
      }
      footer={
        <>
          <Link to="/platform/centers" className="flex items-center gap-2.5 text-xs transition hover:text-white">
            <ArrowLeft className="size-4 text-sidebar-muted" aria-hidden />
            {t('layout.toPlatform')}
          </Link>
          {center && <SidebarUser name={center.owner} role={t('layout.roles.centerOwner')} />}
        </>
      }
    >
      {CENTER_NAV.map(item => (
        <SidebarLink key={item.to} item={item} active={item.to === activePath} search={search} />
      ))}
    </Sidebar>
  )
}

function CenterHeader() {
  const { t } = useTranslation()
  const screen = useScreen()
  const { center, centers, switchCenter, error, retry } = useCabinet()
  return (
    <Header
      actions={
        error ? (
          <Button variant="outline" size="sm" onClick={retry}>
            {t('common.retry')}
          </Button>
        ) : centers.length > 0 ? (
          // демо без входа: в кабинете можно переключить центр (на проде центр берётся из сессии)
          <label className="flex min-w-0 items-center gap-3">
            <span className="hidden text-[11px] whitespace-nowrap text-slate-400 md:inline">{t('layout.demoCenter')}</span>
            <select
              aria-label={t('layout.centerSwitcher')}
              value={center?.id ?? ''}
              onChange={e => switchCenter(Number(e.target.value))}
              className="max-w-36 cursor-pointer truncate rounded-lg sm:max-w-64 border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:outline-none"
            >
              {centers.map(c => (
                <option key={c.id} value={c.id}>
                  {t('layout.centerOption', { name: c.name, city: c.city })}
                </option>
              ))}
            </select>
          </label>
        ) : null
      }
    >
      <h1 className="truncate text-base font-extrabold tracking-tight text-heading sm:text-lg">{screen ? t(screen.title) : ''}</h1>
    </Header>
  )
}
