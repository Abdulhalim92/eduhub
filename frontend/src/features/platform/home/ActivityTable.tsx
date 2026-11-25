/* «Активность центров» — обзорная таблица без главной кнопки: строка ведёт в реестр, отфильтрованный по центру (PLT-DSH-010, критерий 2).
   В меню — только работающие действия (ui-principles): реестр, вход в кабинет (режим поддержки), финансы центра. */
import { ExternalLink, LogIn, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import type { CenterDto } from '@/api'
import { useRecentActivity } from '@/api/queries'
import { Panel } from '@/components/Panel'
import { QueryError } from '@/components/QueryError'
import { RowActions } from '@/components/RowActions'
import { dataTableClass } from '@/components/table-styles'
import { CenterStatusBadge } from '@/features/centers/CenterStatusBadge'
import { useLoginLabel } from '@/features/centers/use-login-label'
import { useFinanceUi } from '@/features/finance/use-finance-ui'
import { useEnterSupportNav } from '@/features/support/use-enter-support'
import { formatMoney } from '@/lib/format'

const COLS = 6
const registryUrl =(c: Pick<CenterDto, 'name'>) => `/platform/centers?q=${encodeURIComponent(c.name)}`

export function ActivityTable() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const loginLabel = useLoginLabel()
  const { data, error, isPending, refetch } = useRecentActivity(5)
  const finance = useFinanceUi()
  const support = useEnterSupportNav()

  return (
    <Panel className="overflow-hidden" aria-labelledby="activity-title">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 id="activity-title" className="text-sm font-bold text-heading">
            {t('home.activity.title')}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{t('home.activity.subtitle')}</p>
        </div>
        <Link to="/platform/centers" className="text-xs font-semibold whitespace-nowrap text-brand hover:underline">
          {t('home.activity.allCenters')}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className={`${dataTableClass} min-w-176`}>
          <thead>
            <tr>
              <th scope="col">{t('home.activity.columns.center')}</th>
              <th scope="col">{t('home.activity.columns.plan')}</th>
              <th scope="col">{t('home.activity.columns.lastLogin')}</th>
              <th scope="col" className="text-right">{t('home.activity.columns.lessons')}</th>
              <th scope="col">{t('home.activity.columns.status')}</th>
              <th scope="col" className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {error ? (
              <tr>
                <td colSpan={COLS}>
                  <QueryError error={error} onRetry={() => refetch()} />
                </td>
              </tr>
            ) : isPending ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} data-testid="skeleton-row">
                  {Array.from({ length: COLS }, (_, j) => (
                    <td key={j} className="py-4">
                      <div className="h-3 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              data.items.map(c => (
                <tr key={c.id} onClick={() => navigate(registryUrl(c))} className="cursor-pointer transition hover:bg-slate-50">
                  <td className="py-3.5">
                    {/* ссылка — для клавиатуры и «открыть в новой вкладке»; клик по строке делает то же */}
                    <Link to={registryUrl(c)} className="font-semibold text-heading hover:text-brand" onClick={e => e.stopPropagation()}>
                      {c.name}
                    </Link>
                    <div className="text-[11px] text-slate-400">{c.city}</div>
                  </td>
                  <td className="py-3.5 text-slate-600">{c.plan}</td>
                  <td className="py-3.5 text-slate-600">{loginLabel(c)}</td>
                  <td className="py-3.5 text-right text-slate-600 tabular-nums">{t('center.lessons', { count: c.lessons7d })}</td>
                  <td className="py-3.5">
                    <CenterStatusBadge center={c} />
                  </td>
                  <td className="py-3.5 text-right" onClick={e => e.stopPropagation()}>
                    <RowActions
                      label={t('common.actionsFor', { name: c.name })}
                      actions={[
                        {
                          label: t('home.activity.openInRegistry'),
                          hint: t('home.activity.openInRegistryHint'),
                          icon: ExternalLink,
                          onSelect: () => navigate(registryUrl(c)),
                        },
                        ...(c.status === 'blocked'
                          ? []
                          : [{ label: t('support.enterFull'), hint: t('support.enterMenuHint'), icon: LogIn, onSelect: () => support.enter(c.id) }]),
                        {
                          label: t('finance.menu.finance'),
                          hint: t('finance.menu.financeHintShort', { balance: formatMoney(c.balance) }),
                          icon: Wallet,
                          onSelect: () => finance.openFinance(c.id),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {finance.ui}
    </Panel>
  )
}
