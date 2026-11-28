/* «Данные для входа администратора центра» (SYS-ACC-020, BR-025): основание обязательно, прежний пароль перестаёт работать,
   новый временный показывается один раз. Окно с паролем не закрывается случайным кликом мимо — только кнопкой «Готово». */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import type { IssuedCredentials } from '@/features/access/api/types'
import { useIssueAdminAccessMutation } from './api/accessApi'
import { Field } from '@/components/Field'
import { fieldAria, inputClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { applyServerErrors } from '@/lib/server-errors'

type Center = { id: number; name: string }

export function AdminAccessDialog({ center, onClose }: { center: Center | null; onClose: () => void }) {
  const { t } = useTranslation()
  const [issueAccess, { isLoading: issuing }] = useIssueAdminAccessMutation()
  const [issued, setIssued] = useState<IssuedCredentials | null>(null)
  const close = () => {
    setIssued(null)
    onClose()
  }
  return (
    <Dialog open={!!center} onOpenChange={open => !open && !issuing && !issued && close()}>
      <DialogContent
        className="[--dialog-p:--spacing(6)] sm:max-w-lg"
        showCloseButton={!issued}
        // пароль виден один раз — не терять его случайным кликом или Esc
        onInteractOutside={e => issued && e.preventDefault()}
        onEscapeKeyDown={e => issued && e.preventDefault()}
      >
        {center && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-heading">{issued ? t('access.issuedTitle') : t('access.title')}</DialogTitle>
              <DialogDescription>{issued ? `${issued.name} · ${center.name}` : center.name}</DialogDescription>
            </DialogHeader>
            {issued ? (
              <Credentials creds={issued} onDone={close} />
            ) : (
              <ReasonForm centerId={center.id} issueAccess={issueAccess} issuing={issuing} onIssued={setIssued} onCancel={close} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

type FormProps = {
  centerId: number
  issueAccess: ReturnType<typeof useIssueAdminAccessMutation>[0]
  issuing: boolean
  onIssued: (c: IssuedCredentials) => void
  onCancel: () => void
}

function ReasonForm({ centerId, issueAccess, issuing, onIssued, onCancel }: FormProps) {
  const { t } = useTranslation()
  const { register, handleSubmit, setError, clearErrors, formState } = useForm<{ reason: string }>({ defaultValues: { reason: '' } })
  const error = formState.errors.reason?.message
  const onSubmit = handleSubmit(async v => {
    try {
      onIssued(await issueAccess({ centerId, reason: v.reason }).unwrap())
    } catch (e) {
      if (!applyServerErrors(e, setError, ['reason'])) toast.error(errorMessage(e, t('common.saveError')))
    }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">{t('access.note')}</p>
      <Field label={t('access.reason')} htmlFor="access-reason" required error={error}>
        <textarea
          rows={2}
          placeholder={t('access.reasonPlaceholder')}
          className={inputClass(error)}
          {...fieldAria('access-reason', error)}
          {...register('reason', { onChange: () => clearErrors('reason') })}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={issuing}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" variant="destructive" disabled={issuing}>
          {issuing ? t('access.submitting') : t('access.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Credentials({ creds, onDone }: { creds: IssuedCredentials; onDone: () => void }) {
  const { t } = useTranslation()
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('access.copied'))
    } catch {
      toast.error(t('access.copyFailed'))
    }
  }
  const row = (label: string, value: string, copyLabel: string) => (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono font-semibold break-all text-heading">{value}</dd>
      <dd>
        <button type="button" onClick={() => copy(value)} aria-label={copyLabel} className="text-[11px] font-semibold text-brand hover:underline">
          {t('access.copy')}
        </button>
      </dd>
    </>
  )
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[5rem_1fr_auto] items-center gap-x-3 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
        {row(t('access.login'), creds.login, t('access.copyLogin'))}
        {row(t('access.password'), creds.password, t('access.copyPassword'))}
      </dl>
      <p className="text-[11px] text-amber-700">{t('access.once')}</p>
      <DialogFooter>
        <Button size="lg" onClick={onDone}>
          {t('access.done')}
        </Button>
      </DialogFooter>
    </div>
  )
}
