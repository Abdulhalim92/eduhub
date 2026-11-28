/* Восстановление пароля по SMS-коду (SYS-ACC-030, решение владельца 26.11.2026; Q-023).
   Шаг 1 — логин → код на телефон; шаг 2 — код и новый пароль → вход с новым паролем.
   Ответ на шаге 1 одинаковый для любого логина (нельзя узнать, есть ли он). Код, срок, попытки, правила пароля — на сервере.
   SMS-шлюз — мок: код показывается на экране с пометкой «Демо». */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import type { ResetRequested } from '@/features/auth/api/types'
import { useConfirmResetMutation, useRequestResetMutation } from './api/authApi'
import { Field } from '@/components/Field'
import { fieldAria } from '@/components/form-styles'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { applyServerErrors } from '@/lib/server-errors'
import { authInput } from './auth-styles'
import { AuthLayout } from './AuthLayout'
import { FormAlert } from './FormAlert'

type Sent = ResetRequested & { login: string; at: number }

/** Ответ сервера + когда код отправлен (от этого момента считается пауза до повторной отправки). */
const markSent = (r: ResetRequested, login: string): Sent => ({ ...r, login, at: Date.now() })

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const [sent, setSent] = useState<Sent | null>(null)
  // «Другой логин» возвращает к шагу 1 с прежним логином в поле — его проще поправить, чем набрать заново
  const [lastLogin, setLastLogin] = useState(params.get('login') ?? '')
  return (
    <AuthLayout
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      footer={
        <Link to="/login" state={sent ? { login: sent.login } : undefined} className="font-semibold text-brand hover:underline">
          {t('auth.reset.back')}
        </Link>
      }
    >
      {sent ? (
        <ConfirmStep
          sent={sent}
          onResent={r => setSent(markSent(r, sent.login))}
          onChangeLogin={() => {
            setLastLogin(sent.login)
            setSent(null)
          }}
        />
      ) : (
        <RequestStep initialLogin={lastLogin} onSent={setSent} />
      )}
    </AuthLayout>
  )
}

function RequestStep({ initialLogin, onSent }: { initialLogin: string; onSent: (s: Sent) => void }) {
  const { t } = useTranslation()
  const [requestReset, { isLoading: sending }] = useRequestResetMutation()
  const [error, setError] = useState('')
  const { register, handleSubmit, setError: setFieldError, clearErrors, formState } = useForm({ defaultValues: { login: initialLogin } })
  const fieldError = formState.errors.login?.message

  const onSubmit = handleSubmit(async v => {
    setError('')
    const login = v.login.trim().toLowerCase()
    try {
      onSent(markSent(await requestReset(login).unwrap(), login))
    } catch (e) {
      if (!applyServerErrors(e, setFieldError, ['login'])) setError(errorMessage(e, t('common.saveError')))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Field label={t('auth.reset.login')} htmlFor="reset-login" hint={t('auth.reset.loginHint')} error={fieldError}>
        <input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          className={authInput(fieldError)}
          {...fieldAria('reset-login', fieldError, true)}
          {...register('login', { onChange: () => clearErrors('login') })}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={sending}>
        {sending ? t('auth.reset.sending') : t('auth.reset.send')}
      </Button>
    </form>
  )
}

/** Секунд до возможной повторной отправки (тикает раз в секунду). */
function useSecondsLeft(until: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= now) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [until, now])
  return Math.max(0, Math.ceil((until - now) / 1000))
}

type ConfirmProps = { sent: Sent; onResent: (r: ResetRequested) => void; onChangeLogin: () => void }

function ConfirmStep({ sent, onResent, onChangeLogin }: ConfirmProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [confirmReset, { isLoading: confirming }] = useConfirmResetMutation()
  const [resendCode, { isLoading: resending }] = useRequestResetMutation()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const left = useSecondsLeft(sent.at + sent.resendIn * 1000)
  const { register, handleSubmit, setError: setFieldError, clearErrors, formState } = useForm({ defaultValues: { code: '', newPassword: '', repeat: '' } })
  const errors = formState.errors

  const onSubmit = handleSubmit(async v => {
    setError('')
    if (v.newPassword !== v.repeat) {
      setFieldError('repeat', { message: t('auth.reset.mismatch') }, { shouldFocus: true })
      return
    }
    try {
      await confirmReset({ login: sent.login, code: v.code.trim(), newPassword: v.newPassword }).unwrap()
      navigate('/login', { state: { login: sent.login, resetDone: true } })
    } catch (e) {
      if (!applyServerErrors(e, setFieldError, ['code', 'newPassword'])) setError(errorMessage(e, t('common.saveError')))
    }
  })

  const doResend = async () => {
    setError('')
    try {
      onResent(await resendCode(sent.login).unwrap())
      setNotice(t('auth.reset.resent'))
    } catch (e) {
      setError(errorMessage(e, t('common.saveError')))
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert tone="info">{t('auth.reset.sentTo', { login: sent.login })}</FormAlert>
      {sent.demoCode && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-[11px] text-slate-600">
          {t('auth.reset.demo', { code: sent.demoCode })}
        </p>
      )}
      {notice && !error && <FormAlert tone="success">{notice}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      <Field label={t('auth.reset.code')} htmlFor="reset-code" error={errors.code?.message}>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className={`${authInput(errors.code)} tracking-[0.3em] tabular-nums`}
          {...fieldAria('reset-code', errors.code?.message)}
          {...register('code', { onChange: () => clearErrors('code') })}
        />
      </Field>
      <Field label={t('auth.reset.newPassword')} htmlFor="reset-new" hint={t('auth.reset.passwordHint')} error={errors.newPassword?.message}>
        <PasswordInput
          autoComplete="new-password"
          className={authInput(errors.newPassword)}
          {...fieldAria('reset-new', errors.newPassword?.message, true)}
          {...register('newPassword', { onChange: () => clearErrors('newPassword') })}
        />
      </Field>
      <Field label={t('auth.reset.repeat')} htmlFor="reset-repeat" error={errors.repeat?.message}>
        <PasswordInput
          autoComplete="new-password"
          className={authInput(errors.repeat)}
          {...fieldAria('reset-repeat', errors.repeat?.message)}
          {...register('repeat', { onChange: () => clearErrors('repeat') })}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={confirming}>
        {confirming ? t('auth.reset.submitting') : t('auth.reset.submit')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <button type="button" onClick={onChangeLogin} className="font-semibold text-slate-600 hover:underline">
          {t('auth.reset.changeLogin')}
        </button>
        {left > 0 ? (
          <span className="text-slate-400" aria-live="polite">
            {t('auth.reset.resendIn', { s: left })}
          </span>
        ) : (
          <button type="button" onClick={doResend} disabled={resending} className="font-semibold text-brand hover:underline disabled:opacity-60">
            {t('auth.reset.resend')}
          </button>
        )}
      </div>
    </form>
  )
}
