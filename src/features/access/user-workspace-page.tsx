import { Link, useNavigate } from '@tanstack/react-router'

import { ArrowLeft, KeyRound, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { Button } from '@/components/ui/button'
import { useUserSessionStore } from '@/stores/user-session-store'

function formatOptionalTime(value: string | null, fallback: string) {
  if (!value) return fallback

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function UserWorkspacePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const status = useUserSessionStore((state) => state.status)
  const user = useUserSessionStore((state) => state.user)
  const expiresAt = useUserSessionStore((state) => state.expiresAt)
  const logout = useUserSessionStore((state) => state.logout)
  const authenticated = status === 'authenticated' && user

  const handleLogout = async () => {
    logout()
    await navigate({ to: '/' })
  }

  return (
    <PublicAccessShell>
      <section className="mx-auto grid max-w-4xl gap-6">
        <Button asChild variant="text" size="sm" className="w-fit px-0">
          <Link to="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('userWorkspace.back')}
          </Link>
        </Button>

        {!authenticated ? (
          <div className="bg-card rounded-lg border p-5 shadow-sm md:p-6">
            <span className="bg-info/10 text-info flex size-11 items-center justify-center rounded-md">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">{t('userWorkspace.signedOut.title')}</h1>
            <p className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-6">
              {t('userWorkspace.signedOut.description')}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/login">{t('userWorkspace.login')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/register">{t('userWorkspace.register')}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="bg-card rounded-lg border p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <span className="bg-info/10 text-info flex size-11 items-center justify-center rounded-md">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                  <h1 className="mt-5 text-xl font-semibold">{t('userWorkspace.title')}</h1>
                  <p className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-6">
                    {t('userWorkspace.description')}
                  </p>
                </div>
                <Button variant="outline" onClick={() => void handleLogout()}>
                  <LogOut className="size-4" aria-hidden="true" />
                  {t('userWorkspace.logout')}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="bg-card rounded-lg border p-4">
                <p className="text-muted-foreground text-xs">{t('userWorkspace.summary.user')}</p>
                <p className="mt-2 truncate text-sm font-semibold">{user.username}</p>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <p className="text-muted-foreground text-xs">
                  {t('userWorkspace.summary.credits')}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {new Intl.NumberFormat().format(user.credits)}
                </p>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <p className="text-muted-foreground text-xs">
                  {t('userWorkspace.summary.expiresAt')}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {formatOptionalTime(expiresAt, t('userWorkspace.summary.notAvailable'))}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="bg-card rounded-lg border p-5">
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
                    <KeyRound className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">{t('userWorkspace.keys.title')}</h2>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      {t('userWorkspace.keys.pending')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-lg border p-5">
                <div className="flex items-start gap-3">
                  <span className="bg-success/10 text-success flex size-9 shrink-0 items-center justify-center rounded-md">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">{t('userWorkspace.security.title')}</h2>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      {t('userWorkspace.security.pending')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </PublicAccessShell>
  )
}
