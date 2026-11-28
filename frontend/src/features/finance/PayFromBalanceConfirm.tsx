/* Подтверждение оплаты счёта с баланса на платформе (PLT-BAL-040): последствия до подтверждения — баланс до и после, уход в овердрафт.
   Закрывается после ответа сервера; при ошибке — тост и закрытие (данные перечитаются). */
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import type { InvoiceDto } from '@/features/billing/api/types'
import { usePayFromBalanceMutation } from '@/features/billing/api/billingApi'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { paidMessage } from '@/features/billing/paid-message'
import { formatMoney } from '@/lib/format'

type Props = { invoice: InvoiceDto | null; onClose: () => void; onPaid?: (inv: InvoiceDto) => void }

export function PayFromBalanceConfirm({ invoice, onClose, onPaid }: Props) {
  const { t } = useTranslation()
  const [payFromBalance, { isLoading: paying }] = usePayFromBalanceMutation()
  const fb = invoice?.fromBalance

  const doPay = async () => {
    if (!invoice) return
    try {
      const inv = await payFromBalance(invoice.id).unwrap()
      // за смену тарифа и продление — что изменилось у центра; за остальное — что счёт оплачен с баланса
      toast.success(inv.kind === 'plan_change' || inv.kind === 'renewal' ? paidMessage(t, inv) : t('finance.payConfirm.done', { id: inv.id }))
      onClose()
      onPaid?.(inv)
    } catch (e) {
      toast.error(errorMessage(e, t('common.saveError')))
      onClose()
    }
  }

  return (
    <AlertDialog open={!!invoice} onOpenChange={open => !open && !paying && onClose()}>
      <AlertDialogContent>
        {invoice && fb && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('finance.payConfirm.title')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="flex flex-col gap-2 text-xs">
                  <p className="font-semibold text-heading">
                    {invoice.purpose} · {formatMoney(invoice.amount)}
                  </p>
                  <p>{t('finance.payConfirm.after', { before: formatMoney(fb.balance), after: formatMoney(fb.after) })}</p>
                  {fb.usesOverdraft && <p className="text-amber-700">{t('finance.payConfirm.overdraft')}</p>}
                  <p>{t('finance.payConfirm.audit')}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={paying}>{t('common.cancel')}</AlertDialogCancel>
              {/* не AlertDialogAction: он закрывает диалог сразу, а нужно дождаться ответа сервера */}
              <Button onClick={doPay} disabled={paying}>
                {paying ? t('finance.payConfirm.paying') : t('finance.payConfirm.confirm', { amount: formatMoney(invoice.amount) })}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
