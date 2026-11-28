/* Метаданные экрана в `handle` маршрута: заголовок (ключ i18n), родитель для крошек, файл прототипа (пока экран не перенесён). */
import { useLocation, useMatches } from 'react-router'
import type { Translation } from '@/i18n/locales/ru'

type Screens = Translation['screens']
export type ScreenKey =
  | `screens.platform.${keyof Screens['platform'] & string}`
  | `screens.center.${keyof Screens['center'] & string}`

export type RouteHandle = {
  title: ScreenKey
  /** Родительский экран дочерних страниц (группа, курс, состав центра): ссылка в крошках и подсветка в меню. */
  parent?: { title: ScreenKey; to: string }
  /** Экран прототипа, который переносится сюда (src/js/views/…). Убирается, когда экран перенесён. */
  prototype?: string
}

const isRouteHandle = (h: unknown): h is RouteHandle =>
  typeof h === 'object' && h !== null && 'title' in h

/** Метаданные самого глубокого совпавшего маршрута с handle. */
export function useScreen(): RouteHandle | undefined {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const h = matches[i].handle
    if (isRouteHandle(h)) return h
  }
  return undefined
}

/** Адрес пункта меню, который подсвечивается: родитель дочернего экрана или сам адрес (без завершающего «/»). */
export function useActiveNavPath(): string {
  const { pathname } = useLocation()
  const screen = useScreen()
  return screen?.parent?.to ?? (pathname.replace(/\/+$/, '') || '/')
}
