/* Вход по телефону и SMS-коду (SYS-ACC-030, BR-035) — основной способ входа.
   Шаги: номер → код → (если номер привязан к нескольким центрам) выбор центра и роли. Срок кода, лимиты и блокировка — на сервере.
   В демо (mock) SMS не отправляется: код показан на экране с пометкой «Демо». */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { API_MODE } from '@/api/baseApi'
import { errorMessage } from '@/api/errors'
import { Field } from '@/components/Field'
import { fieldAria } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { applyServerErrors } from '@/lib/server-errors'
import { useRequestOtpMutation, useSelectMembershipMutation, useVerifyOtpMutation } from './api/authApi'
import type { Membership, SignedIn } from './api/types'
import { authInput, DEMO_PHONE } from './auth-styles'
import { FormAlert } from './FormAlert'
import { useRoleLabel } from './use-role-label'

/** Пауза до повторной отправки кода (сервер: не чаще раза в минуту). */
const RESEND_S = 60

type Sent = { phone: string; at: number; demoCode?: string }
type Choice = { selectToken: string; memberships: Membership[] }

/** Код отправлен сейчас: от этого момента считается пауза до повторной отправки. */
const markSent = (phone: string, demoCode?: string): Sent => ({ phone, at: Date.now(), demoCode })

export function SmsLoginForm({ onSignedIn }: { onSignedIn: (r: SignedIn) => void }) {
  const [sent, setSent] = useState<Sent | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [lastPhone, setLastPhone] = useState('')

  if (sent && choice)
    return (
      <ChooseStep
        phone={sent.phone}
        choice={choice}
        onSignedIn={onSignedIn}
        onBack={() => {
          setChoice(null)
          setSent(null)
        }}
      />
    )
  if (sent)
    return (
      <CodeStep
        sent={sent}
        onResent={s => setSent(s)}
        onSignedIn={onSignedIn}
        onChoose={setChoice}
        onChangePhone={() => {
          setLastPhone(sent.phone)
          setSent(null)
        }}
      />
    )
  return <PhoneStep initialPhone={lastPhone} onSent={setSent} />
}

function PhoneStep({ initialPhone, onSent }: { initialPhone: string; onSent: (s: Sent) => void }) {
  const { t } = useTranslation()
  const [requestOtp, { isLoading: sending }] = useRequestOtpMutation()
  const [error, setError] = useState('')
  const { register, handleSubmit, setValue, setError: setFieldError, clearErrors, formState } = useForm({ defaultValues: { phone: initialPhone } })
  const fieldError = formState.errors.phone?.message

  const onSubmit = handleSubmit(async v => {
    setError('')
    const phone = v.phone.trim()
    try {
      const r = await requestOtp(phone).unwrap()
      onSent(markSent(phone, r.demoCode))
    } catch (e) {
      if (!applyServerErrors(e, setFieldError, ['phone'])) setError(errorMessage(e, t('common.saveError')))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Field label={t('auth.sms.phone')} htmlFor="sms-phone" hint={t('auth.sms.phoneHint')} error={fieldError}>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          placeholder={t('auth.sms.phonePlaceholder')}
          className={authInput(fieldError)}
          {...fieldAria('sms-phone', fieldError, true)}
          {...register('phone', { onChange: () => clearErrors('phone') })}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={sending}>
        {sending ? t('auth.sms.sending') : t('auth.sms.send')}
      </Button>
      {API_MODE === 'mock' && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-[11px] text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-slate-700">{t('auth.sms.demoTitle')}</strong>
            <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setValue('phone', DEMO_PHONE)}>
              {t('auth.sms.demoFill')}
            </button>
          </div>
          <p className="mt-1">{t('auth.sms.demoText', { phone: DEMO_PHONE })}</p>
        </div>
      )}
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

type CodeProps = {
  sent: Sent
  onResent: (s: Sent) => void
  onSignedIn: (r: SignedIn) => void
  onChoose: (c: Choice) => void
  onChangePhone: () => void
}

function CodeStep({ sent, onResent, onSignedIn, onChoose, onChangePhone }: CodeProps) {
  const { t } = useTranslation()
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation()
  const [requestOtp, { isLoading: resending }] = useRequestOtpMutation()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const left = useSecondsLeft(sent.at + RESEND_S * 1000)
  const { register, handleSubmit, setValue } = useForm({ defaultValues: { code: '' } })

  const onSubmit = handleSubmit(async v => {
    setError('')
    setNotice('')
    try {
      const r = await verifyOtp({ phone: sent.phone, code: v.code.trim() }).unwrap()
      if (r.kind === 'signedIn') onSignedIn(r.signedIn)
      else onChoose({ selectToken: r.selectToken, memberships: r.memberships })
    } catch (e) {
      // неверный, просроченный и чужой код — один ответ; поле очищаем для нового ввода
      setValue('code', '')
      setError(errorMessage(e, t('common.saveError')))
    }
  })

  const doResend = async () => {
    setError('')
    try {
      const r = await requestOtp(sent.phone).unwrap()
      onResent(markSent(sent.phone, r.demoCode))
      setNotice(t('auth.sms.resent'))
    } catch (e) {
      setError(errorMessage(e, t('common.saveError')))
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert tone="info">{t('auth.sms.sentTo', { phone: sent.phone })}</FormAlert>
      {sent.demoCode && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-[11px] text-slate-600">{t('auth.sms.demo', { code: sent.demoCode })}</p>
      )}
      {notice && !error && <FormAlert tone="success">{notice}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      <Field label={t('auth.sms.code')} htmlFor="sms-code">
        <input
          id="sms-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className={`${authInput()} tracking-[0.3em] tabular-nums`}
          {...register('code')}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={verifying}>
        {verifying ? t('auth.sms.submitting') : t('auth.sms.submit')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <button type="button" onClick={onChangePhone} className="font-semibold text-slate-600 hover:underline">
          {t('auth.sms.changePhone')}
        </button>
        {left > 0 ? (
          <span className="text-slate-400" aria-live="polite">
            {t('auth.sms.resendIn', { s: left })}
          </span>
        ) : (
          <button type="button" onClick={doResend} disabled={resending} className="font-semibold text-brand hover:underline disabled:opacity-60">
            {t('auth.sms.resend')}
          </button>
        )}
      </div>
    </form>
  )
}

type ChooseProps = { phone: string; choice: Choice; onSignedIn: (r: SignedIn) => void; onBack: () => void }

function ChooseStep({ phone, choice, onSignedIn, onBack }: ChooseProps) {
  const { t } = useTranslation()
  const roleLabel = useRoleLabel()
  const [selectMembership, state] = useSelectMembershipMutation()
  const [error, setError] = useState('')
  const pendingKey = state.isLoading && state.originalArgs ? `${state.originalArgs.tenantId}:${state.originalArgs.role}` : null

  const pick = async (m: Membership) => {
    setError('')
    try {
      onSignedIn(await selectMembership({ selectToken: choice.selectToken, tenantId: m.tenantId, role: m.role }).unwrap())
    } catch (e) {
      setError(errorMessage(e, t('common.saveError')))
    }
  }

  if (!choice.memberships.length)
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-bold text-heading">{t('auth.sms.noAccessTitle')}</h2>
        <FormAlert>{t('auth.sms.noAccess', { phone })}</FormAlert>
        <Button variant="outline" size="lg" className="w-full" onClick={onBack}>
          {t('auth.sms.back')}
        </Button>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold text-heading">{t('auth.sms.chooseTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('auth.sms.chooseText', { phone })}</p>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <ul className="flex flex-col gap-2">
        {choice.memberships.map(m => {
          const key = `${m.tenantId}:${m.role}`
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => pick(m)}
                disabled={state.isLoading}
                aria-label={t('auth.sms.chooseOption', { center: m.tenantName, role: roleLabel(m.role) })}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand/50 disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-heading">{m.tenantName}</span>
                  <span className="block text-xs text-slate-500">{roleLabel(m.role)}</span>
                </span>
                {pendingKey === key && <span className="text-xs text-slate-400">{t('auth.sms.submitting')}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      <Button variant="outline" size="lg" className="w-full" onClick={onBack}>
        {t('auth.sms.back')}
      </Button>
    </div>
  )
}
