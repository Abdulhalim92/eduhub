/* Каркас страниц без кабинета (вход, восстановление пароля, заявка центра): логотип и карточка по центру экрана; на телефоне — во всю ширину. */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentTitle } from '@/layouts/shared/use-document-title'
import { cn } from '@/lib/utils'

type Props = { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }

export function AuthLayout({ title, subtitle, children, footer, wide }: Props) {
  const { t } = useTranslation()
  useDocumentTitle(title)
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-8 sm:py-12">
      <main className={cn('w-full', wide ? 'max-w-xl' : 'max-w-md')}>
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex size-9 items-center justify-center gap-0.5 rounded-lg bg-brand" aria-hidden>
            <span className="h-4 w-1 rounded-full bg-white" />
            <span className="h-5 w-1 rounded-full bg-white" />
            <span className="h-3.5 w-1 rounded-full bg-white" />
          </span>
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight text-heading">{t('app.name')}</div>
            <div className="text-[11px] text-slate-500">{t('auth.brandSub')}</div>
          </div>
        </div>
        <section className="rounded-2xl border border-slate-200/80 bg-card p-6 shadow-xs sm:p-8" aria-labelledby="auth-title">
          <h1 id="auth-title" className="text-xl font-extrabold tracking-tight text-heading">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </section>
        {footer && <div className="mt-5 text-center text-xs text-slate-600">{footer}</div>}
      </main>
    </div>
  )
}
