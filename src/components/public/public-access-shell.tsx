import type { ReactNode } from 'react'

import { Link } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import productLogo from '@/assets/brand/logo.jpg'
import { LanguageSwitcher } from '@/components/shell/language-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'

type PublicAccessShellProps = {
  children: ReactNode
}

export function PublicAccessShell({ children }: PublicAccessShellProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border/80 bg-background/95 sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link
            to="/"
            className="focus-visible:ring-ring/50 flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-3"
          >
            <span className="ring-primary/20 bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1">
              <img src={productLogo} alt="" aria-hidden="true" className="size-full object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{t('productShortName')}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {t('accessPortal.shellSubtitle')}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">{children}</main>
    </div>
  )
}
