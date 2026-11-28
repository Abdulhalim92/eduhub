/* Окраска загрузки лимита (прототип: limits.js LIM_TONE). Только наглядность: кто «у лимита» и какой тариф рекомендовать, решает сервер (BR-021). */
export type LimitLevel = 'full' | 'critical' | 'warning' | 'ok'

export const LIMIT_TONE: Record<LimitLevel, { bar: string; pill: string; text: string }> = {
  full: { bar: 'bg-rose-500', pill: 'bg-rose-100 text-rose-700', text: 'text-rose-600' },
  critical: { bar: 'bg-amber-500', pill: 'bg-amber-100 text-amber-800', text: 'text-amber-600' },
  warning: { bar: 'bg-yellow-400', pill: 'bg-yellow-100 text-yellow-800', text: 'text-yellow-700' },
  ok: { bar: 'bg-emerald-500', pill: 'bg-slate-100 text-slate-500', text: 'text-slate-500' },
}

/** Уровень по проценту; ниже порога (%) — «в норме». */
export const limitLevel = (pct: number, thresholdPct: number): LimitLevel =>
  pct < thresholdPct ? 'ok' : pct >= 100 ? 'full' : pct >= 90 ? 'critical' : 'warning'
