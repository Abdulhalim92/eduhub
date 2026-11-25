/* Мутации api. После денежной операции обновляется всё, где виден баланс центра: реестр и главная (ключ centers),
   счётчики «Требует внимания» (овердрафт), панель финансов, SMS-продажи, смена тарифа, счета и тариф в кабинете центра. Мутация завершается, когда данные перечитаны, —
   диалог закрывается уже со свежими цифрами на экране. */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ConfirmPaymentPayload, PlanChangePayload, SmsAccruePayload, TopUpPayload } from './contract'
import { api } from './index'
import { queryKeys } from './queries'

function useRefreshCenterMoney() {
  const qc = useQueryClient()
  return (centerId: number) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.centers }),
      qc.invalidateQueries({ queryKey: queryKeys.attention }),
      qc.invalidateQueries({ queryKey: queryKeys.finance(centerId) }),
      qc.invalidateQueries({ queryKey: queryKeys.sms }),
      qc.invalidateQueries({ queryKey: queryKeys.planChangeAll }),
      qc.invalidateQueries({ queryKey: queryKeys.invoiceAll }),
      qc.invalidateQueries({ queryKey: queryKeys.cabinetCenters }), // тариф виден в кабинете центра
    ])
}

export function useTopUp() {
  const refresh = useRefreshCenterMoney()
  return useMutation({
    mutationFn: ({ centerId, payload }: { centerId: number; payload: TopUpPayload }) => api.finance.topUp(centerId, payload),
    onSuccess: c => refresh(c.id),
  })
}

export function useSetOverdraft() {
  const refresh = useRefreshCenterMoney()
  return useMutation({
    mutationFn: ({ centerId, limit, reason }: { centerId: number; limit: number | null; reason: string }) =>
      api.finance.setOverdraft(centerId, { limit, reason }),
    onSuccess: c => refresh(c.id),
  })
}

/** Начисление SMS-пакета: меняются SMS-баланс центра, при списании — баланс на платформе и журнал операций. */
export function useAccrueSms() {
  const refresh = useRefreshCenterMoney()
  return useMutation({
    mutationFn: (payload: SmsAccruePayload) => api.sms.accrue(payload),
    onSuccess: sale => refresh(sale.centerId),
  })
}

/** Смена тарифа: по умолчанию выставляет счёт — тариф сменится после оплаты (BR-001). */
export function useRequestPlanChange() {
  const refresh = useRefreshCenterMoney()
  return useMutation({
    mutationFn: ({ centerId, payload }: { centerId: number; payload: PlanChangePayload }) => api.centers.requestPlanChange(centerId, payload),
    onSuccess: r => refresh(r.center.id),
  })
}

/** Ручное подтверждение оплаты счёта (деньги поступили вне системы, BR-002). */
export function useConfirmPayment() {
  const refresh = useRefreshCenterMoney()
  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: string; payload: ConfirmPaymentPayload }) => api.billing.confirmPayment(invoiceId, payload),
    onSuccess: inv => refresh(inv.centerId),
  })
}

export function useCancelInvoice() {
  const refresh = useRefreshCenterMoney()
  return useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) => api.billing.cancel(invoiceId, { reason }),
    onSuccess: inv => refresh(inv.centerId),
  })
}

/** МОК: владелец оплатил онлайн (в проде — webhook шлюза). */
export function useSimulateOnlinePayment() {
  const refresh = useRefreshCenterMoney()
  return useMutation({
    mutationFn: (invoiceId: string) => api.billing.simulateOnlinePayment(invoiceId),
    onSuccess: inv => refresh(inv.centerId),
  })
}

/** Данные для входа владельца центра (пишется в журнал аудита без пароля, BR-025). */
export const useAdminAccess = () =>
  useMutation({ mutationFn: ({ centerId, reason }: { centerId: number; reason: string }) => api.centers.adminAccess(centerId, { reason }) })

/** Вход в режим поддержки. Без записи в журнале аудита вход не выполняется (NFR-SEC-030). */
export const useEnterSupport = () => useMutation({ mutationFn: (centerId: number) => api.support.enter({ centerId }) })

export function usePayFromBalance() {
  const refresh = useRefreshCenterMoney()
  return useMutation({
    mutationFn: (invoiceId: string) => api.billing.payFromBalance(invoiceId),
    onSuccess: inv => refresh(inv.centerId),
  })
}
