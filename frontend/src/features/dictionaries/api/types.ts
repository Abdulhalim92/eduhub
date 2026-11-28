export interface PlanSummary {
  id: string
  name: string
  price: number
  limits: { staff: number; storageGb: number; branches: number }
  modules: Record<'payroll' | 'inventory' | 'crm' | 'geo', boolean>
}

/** Канал поступления денег. bank/cash/card — вне системы (подтверждает SuperAdmin), online — шлюз, balance — списание с баланса. */
export type PayChannel = 'bank' | 'cash' | 'card' | 'online' | 'balance' | 'promo'

/** Способ оплаты: подписи для формы подтверждения оплаты и пополнения. */
export interface PayMethod {
  method: string
  channel: PayChannel
  evidence: string
  docLabel: string
  docHint: string
}

export interface Dictionaries {
  cities: string[]
  directions: string[]
  managers: string[]
  payMethods: PayMethod[]
  /** Активные тарифы (архивные не входят). */
  plans: PlanSummary[]
}
