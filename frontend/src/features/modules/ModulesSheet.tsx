/* Панель «Настройка модулей» (PLT-CTR-040) — ТОЛЬКО ПРОСМОТР модулей и лимитов тарифа центра (решение владельца, Q-024).
   В прототипе переключатели и ползунки были демонстрационными и ничего не сохраняли; изменить модули и лимиты можно сменой тарифа.
   Рабочие действия: вход в кабинет (режим поддержки), данные для входа администратора, смена тарифа. Для заблокированного центра — только просмотр (BR-012). */
import { LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CenterDto } from '@/features/centers/api/types'
import type { PlanSummary } from '@/features/dictionaries/api/types'
import { useGetDictionariesQuery } from '@/features/dictionaries/api/dictionariesApi'
import { ProgressBar } from '@/components/ProgressBar'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const MODULES = ['payroll', 'inventory', 'crm', 'geo'] as const
const sectionTitle = 'text-[11px] font-bold tracking-wider text-slate-400 uppercase'

type Props = {
  center: CenterDto | null
  onClose: () => void
  onEnter: (c: CenterDto) => void
  onAdminAccess: (c: CenterDto) => void
  onChangePlan: (c: CenterDto) => void
}

export function ModulesSheet({ center: c, onClose, onEnter, onAdminAccess, onChangePlan }: Props) {
  const { t } = useTranslation()
  const plans = useGetDictionariesQuery().data?.plans
  const plan: PlanSummary | undefined = c ? plans?.find(p => p.name === c.plan) : undefined
  const active = c?.status !== 'blocked'

  return (
    <Sheet open={!!c} onOpenChange={open => !open && onClose()}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-slate-100 px-6 py-4">
          <span className="text-[10px] font-bold tracking-wider text-brand uppercase">{t('modules.eyebrow')}</span>
          <SheetTitle className="text-base font-extrabold text-heading">{t('modules.title')}</SheetTitle>
          <SheetDescription>{c?.name}</SheetDescription>
        </SheetHeader>
        {c && (
          <div className="flex flex-1 touch-pan-y flex-col gap-6 overflow-x-hidden overflow-y-auto overscroll-contain p-6">
            {active && (
              <div className="flex flex-col gap-2">
                {/* длинная подпись переносится, а не вылезает за кнопку (у shadcn по умолчанию nowrap) */}
                <Button size="lg" className="h-auto min-h-9 py-2 whitespace-normal" onClick={() => onEnter(c)}>
                  <LogIn aria-hidden />
                  {t('modules.enter')}
                </Button>
                <Button size="lg" variant="outline" className="h-auto min-h-9 py-2 whitespace-normal" onClick={() => onAdminAccess(c)}>
                  {t('modules.adminAccess')}
                </Button>
              </div>
            )}

            <section
              aria-label={t('modules.plan')}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className={sectionTitle}>{t('modules.plan')}</div>
                <div className="mt-0.5 text-xs font-bold text-heading">
                  {c.monthlyPrice ? t('modules.planPrice', { plan: c.plan, price: formatMoney(c.monthlyPrice) }) : t('modules.planFree', { plan: c.plan })}
                </div>
                <div className="text-[11px] text-slate-500">
                  {c.pendingChange
                    ? t('modules.pending', { plan: c.pendingChange.planName, id: c.pendingChange.invoiceId })
                    : t('modules.staff', { used: c.staff[0], limit: c.staff[1] })}
                </div>
              </div>
              {active && (
                <Button variant="outline" className="self-start sm:self-auto" onClick={() => onChangePlan(c)}>
                  {t('modules.changePlan')}
                </Button>
              )}
            </section>

            <section aria-labelledby="mod-modules" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 id="mod-modules" className={sectionTitle}>
                  {t('modules.modulesTitle')}
                </h3>
                {plan && (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    {t('modules.modulesCount', { on: MODULES.filter(m => plan.modules[m]).length, total: MODULES.length })}
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-3 text-xs">
                {MODULES.map(m => (
                  <li key={m} className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-800">{t(`modules.names.${m}`)}</span>
                    {plan ? (
                      <StatusBadge tone={plan.modules[m] ? 'emerald' : 'slate'}>{plan.modules[m] ? t('modules.on') : t('modules.off')}</StatusBadge>
                    ) : (
                      <span className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="mod-limits" className="flex flex-col gap-3 border-t border-slate-100 pt-4">
              <h3 id="mod-limits" className={sectionTitle}>
                {t('modules.limitsTitle')}
              </h3>
              {c.usage.map(u => (
                <div key={u.key}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-800">{u.label}</span>
                    <span className={cn('font-semibold tabular-nums', u.pct >= 100 ? 'text-rose-600' : u.pct >= 80 ? 'text-amber-600' : 'text-heading')}>
                      {t('planChange.usage', { used: u.used, limit: u.limit, pct: u.pct })}
                    </span>
                  </div>
                  <ProgressBar pct={u.pct} barClassName={u.pct >= 100 ? 'bg-rose-500' : u.pct >= 80 ? 'bg-amber-500' : 'bg-brand'} />
                </div>
              ))}
              <p className="text-[11px] text-slate-500">{t('modules.readonlyNote')}</p>
            </section>
          </div>
        )}
        <SheetFooter className="flex-row justify-end border-t border-slate-100 px-6 py-4">
          <Button variant="outline" size="lg" onClick={onClose}>
            {t('common.close')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
