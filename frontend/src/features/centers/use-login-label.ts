/* «Последний вход» центра (прототип: ui.js loginLabel): Ещё не входили / Сегодня / Вчера / N дней назад. */
import { useTranslation } from 'react-i18next'
import type { CenterDto } from '@/api'

export function useLoginLabel() {
  const { t } = useTranslation()
  return (c: Pick<CenterDto, 'neverLogged' | 'loginDays'>) =>
    c.neverLogged
      ? t('center.login.never')
      : c.loginDays === 0
        ? t('center.login.today')
        : c.loginDays === 1
          ? t('center.login.yesterday')
          : t('center.login.daysAgo', { count: c.loginDays })
}
