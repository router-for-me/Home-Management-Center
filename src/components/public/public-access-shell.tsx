import type { ReactNode } from 'react'

import { useTranslation } from 'react-i18next'

import productLogo from '@/assets/brand/logo.jpg'
import { LanguageSwitcher } from '@/components/shell/language-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { embeddedEntryLinks } from '@/lib/embedded-entry-links'
import { publicShellScrollRestorationId } from '@/lib/shell-scroll'
import { cn } from '@/lib/utils'

type PublicAccessShellProps = {
  children: ReactNode
  headerActions?: ReactNode
  mainClassName?: string
  subtitleKey?: string
}

export function PublicAccessShell({
  children,
  headerActions,
  mainClassName,
  subtitleKey = 'accessPortal.shellSubtitle',
}: PublicAccessShellProps) {
  const { t } = useTranslation()

  return (
    /*
      Same scroll arrangement as AppShell, for the same reason (#142): one
      viewport tall, document never scrolls, <main> is the scroll container.
      Radix's page lock compensates for a document scrollbar this layout
      never has, so overlays cannot move the page width on any platform.
    */
    <div className="bg-background text-foreground flex h-dvh min-h-0 flex-col overflow-hidden">
      <header className="border-border/80 bg-background/95 sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <a
            href={embeddedEntryLinks.bridge}
            aria-label={t('productShortName')}
            className="focus-visible:ring-ring/50 flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-3"
          >
            <span className="ring-primary/20 bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1">
              <img src={productLogo} alt="" aria-hidden="true" className="size-full object-cover" />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-semibold">{t('productShortName')}</span>
              <span className="text-muted-foreground block truncate text-xs">{t(subtitleKey)}</span>
            </span>
          </a>

          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/*
        The scroll container spans the full width so its scrollbar sits at the
        window edge; the max-w-6xl content box moves inside it, still under
        mainClassName's control.
      */}
      <main
        data-scroll-restoration-id={publicShellScrollRestorationId}
        className="min-h-0 w-full flex-1 [scrollbar-gutter:stable] overflow-y-auto"
      >
        <div className={cn('mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12', mainClassName)}>
          {children}
        </div>
      </main>
    </div>
  )
}
