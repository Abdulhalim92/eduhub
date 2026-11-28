/* Поле формы диалога: подпись (* — обязательное), подсказка, ошибка под полем. Ошибка связана с полем через aria-describedby у самого input. */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type Props = {
  label: ReactNode
  /** id поля — подпись кликабельна, ошибка и подсказка получают id `${htmlFor}-error` / `${htmlFor}-hint`. */
  htmlFor?: string
  required?: boolean
  optional?: boolean
  hint?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, required, optional, hint, error, className, children }: Props) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[11px] font-semibold text-slate-600">
        {label}
        {required && (
          <span className="text-rose-500" title={t('common.required')}>
            {' '}*
          </span>
        )}
        {optional && <span className="font-normal text-slate-400"> {t('common.optional')}</span>}
      </label>
      {children}
      {hint && (
        <span id={htmlFor && `${htmlFor}-hint`} className="text-[11px] text-slate-400">
          {hint}
        </span>
      )}
      {error && (
        <span id={htmlFor && `${htmlFor}-error`} role="alert" className="text-[11px] text-rose-600">
          {error}
        </span>
      )}
    </div>
  )
}
