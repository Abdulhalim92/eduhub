/* Совпадает ли медиазапрос (ширина экрана) — для разметки, которая на телефоне и компьютере разная (таблица ↔ карточки).
   Рисуется один вариант, а не оба с CSS-скрытием: меньше DOM и нет дублей для экранных чтецов.
   Без matchMedia (jsdom в тестах) — fallback: по умолчанию считаем экран широким. */
import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    onChange => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback),
    () => fallback,
  )
}

/** Брейкпоинты Tailwind (src/index.css — стандартные): md 768, lg 1024, xl 1280. */
export const MQ = {
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
} as const
