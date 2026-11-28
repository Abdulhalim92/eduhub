/* Каркас кабинета: (баннер сверху), сайдбар слева, справа шапка и прокручиваемая область экрана.
   От 1024 px сайдбар постоянный; уже — открывается шторкой из шапки (кнопка меню) и закрывается при переходе.
   Экран прокручивается целиком (docs/design/ui-principles.md → «Компоновка»). */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'
import { useScreen } from '@/app/route-handle'
import { X } from 'lucide-react'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { ShellContext } from './shell-context'
import { useDocumentTitle } from './use-document-title'

export function AppShell({ sidebar, header, banner }: { sidebar: ReactNode; header: ReactNode; banner?: ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const screen = useScreen()
  useDocumentTitle(screen ? t(screen.title) : undefined)
  // шторка открыта «на этом адресе»: любой переход (пункт меню, ссылка) её закрывает без лишних эффектов
  const [navOpenAt, setNavOpenAt] = useState<string | null>(null)
  const navOpen = navOpenAt === location.key

  return (
    <ShellContext.Provider value={{ openNav: () => setNavOpenAt(location.key) }}>
      <div className="flex h-dvh flex-col overflow-hidden">
        {banner}
        <div className="flex min-h-0 flex-1">
          <div className="hidden lg:flex">{sidebar}</div>
          <Sheet open={navOpen} onOpenChange={open => !open && setNavOpenAt(null)}>
            {/* ширина и фон — как у самого сайдбара (у shadcn по умолчанию 3/4 экрана и белый фон: оставалась белая полоса) */}
            <SheetContent
              side="left"
              showCloseButton={false}
              className="gap-0 border-0 bg-sidebar p-0 data-[side=left]:w-64 data-[side=left]:sm:max-w-64"
            >
              <SheetTitle className="sr-only">{t('layout.mainNav')}</SheetTitle>
              <SheetDescription className="sr-only">{t('layout.mainNav')}</SheetDescription>
              {sidebar}
              <SheetClose
                aria-label={t('common.close')}
                className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg text-sidebar-muted transition hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" aria-hidden />
              </SheetClose>
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 flex-1 flex-col">
            {header}
            {/* key: при смене экрана область монтируется заново — прокрутка в начало, анимация появления */}
            <main key={location.pathname} className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
              <div className="animate-fade-in px-4 pt-5 pb-12 sm:px-6 sm:pt-6 xl:pt-8 2xl:px-8">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </ShellContext.Provider>
  )
}
