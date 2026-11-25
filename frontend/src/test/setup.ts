import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { apiConfig } from '@/api'
import '@/i18n'

apiConfig.latencyMs = 0 // mock отвечает сразу

// jsdom не умеет ResizeObserver, а он нужен ResponsiveContainer из recharts
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})
