/* Панель фильтров реестра: поиск, тариф, город, чипы со счётчиками из «Требует внимания», «Сбросить фильтры». */
import { useTranslation } from 'react-i18next'
import type { Attention, CenterFilter } from '@/api'
import { useAttention, useDictionaries } from '@/api/queries'
import { FilterChip, FilterSelect, SearchInput } from '@/components/filters'
import { CENTER_FILTERS, type useCentersFilters } from './use-centers-filters'

const CHIP_COUNT: Record<Exclude<CenterFilter, 'all'>, (a: Attention) => number> = {
  overdraft: a => a.overdraft,
  expiring: a => a.expiring,
  churn: a => a.churn,
  blocked: a => a.blocked,
}

export function CentersFilters({ state }: { state: ReturnType<typeof useCentersFilters> }) {
  const { t } = useTranslation()
  const { filters, setFilter, isFiltered, reset } = state
  const dict = useDictionaries().data
  const attention = useAttention().data

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
      <SearchInput
        value={filters.q}
        onChange={v => setFilter('q', v)}
        label={t('centers.filters.search')}
        placeholder={t('centers.filters.searchPlaceholder')}
      />
      <FilterSelect label={t('centers.filters.plan')} value={filters.plan} onChange={v => setFilter('plan', v)}>
        <option value="all">{t('centers.filters.allPlans')}</option>
        {dict?.plans.map(p => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label={t('centers.filters.city')} value={filters.city} onChange={v => setFilter('city', v)}>
        <option value="all">{t('centers.filters.allCities')}</option>
        {dict?.cities.map(c => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </FilterSelect>
      <div role="group" aria-label={t('centers.filters.quick')} className="flex flex-wrap items-center gap-2">
        {CENTER_FILTERS.map(f => {
          const label = t(`centers.filters.chips.${f}`)
          const count = f !== 'all' && attention ? CHIP_COUNT[f](attention) : null
          return (
            <FilterChip key={f} active={filters.filter === f} onClick={() => setFilter('filter', f)}>
              {count === null ? label : t('centers.filters.chipCount', { label, count })}
            </FilterChip>
          )
        })}
      </div>
      {isFiltered && (
        <button type="button" onClick={reset} className="text-xs font-semibold text-brand hover:underline">
          {t('common.resetFilters')}
        </button>
      )}
    </div>
  )
}
