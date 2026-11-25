/* Временная заглушка экрана: показывает, из какого файла прототипа экран будет перенесён. Удаляется вместе с последним перенесённым экраном. */
import { useTranslation } from 'react-i18next'
import { useScreen } from '@/app/route-handle'

export function ScreenPlaceholder() {
  const { t } = useTranslation()
  const screen = useScreen()
  return (
    <section className="rounded-2xl border border-slate-200 bg-card p-8 text-center">
      <p className="font-semibold text-heading">{t('placeholder.title')}</p>
      {screen?.prototype && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('placeholder.source', { file: `src/js/views/${screen.prototype}` })}
        </p>
      )}
    </section>
  )
}
