/* Значок канала поступления денег (прототип: invoice-panel.js PAY_CHANNEL_UI). Цвет — только подложка значка; название способа рядом текстом. */
import { Banknote, CreditCard, Landmark, Smartphone, Tag, Wallet, type LucideIcon } from 'lucide-react'
import type { PayChannel } from '@/api'

export const PAY_CHANNEL_UI: Record<PayChannel, { icon: LucideIcon; tone: string }> = {
  online: { icon: CreditCard, tone: 'bg-indigo-100 text-brand' },
  bank: { icon: Landmark, tone: 'bg-sky-100 text-sky-700' },
  cash: { icon: Banknote, tone: 'bg-emerald-100 text-emerald-700' },
  card: { icon: Smartphone, tone: 'bg-violet-100 text-violet-700' },
  balance: { icon: Wallet, tone: 'bg-teal-100 text-teal-700' },
  promo: { icon: Tag, tone: 'bg-amber-100 text-amber-700' },
}
