/* «Подтвердить поступление оплаты» (PLT-BIL-040): деньги УЖЕ получены вне системы — способ, документ, дата, сумма (= сумме счёта), подтверждение.
   Необратимо, пишется в журнал аудита (BR-002). Прототип: components/payments.js. */
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/errors'
import type { InvoiceDto } from '@/features/billing/api/types'
import type { PayChannel } from '@/features/dictionaries/api/types'
import { skipToken } from '@reduxjs/toolkit/query'
import { useGetDictionariesQuery } from '@/features/dictionaries/api/dictionariesApi'
import { useConfirmPaymentMutation, useGetInvoiceQuery } from './api/billingApi'
import { Field } from '@/components/Field'
import { fieldAria, inputClass } from '@/components/form-styles'
import { QueryError } from '@/components/QueryError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MethodPicker } from '@/features/finance/MethodPicker'
import { formatDay, formatMoney, todayUtc } from '@/lib/format'
import { applyServerErrors } from '@/lib/server-errors'
import { cn } from '@/lib/utils'
import { paidMessage } from './paid-message'

type Props = { invoiceId: string | null; onClose: () => void; onPaid?: (inv: InvoiceDto) => void }

export function PaymentConfirmDialog({ invoiceId, onClose, onPaid }: Props) {
  const { t } = useTranslation()
  const [confirmPayment, { isLoading: confirming }] = useConfirmPaymentMutation()
  const invoice = useGetInvoiceQuery(invoiceId ?? skipToken)
  const inv = invoice.data && invoice.data.id === invoiceId ? invoice.data : undefined
  return (
    <Dialog open={invoiceId !== null} onOpenChange={open => !open && !confirming && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto [--dialog-p:--spacing(6)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold text-heading">{t('billing.confirm.title')}</DialogTitle>
          <DialogDescription>{inv ? t('billing.confirm.sub', { id: inv.id, name: inv.centerName }) : invoiceId}</DialogDescription>
        </DialogHeader>
        {invoice.error && !inv ? (
          <QueryError error={invoice.error} onRetry={() => invoice.refetch()} />
        ) : !inv ? (
          <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <ConfirmForm invoice={inv} confirmPayment={confirmPayment} confirming={confirming} onClose={onClose} onPaid={onPaid} />
        )}
      </DialogContent>
    </Dialog>
  )
}

type Form = { method: string; reference: string; receivedOn: string; receivedAmount: string; comment: string; confirmed: boolean }
const ERROR_ORDER = ['method', 'reference', 'receivedOn', 'receivedAmount', 'confirmed'] as const
const CONFIRM_TEXT: Partial<Record<PayChannel, 'bank' | 'cash' | 'card'>> = { bank: 'bank', cash: 'cash', card: 'card' }

type FormProps = {
  invoice: InvoiceDto
  confirmPayment: ReturnType<typeof useConfirmPaymentMutation>[0]
  confirming: boolean
  onClose: () => void
  onPaid?: (inv: InvoiceDto) => void
}

function ConfirmForm({ invoice: i, confirmPayment, confirming, onClose, onPaid }: FormProps) {
  const { t } = useTranslation()
  const methods = useGetDictionariesQuery().data?.payMethods ?? []
  const { register, handleSubmit, control, setValue, setError, clearErrors, formState } = useForm<Form>({
    defaultValues: { method: methods[0]?.method ?? '', reference: '', receivedOn: todayUtc(), receivedAmount: String(i.amount), comment: '', confirmed: false },
  })
  const errors = formState.errors
  const method = useWatch({ control, name: 'method' })
  const pm = methods.find(m => m.method === method) ?? methods[0]
  const field = (name: keyof Form) => register(name, { onChange: () => clearErrors(name) })
  const effect = i.kind === 'trial' ? null : t(`billing.confirm.effect.${i.kind}`)

  const onSubmit = handleSubmit(async v => {
    try {
      const paid = await confirmPayment({
        invoiceId: i.id,
        payload: { ...v, receivedAmount: v.receivedAmount === '' ? null : Number(v.receivedAmount) },
      }).unwrap()
      toast.success(paidMessage(t, paid))
      onClose()
      onPaid?.(paid)
    } catch (e) {
      if (applyServerErrors(e, setError, [...ERROR_ORDER])) return
      toast.error(errorMessage(e, t('common.saveError')))
      if (isApiError(e) && e.code === 'CONFLICT') onClose() // счёт уже закрыт — данные перечитаются
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="min-w-0">
          <div className="text-xs font-bold text-heading">{i.purpose}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {t('billing.confirm.issued', { date: formatDay(i.issuedAt) })}
            {i.dueAt && ` · ${t('billing.confirm.due', { date: formatDay(i.dueAt) })}`}
          </div>
        </div>
        <div className="text-lg font-extrabold whitespace-nowrap text-heading tabular-nums">{formatMoney(i.amount)}</div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
        <strong>{t('billing.confirm.warningStrong')}</strong> {t('billing.confirm.warning')}
        {effect && (
          <>
            <br />
            {effect}
          </>
        )}
      </div>

      <MethodPicker
        methods={methods}
        value={method}
        label={t('billing.confirm.method')}
        error={errors.method?.message}
        onChange={m => {
          setValue('method', m)
          clearErrors(['method', 'reference'])
        }}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label={pm?.docLabel ?? ''}
          htmlFor="pay-reference"
          required
          hint={pm ? t('billing.confirm.evidence', { value: pm.evidence.toLowerCase() }) : undefined}
          error={errors.reference?.message}
          className="md:col-span-2"
        >
          <input type="text" placeholder={pm?.docHint} className={inputClass(errors.reference)} {...fieldAria('pay-reference', errors.reference?.message, true)} {...field('reference')} />
        </Field>
        <Field label={t('topUp.receivedOn')} htmlFor="pay-receivedOn" required error={errors.receivedOn?.message}>
          <input type="date" max={todayUtc()} className={inputClass(errors.receivedOn)} {...fieldAria('pay-receivedOn', errors.receivedOn?.message)} {...field('receivedOn')} />
        </Field>
        <Field label={t('billing.confirm.amount')} htmlFor="pay-receivedAmount" required hint={t('billing.confirm.amountHint', { value: formatMoney(i.amount) })} error={errors.receivedAmount?.message}>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={cn(inputClass(errors.receivedAmount), 'tabular-nums')}
            {...fieldAria('pay-receivedAmount', errors.receivedAmount?.message, true)}
            {...field('receivedAmount')}
          />
        </Field>
        <Field label={t('topUp.comment')} htmlFor="pay-comment" optional className="md:col-span-2">
          <textarea rows={2} id="pay-comment" placeholder={t('billing.confirm.commentPlaceholder')} className={inputClass()} {...field('comment')} />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand" {...fieldAria('pay-confirmed', errors.confirmed?.message)} {...field('confirmed')} />
          <span>{t(`billing.confirm.confirmed.${(pm && CONFIRM_TEXT[pm.channel]) || 'bank'}`)}</span>
        </label>
        {errors.confirmed && (
          <span id="pay-confirmed-error" role="alert" className="text-[11px] text-rose-600">
            {errors.confirmed.message}
          </span>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={confirming}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={confirming}>
          {confirming ? t('billing.confirm.submitting') : t('billing.confirm.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
