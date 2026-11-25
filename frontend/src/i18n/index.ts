/* i18next: языки интерфейса (SYS-I18-010). Сейчас подключён только русский; tj и en добавляются файлами в locales/ с той же структурой, что ru. */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ru } from './locales/ru'

export const defaultNS = 'translation'
export const resources = { ru: { translation: ru } } as const

i18n.use(initReactI18next).init({
  lng: 'ru',
  fallbackLng: 'ru',
  resources,
  defaultNS,
  initAsync: false, // ресурсы встроены — переводы доступны сразу, без мигания ключей
  interpolation: { escapeValue: false }, // React сам экранирует вывод
})

export default i18n
