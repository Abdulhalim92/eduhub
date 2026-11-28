/** GET /platform/attention — счётчики очередей «Требует внимания». */
export interface Attention {
  totalCenters: number
  /** Филиалы, ожидающие модерации каталога. */
  moderation: number
  /** Подписка истекает в ближайшие 14 дней (BR: isExpiring). */
  expiring: number
  expiring7: number
  /** Не заходили больше 10 дней (Churn Risk). */
  churn: number
  blocked: number
  /** Использование лимита тарифа ≥ 80 % (BR-021). */
  nearLimit: number
  /** Баланс на платформе ушёл в минус. */
  overdraft: number
  pendingInvoices: number
}
