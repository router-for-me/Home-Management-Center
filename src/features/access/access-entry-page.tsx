import { Link } from '@tanstack/react-router'

import { ArrowRight, KeyRound, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '@/stores/session-store'
import { useUserSessionStore } from '@/stores/user-session-store'

export function AccessEntryPage() {
  const { t } = useTranslation()
  const managementStatus = useSessionStore((state) => state.status)
  const userStatus = useUserSessionStore((state) => state.status)
  const managementConnected = managementStatus === 'connected'
  const userUnavailable = userStatus === 'unavailable'

  return (
    <PublicAccessShell>
      <section className="mx-auto grid max-w-4xl gap-8">
        <div className="max-w-2xl">
          <p className="text-primary text-xs font-semibold">{t('accessPortal.eyebrow')}</p>
          <h1 className="mt-3 text-2xl font-semibold md:text-3xl">{t('accessPortal.title')}</h1>
          <p className="text-muted-foreground mt-3 max-w-[68ch] text-sm leading-6">
            {t('accessPortal.description')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="bg-card grid content-between gap-8 rounded-lg border p-5 shadow-sm">
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
                  <KeyRound className="size-5" aria-hidden="true" />
                </span>
                <span className="border-primary/25 bg-primary/8 text-primary rounded-md border px-2 py-1 text-xs font-medium">
                  {managementConnected
                    ? t('accessPortal.admin.connected')
                    : t('accessPortal.admin.available')}
                </span>
              </div>
              <div>
                <h2 className="text-base font-semibold">{t('accessPortal.admin.title')}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {t('accessPortal.admin.description')}
                </p>
              </div>
            </div>

            <Button asChild className="w-full justify-between">
              <Link to={managementConnected ? '/dashboard' : '/admin/connect'}>
                {managementConnected
                  ? t('accessPortal.admin.resume')
                  : t('accessPortal.admin.action')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </section>

          <section className="bg-card grid content-between gap-8 rounded-lg border p-5 shadow-sm">
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <span className="bg-info/10 text-info flex size-10 items-center justify-center rounded-md">
                  <UserRound className="size-5" aria-hidden="true" />
                </span>
                <span className="border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning rounded-md border px-2 py-1 text-xs font-medium">
                  {userUnavailable
                    ? t('accessPortal.user.unavailable')
                    : t('accessPortal.user.available')}
                </span>
              </div>
              <div>
                <h2 className="text-base font-semibold">{t('accessPortal.user.title')}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {t('accessPortal.user.description')}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline">
                <Link to="/register">{t('accessPortal.user.register')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/login">
                  {t('accessPortal.user.login')}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <Button asChild variant="text" size="sm" className="w-fit justify-self-start px-0">
              <Link to="/workspace">{t('accessPortal.user.previewWorkspace')}</Link>
            </Button>
          </section>
        </div>
      </section>
    </PublicAccessShell>
  )
}
