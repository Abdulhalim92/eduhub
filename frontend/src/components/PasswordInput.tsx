/* Поле пароля с кнопкой «показать / скрыть» (на телефоне пароль легко ввести с ошибкой). Пропсы и ref уходят в сам input — работает с register(). */
import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={cn(className, 'pr-10')} />
      <button
        type="button"
        onClick={() => setShown(v => !v)}
        aria-label={shown ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
        aria-pressed={shown}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}
