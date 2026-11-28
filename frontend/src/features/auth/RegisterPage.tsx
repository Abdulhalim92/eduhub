/* Заявка учебного центра на подключение (PLT-CTR-070, решение владельца 26.11.2026). Самостоятельной регистрации нет:
   центр оставляет заявку, SuperAdmin рассматривает её и подключает центр (PLT-CTR-020) — тогда владелец получает логин и временный пароль.
   Проверки (уникальность названия, одна открытая заявка на телефон, согласие) — на сервере, ошибки под полями. */
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { errorMessage } from '@/api/errors'
import type { CenterApplicationPayload } from '@/features/auth/api/types'
import { useGetDictionariesQuery } from '@/features/dictionaries/api/dictionariesApi'
import { useSubmitApplicationMutation } from './api/authApi'
import { Field } from '@/components/Field'
import { fieldAria } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { applyServerErrors } from '@/lib/server-errors'
import { authInput } from './auth-styles'
import { AuthLayout } from './AuthLayout'
import { FormAlert } from './FormAlert'

const ERROR_ORDER = ['centerName', 'city', 'direction', 'ownerName', 'phone', 'email', 'consent'] as const

export function RegisterPage() {
  const { t } = useTranslation()
  const [done, setDone] = useState<{ id: string; phone: string } | null>(null)
  const footer = (
    <>
      {t('auth.register.haveAccount')}{' '}
      <Link to="/login" className="font-semibold text-brand hover:underline">
        {t('auth.register.toLogin')}
      </Link>
    </>
  )

  if (done)
    return (
      <AuthLayout title={t('auth.register.doneTitle', { id: done.id })}>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
          <p className="text-sm text-slate-600">{t('auth.register.doneText', { phone: done.phone })}</p>
          <Button asChild variant="outline" size="lg" className="mt-2 w-full">
            <Link to="/login">{t('auth.register.back')}</Link>
          </Button>
        </div>
      </AuthLayout>
    )

  return (
    <AuthLayout title={t('auth.register.title')} subtitle={t('auth.register.subtitle')} footer={footer} wide>
      <ApplicationForm onDone={setDone} />
    </AuthLayout>
  )
}

function ApplicationForm({ onDone }: { onDone: (d: { id: string; phone: string }) => void }) {
  const { t } = useTranslation()
  const dict = useGetDictionariesQuery().data
  const [submitApplication, { isLoading: submitting }] = useSubmitApplicationMutation()
  const [error, setError] = useState('')
  const { register, handleSubmit, setError: setFieldError, clearErrors, formState } = useForm<CenterApplicationPayload>({
    defaultValues: { centerName: '', city: '', direction: '', ownerName: '', phone: '', email: '', comment: '', consent: false },
  })
  const errors = formState.errors
  const field = (name: keyof CenterApplicationPayload) => register(name, { onChange: () => clearErrors(name) })

  const onSubmit = handleSubmit(async v => {
    setError('')
    try {
      const app = await submitApplication(v).unwrap()
      onDone({ id: app.id, phone: v.phone.trim() })
    } catch (e) {
      if (!applyServerErrors(e, setFieldError, [...ERROR_ORDER])) setError(errorMessage(e, t('common.saveError')))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Field label={t('auth.register.centerName')} htmlFor="app-centerName" required error={errors.centerName?.message}>
        <input autoComplete="organization" className={authInput(errors.centerName)} {...fieldAria('app-centerName', errors.centerName?.message)} {...field('centerName')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('auth.register.city')} htmlFor="app-city" required error={errors.city?.message}>
          <select className={authInput(errors.city)} {...fieldAria('app-city', errors.city?.message)} {...field('city')}>
            <option value="">{t('auth.register.cityPlaceholder')}</option>
            {dict?.cities.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('auth.register.direction')} htmlFor="app-direction" required error={errors.direction?.message}>
          <select className={authInput(errors.direction)} {...fieldAria('app-direction', errors.direction?.message)} {...field('direction')}>
            <option value="">{t('auth.register.directionPlaceholder')}</option>
            {dict?.directions.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('auth.register.ownerName')} htmlFor="app-ownerName" required error={errors.ownerName?.message}>
        <input autoComplete="name" className={authInput(errors.ownerName)} {...fieldAria('app-ownerName', errors.ownerName?.message)} {...field('ownerName')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('auth.register.phone')} htmlFor="app-phone" required hint={t('auth.register.phoneHint')} error={errors.phone?.message}>
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder={t('auth.register.phonePlaceholder')}
            className={authInput(errors.phone)}
            {...fieldAria('app-phone', errors.phone?.message, true)}
            {...field('phone')}
          />
        </Field>
        <Field label={t('auth.register.email')} htmlFor="app-email" optional error={errors.email?.message}>
          <input type="email" autoComplete="email" inputMode="email" className={authInput(errors.email)} {...fieldAria('app-email', errors.email?.message)} {...field('email')} />
        </Field>
      </div>
      <Field label={t('auth.register.comment')} htmlFor="app-comment" optional>
        <textarea id="app-comment" rows={3} maxLength={500} placeholder={t('auth.register.commentPlaceholder')} className={authInput()} {...field('comment')} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand" {...fieldAria('app-consent', errors.consent?.message)} {...field('consent')} />
          <span>{t('auth.register.consent')}</span>
        </label>
        {errors.consent && (
          <span id="app-consent-error" role="alert" className="text-[11px] text-rose-600">
            {errors.consent.message}
          </span>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? t('auth.register.submitting') : t('auth.register.submit')}
      </Button>
    </form>
  )
}
