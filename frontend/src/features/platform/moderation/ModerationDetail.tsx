/* Проверка заявки (PLT-MOD-020) и решение по ней (PLT-MOD-030): карта и координаты, описания RU/TJ/EN, телефон,
   подтверждение пина, «Одобрить и опубликовать» / «Вернуть на доработку» / «Отклонить». Обработанную — «Вернуть в очередь». */
import { Check, Copy, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { CatalogDesc, ModerationDecision, ModerationRequest } from '@/features/platform/moderation/api/types'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatDay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DESC_MIN, distanceM, formatCoord, GPS_MISMATCH_M, publishBlockers } from './geo'
import { ModerationMap } from './ModerationMap'
import { MOD_STATUS_TONE } from './status'

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-brand focus:outline-none'

type Props = {
  /** Заявка с учётом правок модератора (черновик). */
  r: ModerationRequest
  onDesc: (lang: keyof CatalogDesc, value: string) => void
  onCoord: (key: 'lat' | 'lng', value: number) => void
  onGpsOk: (ok: boolean) => void
  onDecide: (decision: ModerationDecision, reason?: string) => void
  onRequeue: () => void
  busy: boolean
}

export function ModerationDetail({ r, onDesc, onCoord, onGpsOk, onDecide, onRequeue, busy }: Props) {
  const { t } = useTranslation()
  const editable = r.status === 'pending'
  const coords = `${r.gps.lat.toFixed(4)}, ${r.gps.lng.toFixed(4)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coords)
      toast.success(t('moderation.copied', { value: coords }))
    } catch {
      toast(t('moderation.copyManual', { value: coords }))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-heading">{t('moderation.previewTitle')}</h2>
          <p className="mt-1 text-[11px] text-slate-400">
            {t('moderation.meta', { by: r.submittedBy, at: r.submitted, phone: r.phone })}
            {r.decidedAt && ` · ${t('moderation.decided', { date: formatDay(r.decidedAt) })}`}
          </p>
        </div>
        <StatusBadge tone={MOD_STATUS_TONE[r.status]}>{t(`moderation.status.${r.status}`)}</StatusBadge>
      </div>

      <ModerationMap r={r} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="text-xs text-slate-700">
          {t('moderation.coords')}{' '}
          <span className="font-semibold tabular-nums">
            {formatCoord(r.gps.lat, 'N', 'S')}, {formatCoord(r.gps.lng, 'E', 'W')}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={t('moderation.copy')} title={t('moderation.copy')}>
          <Copy aria-hidden />
        </Button>
      </div>

      {editable && (
        // key: после смены заявки или ручной правки поля начинают с актуальных значений
        <div key={`${r.id}-${r.gps.lat}-${r.gps.lng}`} className="grid max-w-sm grid-cols-2 gap-3">
          <CoordInput label={t('moderation.lat')} value={r.gps.lat} onCommit={v => onCoord('lat', v)} />
          <CoordInput label={t('moderation.lng')} value={r.gps.lng} onCommit={v => onCoord('lng', v)} />
        </div>
      )}

      <Checks r={r} editable={editable} onDesc={onDesc} />

      <div className="border-t border-slate-100 pt-3">
        {editable ? (
          <Decision key={r.id} r={r} onGpsOk={onGpsOk} onDecide={onDecide} busy={busy} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col items-start gap-1">
              <StatusBadge tone={MOD_STATUS_TONE[r.status]}>{t(`moderation.status.${r.status}`)}</StatusBadge>
              {r.reason && <div className="text-[11px] text-slate-500">{t('moderation.reasonLine', { value: r.reason })}</div>}
            </div>
            <Button variant="outline" size="lg" onClick={onRequeue} disabled={busy}>
              {t('moderation.requeue')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Координата: правка применяется по уходу с поля (как в прототипе); пустое или нечисловое значение не принимается. */
function CoordInput({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      <input
        type="number"
        step="0.0001"
        inputMode="decimal"
        defaultValue={value}
        onBlur={e => {
          const n = parseFloat(e.target.value)
          if (!Number.isNaN(n) && n !== value) onCommit(n)
        }}
        className={cn(field, 'tabular-nums')}
      />
    </label>
  )
}

function Mark({ ok }: { ok: boolean | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
        ok === true ? 'bg-emerald-100 text-emerald-600' : ok === false ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600',
      )}
    >
      {ok === true ? <Check className="size-3" /> : ok === false ? <X className="size-3" /> : '!'}
    </span>
  )
}

function Checks({ r, editable, onDesc }: { r: ModerationRequest; editable: boolean; onDesc: Props['onDesc'] }) {
  const { t } = useTranslation()
  const dist = Math.round(distanceM(r.gps, r.geo))
  const near = dist <= GPS_MISMATCH_M
  return (
    <section aria-label={t('moderation.checks')} className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <Mark ok={near ? true : null} />
        <div className="text-xs text-slate-700">
          <span className="font-semibold text-slate-800">{t('moderation.address')}</span>{' '}
          <span className={cn('ml-1 rounded-md px-2 py-0.5 text-[11px] font-medium', near ? 'bg-indigo-50 text-brand' : 'bg-amber-50 text-amber-700')}>
            {near ? t('moderation.addressOk', { dist }) : t('moderation.addressWarn', { dist })}
          </span>
        </div>
      </div>
      {(['ru', 'tj', 'en'] as const).map(lang => {
        const required = lang !== 'en'
        const v = r.desc[lang]
        const ok = v.trim().length >= DESC_MIN ? true : required ? false : null
        const label = t('moderation.descLabel', { lang: lang.toUpperCase() })
        const id = `mod-desc-${r.id}-${lang}`
        return (
          <div key={lang} className="flex items-start gap-2.5">
            <Mark ok={ok} />
            <div className="min-w-0 flex-1">
              <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-800">
                {label}
                {!required && <span className="font-normal text-slate-400"> {t('common.optional')}</span>}
              </label>
              {editable ? (
                <textarea
                  id={id}
                  rows={2}
                  value={v}
                  onChange={e => onDesc(lang, e.target.value)}
                  placeholder={t('moderation.descPlaceholder', { lang: lang.toUpperCase() })}
                  className={cn(field, 'min-h-16 leading-relaxed field-sizing-content')}
                />
              ) : (
                <p id={id} className="text-xs leading-relaxed text-slate-600">
                  {v || <span className="text-slate-400">{t('moderation.descEmpty')}</span>}
                </p>
              )}
            </div>
          </div>
        )
      })}
      <div className="flex items-start gap-2.5">
        <Mark ok={!!r.phone} />
        <div className="text-xs text-slate-700">
          <span className="font-semibold text-slate-800">{t('moderation.phone')}</span>
          <span className="ml-1.5 text-slate-500">{r.phone || t('moderation.phoneNone')}</span>
        </div>
      </div>
    </section>
  )
}

function Decision({ r, onGpsOk, onDecide, busy }: { r: ModerationRequest; onGpsOk: Props['onGpsOk']; onDecide: Props['onDecide']; busy: boolean }) {
  const { t } = useTranslation()
  const [panel, setPanel] = useState<'return' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const blockers = publishBlockers(r.desc, r.gpsOk)

  const submitReason = () => {
    if (reason.trim().length < 5) return setError(t('moderation.reasonShort'))
    onDecide(panel === 'return' ? 'returned' : 'rejected', reason.trim())
  }
  const openPanel = (p: 'return' | 'reject') => {
    setPanel(p)
    setError('')
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
        <input type="checkbox" checked={r.gpsOk} onChange={e => onGpsOk(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand" />
        {t('moderation.gpsConfirm')}
      </label>

      {panel && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label htmlFor="mod-reason" className="mb-2 block text-xs font-semibold text-slate-800">
            {panel === 'return' ? t('moderation.reasonReturn') : t('moderation.reasonReject')}
          </label>
          <textarea
            id="mod-reason"
            rows={2}
            autoFocus
            value={reason}
            aria-invalid={!!error}
            aria-describedby={error ? 'mod-reason-error' : undefined}
            onChange={e => {
              setReason(e.target.value)
              setError('')
            }}
            placeholder={t('moderation.reasonPlaceholder')}
            className={cn(field, error && 'border-rose-400')}
          />
          {error && (
            <p id="mod-reason-error" className="mt-1 text-[11px] text-rose-600">
              {error}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPanel(null)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant={panel === 'reject' ? 'destructive' : 'default'} onClick={submitReason} disabled={busy}>
              {panel === 'return' ? t('moderation.confirmReturn') : t('moderation.confirmReject')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className={cn('text-[11px]', blockers.length ? 'text-slate-500' : 'text-emerald-600')}>
          {blockers.length ? t('moderation.gate', { value: blockers.map(b => t(`moderation.blockers.${b}`)).join('; ') }) : t('moderation.gateOk')}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="lg" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => openPanel('reject')}>
            {t('moderation.reject')}
          </Button>
          <Button variant="outline" size="lg" onClick={() => openPanel('return')}>
            {t('moderation.return')}
          </Button>
          <Button size="lg" disabled={!!blockers.length || busy} onClick={() => onDecide('published')}>
            {t('moderation.publish')}
          </Button>
        </div>
      </div>
    </div>
  )
}
