export interface SmsPackage {
  id: string
  sms: number
  price: number
  description: string
  active: boolean
  /** Продано пакетов и скольким центрам. */
  sold: number
  centers: number
}

/** balance — списать с баланса на платформе (BR-005); manual — деньги получены вне системы (BR-002); bonus — бесплатно с причиной (BR-011). */
export type SmsAccrueMode = 'balance' | 'manual' | 'bonus'

export interface SmsAccruePayload {
  centerId: number
  packageId: string
  mode: SmsAccrueMode
  /** manual: способ, документ, дата, сумма (= цене пакета), подтверждение. */
  method?: string
  reference?: string
  receivedOn?: string
  receivedAmount?: number
  confirmed?: boolean
  /** bonus: причина бесплатного начисления. */
  reason?: string
}

export interface SmsSale {
  id: string
  centerId: number
  /** Название центра. */
  center: string
  packageId: string
  sms: number
  remaining: number
  price: number
  boughtAt: string
  status: 'paid' | 'bonus'
  method: string
  reference: string
  reason: string
  low: boolean
  usedPct: number
}
