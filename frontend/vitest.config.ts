import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Модульные и компонентные тесты (jsdom). Сквозные в браузере — Playwright, папка e2e/.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      css: false,
      // jsdom-тесты тяжёлые: больше двух параллельных потоков рабочая машина (7 ГБ) не тянет — уходит в swap, тесты падают по таймауту
      maxWorkers: 2,
    },
  }),
)
