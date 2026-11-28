/* Сессия после входа — как в прототипе: в sessionStorage (mock). На проде — httpOnly-cookie от бэкенда, этот модуль заменится.
   Кабинеты пока открыты и без входа (демо, Q-023); защита маршрутов — на шаге авторизации. */
import type { Session } from '@/api'

const KEY = 'liniya.session'

export function saveSession(s: Session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ login: s.login, role: s.role, name: s.name, centerId: s.centerId }))
  } catch {
    /* без хранилища сессия не запомнится */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
