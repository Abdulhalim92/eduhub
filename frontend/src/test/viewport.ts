/* Ширина экрана для тестов адаптивной разметки: подменяет window.matchMedia (в jsdom его нет).
   Понимает запросы вида (min-width: Npx) — их использует lib/use-media-query. */
import { afterEach, vi } from 'vitest'

export function setViewportWidth(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0)
    return {
      matches: width >= min,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }
  })
}

afterEach(() => vi.unstubAllGlobals())
