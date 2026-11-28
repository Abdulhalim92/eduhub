import { inputClass } from '@/components/form-styles'
import { cn } from '@/lib/utils'

/** Поля страниц входа: 16 px на телефоне — iOS не увеличивает страницу при вводе. */
export const authInput = (error?: unknown) => cn(inputClass(error), 'text-base sm:text-sm')

/** Демо-доступ из mock (src/api/mock: «frontend: демо-доступ») — на проде этого блока нет. */
export const DEMO_LOGIN = { login: '992901001001', password: 'Demo2026' } as const

/** Демо-номер для входа по SMS-коду (mock): владелец «Центр Перспектива» и администратор «Дониш» — показывает выбор центра. */
export const DEMO_PHONE = '+992 90 100 10 01'
