/* Ошибка загрузки: текст сервера (или общий) и «Повторить». Используется внутри карточки или строки таблицы. */
import { useTranslation } from 'react-i18next'
import { errorMessage } from '@/api'
import { Button } from '@/components/ui/button'

export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="py-8 text-center">
      <p className="mb-2 text-xs text-rose-600">{errorMessage(error, t('common.loadError'))}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  )
}
