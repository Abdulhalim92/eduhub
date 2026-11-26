/* «Лимит овердрафта» (PLT-BAL-050): причина обязательна (BR-011), лимит не ниже использованного (BR-006) — проверяет сервер.
   Предпросмотр показывает, как изменится «доступно к расходу», до сохранения. */
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage, type CenterDto } from '@/api'
import { useSetOverdraft } from '@/api/mutations'
import { Field } from '@/components/Field'
import { fieldAria, inputClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney } from '@/lib/format'
import { applyServerErrors } from '@/lib/server-errors'
import { cn } from '@/lib/utils'

const PRESETS = [0, 300, 500, 1000, 2000, 5000]
type Form = { limit: string; reason: string }

export function OverdraftDialog({ center, onClose }: { center: CenterDto | null; onClose: () => void }) {
  const { t } = useTranslation()
  const mutation = useSetOverdraft()
  return (
    <Dialog open={!!center} onOpenChange={open => !open && !mutation.isPending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto [--dialog-p:--spacing(6)] sm:max-w-lg">
        {center && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-heading">{t('overdraftLimit.title')}</DialogTitle>
              <DialogDescription>{center.name}</DialogDescription>
            </DialogHeader>
            <OverdraftForm center={center} mutation={mutation} onDone={onClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={cn('text-sm font-extrabold text-heading tabular-nums', className)}>{value}</div>
    </div>
  )
}

function OverdraftForm({ center: c, mutation, onDone }: { center: CenterDto; mutation: ReturnType<typeof useSetOverdraft>; onDone: () => void }) {
  const { t } = useTranslation()
  const { register, handleSubmit, control, setValue, setError, clearErrors, formState } = useForm<Form>({
    defaultValues: { limit: String(c.overdraftLimit), reason: '' },
  })
  const errors = formState.errors
  const limitText = useWatch({ control, name: 'limit' })
  const n = Number(limitText)
  const validLimit = limitText !== '' && Number.isInteger(n) && n >= 0
  const diff = n - c.overdraftLimit

  const onSubmit = handleSubmit(async v => {
    try {
      const res = await mutation.mutateAsync({ centerId: c.id, limit: v.limit === '' ? null : Number(v.limit), reason: v.reason })
      toast.success(t('overdraftLimit.done', { name: res.name, limit: formatMoney(res.overdraftLimit) }))
      onDone()
    } catch (e) {
      if (!applyServerErrors(e, setError, ['limit', 'reason'])) toast.error(errorMessage(e, t('common.saveError')))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('overdraftLimit.balance')} value={formatMoney(c.balance)} className={c.balance < 0 ? 'text-rose-600' : undefined} />
        <Stat label={t('overdraftLimit.current')} value={formatMoney(c.overdraftLimit)} />
        <Stat label={t('overdraftLimit.used')} value={formatMoney(c.overdraftUsed)} className={c.overdraftUsed ? 'text-amber-600' : undefined} />
      </div>

      <div className="flex flex-col gap-2">
        <Field
          label={t('overdraftLimit.limit')}
          htmlFor="od-limit"
          required
          hint={`${c.overdraftUsed ? `${t('overdraftLimit.hintUsed', { value: formatMoney(c.overdraftUsed) })} ` : ''}${t('overdraftLimit.hint')}`}
          error={errors.limit?.message}
        >
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={cn(inputClass(errors.limit), 'tabular-nums')}
            {...fieldAria('od-limit', errors.limit?.message, true)}
            {...register('limit', { onChange: () => clearErrors('limit') })}
          />
        </Field>
        <div role="group" aria-label={t('overdraftLimit.presets')} className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p}
              type="button"
              aria-pressed={String(p) === limitText}
              onClick={() => {
                setValue('limit', String(p))
                clearErrors('limit')
              }}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition',
                String(p) === limitText ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
        {validLimit ? (
          <>
            {t('overdraftLimit.preview', { before: formatMoney(c.available), after: formatMoney(c.balance + n) })}{' '}
            {diff > 0
              ? t('overdraftLimit.up', { value: formatMoney(diff) })
              : diff < 0
                ? t('overdraftLimit.down', { value: formatMoney(-diff) })
                : t('overdraftLimit.same')}
          </>
        ) : (
          t('overdraftLimit.previewEmpty')
        )}
      </p>

      <Field label={t('overdraftLimit.reason')} htmlFor="od-reason" required hint={t('overdraftLimit.reasonHint')} error={errors.reason?.message}>
        <textarea
          rows={2}
          placeholder={t('overdraftLimit.reasonPlaceholder')}
          className={inputClass(errors.reason)}
          {...fieldAria('od-reason', errors.reason?.message, true)}
          {...register('reason', { onChange: () => clearErrors('reason') })}
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone} disabled={mutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? t('overdraftLimit.submitting') : t('overdraftLimit.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
