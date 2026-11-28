import { defineConfig, devices } from '@playwright/test'

// Сквозные проверки в настоящем Chromium (вёрстка, стили, переходы). Браузер: npx playwright install chromium.
const PORT = 5180

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: 2, // больше браузеров одновременно не помещается в память рабочей машины (7 ГБ): процесс убивался с кодом 137

  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // e2e — на mock прототипа, даже если в .env.local включён сервер
    env: { VITE_API_MODE: 'mock' },
  },
})
