/* ДЕМО-значения главной: в прототипе плитки KPI и график заданы в разметке, api для них нет (PLT-DSH-010: «значения KPI и график демонстрационные»).
   Заменяются ответом api, когда у бэкенда появится метод сводной аналитики. */
export const KPI_DEMO = {
  centers: 142,
  centersNewMonth: 12,
  subscriptions: 118,
  conversionPct: 83,
  revenue: 48_500,
  revenueGrowthPct: '18,4',
  smsSent: 64_200,
  smsLeft: 120_000,
} as const

/** Подключений за месяц (значения из подсказок графика прототипа); последний месяц — прогноз. */
export const CONNECTIONS_DEMO: { month: string; value: number; forecast?: boolean }[] = [
  { month: 'Янв', value: 2400 },
  { month: 'Фев', value: 1800 },
  { month: 'Мар', value: 3100 },
  { month: 'Апр', value: 2700 },
  { month: 'Май', value: 4200 },
  { month: 'Июн', value: 4900 },
  { month: 'Июл', value: 6100 },
  { month: 'Авг', value: 4500 },
  { month: 'Сен', value: 4800 },
  { month: 'Окт', value: 3900 },
  { month: 'Ноя', value: 3200, forecast: true },
]
