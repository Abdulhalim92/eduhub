/* Экран «Все центры» — реестр учебных центров (PLT-CTR-010). Прототип: src/js/views/platform/centers.js. */
import { ArrowLeftRight, CirclePlus, MessageSquarePlus, Plus, SlidersHorizontal, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { CenterDto } from '@/api'
import { useCentersList } from '@/api/queries'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { AdminAccessDialog } from '@/features/access/AdminAccessDialog'
import { useFinanceUi } from '@/features/finance/use-finance-ui'
import { ModulesSheet } from '@/features/modules/ModulesSheet'
import { PlanChangeDialog } from '@/features/plans/PlanChangeDialog'
import { SmsAccrueDialog } from '@/features/sms/SmsAccrueDialog'
import { useEnterSupportNav } from '@/features/support/use-enter-support'
import { formatMoney, formatNumber } from '@/lib/format'
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
  const finance = useFinanceUi()
  const support = useEnterSupportNav()
  const [smsCenter, setSmsCenter] = useState<CenterDto | null>(null)
  const [planCenterId, setPlanCenterId] = useState<number | null>(null)
  const [modulesCenter, setModulesCenter] = useState<CenterDto | null>(null)
  const [accessCenter, setAccessCenter] = useState<CenterDto | null>(null)

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
          primaryFor={c =>
            c.status === 'blocked' ? null : (
              <Button
                size="sm"
                onClick={() => support.enter(c.id)}
                disabled={support.pendingId === c.id}
                aria-label={t('support.enterHint', { name: c.name })}
                title={t('support.enterHint', { name: c.name })}
              >
                {support.pendingId === c.id ? t('support.entering') : t('support.enter')}
              </Button>
            )
          }
          actionsFor={c => [
            {
              label: t('finance.menu.finance'),
              hint: t('finance.menu.financeHint', { balance: formatMoney(c.balance), limit: formatMoney(c.overdraftLimit) }),
              icon: Wallet,
              onSelect: () => finance.openFinance(c.id),
            },
            { label: t('finance.menu.topUp'), hint: t('finance.menu.topUpHint'), icon: CirclePlus, onSelect: () => finance.openTopUp(c) },
            // заблокированному центру начислить SMS и сменить тариф нельзя (BR-012) — пункты не показываем
            ...(c.status === 'blocked'
              ? []
              : [
                  {
                    label: t('smsAccrue.menu'),
                    hint: c.smsBalance
                      ? t('smsAccrue.menuHint', { value: t('common.count.pcs', { value: formatNumber(c.smsBalance) }) })
                      : t('smsAccrue.menuHintNone'),
                    icon: MessageSquarePlus,
                    onSelect: () => setSmsCenter(c),
                  },
                  { label: t('planChange.menu'), hint: t('planChange.menuHint', { plan: c.plan }), icon: ArrowLeftRight, onSelect: () => setPlanCenterId(c.id) },
                ]),
            { label: t('modules.menu'), hint: t('modules.menuHint'), icon: SlidersHorizontal, onSelect: () => setModulesCenter(c) },
          ]}
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
      {finance.ui}
      <SmsAccrueDialog center={smsCenter} onClose={() => setSmsCenter(null)} />
      <PlanChangeDialog centerId={planCenterId} onClose={() => setPlanCenterId(null)} />
      <ModulesSheet
        center={modulesCenter}
        onClose={() => setModulesCenter(null)}
        onEnter={c => support.enter(c.id)}
        onAdminAccess={c => {
          setModulesCenter(null)
          setAccessCenter(c)
        }}
        onChangePlan={c => {
          setModulesCenter(null)
          setPlanCenterId(c.id)
        }}
      />
      <AdminAccessDialog center={accessCenter} onClose={() => setAccessCenter(null)} />
    </div>
  )
}
