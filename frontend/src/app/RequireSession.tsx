/* Кабинеты при работе с сервером (VITE_API_MODE=http) — только после входа: без токена сервер ничего не отдаст.
   Без сервера (демо на mock) кабинеты открыты, как и решено для прототипа (Q-023). */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { API_MODE } from '@/api/baseApi'
import { getToken } from '@/lib/session'

export function RequireSession({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (API_MODE === 'http' && !getToken()) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}
