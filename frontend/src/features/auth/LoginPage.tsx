/* Вход по логину и паролю (SYS-ACC-010). Прототип: login.html + src/js/login.js.
   Временный пароль → обязательная смена; владелец и администратор центра попадают в кабинет своего центра,
   остальные роли — пояснение про мобильное приложение. Проверки (одинаковое сообщение, блокировка после 5 попыток) — на сервере. */
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { errorMessage, type Session } from '@/api'
import { useChangePassword, useLogin } from '@/api/mutations'
import { Field } from '@/components/Field'
import { fieldAria } from '@/components/form-styles'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { applyServerErrors } from '@/lib/server-errors'
import { clearSession, saveSession } from '@/lib/session'
import { authInput, DEMO_LOGIN } from './auth-styles'
import { AuthLayout } from './AuthLayout'
import { FormAlert } from './FormAlert'

type LoginState = { login?: string; resetDone?: boolean } | null

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useLocation().state as LoginState
  const [step, setStep] = useState<'login' | 'change' | 'done'>('login')
  const [creds, setCreds] = useState({ login: '', password: '' })
  const [user, setUser] = useState<Session | null>(null)

  const enter = (u: Session) => {
    saveSession(u)
    if (u.cabinet) navigate(`/center/profile?center=${u.centerId}`)
    else {
      setUser(u)
      setStep('done')
    }
  }

  if (step === 'change')
    return (
      <AuthLayout title={t('auth.change.title')} subtitle={t('auth.change.text')}>
        <ChangeForm creds={creds} onDone={enter} />
      </AuthLayout>
    )

  if (step === 'done' && user)
    return (
      <AuthLayout title={t('auth.done.title', { name: user.name })}>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
          <p className="text-xs text-slate-500">{t('auth.done.text', { role: user.roleLabel })}</p>
          <Button
            variant="outline"
            size="lg"
            className="mt-2 w-full"
            onClick={() => {
              clearSession()
              setUser(null)
              setStep('login')
            }}
          >
            {t('auth.done.logout')}
          </Button>
        </div>
      </AuthLayout>
    )

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-brand hover:underline">
            {t('auth.login.apply')}
          </Link>
        </>
      }
    >
      <LoginForm
        initialLogin={state?.login ?? ''}
        resetDone={!!state?.resetDone}
        onSuccess={(u, c) => {
          setCreds(c)
          if (u.mustChange) setStep('change')
          else enter(u)
        }}
      />
    </AuthLayout>
  )
}

type LoginFormProps = { initialLogin: string; resetDone: boolean; onSuccess: (u: Session, creds: { login: string; password: string }) => void }

function LoginForm({ initialLogin, resetDone, onSuccess }: LoginFormProps) {
  const { t } = useTranslation()
  const mutation = useLogin()
  const [error, setError] = useState('')
  const { register, handleSubmit, setValue, control } = useForm({ defaultValues: { login: initialLogin, password: '' } })

  const onSubmit = handleSubmit(async v => {
    setError('')
    try {
      onSuccess(await mutation.mutateAsync(v), v)
    } catch (e) {
      // одно сообщение для «нет логина» и «не тот пароль»; пароль стираем, логин оставляем
      setError(errorMessage(e, t('common.loadError')))
      setValue('password', '')
    }
  })
  const login = useWatch({ control, name: 'login' })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {resetDone && !error && <FormAlert tone="success">{t('auth.login.resetDone')}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      <Field label={t('auth.login.login')} htmlFor="login-login">
        <input id="login-login" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus className={authInput()} {...register('login')} />
      </Field>
      <Field label={t('auth.login.password')} htmlFor="login-password">
        <PasswordInput id="login-password" autoComplete="current-password" className={authInput()} {...register('password')} />
      </Field>
      <div className="-mt-1 text-right">
        <Link to={`/reset-password${login ? `?login=${encodeURIComponent(login.trim())}` : ''}`} className="text-xs font-semibold text-brand hover:underline">
          {t('auth.login.forgot')}
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
      </Button>
      <p className="text-[11px] text-slate-500">{t('auth.login.hint')}</p>
      {/* демо: SMS и выдачи логинов нет — даём готовый доступ, чтобы вход можно было попробовать */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-[11px] text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-slate-700">{t('auth.login.demoTitle')}</strong>
          <button
            type="button"
            className="font-semibold text-brand hover:underline"
            onClick={() => {
              setValue('login', DEMO_LOGIN.login)
              setValue('password', DEMO_LOGIN.password)
            }}
          >
            {t('auth.login.demoFill')}
          </button>
        </div>
        <p className="mt-1">{t('auth.login.demoText', DEMO_LOGIN)}</p>
      </div>
    </form>
  )
}

function ChangeForm({ creds, onDone }: { creds: { login: string; password: string }; onDone: (u: Session) => void }) {
  const { t } = useTranslation()
  const mutation = useChangePassword()
  const [error, setError] = useState('')
  const { register, handleSubmit, setError: setFieldError, clearErrors, formState } = useForm({ defaultValues: { newPassword: '', repeat: '' } })
  const errors = formState.errors

  const onSubmit = handleSubmit(async v => {
    setError('')
    // совпадение повтора — проверка удобства на клиенте; правила пароля проверяет сервер
    if (v.newPassword !== v.repeat) {
      setFieldError('repeat', { message: t('auth.change.mismatch') }, { shouldFocus: true })
      return
    }
    try {
      onDone(await mutation.mutateAsync({ ...creds, newPassword: v.newPassword }))
    } catch (e) {
      if (!applyServerErrors(e, setFieldError, ['newPassword'])) setError(errorMessage(e, t('common.saveError')))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Field label={t('auth.change.newPassword')} htmlFor="change-new" error={errors.newPassword?.message}>
        <PasswordInput
          autoComplete="new-password"
          autoFocus
          className={authInput(errors.newPassword)}
          {...fieldAria('change-new', errors.newPassword?.message)}
          {...register('newPassword', { onChange: () => clearErrors('newPassword') })}
        />
      </Field>
      <Field label={t('auth.change.repeat')} htmlFor="change-repeat" error={errors.repeat?.message}>
        <PasswordInput
          autoComplete="new-password"
          className={authInput(errors.repeat)}
          {...fieldAria('change-repeat', errors.repeat?.message)}
          {...register('repeat', { onChange: () => clearErrors('repeat') })}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? t('auth.login.submitting') : t('auth.change.submit')}
      </Button>
    </form>
  )
}
