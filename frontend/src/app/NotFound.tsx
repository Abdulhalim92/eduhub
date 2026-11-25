/* Неизвестный адрес. В прототипе — красный тост и переход на главную; здесь — отдельная страница, чтобы ошибка в ссылке была видна. */
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/layouts/shared/use-document-title'

export function NotFound() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  useDocumentTitle(t('notFound.title'))
  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <section className="max-w-md rounded-2xl border border-slate-200 bg-card p-8 text-center">
        <h1 className="text-xl font-extrabold text-heading">{t('notFound.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('notFound.text', { path: pathname })}</p>
        <Button asChild className="mt-6">
          <Link to="/">{t('notFound.toHome')}</Link>
        </Button>
      </section>
    </div>
  )
}
