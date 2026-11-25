/* «Пополнить баланс на платформе» (PLT-BAL-030): деньги УЖЕ поступили вне системы — способ, документ, дата, сумма, явное подтверждение.
   Проверки — на сервере (BR-002), ошибки показываются под полями; диалог закрывается только после успеха, повторная отправка заблокирована. */
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage, type CenterDto, type PayMethod } from '@/api'
import { useTopUp } from '@/api/mutations'
import { useDictionaries } from '@/api/queries'
import { Field } from '@/components/Field'
import { fieldAria, inputClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney, todayUtc } from '@/lib/format'
import { applyServerErrors } from '@/lib/server-errors'
import { cn } from '@/lib/utils'
import { MethodPicker } from './MethodPicker'

type Form = { method: string; reference: string; receivedOn: string; receivedAmount: string; comment: string; confirmed: boolean }
const ERROR_ORDER = ['method', 'reference', 'receivedOn', 'receivedAmount', 'confirmed'] as const

export function TopUpDialog({ center, onClose }: { center: CenterDto | null; onClose: () => void }) {
  const { t } = useTranslation()
  const mutation = useTopUp()
  return (
    <Dialog open={!!center} onOpenChange={open => !open && !mutation.isPending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-6 sm:max-w-2xl">
        {center && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-heading">{t('topUp.title')}</DialogTitle>
              <DialogDescription>{center.name}</DialogDescription>
            </DialogHeader>
            <TopUpForm center={center} mutation={mutation} onDone={onClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TopUpForm({ center, mutation, onDone }: { center: CenterDto; mutation: ReturnType<typeof useTopUp>; onDone: () => void }) {
  const { t } = useTranslation()
  const methods: PayMethod[] = useDictionaries().data?.payMethods ?? []
  const { register, handleSubmit, control, setValue, setError, clearErrors, formState } = useForm<Form>({
    defaultValues: { method: methods[0]?.method ?? '', reference: '', receivedOn: todayUtc(), receivedAmount: '', comment: '', confirmed: false },
  })
  const errors = formState.errors
  const [method, amountText] = useWatch({ control, name: ['method', 'receivedAmount'] })
  const pm = methods.find(m => m.method === method) ?? methods[0]
  // ошибка поля пропадает, как только его исправляют
  const field = (name: keyof Form) => register(name, { onChange: () => clearErrors(name) })

  const amount = Number(amountText)
  const validAmount = Number.isInteger(amount) && amount >= 1
  const after = center.balance + amount
  const repaid = validAmount ? Math.min(amount, center.overdraftUsed) : 0

  const onSubmit = handleSubmit(async v => {
    try {
      const c = await mutation.mutateAsync({
        centerId: center.id,
        payload: { ...v, receivedAmount: v.receivedAmount === '' ? null : Number(v.receivedAmount) },
      })
      toast.success(t('topUp.done', { name: c.name, balance: formatMoney(c.balance) }))
      onDone()
    } catch (e) {
      if (!applyServerErrors(e, setError, [...ERROR_ORDER])) toast.error(errorMessage(e, t('common.saveError')))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
        <strong>{t('topUp.warningStrong')}</strong> {t('topUp.warning')}
      </div>

      <MethodPicker
        methods={methods}
        value={method}
        label={t('topUp.method')}
        error={errors.method?.message}
        onChange={m => {
          setValue('method', m)
          clearErrors(['method', 'reference'])
        }}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={pm?.docLabel ?? ''} htmlFor="top-reference" required error={errors.reference?.message} className="md:col-span-2">
          <input
            type="text"
            placeholder={pm?.docHint}
            className={inputClass(errors.reference)}
            {...fieldAria('top-reference', errors.reference?.message)}
            {...field('reference')}
          />
        </Field>
        <Field label={t('topUp.receivedOn')} htmlFor="top-receivedOn" required error={errors.receivedOn?.message}>
          <input
            type="date"
            max={todayUtc()}
            className={inputClass(errors.receivedOn)}
            {...fieldAria('top-receivedOn', errors.receivedOn?.message)}
            {...field('receivedOn')}
          />
        </Field>
        <Field label={t('topUp.amount')} htmlFor="top-receivedAmount" required error={errors.receivedAmount?.message}>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="500"
            className={cn(inputClass(errors.receivedAmount), 'tabular-nums')}
            {...fieldAria('top-receivedAmount', errors.receivedAmount?.message)}
            {...field('receivedAmount')}
          />
        </Field>
        <Field label={t('topUp.comment')} htmlFor="top-comment" optional className="md:col-span-2">
          <textarea rows={2} id="top-comment" className={inputClass()} {...field('comment')} />
        </Field>
      </div>

      <p aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
        {validAmount ? (
          <>
            {t('topUp.preview', { before: formatMoney(center.balance), after: formatMoney(after) })}
            {repaid > 0 && ` ${t('topUp.previewRepaid', { value: formatMoney(repaid) })}`}
          </>
        ) : (
          t('topUp.previewEmpty')
        )}
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand" {...fieldAria('top-confirmed', errors.confirmed?.message)} {...field('confirmed')} />
          <span>{t('topUp.confirmed')}</span>
        </label>
        {errors.confirmed && (
          <span id="top-confirmed-error" role="alert" className="text-[11px] text-rose-600">
            {errors.confirmed.message}
          </span>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone} disabled={mutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? t('topUp.submitting') : t('topUp.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
