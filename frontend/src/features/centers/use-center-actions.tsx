/* Действия с центром, общие для реестра, истекающих подписок, риска оттока (и следующих экранов платформы):
   пункты меню строки, кнопка «Войти» и все окна, которые они открывают. Экран берёт нужные пункты и ставит {ui} в разметку.
   Пункты, недоступные заблокированному центру (BR-012), возвращают null — экран их отфильтровывает. */
import { ArrowLeftRight, CirclePlus, LogIn, MessageSquarePlus, SlidersHorizontal, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CenterDto } from '@/api'
import type { RowAction } from '@/components/RowActions'
import { Button } from '@/components/ui/button'
import { AdminAccessDialog } from '@/features/access/AdminAccessDialog'
import { PaymentConfirmDialog } from '@/features/billing/PaymentConfirmDialog'
import { useFinanceUi } from '@/features/finance/use-finance-ui'
import { ModulesSheet } from '@/features/modules/ModulesSheet'
import { PlanChangeDialog, type PlanChangePreset } from '@/features/plans/PlanChangeDialog'
import { SmsAccrueDialog } from '@/features/sms/SmsAccrueDialog'
import { useEnterSupportNav } from '@/features/support/use-enter-support'
import { formatMoney, formatNumber } from '@/lib/format'

export function useCenterActions() {
  const { t } = useTranslation()
  const finance = useFinanceUi()
  const support = useEnterSupportNav()
  const [smsCenter, setSmsCenter] = useState<CenterDto | null>(null)
  const [plan, setPlan] = useState<{ id: number; preset?: PlanChangePreset } | null>(null)
  const [modulesCenter, setModulesCenter] = useState<CenterDto | null>(null)
  const [accessCenter, setAccessCenter] = useState<CenterDto | null>(null)
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null)
  const blocked = (c: CenterDto) => c.status === 'blocked'

  /** Пункты меню строки; null — пункт не показывается (центр заблокирован). */
  const item = {
    finance: (c: CenterDto): RowAction => ({
      label: t('finance.menu.finance'),
      hint: t('finance.menu.financeHint', { balance: formatMoney(c.balance), limit: formatMoney(c.overdraftLimit) }),
      icon: Wallet,
      onSelect: () => finance.openFinance(c.id),
    }),
    topUp: (c: CenterDto): RowAction => ({ label: t('finance.menu.topUp'), hint: t('finance.menu.topUpHint'), icon: CirclePlus, onSelect: () => finance.openTopUp(c) }),
    sms: (c: CenterDto): RowAction | null =>
      blocked(c)
        ? null
        : {
            label: t('smsAccrue.menu'),
            hint: c.smsBalance ? t('smsAccrue.menuHint', { value: t('common.count.pcs', { value: formatNumber(c.smsBalance) }) }) : t('smsAccrue.menuHintNone'),
            icon: MessageSquarePlus,
            onSelect: () => setSmsCenter(c),
          },
    planChange: (c: CenterDto): RowAction | null =>
      blocked(c) ? null : { label: t('planChange.menu'), hint: t('planChange.menuHint', { plan: c.plan }), icon: ArrowLeftRight, onSelect: () => setPlan({ id: c.id }) },
    modules: (c: CenterDto): RowAction => ({ label: t('modules.menu'), hint: t('modules.menuHint'), icon: SlidersHorizontal, onSelect: () => setModulesCenter(c) }),
    enter: (c: CenterDto): RowAction | null =>
      blocked(c) ? null : { label: t('support.enterFull'), hint: t('support.enterMenuHint'), icon: LogIn, onSelect: () => support.enter(c.id) },
  }

  /** Главная кнопка «Войти» (режим поддержки); у заблокированного центра её нет. */
  const enterButton = (c: CenterDto) =>
    blocked(c) ? null : (
      <Button
        size="sm"
        onClick={() => support.enter(c.id)}
        disabled={support.pendingId === c.id}
        aria-label={t('support.enterHint', { name: c.name })}
        title={t('support.enterHint', { name: c.name })}
      >
        {support.pendingId === c.id ? t('support.entering') : t('support.enter')}
      </Button>
    )

  const ui = (
    <>
      {finance.ui}
      <SmsAccrueDialog center={smsCenter} onClose={() => setSmsCenter(null)} />
      <PlanChangeDialog centerId={plan?.id ?? null} preset={plan?.preset} onClose={() => setPlan(null)} />
      <ModulesSheet
        center={modulesCenter}
        onClose={() => setModulesCenter(null)}
        onEnter={c => support.enter(c.id)}
        onAdminAccess={c => {
          setModulesCenter(null)
          setAccessCenter(c)
        }}
        onChangePlan={c => {
          setModulesCenter(null)
          setPlan({ id: c.id })
        }}
      />
      <AdminAccessDialog center={accessCenter} onClose={() => setAccessCenter(null)} />
      <PaymentConfirmDialog invoiceId={payInvoiceId} onClose={() => setPayInvoiceId(null)} />
    </>
  )

  return {
    item,
    enterButton,
    confirmPayment: setPayInvoiceId,
    openPlanChange: (centerId: number, preset?: PlanChangePreset) => setPlan({ id: centerId, preset }),
    enter: (c: CenterDto) => support.enter(c.id),
    openModules: setModulesCenter,
    ui,
  }
}

/** Убрать недоступные (null) пункты. */
export const compact = (items: (RowAction | null)[]): RowAction[] => items.filter((a): a is RowAction => a !== null)
