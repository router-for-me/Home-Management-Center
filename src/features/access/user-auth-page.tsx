import { Link } from '@tanstack/react-router'

import { ArrowLeft, CircleAlert, LockKeyhole, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUserSessionStore } from '@/stores/user-session-store'

type UserAuthPageProps = {
  mode: 'login' | 'register'
}

export function UserAuthPage({ mode }: UserAuthPageProps) {
  const { t } = useTranslation()
  const status = useUserSessionStore((state) => state.status)
  const unavailable = status === 'unavailable'

  return (
    <PublicAccessShell>
      <section className="mx-auto grid max-w-xl gap-6">
        <Button asChild variant="text" size="sm" className="w-fit px-0">
          <Link to="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('userAccess.back')}
          </Link>
        </Button>

        <div className="bg-card rounded-lg border shadow-sm">
          <div className="border-b p-5 md:p-6">
            <span className="bg-info/10 text-info flex size-11 items-center justify-center rounded-md">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">{t(`userAccess.${mode}.title`)}</h1>
            <p className="text-muted-foreground mt-2 max-w-[65ch] text-sm leading-6">
              {t(`userAccess.${mode}.description`)}
            </p>
          </div>

          <div className="grid gap-5 p-5 md:p-6">
            {unavailable ? (
              <div className="bg-warning/10 text-warning-foreground dark:text-warning grid gap-2 px-3 py-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                  {t('userAccess.unavailable.title')}
                </span>
                <span className="leading-6">{t('userAccess.unavailable.description')}</span>
              </div>
            ) : null}

            <fieldset className="grid gap-4" disabled={unavailable} aria-disabled={unavailable}>
              <label className="grid gap-2 text-sm font-medium">
                <span>{t('userAccess.fields.username')}</span>
                <Input
                  autoComplete="username"
                  placeholder={t('userAccess.fields.usernamePlaceholder')}
                  className={unavailable ? 'bg-muted/45' : undefined}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>{t('userAccess.fields.password')}</span>
                <Input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={t('userAccess.fields.passwordPlaceholder')}
                  className={unavailable ? 'bg-muted/45' : undefined}
                />
              </label>
              {mode === 'register' ? (
                <label className="grid gap-2 text-sm font-medium">
                  <span>{t('userAccess.fields.confirmPassword')}</span>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('userAccess.fields.confirmPasswordPlaceholder')}
                    className={unavailable ? 'bg-muted/45' : undefined}
                  />
                </label>
              ) : null}
              <Button type="button" disabled={unavailable}>
                <LockKeyhole className="size-4" aria-hidden="true" />
                {t(`userAccess.${mode}.action`)}
              </Button>
            </fieldset>

            <p className="text-muted-foreground text-center text-sm">
              {mode === 'login'
                ? t('userAccess.login.switchPrompt')
                : t('userAccess.register.switchPrompt')}{' '}
              <Link
                to={mode === 'login' ? '/register' : '/login'}
                className="text-primary focus-visible:ring-ring/50 rounded-sm font-medium outline-none hover:underline focus-visible:ring-3"
              >
                {mode === 'login'
                  ? t('userAccess.login.switchAction')
                  : t('userAccess.register.switchAction')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </PublicAccessShell>
  )
}
