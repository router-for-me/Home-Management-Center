import { Link } from '@tanstack/react-router'

import { ArrowLeft, CircleAlert, LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { Button } from '@/components/ui/button'
import { useUserSessionStore } from '@/stores/user-session-store'

export function UserWorkspacePage() {
  const { t } = useTranslation()
  const status = useUserSessionStore((state) => state.status)

  return (
    <PublicAccessShell>
      <section className="mx-auto grid max-w-3xl gap-6">
        <Button asChild variant="text" size="sm" className="w-fit px-0">
          <Link to="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('userWorkspace.back')}
          </Link>
        </Button>

        <div className="bg-card rounded-lg border p-5 shadow-sm md:p-6">
          <span className="bg-info/10 text-info flex size-11 items-center justify-center rounded-md">
            <LayoutDashboard className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold">{t('userWorkspace.title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-6">
            {t('userWorkspace.description')}
          </p>

          {status === 'unavailable' ? (
            <div className="border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning mt-6 grid gap-2 rounded-md border px-3 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                {t('userWorkspace.unavailable.title')}
              </span>
              <span className="leading-6">{t('userWorkspace.unavailable.description')}</span>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/login">{t('userWorkspace.login')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">{t('userWorkspace.chooseAccess')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicAccessShell>
  )
}
