/* Панель «Финансы центра» (PLT-BAL-010…060): баланс на платформе, доступно к расходу, овердрафт, открытые счета, журнал операций.
   Прототип: src/js/components/finance.js. Все признаки и суммы — из DTO (financeStatus, available, fromBalance): правила считает api. */
import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { InvoiceDto } from '@/features/billing/api/types'
import type { CenterDto } from '@/features/centers/api/types'
import type { LedgerEntry } from '@/features/finance/api/types'
import { skipToken } from '@reduxjs/toolkit/query'
import { useGetFinanceQuery } from './api/financeApi'
import { ProgressBar } from '@/components/ProgressBar'
import { QueryError } from '@/components/QueryError'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDay, formatMoney, formatSignedMoney } from '@/lib/format'
import { PayFromBalanceConfirm } from './PayFromBalanceConfirm'
import { cn } from '@/lib/utils'

type Props = {
  centerId: number | null
  onClose: () => void
  onTopUp: (c: CenterDto) => void
  onChangeLimit: (c: CenterDto) => void
}

export function FinanceSheet({ centerId, onClose, onTopUp, onChangeLimit }: Props) {
  const { t } = useTranslation()
  const { data, error, refetch } = useGetFinanceQuery(centerId ?? skipToken)
  // пока перечитывается другой центр — не показывать данные прежнего
  const fin = data && data.center.id === centerId ? data : undefined

  return (
    <Sheet open={centerId !== null} onOpenChange={open => !open && onClose()}>
      {/* ширина — тем же селектором, что у shadcn (data-[side=right]:sm:max-w-sm), иначе его правило сильнее */}
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b border-slate-100 px-6 py-4">
          <SheetTitle className="text-base font-extrabold text-heading">{t('finance.title')}</SheetTitle>
          <SheetDescription className="sr-only">{fin?.center.name ?? t('finance.title')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 touch-pan-y flex-col gap-6 overflow-x-hidden overflow-y-auto overscroll-contain p-6">
          {error && !fin ? (
            <QueryError error={error} onRetry={() => refetch()} />
          ) : !fin ? (
            Array.from({ length: 4 }, (_, i) => <div key={i} data-testid="finance-skeleton" className="h-16 animate-pulse rounded-xl bg-slate-100" />)
          ) : (
            <>
              <CenterHead c={fin.center} />
              <BalanceCard c={fin.center} onTopUp={() => onTopUp(fin.center)} onChangeLimit={() => onChangeLimit(fin.center)} />
              <details className="rounded-xl border border-slate-200 bg-slate-50/60">
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-700 select-none">{t('finance.how.title')}</summary>
                <div className="flex flex-col gap-1.5 px-4 pb-4 text-[11px] leading-relaxed text-slate-500">
                  <p>{t('finance.how.balance')}</p>
                  <p>{t('finance.how.overdraft')}</p>
                  <p>{t('finance.how.repay')}</p>
                </div>
              </details>
              {fin.invoices.length > 0 && <OpenInvoices center={fin.center} invoices={fin.invoices} />}
              <Ledger entries={fin.ledger} />
            </>
          )}
        </div>
        <SheetFooter className="flex-row justify-end border-t border-slate-100 px-6 py-4">
          <Button variant="outline" size="lg" onClick={onClose}>
            {t('common.close')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const sectionTitle = 'text-[11px] font-bold tracking-wider text-slate-400 uppercase'

function CenterHead({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="text-sm font-extrabold text-heading">{c.name}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        {t('finance.meta', { city: c.city, owner: c.owner, plan: c.plan })}
        {c.status === 'blocked' && <StatusBadge tone="rose">{t('center.status.blocked')}</StatusBadge>}
      </div>
    </div>
  )
}

function BalanceCard({ c, onTopUp, onChangeLimit }: { c: CenterDto; onTopUp: () => void; onChangeLimit: () => void }) {
  const { t } = useTranslation()
  const pct = c.overdraftPct ?? 0
  return (
    <section aria-label={t('finance.balance')} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className={sectionTitle}>{t('finance.balance')}</div>
          <div className={cn('mt-1 text-3xl font-extrabold tabular-nums', c.balance < 0 ? 'text-rose-600' : 'text-heading')}>
            {formatMoney(c.balance)}
          </div>
          <div className="mt-2">
            {c.financeStatus === 'critical' ? (
              <StatusBadge tone="rose">{t('center.finance.critical')}</StatusBadge>
            ) : c.financeStatus === 'overdraft' ? (
              <StatusBadge tone="amber">{t('center.finance.overdraft')}</StatusBadge>
            ) : (
              <StatusBadge tone="emerald">{t('finance.positive')}</StatusBadge>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={sectionTitle}>{t('finance.available')}</div>
          <div className="mt-1 text-xl font-extrabold text-heading tabular-nums">{formatMoney(c.available)}</div>
          <div className="mt-1 text-[11px] text-slate-400">{t('finance.availableHint')}</div>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-slate-700">{t('finance.overdraft')}</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              c.overdraftUsed ? (pct >= 80 ? 'text-rose-600' : 'text-amber-600') : 'text-slate-500',
            )}
          >
            {c.overdraftLimit
              ? t('finance.overdraftUsage', { used: formatMoney(c.overdraftUsed), limit: formatMoney(c.overdraftLimit), pct })
              : t('finance.overdraftNone')}
          </span>
        </div>
        <ProgressBar pct={c.overdraftLimit ? pct : 0} className="mt-0 h-2" barClassName={pct >= 80 ? 'bg-rose-500' : 'bg-amber-500'} />
        {!c.overdraftLimit && <p className="mt-1.5 text-[11px] text-slate-400">{t('finance.overdraftNoneHint')}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={onTopUp}>
          {t('finance.topUp')}
        </Button>
        <Button size="lg" variant="outline" onClick={onChangeLimit}>
          {t('finance.changeLimit')}
        </Button>
      </div>
    </section>
  )
}

function dueText(t: TFunction, i: InvoiceDto) {
  if (i.daysLeft === null) return t('finance.due.none')
  if (i.overdue) return t('finance.due.overdue', { count: i.daysOverdue })
  if (i.daysLeft === 0) return t('finance.due.today')
  return t('finance.due.left', { count: i.daysLeft })
}

function OpenInvoices({ center, invoices }: { center: CenterDto; invoices: InvoiceDto[] }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState<InvoiceDto | null>(null)

  return (
    <section className="flex flex-col gap-3" aria-labelledby="fin-invoices">
      <h3 id="fin-invoices" className={sectionTitle}>
        {t('finance.invoices')}
      </h3>
      {invoices.map(i => {
        const fb = i.fromBalance
        return (
          <div key={i.id} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3', i.overdue ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200')}>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-heading">{i.purpose}</div>
              <div className={cn('text-[11px]', i.overdue ? 'font-medium text-rose-600' : 'text-slate-400')}>
                {i.id} · {dueText(t, i)}
              </div>
              {fb && !fb.possible && (
                <div className="text-[11px] text-slate-500">{center.status === 'blocked' ? t('finance.cannotPayBlocked') : t('finance.cannotPay')}</div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-extrabold text-heading tabular-nums">{formatMoney(i.amount)}</span>
              <Button variant="outline" size="sm" disabled={!fb?.possible} onClick={() => setConfirm(i)}>
                {t('finance.payFromBalance')}
              </Button>
            </div>
          </div>
        )
      })}
      <PayFromBalanceConfirm invoice={confirm} onClose={() => setConfirm(null)} />
    </section>
  )
}

function Ledger({ entries }: { entries: LedgerEntry[] }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-3" aria-labelledby="fin-ledger">
      <h3 id="fin-ledger" className={sectionTitle}>
        {t('finance.ledger')}
      </h3>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-[11px]" aria-labelledby="fin-ledger">
          <thead>
            <tr className="bg-slate-50 text-slate-400">
              <th scope="col" className="px-3 py-2 font-medium">{t('finance.columns.date')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('finance.columns.operation')}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t('finance.columns.amount')}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t('finance.columns.after')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  {t('finance.ledgerEmpty')}
                </td>
              </tr>
            ) : (
              entries.map(e => (
                <tr key={e.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatDay(e.at)}</td>
                  <td className="px-3 py-2">
                    <div className={cn('font-medium', e.type === 'topup' ? 'text-emerald-700' : 'text-slate-700')}>{t(`finance.types.${e.type}`)}</div>
                    <div className="text-slate-400">
                      {e.method}
                      {e.reference && ` · ${e.reference}`}
                    </div>
                  </td>
                  <td className={cn('px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums', e.amount > 0 ? 'text-emerald-600' : 'text-slate-700')}>
                    {formatSignedMoney(e.amount)}
                  </td>
                  <td className={cn('px-3 py-2 text-right whitespace-nowrap tabular-nums', e.balanceAfter < 0 ? 'text-rose-600' : 'text-slate-600')}>
                    {formatMoney(e.balanceAfter)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
