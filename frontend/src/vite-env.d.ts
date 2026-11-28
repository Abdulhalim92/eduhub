/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** http — сервер «Линия»; иначе — mock прототипа (демо, тесты). */
  readonly VITE_API_MODE?: 'http' | 'mock'
  /** Адрес api; по умолчанию /api (прокси Vite в разработке). */
  readonly VITE_API_URL?: string
}
