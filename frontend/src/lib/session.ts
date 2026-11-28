/* Сессия после входа: пользователь и токен доступа сервера — в sessionStorage (живёт до закрытия вкладки).
   Сервер выдаёт токен в теле ответа (backend/internal/auth); на проде лучше httpOnly-cookie — это решение бэкенда, тогда модуль упростится.
   Без сервера (mock) токена нет, кабинеты открыты (демо, Q-023). */
import type { Session } from '@/features/auth/api/types'

const KEY = 'liniya.session'
const TOKEN = 'liniya.token'

const read = (key: string) => {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function saveSession(s: Session, token?: string | null) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ login: s.login, role: s.role, name: s.name, centerId: s.centerId }))
    if (token) sessionStorage.setItem(TOKEN, token)
  } catch {
    /* без хранилища сессия не запомнится */
  }
}

export function getToken(): string | null {
  return read(TOKEN)
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY)
    sessionStorage.removeItem(TOKEN)
  } catch {
    /* ignore */
  }
}
