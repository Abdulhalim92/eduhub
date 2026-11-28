/* Схематичная карта (прототип: moderation.js modMapSvg): точка центра, точка геокодера, круг 100 м и масштаб.
   Подложка условная — реальная карта появится с интеграцией INT-GEO-010. Цвета — классы палитры (без hex). */
import { useTranslation } from 'react-i18next'
import type { ModerationRequest } from '@/api'
import { distanceM } from './geo'

const W = 600
const H = 360
/** px на метр */
const S = 0.45

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function ModerationMap({ r }: { r: Pick<ModerationRequest, 'gps' | 'geo' | 'centerName' | 'branch' | 'address'> }) {
  const { t } = useTranslation()
  const toXY = (p: { lat: number; lng: number }): [number, number] => {
    const dx = (p.lng - r.geo.lng) * 111320 * Math.cos((r.geo.lat * Math.PI) / 180)
    const dy = (p.lat - r.geo.lat) * 110540
    return [Math.max(24, Math.min(W - 24, W / 2 + dx * S)), Math.max(24, Math.min(H - 24, H / 2 - dy * S))]
  }
  const g = toXY(r.geo)
  const d = toXY(r.gps)
  const dist = Math.round(distanceM(r.gps, r.geo))
  const R = 100 * S
  const boxX = Math.max(8, Math.min(W - 278, d[0] - 135))
  const boxY = Math.max(8, d[1] - 62)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('moderation.map', { dist })} className="aspect-5/3 h-auto w-full rounded-xl border border-slate-200">
      <rect width={W} height={H} className="fill-slate-100" />
      <path d="M-10 300 C 120 250, 220 330, 330 290 S 520 230, 620 270 L620 330 C 520 290, 420 350, 330 340 S 100 300, -10 350Z" className="fill-sky-100" />
      <rect x="30" y="30" width="110" height="70" rx="8" className="fill-emerald-100" />
      <rect x="440" y="40" width="120" height="90" rx="8" className="fill-emerald-100" />
      <g className="fill-slate-200">
        <rect x="170" y="40" width="70" height="50" rx="4" />
        <rect x="260" y="40" width="60" height="50" rx="4" />
        <rect x="350" y="150" width="70" height="60" rx="4" />
        <rect x="60" y="140" width="80" height="60" rx="4" />
        <rect x="450" y="160" width="90" height="60" rx="4" />
        <rect x="160" y="150" width="90" height="60" rx="4" />
      </g>
      <g className="fill-none stroke-white" strokeWidth="10" strokeLinecap="round">
        <path d="M0 120 H600" />
        <path d="M0 225 H600" />
        <path d="M150 0 V360" />
        <path d="M335 0 V360" />
        <path d="M0 40 L600 205" strokeWidth="6" />
      </g>
      <circle cx={d[0]} cy={d[1]} r={R} className="fill-brand/10 stroke-brand" strokeDasharray="4 3" />
      {dist > 5 && <line x1={g[0]} y1={g[1]} x2={d[0]} y2={d[1]} className="stroke-slate-400" strokeDasharray="3 3" />}
      <circle cx={g[0]} cy={g[1]} r="7" className="fill-emerald-500 stroke-white" strokeWidth="2.5" />
      <circle cx={d[0]} cy={d[1]} r="9" className="fill-brand stroke-white" strokeWidth="3" />
      <g>
        <rect x={boxX} y={boxY} width="270" height="46" rx="9" className="fill-white stroke-slate-300" />
        <text x={boxX + 10} y={boxY + 19} fontSize="11" fontWeight="700" className="fill-slate-900">
          {clip(`${r.centerName} — ${r.branch}`, 42)}
        </text>
        <text x={boxX + 10} y={boxY + 35} fontSize="10" className="fill-slate-500">
          {clip(r.address, 48)}
        </text>
      </g>
      <g fontSize="11" fontWeight="600">
        <rect x="12" y="332" width="230" height="18" rx="6" className="fill-white/90" />
        <text x="20" y="345" className="fill-slate-700">
          <tspan className="fill-brand">●</tspan> {t('moderation.legendCenter')} <tspan className="fill-emerald-500">●</tspan> {t('moderation.legendGeo')}
        </text>
      </g>
      <g>
        <rect x="500" y="332" width={R + 30} height="18" rx="6" className="fill-white/90" />
        <line x1="508" y1="346" x2={508 + R} y2="346" className="stroke-slate-700" strokeWidth="2" />
        <text x={512 + R} y="344" fontSize="9" className="fill-slate-700">
          {t('moderation.scale')}
        </text>
      </g>
    </svg>
  )
}
