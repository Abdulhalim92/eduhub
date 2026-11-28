/* Отмена счёта (BR-004): только неоплаченного, с причиной (BR-011). Отсроченная смена тарифа при отмене откатывается — предупреждаем заранее. */
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage, type InvoiceDto } from '@/api'
import { useCancelInvoice } from '@/api/mutations'
import { Field } from '@/components/Field'
import { fieldAria, inputClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney } from '@/lib/format'
import { applyServerErrors } from '@/lib/server-errors'

type Props = { invoice: InvoiceDto | null; onClose: () => void; onCancelled?: (inv: InvoiceDto) => void }

export function CancelInvoiceDialog({ invoice, onClose, onCancelled }: Props) {
  const { t } = useTranslation()
  const mutation = useCancelInvoice()
  return (
    <Dialog open={!!invoice} onOpenChange={open => !open && !mutation.isPending && onClose()}>
      <DialogContent className="[--dialog-p:--spacing(6)] sm:max-w-lg">
        {invoice && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-heading">{t('billing.cancel.title', { id: invoice.id })}</DialogTitle>
              <DialogDescription>{invoice.centerName}</DialogDescription>
            </DialogHeader>
            <CancelForm invoice={invoice} mutation={mutation} onClose={onClose} onCancelled={onCancelled} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

type FormProps = { invoice: InvoiceDto; mutation: ReturnType<typeof useCancelInvoice>; onClose: () => void; onCancelled?: (inv: InvoiceDto) => void }

function CancelForm({ invoice: i, mutation, onClose, onCancelled }: FormProps) {
  const { t } = useTranslation()
  const { register, handleSubmit, setError, clearErrors, formState } = useForm<{ reason: string }>({ defaultValues: { reason: '' } })
  const error = formState.errors.reason?.message

  const onSubmit = handleSubmit(async v => {
    try {
      const inv = await mutation.mutateAsync({ invoiceId: i.id, reason: v.reason })
      toast.success(t('billing.cancel.done', { id: inv.id }))
      onClose()
      onCancelled?.(inv)
    } catch (e) {
      if (!applyServerErrors(e, setError, ['reason'])) toast.error(errorMessage(e, t('common.saveError')))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-bold text-heading">{i.purpose}</div>
        <div className="text-sm font-extrabold whitespace-nowrap text-heading tabular-nums">{formatMoney(i.amount)}</div>
      </div>
      {i.deferred && i.plan && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
          {t('billing.cancel.deferred', { from: i.plan.fromName, to: i.plan.toName })}
        </div>
      )}
      <Field label={t('billing.cancel.reason')} htmlFor="cancel-reason" required error={error}>
        <textarea
          rows={3}
          placeholder={t('billing.cancel.reasonPlaceholder')}
          className={inputClass(error)}
          {...fieldAria('cancel-reason', error)}
          {...register('reason', { onChange: () => clearErrors('reason') })}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={mutation.isPending}>
          {t('billing.cancel.keep')}
        </Button>
        <Button type="submit" size="lg" variant="destructive" disabled={mutation.isPending}>
          {mutation.isPending ? t('billing.cancel.submitting') : t('billing.cancel.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
