/* Форматирование чисел, денег и дат (ru-RU, валюта — сомони). Тексты с падежами — через i18n (plural), не здесь. */
const nf = new Intl.NumberFormat('ru-RU')
const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

export const formatNumber = (n: number) => nf.format(n)
export const formatMoney = (n: number) => `${nf.format(n)} сомони`
/** Сумма операции со знаком: «+2 600 сомони», «−200 сомони» (типографский минус). */
export const formatSignedMoney = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatMoney(Math.abs(n))}`
/** «5 декабря» */
export const formatDay = (iso: string) => dayFmt.format(new Date(iso))
/** Сегодня в UTC (YYYY-MM-DD): сервер сверяет даты поступления в UTC. */
export const todayUtc = () => new Date().toISOString().slice(0, 10)
const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
/** «25.11.2026, 14:05» */
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))
/** Дата через N дней от сегодня (N < 0 — в прошлом): «5 декабря». */
export const formatDayFromNow = (days: number) => dayFmt.format(new Date(Date.now() + days * 864e5))
