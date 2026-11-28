/* Карточка центра у лимита (PLT-TRF-040): три лимита, тарифы выше с расчётом цены, счёт на переход или предложение владельцу.
   Тариф не меняется кнопкой: «Выставить счёт…» открывает диалог смены тарифа (PLT-TRF-020) с подставленными тарифом и причиной. */
import { Trans, useTranslation } from 'react-i18next'
import type { NearLimitEntry, PlanOption, UsageItem } from '@/api'
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LIMIT_TONE, limitLevel, type LimitLevel } from './limit-tone'

const sectionTitle = 'text-[11px] font-bold tracking-wider text-slate-400 uppercase'
/** Кнопки действий: на телефоне — столбиком во всю ширину, длинный текст переносится, а не обрезается. */
const actionRow = 'flex flex-col gap-2 sm:flex-row sm:flex-wrap'
const actionBtn = 'h-auto min-h-10 w-full py-2 whitespace-normal sm:w-auto'
const LEVEL_BADGE: Record<LimitLevel, BadgeTone> = { full: 'rose', critical: 'amber', warning: 'amber', ok: 'slate' }
/** Окраска «после перехода»: от 80 % — как у лимита (сервер рекомендует тариф по тому же порогу). */
const AFTER_PCT = 80

type Props = {
  entry: NearLimitEntry
  thresholdPct: number
  /** Выбранный тариф (по умолчанию — рекомендуемый). */
  picked: PlanOption | null
  onPick: (planId: string) => void
  onIssue: (o: PlanOption) => void
  onOffer: (o: PlanOption) => void
  offerPending: boolean
  onConfirmPayment: (invoiceId: string) => void
  onPlanChange: () => void
  onEnter: () => void
  onModules: () => void
  /** В боковой панели имя уже в заголовке панели — здесь только для экранных чтецов. */
  nameHidden?: boolean
}

export function LimitDetail({ entry, thresholdPct, picked, onPick, onIssue, onOffer, offerPending, onConfirmPayment, onPlanChange, onEnter, onModules, nameHidden }: Props) {
  const { t } = useTranslation()
  const c = entry.center
  const level = limitLevel(c.worst.pct, 0)
  const pc = c.pendingChange

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        {/* в боковой панели имя и контакты — в её заголовке */}
        <div className={cn('min-w-0', nameHidden && 'sr-only')}>
          <h2 className="text-sm font-extrabold text-heading">{c.name}</h2>
          <div className="mt-0.5 text-[11px] text-slate-500">{t('limits.detail.meta', { city: c.city, owner: c.owner, phone: c.phone })}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="slate">{t('limits.detail.current', { plan: c.plan })}</StatusBadge>
          <StatusBadge tone={LEVEL_BADGE[level]}>{t(`limits.levels.${level}`)}</StatusBadge>
        </div>
      </div>

      <section aria-label={t('limits.detail.usage')} className="flex flex-col gap-3">
        <div className={sectionTitle} aria-hidden>
          {t('limits.detail.usage')}
        </div>
        {c.usage.map(u => (
          <UsageBar key={u.key} u={u} thresholdPct={thresholdPct} limiting={c.worst.key === u.key && u.pct >= thresholdPct} />
        ))}
      </section>

      {pc ? (
        <div role="region" aria-label={t('limits.pending')} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-bold text-amber-900">
            {t('limits.detail.pendingTitle', { id: pc.invoiceId, plan: pc.planName, amount: formatMoney(pc.amount) })}
          </div>
          <p className="text-[11px] leading-relaxed text-amber-900">{t('limits.detail.pendingText')}</p>
          <div className={actionRow}>
            <Button className={actionBtn} onClick={() => onConfirmPayment(pc.invoiceId)}>
              {t('limits.detail.confirmPayment')}
            </Button>
            <Button variant="outline" className={actionBtn} onClick={onPlanChange}>
              {t('limits.detail.openPlanChange')}
            </Button>
          </div>
        </div>
      ) : entry.options.length ? (
        <>
          {c.offer && (
            <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-900">
              {t('limits.detail.offerSent', { plan: c.offer.planName })}
            </p>
          )}
          <div role="radiogroup" aria-label={t('limits.detail.where')} className="flex flex-col gap-2">
            <div className={sectionTitle} aria-hidden>
              {t('limits.detail.where')}
            </div>
            {entry.options.map(o => (
              <OptionCard key={o.id} o={o} name={`limit-plan-${c.id}`} on={picked?.id === o.id} onPick={() => onPick(o.id)} />
            ))}
          </div>
          {picked && (
            <>
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                {picked.fits ? (
                  <Trans
                    i18nKey="limits.detail.summaryFits"
                    values={{ price: formatMoney(picked.price), delta: formatMoney(picked.delta) }}
                    components={{ b: <strong /> }}
                  />
                ) : (
                  t('limits.detail.summaryNoFit', { plan: picked.name })
                )}
              </p>
              <div className={actionRow}>
                <Button size="lg" className={cn(actionBtn, 'sm:flex-1')} disabled={!picked.fits} onClick={() => onIssue(picked)}>
                  {t('limits.detail.issue', { plan: picked.name })}
                </Button>
                <Button size="lg" variant="outline" className={actionBtn} disabled={offerPending} onClick={() => onOffer(picked)}>
                  {c.offer ? t('limits.detail.offerAgain') : t('limits.detail.offer')}
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">{t('limits.detail.top')}</p>
          <Button variant="outline" className={cn(actionBtn, 'sm:self-start')} onClick={onPlanChange}>
            {t('limits.detail.changePlan')}
          </Button>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:flex sm:flex-wrap">
        {c.status !== 'blocked' && (
          <Button variant="outline" className={actionBtn} onClick={onEnter}>
            {t('limits.detail.enter')}
          </Button>
        )}
        <Button variant="outline" className={actionBtn} onClick={onModules}>
          {t('limits.detail.modules')}
        </Button>
      </div>
    </div>
  )
}

function UsageBar({ u, thresholdPct, limiting }: { u: UsageItem; thresholdPct: number; limiting: boolean }) {
  const { t } = useTranslation()
  const tone = LIMIT_TONE[limitLevel(u.pct, thresholdPct)]
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-700">
          {u.label}
          {limiting && <span className="ml-1.5 text-[10px] font-bold tracking-wide text-rose-600 uppercase">{t('limits.detail.limiting')}</span>}
        </span>
        <span className={cn('font-semibold tabular-nums', tone.text)}>{t('limits.detail.usageValue', { used: u.used, limit: u.limit, pct: u.pct })}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div className={cn('h-full', tone.bar)} style={{ width: `${Math.min(100, u.pct)}%` }} />
      </div>
    </div>
  )
}

export function UsagePill({ u, thresholdPct }: { u: UsageItem; thresholdPct: number }) {
  const { t } = useTranslation()
  return (
    <span
      title={t('limits.pillTitle', { label: u.label, used: u.used, limit: u.limit, pct: u.pct })}
      className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums', LIMIT_TONE[limitLevel(u.pct, thresholdPct)].pill)}
    >
      {t(`limits.short.${u.key}`)} {u.used}/{u.limit}
    </span>
  )
}

function OptionCard({ o, name, on, onPick }: { o: PlanOption; name: string; on: boolean; onPick: () => void }) {
  const { t } = useTranslation()
  return (
    <label
      className={cn(
        'block w-full cursor-pointer rounded-xl border p-3 text-left transition has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
        on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white hover:border-brand/50',
        !o.fits && 'opacity-60',
      )}
    >
      <input type="radio" name={name} value={o.id} checked={on} onChange={onPick} className="sr-only" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-brand' : 'border-slate-300')} aria-hidden>
            {on && <span className="size-2 rounded-full bg-brand" />}
          </span>
          <span className="text-xs font-bold text-heading">{o.name}</span>
          {o.recommended && <StatusBadge tone="emerald">{t('limits.detail.recommended')}</StatusBadge>}
          {!o.fits && <StatusBadge tone="rose">{t('limits.detail.noFit')}</StatusBadge>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-extrabold text-heading">{t('limits.detail.perMonth', { price: formatMoney(o.price) })}</div>
          <div className="text-[11px] font-semibold text-emerald-600">{t('limits.detail.delta', { value: formatMoney(o.delta) })}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
        {o.after.map(u => (
          <UsagePill key={u.key} u={u} thresholdPct={AFTER_PCT} />
        ))}
      </div>
    </label>
  )
}
