import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Заголовок вкладки браузера: «<экран> · ЛИНИЯ», как в прототипе. */
export function useDocumentTitle(title: string | undefined) {
  const { t } = useTranslation()
  const appName = t('app.name')
  useEffect(() => {
    document.title = title ? `${title} · ${appName}` : appName
  }, [title, appName])
}
