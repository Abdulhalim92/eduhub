import { inputClass } from '@/components/form-styles'
import { cn } from '@/lib/utils'

/** Поля страниц входа: 16 px на телефоне — iOS не увеличивает страницу при вводе. */
export const authInput = (error?: unknown) => cn(inputClass(error), 'text-base sm:text-sm')

/** Демо-доступ из mock (src/api/mock: «frontend: демо-доступ») — на проде этого блока нет. */
export const DEMO_LOGIN = { login: '992901001001', password: 'Demo2026' } as const
