/* Фильтры экрана-списка в адресе (?key=value&page=N): ссылку можно отправить, «Назад» возвращает прежнюю выдачу.
   Значения по умолчанию в адрес не пишутся; неизвестное значение (из старой ссылки) считается значением по умолчанию.
   Смена фильтра возвращает на первую страницу (ui-principles). */
import { useSearchParams } from 'react-router'

export function useUrlFilters<K extends string>(defaults: Record<K, string>, allowed: Partial<Record<K, readonly string[]>> = {}) {
  const [params, setParams] = useSearchParams()
  const keys = Object.keys(defaults) as K[]
  const values = Object.fromEntries(
    keys.map(k => {
      const v = params.get(k)
      const ok = v !== null && v !== '' && (!allowed[k] || allowed[k]!.includes(v))
      return [k, ok ? v : defaults[k]]
    }),
  ) as Record<K, string>
  const rawPage = Number(params.get('page'))
  const page = Number.isInteger(rawPage) && rawPage > 1 ? rawPage : 1

  const write = (patch: Record<string, string | number>, replace: boolean) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          const isDefault = k === 'page' ? Number(v) <= 1 : v === defaults[k as K] || v === ''
          if (isDefault) next.delete(k)
          else next.set(k, String(v))
        }
        return next
      },
      { replace },
    )

  return {
    values,
    page,
    isFiltered: (only: K[] = keys) => only.some(k => values[k] !== defaults[k]),
    set: (key: K, value: string) => write({ [key]: value, page: 1 }, true),
    setPage: (n: number) => write({ page: n }, false),
    reset: (only: K[] = keys) => write(Object.fromEntries([...only.map(k => [k, defaults[k]]), ['page', 1]]), true),
  }
}

/** Клиентская пагинация уже загруженного списка: страница не выходит за пределы. */
export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const p = Math.min(Math.max(1, page), pages)
  return { items: items.slice((p - 1) * size, p * size), page: p, total: items.length }
}
