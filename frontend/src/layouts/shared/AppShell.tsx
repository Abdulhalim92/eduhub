/* Каркас кабинета: (баннер сверху), сайдбар слева, справа шапка и прокручиваемая область экрана.
   Экран прокручивается целиком (docs/design/ui-principles.md → «Компоновка»). */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'
import { useScreen } from '@/app/route-handle'
import { useDocumentTitle } from './use-document-title'

export function AppShell({ sidebar, header, banner }: { sidebar: ReactNode; header: ReactNode; banner?: ReactNode }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const screen = useScreen()
  useDocumentTitle(screen ? t(screen.title) : undefined)

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {banner}
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col">
          {header}
          {/* key: при смене экрана область монтируется заново — прокрутка в начало, анимация появления */}
          <main key={pathname} className="flex-1 overflow-y-auto">
            <div className="animate-fade-in px-8 pt-8 pb-12">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
