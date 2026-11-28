/* Фильтры реестра центров живут в адресе (?q=&plan=&city=&filter=&page=): ссылка с главной открывает реестр уже отфильтрованным,
   «Назад» возвращает прежнюю выдачу, адрес можно отправить коллеге. Значения по умолчанию в адрес не пишутся. */
import { useSearchParams } from 'react-router'
import type { CenterFilter } from '@/api'

export const CENTER_FILTERS: CenterFilter[] = ['all', 'overdraft', 'expiring', 'churn', 'blocked']

export type CentersFilters = { q: string; plan: string; city: string; filter: CenterFilter; page: number }
type FilterKey = Exclude<keyof CentersFilters, 'page'>

const DEFAULTS: CentersFilters = { q: '', plan: 'all', city: 'all', filter: 'all', page: 1 }

function parse(p: URLSearchParams): CentersFilters {
  const filter = p.get('filter') as CenterFilter | null
  const page = Number(p.get('page'))
  return {
    q: (p.get('q') ?? '').trim(),
    plan: p.get('plan') || DEFAULTS.plan,
    city: p.get('city') || DEFAULTS.city,
    filter: filter && CENTER_FILTERS.includes(filter) ? filter : DEFAULTS.filter,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

export function useCentersFilters() {
  const [params, setParams] = useSearchParams()
  const filters = parse(params)

  const write = (patch: Partial<CentersFilters>, replace: boolean) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch) as [keyof CentersFilters, string | number][]) {
          if (v === DEFAULTS[k] || v === '') next.delete(k)
          else next.set(k, String(v))
        }
        return next
      },
      { replace },
    )

  return {
    filters,
    isFiltered: filters.q !== '' || filters.plan !== 'all' || filters.city !== 'all' || filters.filter !== 'all',
    /** Смена фильтра возвращает выдачу на первую страницу (ui-principles). */
    setFilter: (key: FilterKey, value: string) => write({ [key]: value, page: 1 }, true),
    /** Переход по страницам попадает в историю браузера; поправка «страница опустела» — нет. */
    setPage: (page: number, opts: { replace?: boolean } = {}) => write({ page }, !!opts.replace),
    reset: () => setParams({}, { replace: true }),
  }
}
