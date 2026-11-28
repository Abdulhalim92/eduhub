/* Выбор центра кабинета: из адреса (?center=), иначе последний открытый (localStorage), иначе первый в списке.
   Адрес всегда приводится к выбранному центру — перезагрузка и ссылка ведут в тот же центр. */
import { useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useGetCabinetCentersQuery } from './api/cabinetApi'
import { CabinetContext, type Cabinet } from './cabinet-context'

const STORE_KEY = 'eduhub.centerId' // тот же ключ, что в прототипе

/** Новый объект параметров (текущий router хранит у себя — не мутируем). */
const withParam = (p: URLSearchParams, key: string, value: string) => {
  const next = new URLSearchParams(p)
  next.set(key, value)
  return next
}

const readSaved = () => {
  try {
    return Number(localStorage.getItem(STORE_KEY))
  } catch {
    return 0 // хранилище недоступно
  }
}

export function CabinetProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const { data, error, isLoading: isPending, refetch } = useGetCabinetCentersQuery()
  const centers = data ?? []
  const support = params.get('support') === '1'
  const ids = centers.map(c => c.id)
  const centerId = [Number(params.get('center')), readSaved()].find(id => ids.includes(id)) ?? ids[0]
  const center = centers.find(c => c.id === centerId)

  useEffect(() => {
    if (!centerId) return
    try {
      localStorage.setItem(STORE_KEY, String(centerId))
    } catch {
      /* центр не запомнится */
    }
    if (params.get('center') !== String(centerId))
      setParams(p => withParam(p, 'center', String(centerId)), { replace: true })
  }, [centerId, params, setParams])

  const value: Cabinet = {
    center,
    centers,
    support,
    search: centerId ? `?center=${centerId}${support ? '&support=1' : ''}` : '',
    isPending,
    error,
    retry: () => refetch(),
    switchCenter: id => setParams(p => withParam(p, 'center', String(id))),
  }
  return <CabinetContext.Provider value={value}>{children}</CabinetContext.Provider>
}
