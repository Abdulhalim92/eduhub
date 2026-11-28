/* «Смена тарифа центра» (PLT-TRF-020/030) — прототип: components/plan-change.js.
   Тариф не меняется напрямую (BR-001): выставляется счёт, тариф сменится после оплаты. Исключения: бесплатный тариф — сразу;
   «списать с баланса» — сразу с оплатой; «сменить сейчас, оплата позже» — решение SuperAdmin с подтверждением.
   Пока счёт открыт (BR-007), вместо выбора тарифа — действия с этим счётом. Вместимость и прочие правила проверяет сервер (BR-008). */
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/errors'
import type { InvoiceDto } from '@/features/billing/api/types'
import type { CenterDto, UsageItem } from '@/features/centers/api/types'
import type { AuditEntry, PlanChangeInfo, PlanOption } from '@/features/plans/api/types'
import { skipToken } from '@reduxjs/toolkit/query'
import { usePayOnlineMutation } from '@/features/billing/api/billingApi'
import { useGetPlanChangeQuery, useRequestPlanChangeMutation } from './api/planChangeApi'
import { ChoiceCard } from '@/components/ChoiceCard'
import { Field } from '@/components/Field'
import { fieldAria, inputClass } from '@/components/form-styles'
import { QueryError } from '@/components/QueryError'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CancelInvoiceDialog } from '@/features/billing/CancelInvoiceDialog'
import { paidMessage } from '@/features/billing/paid-message'
import { PaymentConfirmDialog } from '@/features/billing/PaymentConfirmDialog'
import { PayFromBalanceConfirm } from '@/features/finance/PayFromBalanceConfirm'
import { formatDateTime, formatDay, formatMoney } from '@/lib/format'
import { applyServerErrors } from '@/lib/server-errors'
import { cn } from '@/lib/utils'

const sectionTitle = 'text-[11px] font-bold tracking-wider text-slate-400 uppercase'

/** Предвыбор из «Центры у лимита»: тариф и причина подставлены, их можно поправить. */
export type PlanChangePreset = { planId: string; reason: string }

export function PlanChangeDialog({ centerId, preset, onClose }: { centerId: number | null; preset?: PlanChangePreset | null; onClose: () => void }) {
  const { t } = useTranslation()
  const info = useGetPlanChangeQuery(centerId ?? skipToken)
  const data = info.data && info.data.center.id === centerId ? info.data : undefined
  const [requestPlanChange, { isLoading: requesting }] = useRequestPlanChangeMutation()
  // диалоги поверх: подтверждение оплаты, списание с баланса, отмена счёта
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [payInvoice, setPayInvoice] = useState<InvoiceDto | null>(null)
  const [cancelInvoice, setCancelInvoice] = useState<InvoiceDto | null>(null)
  const c = data?.center

  return (
    <>
      <Dialog open={centerId !== null} onOpenChange={open => !open && !requesting && onClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto [--dialog-p:--spacing(6)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-heading">{t('planChange.title', { name: c?.name ?? '…' })}</DialogTitle>
            <DialogDescription>{c ? t('planChange.meta', { city: c.city, owner: c.owner, phone: c.phone }) : ' '}</DialogDescription>
          </DialogHeader>
          {info.error && !data ? (
            <QueryError error={info.error} onRetry={() => info.refetch()} />
          ) : !data ? (
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <div className="flex flex-col gap-5">
              <CurrentPlan c={data.center} />
              {data.pending ? (
                <PendingInvoice
                  inv={data.pending}
                  onConfirm={() => setConfirmId(data.pending!.id)}
                  onPayFromBalance={() => setPayInvoice(data.pending)}
                  onCancel={() => setCancelInvoice(data.pending)}
                  onPaid={onClose}
                />
              ) : (
                // key: после смены тарифа (или отмены счёта) форма начинается заново
                <PlanForm
                  key={`${data.center.plan}-${data.options.length}`}
                  info={data}
                  preset={preset}
                  requestPlanChange={requestPlanChange} requesting={requesting}
                  onDone={onClose}
                  onRefresh={() => info.refetch()}
                />
              )}
              <History items={data.history} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PaymentConfirmDialog invoiceId={confirmId} onClose={() => setConfirmId(null)} onPaid={onClose} />
      <PayFromBalanceConfirm invoice={payInvoice} onClose={() => setPayInvoice(null)} onPaid={onClose} />
      <CancelInvoiceDialog invoice={cancelInvoice} onClose={() => setCancelInvoice(null)} />
    </>
  )
}

function UsageRow({ u }: { u: UsageItem }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span className="w-28 text-slate-600">{u.label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div
          className={cn('h-full', u.pct >= 100 ? 'bg-rose-500' : u.pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')}
          style={{ width: `${Math.min(100, u.pct)}%` }}
        />
      </div>
      <span className="w-28 text-right font-semibold text-slate-700 tabular-nums">{t('planChange.usage', { used: u.used, limit: u.limit, pct: u.pct })}</span>
    </div>
  )
}

function CurrentPlan({ c }: { c: CenterDto }) {
  const { t } = useTranslation()
  return (
    <section aria-label={t('planChange.now')} className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className={sectionTitle}>{t('planChange.now')}</div>
        <StatusBadge tone="slate">
          {t('planChange.currentPlan', {
            plan: c.plan,
            price: c.monthlyPrice ? t('planChange.perMonth', { price: formatMoney(c.monthlyPrice) }) : t('planChange.free'),
          })}
        </StatusBadge>
      </div>
      {c.usage.map(u => (
        <UsageRow key={u.key} u={u} />
      ))}
    </section>
  )
}

/** Подписи использования лимитов по ключу (у сервера подпись «Хранилище, ГБ» — для фразы нужна единица после числа). */
const usageText = (t: TFunction, u: UsageItem) => t(`planChange.usage2.${u.key}`, { used: u.used, limit: u.limit })

/** Тариф, в который центр помещается: цена и разница словами, можно ли оплатить с баланса, что будет занято после перехода. */
function OptionCard({ o, checked, onSelect }: { o: PlanOption; checked: boolean; onSelect: () => void }) {
  const { t } = useTranslation()
  return (
    <ChoiceCard
      checked={checked}
      onSelect={onSelect}
      title={o.name}
      aside={
        <span className="text-xs font-extrabold whitespace-nowrap text-heading">
          {o.price ? t('planChange.perMonth', { price: formatMoney(o.price) }) : t('planChange.freeCap')}
        </span>
      }
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {o.recommended && <StatusBadge tone="emerald">{t('planChange.recommended')}</StatusBadge>}
        {o.delta !== 0 && (
          <span className={cn('font-medium', o.delta < 0 ? 'text-slate-600' : 'text-slate-700')}>
            {t(o.delta < 0 ? 'planChange.cheaper' : 'planChange.pricier', { value: formatMoney(Math.abs(o.delta)) })}
          </span>
        )}
      </span>
      {o.price > 0 && (
        <span className={cn('mt-1 block', o.payable ? 'text-emerald-700' : 'text-slate-500')}>
          {o.payable ? `✓ ${t('planChange.payableHint')}` : t('planChange.notPayableHint')}
        </span>
      )}
      <span className="mt-2 block text-slate-500">{t('planChange.afterTitle')}</span>
      <span className="mt-1 flex flex-wrap gap-1.5">
        {o.after.map(u => (
          <span
            key={u.key}
            className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', u.pct >= 80 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}
          >
            {usageText(t, u)}
            {u.pct >= 80 && ` · ${u.pct}%`}
          </span>
        ))}
      </span>
    </ChoiceCard>
  )
}

/** Тарифы, в которые центр не помещается (BR-008): свёрнуты в один блок с короткой причиной — не мешают выбору. */
function UnfitPlans({ options }: { options: PlanOption[] }) {
  const { t } = useTranslation()
  if (!options.length) return null
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/60 text-[11px]">
      <summary className="cursor-pointer list-none px-3 py-2.5 font-semibold text-slate-600 select-none">
        <span className="mr-1.5 inline-block transition group-open:rotate-90" aria-hidden>
          ›
        </span>
        {t('planChange.unfitTitle', { names: options.map(o => o.name).join(', ') })}
      </summary>
      <div className="flex flex-col gap-2 border-t border-slate-200 px-3 py-2.5">
        <p className="text-slate-500">{t('planChange.unfitHint')}</p>
        <ul className="flex flex-col gap-2">
          {options.map(o => (
            <li key={o.id}>
              <span className="font-semibold text-slate-700">
                {o.name} · {o.price ? t('planChange.perMonth', { price: formatMoney(o.price) }) : t('planChange.freeCap')}
              </span>
              <span className="block text-rose-600">
                {o.exceeded.map(u => t(`planChange.over.${u.key}`, { used: u.used, limit: u.limit })).join('; ')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

type PayMode = 'invoice' | 'balance' | 'defer'
type Form = { plan: string; reason: string; payMode: PayMode; deferConfirmed: boolean; payment: string }

type PlanFormProps = {
  info: PlanChangeInfo
  preset?: PlanChangePreset | null
  requestPlanChange: ReturnType<typeof useRequestPlanChangeMutation>[0]
  requesting: boolean
  onDone: () => void
  onRefresh: () => void
}

function PlanForm({ info, preset, requestPlanChange, requesting, onDone, onRefresh }: PlanFormProps) {
  const { t } = useTranslation()
  const { center: c, options } = info
  const initial = options.find(o => o.id === preset?.planId && o.fits) ?? options.find(o => o.recommended && o.fits) ?? options.find(o => o.fits)
  const { register, handleSubmit, control, setValue, setError, clearErrors, formState } = useForm<Form>({
    defaultValues: { plan: initial?.id ?? '', reason: preset?.reason ?? '', payMode: 'invoice', deferConfirmed: false, payment: '' },
  })
  const errors = formState.errors
  const [planId, payMode, deferConfirmed] = useWatch({ control, name: ['plan', 'payMode', 'deferConfirmed'] })
  const sel = options.find(o => o.id === planId)

  const pickPlan = (o: PlanOption) => {
    setValue('plan', o.id)
    clearErrors()
    // бесплатный тариф оплачивать не нужно; «с баланса» — только если хватает
    if (o.price === 0 || (payMode === 'balance' && !o.payable)) {
      setValue('payMode', 'invoice')
      setValue('deferConfirmed', false)
    }
  }
  const pickMode = (m: PayMode) => {
    setValue('payMode', m)
    if (m !== 'defer') setValue('deferConfirmed', false)
    clearErrors('payment')
  }

  const onSubmit = handleSubmit(async v => {
    if (!sel) return
    const paid = sel.price > 0
    try {
      const r = await requestPlanChange({
        centerId: c.id,
        payload: {
          planId: sel.id,
          reason: v.reason,
          payFromBalance: paid && v.payMode === 'balance',
          deferPayment: paid && v.payMode === 'defer',
          deferConfirmed: v.deferConfirmed,
        },
      }).unwrap()
      const amount = r.invoice ? formatMoney(r.invoice.amount) : ''
      if (r.mode === 'invoice') {
        // остаёмся в окне: теперь видны счёт и действия оплаты
        toast.success(t('planChange.done.invoice', { id: r.invoice?.id ?? '', amount }))
        return
      }
      if (r.mode === 'deferred')
        toast.success(t('planChange.done.deferred', { name: r.center.name, plan: r.center.plan, id: r.invoice?.id ?? '', date: r.invoice?.dueAt ? formatDay(r.invoice.dueAt) : '' }))
      else toast.success(t(r.mode === 'paid' ? 'planChange.done.paid' : 'planChange.done.applied', { name: r.center.name, plan: r.center.plan, amount }))
      onDone()
    } catch (e) {
      if (applyServerErrors(e, setError, ['plan', 'reason', 'payment'])) return
      toast.error(errorMessage(e, t('common.saveError')))
      if (isApiError(e) && e.code === 'CONFLICT') onRefresh() // например, счёт уже выставлен из другой вкладки
    }
  })

  const summary = !sel
    ? null
    : sel.price === 0
      ? t('planChange.summary.free', { plan: sel.name })
      : payMode === 'defer'
        ? t('planChange.summary.defer', { price: formatMoney(sel.price) })
        : payMode === 'balance'
          ? t('planChange.summary.balance', { price: formatMoney(sel.price) })
          : t(sel.delta < 0 ? 'planChange.summary.invoiceDown' : 'planChange.summary.invoice', { price: formatMoney(sel.price) })

  const submitLabel = !sel
    ? t('planChange.submit.choose')
    : sel.price === 0
      ? t('planChange.submit.free', { plan: sel.name })
      : t(`planChange.submit.${payMode}`, { price: formatMoney(sel.price) })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className={cn(sectionTitle, 'mb-2')}>{t('planChange.newPlan')}</legend>
        {/* сначала то, что можно выбрать; неподходящие — одним свёрнутым блоком ниже */}
        {!options.length ? (
          <p className="text-xs text-slate-500">{t('planChange.noOptions')}</p>
        ) : (
          <>
            {options.some(o => o.fits) ? (
              <div role="radiogroup" aria-label={t('planChange.newPlan')} className="flex flex-col gap-2">
                {options
                  .filter(o => o.fits)
                  .map(o => (
                    <OptionCard key={o.id} o={o} checked={o.id === planId} onSelect={() => pickPlan(o)} />
                  ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{t('planChange.noFitting')}</p>
            )}
            <UnfitPlans options={options.filter(o => !o.fits)} />
          </>
        )}
        {errors.plan && <span role="alert" className="text-[11px] text-rose-600">{errors.plan.message}</span>}
      </fieldset>

      <Field label={t('planChange.reason')} htmlFor="pc-reason" required hint={t('planChange.reasonHint')} error={errors.reason?.message}>
        <textarea
          rows={2}
          placeholder={t('planChange.reasonPlaceholder')}
          className={inputClass(errors.reason)}
          {...fieldAria('pc-reason', errors.reason?.message, true)}
          {...register('reason', { onChange: () => clearErrors('reason') })}
        />
      </Field>

      {sel && sel.price > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[11px] font-semibold text-slate-600">{t('planChange.howToPay')}</legend>
          <div role="radiogroup" aria-label={t('planChange.howToPay')} className="flex flex-col gap-2">
            <ChoiceCard checked={payMode === 'invoice'} onSelect={() => pickMode('invoice')} title={t('planChange.modes.invoice')}>
              {t('planChange.modes.invoiceText')}
            </ChoiceCard>
            <ChoiceCard checked={payMode === 'balance'} disabled={!sel.payable} onSelect={() => pickMode('balance')} title={t('planChange.modes.balance')}>
              {sel.payable ? (
                <>
                  {t('planChange.modes.balanceOk', { balance: formatMoney(c.balance), available: formatMoney(c.available), after: formatMoney(sel.balanceAfter) })}
                  {sel.balanceAfter < 0 && <span className="text-amber-700"> {t('planChange.modes.balanceOverdraft')}</span>}
                </>
              ) : (
                <span className="text-rose-600">{t('planChange.modes.balanceShort', { available: formatMoney(c.available), price: formatMoney(sel.price) })}</span>
              )}
            </ChoiceCard>
            <ChoiceCard checked={payMode === 'defer'} onSelect={() => pickMode('defer')} title={t('planChange.modes.defer')}>
              {t('planChange.modes.deferText')}
            </ChoiceCard>
          </div>
          {payMode === 'defer' && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={deferConfirmed}
                onChange={e => {
                  setValue('deferConfirmed', e.target.checked)
                  clearErrors('payment')
                }}
                className="mt-0.5 size-4 accent-brand"
              />
              <span>{t('planChange.modes.deferConfirm')}</span>
            </label>
          )}
          {errors.payment && <span role="alert" className="text-[11px] text-rose-600">{errors.payment.message}</span>}
        </fieldset>
      )}

      {summary && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">{summary}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone} disabled={requesting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={!sel || requesting}>
          {requesting ? t('planChange.submit.busy') : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

type PendingProps = { inv: InvoiceDto; onConfirm: () => void; onPayFromBalance: () => void; onCancel: () => void; onPaid: () => void }

function PendingInvoice({ inv, onConfirm, onPayFromBalance, onCancel, onPaid }: PendingProps) {
  const { t } = useTranslation()
  const [payOnline, { isLoading: payingOnline }] = usePayOnlineMutation()
  const canPay = !!inv.fromBalance?.possible

  const demoOnline = async () => {
    try {
      const paid = await payOnline(inv.id).unwrap()
      toast.success(paidMessage(t, paid))
      onPaid()
    } catch (e) {
      toast.error(errorMessage(e, t('common.saveError')))
    }
  }

  return (
    <section aria-label={t('planChange.pending.title', { id: inv.id })} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-amber-900">
            {t('planChange.pending.title', { id: inv.id })}
            {inv.deferred && ` · ${t('planChange.pending.deferredMark')}`}
          </div>
          <div className="mt-0.5 text-[11px] text-amber-800">{t('planChange.pending.issued', { purpose: inv.purpose, date: formatDateTime(inv.issuedAt) })}</div>
          {inv.reason && <div className="mt-0.5 text-[11px] text-amber-800/80">{t('planChange.pending.reason', { reason: inv.reason })}</div>}
        </div>
        <div className="text-base font-extrabold whitespace-nowrap text-amber-900 tabular-nums">{formatMoney(inv.amount)}</div>
      </div>
      <p className="text-[11px] leading-relaxed text-amber-900">
        {inv.deferred && inv.plan ? t('planChange.pending.textDeferred', { plan: inv.plan.fromName }) : t('planChange.pending.text')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm}>{t('planChange.pending.confirm')}</Button>
        <Button variant="outline" onClick={onPayFromBalance} disabled={!canPay}>
          {t('planChange.pending.payFromBalance')}
        </Button>
        <Button variant="outline" className="border-dashed" onClick={demoOnline} disabled={payingOnline}>
          {t('planChange.pending.demoOnline')}
        </Button>
        <Button variant="outline" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={onCancel}>
          {inv.deferred ? t('planChange.pending.cancelDeferred') : t('planChange.pending.cancel')}
        </Button>
      </div>
      {!canPay && <p className="text-[11px] text-amber-800">{t('planChange.pending.cannotPay')}</p>}
    </section>
  )
}

const HISTORY_KEYS = {
  'plan.changed': 'planChange.history.plan_changed',
  'invoice.created': 'planChange.history.invoice_created',
  'invoice.paid': 'planChange.history.invoice_paid',
  'invoice.cancelled': 'planChange.history.invoice_cancelled',
} as const

function History({ items }: { items: AuditEntry[] }) {
  const { t } = useTranslation()
  if (!items.length) return null
  return (
    <section aria-labelledby="pc-history" className="flex flex-col gap-2">
      <h3 id="pc-history" className={sectionTitle}>
        {t('planChange.history.title')}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map(h => (
          <li key={h.id} className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-slate-700">
              <strong>{h.action in HISTORY_KEYS ? t(HISTORY_KEYS[h.action as keyof typeof HISTORY_KEYS]) : h.action}</strong>
              {h.reason && ` · ${h.reason}`}
            </span>
            <span className="whitespace-nowrap text-slate-400">{formatDateTime(h.at)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
