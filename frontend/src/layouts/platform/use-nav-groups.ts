/* Секции меню платформы сворачиваются; выбор запоминается в localStorage (тот же ключ, что в прототипе).
   Секция с активным пунктом раскрывается сама — при открытии страницы и при переходе; потом её можно свернуть. */
import { useEffect, useState } from 'react'
import type { NavGroup } from '@/app/navigation'

const STORE_KEY = 'liniya.navOpen'
type OpenState = Partial<Record<NavGroup['id'], boolean>>

function readStored(): OpenState {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
    return raw && typeof raw === 'object' ? (raw as OpenState) : {}
  } catch {
    return {} // хранилище недоступно или испорчено — секции по умолчанию
  }
}

const groupOf = (groups: NavGroup[], path: string) => groups.find(g => g.items.some(i => i.to === path))?.id

function withActiveOpen(state: OpenState, groups: NavGroup[], path: string): OpenState {
  const id = groupOf(groups, path)
  return id && !state[id] ? { ...state, [id]: true } : state
}

export function useNavGroups(groups: NavGroup[], activePath: string) {
  const [open, setOpen] = useState<OpenState>(() => withActiveOpen(readStored(), groups, activePath))
  const [seenPath, setSeenPath] = useState(activePath)

  // переход на экран из свёрнутой секции — раскрыть её (обновление состояния во время рендера, без лишнего прохода эффекта)
  if (seenPath !== activePath) {
    setSeenPath(activePath)
    setOpen(s => withActiveOpen(s, groups, activePath))
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(open))
    } catch {
      /* хранилище недоступно — выбор не запомнится */
    }
  }, [open])

  const isOpen = (g: NavGroup) => open[g.id] ?? g.defaultOpen
  const toggle = (g: NavGroup) => setOpen(s => ({ ...s, [g.id]: !(s[g.id] ?? g.defaultOpen) }))
  return { isOpen, toggle }
}
