/* «Начислить пакет SMS» (PLT-SMS-020): пакет и способ оплаты — с баланса на платформе (BR-005), деньги вне системы (BR-002) или бесплатно с причиной (BR-011).
   Открывается из реестра для конкретного центра. Проверки — на сервере; «с баланса» недоступно, если не хватает (с пояснением). */
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage, type CenterDto, type SmsAccrueMode, type SmsPackage } from '@/api'
import { useAccrueSms } from '@/api/mutations'
import { useDictionaries, useSmsPackages } from '@/api/queries'
import { ChoiceCard } from '@/components/ChoiceCard'
import { Field } from '@/components/Field'
import { fieldAria, inputClass } from '@/components/form-styles'
import { QueryError } from '@/components/QueryError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MethodPicker } from '@/features/finance/MethodPicker'
import { formatMoney, formatNumber, todayUtc } from '@/lib/format'
import { applyServerErrors } from '@/lib/server-errors'
import { cn } from '@/lib/utils'

type Form = {
  packageId: string
  mode: SmsAccrueMode
  method: string
  reference: string
  receivedOn: string
  confirmed: boolean
  reason: string
  /** Ошибка сервера по сумме (manual: сумма = цене пакета) — показывается в блоке оплаты. */
  receivedAmount: string
}
const ERROR_ORDER = ['packageId', 'mode', 'method', 'reference', 'receivedOn', 'receivedAmount', 'confirmed', 'reason'] as const

export function SmsAccrueDialog({ center, onClose }: { center: CenterDto | null; onClose: () => void }) {
  const { t } = useTranslation()
  const mutation = useAccrueSms()
  const packages = useSmsPackages()
  return (
    <Dialog open={!!center} onOpenChange={open => !open && !mutation.isPending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto [--dialog-p:--spacing(6)] sm:max-w-xl">
        {center && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-heading">{t('smsAccrue.title')}</DialogTitle>
              <DialogDescription>{center.name}</DialogDescription>
            </DialogHeader>
            {packages.error ? (
              <QueryError error={packages.error} onRetry={() => packages.refetch()} />
            ) : !packages.data ? (
              <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <SmsForm center={center} packages={packages.data.items.filter(p => p.active)} mutation={mutation} onDone={onClose} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

type FormProps = { center: CenterDto; packages: SmsPackage[]; mutation: ReturnType<typeof useAccrueSms>; onDone: () => void }

function SmsForm({ center: c, packages, mutation, onDone }: FormProps) {
  const { t } = useTranslation()
  const methods = useDictionaries().data?.payMethods ?? []
  const defaultPack = packages.find(p => p.sms === 1000) ?? packages[0]
  const canPay = (p: SmsPackage | undefined) => !!p && c.available >= p.price
  const { register, handleSubmit, control, setValue, setError, clearErrors, formState } = useForm<Form>({
    defaultValues: {
      packageId: defaultPack?.id ?? '',
      mode: canPay(defaultPack) ? 'balance' : 'manual',
      method: methods[0]?.method ?? '',
      reference: '',
      receivedOn: todayUtc(),
      confirmed: false,
      reason: '',
      receivedAmount: '',
    },
  })
  const errors = formState.errors
  const [packageId, mode, method] = useWatch({ control, name: ['packageId', 'mode', 'method'] })
  const pk = packages.find(p => p.id === packageId)
  const balanceOk = canPay(pk)
  const pm = methods.find(m => m.method === method) ?? methods[0]

  const pick = (patch: Partial<Pick<Form, 'packageId' | 'mode'>>) => {
    for (const [k, v] of Object.entries(patch)) setValue(k as 'packageId' | 'mode', v as never)
    clearErrors()
    // пакет стал дороже доступного — «с баланса» больше нельзя
    const nextPk = packages.find(p => p.id === (patch.packageId ?? packageId))
    if ((patch.mode ?? mode) === 'balance' && !canPay(nextPk)) setValue('mode', 'manual')
  }

  const onSubmit = handleSubmit(async v => {
    if (!pk) return
    try {
      const sale = await mutation.mutateAsync({
        centerId: c.id,
        packageId: v.packageId,
        mode: v.mode,
        method: v.method,
        reference: v.reference,
        receivedOn: v.receivedOn,
        receivedAmount: pk.price,
        confirmed: v.confirmed,
        reason: v.reason,
      })
      toast.success(t('smsAccrue.done', { value: formatNumber(sale.sms), center: sale.center }))
      onDone()
    } catch (e) {
      if (!applyServerErrors(e, setError, [...ERROR_ORDER])) toast.error(errorMessage(e, t('common.saveError')))
    }
  })

  const after = pk ? c.balance - pk.price : 0

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[11px] font-semibold text-slate-600">
          {t('smsAccrue.package')} <span className="text-rose-500">*</span>
        </legend>
        <div role="radiogroup" aria-label={t('smsAccrue.package')} className="grid grid-cols-3 gap-2">
          {packages.map(p => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === packageId}
              onClick={() => pick({ packageId: p.id })}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                p.id === packageId ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white hover:border-brand/50',
              )}
            >
              <span className="block text-xs font-bold text-heading">{t('smsAccrue.packageSms', { value: formatNumber(p.sms) })}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{formatMoney(p.price)}</span>
            </button>
          ))}
        </div>
        {errors.packageId && <span role="alert" className="text-[11px] text-rose-600">{errors.packageId.message}</span>}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[11px] font-semibold text-slate-600">{t('smsAccrue.payment')}</legend>
        <div role="radiogroup" aria-label={t('smsAccrue.payment')} className="flex flex-col gap-2">
          <ChoiceCard checked={mode === 'balance'} disabled={!balanceOk} onSelect={() => pick({ mode: 'balance' })} title={t('smsAccrue.modes.balance')}>
            {balanceOk && pk ? (
              <>
                {t('smsAccrue.balanceOk', { balance: formatMoney(c.balance), available: formatMoney(c.available), after: formatMoney(after) })}
                {after < 0 && <span className="text-amber-700"> {t('smsAccrue.balanceOverdraft')}</span>}
              </>
            ) : (
              <span className="text-rose-600">{t('smsAccrue.balanceShort', { available: formatMoney(c.available), price: formatMoney(pk?.price ?? 0) })}</span>
            )}
          </ChoiceCard>
          <ChoiceCard checked={mode === 'manual'} onSelect={() => pick({ mode: 'manual' })} title={t('smsAccrue.modes.manual')}>
            {t('smsAccrue.modes.manualText')}
          </ChoiceCard>
          <ChoiceCard checked={mode === 'bonus'} onSelect={() => pick({ mode: 'bonus' })} title={t('smsAccrue.modes.bonus')}>
            {t('smsAccrue.modes.bonusText')}
          </ChoiceCard>
        </div>
        {errors.mode && <span role="alert" className="text-[11px] text-rose-600">{errors.mode.message}</span>}
      </fieldset>

      {mode === 'manual' && (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
          <Field label={pm?.docLabel ?? ''} htmlFor="sms-reference" required error={errors.reference?.message}>
            <input
              type="text"
              placeholder={pm?.docHint}
              className={inputClass(errors.reference)}
              {...fieldAria('sms-reference', errors.reference?.message)}
              {...register('reference', { onChange: () => clearErrors('reference') })}
            />
          </Field>
          <Field label={t('topUp.receivedOn')} htmlFor="sms-receivedOn" required error={errors.receivedOn?.message}>
            <input
              type="date"
              max={todayUtc()}
              className={inputClass(errors.receivedOn)}
              {...fieldAria('sms-receivedOn', errors.receivedOn?.message)}
              {...register('receivedOn', { onChange: () => clearErrors('receivedOn') })}
            />
          </Field>
          {errors.receivedAmount && <span role="alert" className="text-[11px] text-rose-600">{errors.receivedAmount.message}</span>}
          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-brand"
                {...fieldAria('sms-confirmed', errors.confirmed?.message)}
                {...register('confirmed', { onChange: () => clearErrors('confirmed') })}
              />
              <span>{t('smsAccrue.confirmed', { amount: formatMoney(pk?.price ?? 0) })}</span>
            </label>
            {errors.confirmed && (
              <span id="sms-confirmed-error" role="alert" className="text-[11px] text-rose-600">
                {errors.confirmed.message}
              </span>
            )}
          </div>
        </div>
      )}

      {mode === 'bonus' && (
        <Field label={t('smsAccrue.reason')} htmlFor="sms-reason" required error={errors.reason?.message}>
          <textarea
            rows={2}
            placeholder={t('smsAccrue.reasonPlaceholder')}
            className={inputClass(errors.reason)}
            {...fieldAria('sms-reason', errors.reason?.message)}
            {...register('reason', { onChange: () => clearErrors('reason') })}
          />
        </Field>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone} disabled={mutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={mutation.isPending || !pk}>
          {mutation.isPending ? t('smsAccrue.submitting') : t('smsAccrue.submit', { value: formatNumber(pk?.sms ?? 0) })}
        </Button>
      </DialogFooter>
    </form>
  )
}
