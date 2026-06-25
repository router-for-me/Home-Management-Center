import { ArrowRight, KeyRound, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import productLogo from '@/assets/brand/logo.jpg'
import { LanguageSwitcher } from '@/components/shell/language-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Button } from '@/components/ui/button'
import { embeddedEntryLinks } from '@/lib/embedded-entry-links'

export function EmbeddedEntryPage() {
  const { t } = useTranslation()

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border/80 bg-background/95 sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="ring-primary/20 bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1">
              <img src={productLogo} alt="" aria-hidden="true" className="size-full object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{t('productShortName')}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {t('embeddedPortal.shellSubtitle')}
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:px-6 md:py-12">
        <section className="max-w-3xl">
          <h1 className="text-2xl font-semibold md:text-3xl">{t('embeddedPortal.title')}</h1>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            {t('embeddedPortal.description')}
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="bg-card grid min-h-[260px] gap-5 rounded-lg border p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
                <KeyRound className="size-5" aria-hidden="true" />
              </span>
              <span className="border-primary/25 bg-primary/8 text-primary rounded-md border px-2 py-1 text-xs font-medium">
                {t('embeddedPortal.admin.badge')}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t('embeddedPortal.admin.title')}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {t('embeddedPortal.admin.description')}
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-2 sm:flex-row">
              <Button asChild className="sm:flex-1">
                <a href={embeddedEntryLinks.managementConnect}>
                  {t('embeddedPortal.admin.primary')}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </Button>
              <Button asChild variant="outline" className="sm:flex-1">
                <a href={embeddedEntryLinks.managementDashboard}>
                  {t('embeddedPortal.admin.secondary')}
                </a>
              </Button>
            </div>
          </article>

          <article className="bg-card grid min-h-[260px] gap-5 rounded-lg border p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="bg-info/10 text-info flex size-11 shrink-0 items-center justify-center rounded-md">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <span className="border-info/25 bg-info/10 text-info rounded-md border px-2 py-1 text-xs font-medium">
                {t('embeddedPortal.user.badge')}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t('embeddedPortal.user.title')}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {t('embeddedPortal.user.description')}
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-2 sm:flex-row">
              <Button asChild className="sm:flex-1">
                <a href={embeddedEntryLinks.userLogin}>
                  {t('embeddedPortal.user.primary')}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </Button>
              <Button asChild variant="outline" className="sm:flex-1">
                <a href={embeddedEntryLinks.userRegister}>{t('embeddedPortal.user.secondary')}</a>
              </Button>
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}
