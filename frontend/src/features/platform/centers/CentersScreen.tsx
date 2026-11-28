/* Экран «Все центры» — реестр учебных центров (PLT-CTR-010). Прототип: src/js/views/platform/centers.js. */
import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCentersList } from '@/api/queries'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { compact, useCenterActions } from '@/features/centers/use-center-actions'
import { formatNumber } from '@/lib/format'
import { PAGE_SIZE, pageCount } from '@/lib/pager'
import { CentersFilters } from './CentersFilters'
import { CentersTable } from './CentersTable'
import { CentersTiles } from './CentersTiles'
import { useCentersFilters } from './use-centers-filters'

export function CentersScreen() {
  const { t } = useTranslation()
  const filtersState = useCentersFilters()
  const { filters, setPage, reset } = filtersState
  const { q, plan, city, filter, page } = filters
  const list = useCentersList({ q, plan, city, filter, page, pageSize: PAGE_SIZE })
  const data = list.data
  const actions = useCenterActions()

  // страница опустела (ссылка на 9-ю страницу, центр ушёл из выборки) — показать последнюю существующую
  const lastPage = data ? pageCount(data.total) : 1
  const pageGone = !!data && !list.isPlaceholderData && data.items.length === 0 && data.total > 0 && page > lastPage
  useEffect(() => {
    if (pageGone) setPage(lastPage, { replace: true })
  }, [pageGone, lastPage, setPage])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('centers.title')}
        subtitle={t('centers.subtitle')}
        actions={
          <Button asChild size="lg">
            <Link to="/platform/centers/new">
              <Plus aria-hidden />
              {t('centers.register')}
            </Link>
          </Button>
        }
      />
      <CentersTiles data={data} />
      <Panel className="flex min-h-120 flex-col overflow-hidden">
        <CentersFilters state={filtersState} />
        <CentersTable
          data={data}
          error={list.error}
          isPending={list.isPending || pageGone /* пока страница исправляется — загрузка, а не «Ничего не найдено» */}
          isRefreshing={list.isPlaceholderData}
          onRetry={() => list.refetch()}
          onReset={reset}
          primaryFor={actions.enterButton}
          actionsFor={c =>
            compact([actions.item.finance(c), actions.item.topUp(c), actions.item.sms(c), actions.item.planChange(c), actions.item.modules(c)])
          }
        />
        {data && (
          <Pager
            page={page}
            total={data.total}
            note={t('centers.platformTotal', { value: formatNumber(data.platformTotal) })}
            onPage={n => setPage(n)}
          />
        )}
      </Panel>
      {actions.ui}
    </div>
  )
}
