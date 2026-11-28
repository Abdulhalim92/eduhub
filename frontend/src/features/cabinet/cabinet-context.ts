/* Контекст кабинета центра: какой центр открыт и вошёл ли SuperAdmin в режиме поддержки.
   Адрес: /center/<экран>?center=<id>[&support=1] (прототип: center-app.js). Провайдер — CabinetProvider в CenterLayout. */
import { createContext, useContext } from 'react'
import type { CabinetCenter } from '@/api'

export type Cabinet = {
  /** Открытый центр; undefined — список ещё грузится или пуст. */
  center: CabinetCenter | undefined
  centers: CabinetCenter[]
  /** Вход SuperAdmin из кабинета платформы (PLT-CTR-050): баннер и выход обратно. */
  support: boolean
  /** «?center=…&support=1» — добавляется ко всем ссылкам внутри кабинета, чтобы не терять центр и режим. */
  search: string
  isPending: boolean
  error: unknown
  retry: () => void
  switchCenter: (id: number) => void
}

export const CabinetContext = createContext<Cabinet | null>(null)

export function useCabinet(): Cabinet {
  const ctx = useContext(CabinetContext)
  if (!ctx) throw new Error('useCabinet: нет CabinetProvider (используется вне кабинета центра)')
  return ctx
}
