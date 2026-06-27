import type { ReactNode } from 'react'

import { KeyRound, Network, ShieldCheck, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import productLogo from '@/assets/brand/logo.jpg'
import claudeIcon from '@/assets/icons/claude.svg'
import geminiIcon from '@/assets/icons/gemini.svg'
import grokIcon from '@/assets/icons/grok.svg'
import kimiDarkIcon from '@/assets/icons/kimi-dark.svg'
import kimiLightIcon from '@/assets/icons/kimi-light.svg'
import openaiDarkIcon from '@/assets/icons/openai-dark.svg'
import openaiLightIcon from '@/assets/icons/openai-light.svg'
import { PublicAccessShell } from '@/components/public/public-access-shell'
import { Button } from '@/components/ui/button'
import { embeddedEntryLinks } from '@/lib/embedded-entry-links'
import { useSessionStore } from '@/stores/session-store'
import { useUserSessionStore } from '@/stores/user-session-store'

type ProviderItem = {
  label: string
  iconSrc: string
  darkIconSrc?: string
}

type CapabilityItem = {
  key: 'models' | 'access' | 'review'
  icon: LucideIcon
}

const providerItems: ProviderItem[] = [
  { label: 'OpenAI', iconSrc: openaiLightIcon, darkIconSrc: openaiDarkIcon },
  { label: 'Claude Code', iconSrc: claudeIcon },
  { label: 'Gemini', iconSrc: geminiIcon },
  { label: 'Kimi', iconSrc: kimiLightIcon, darkIconSrc: kimiDarkIcon },
  { label: 'xAI', iconSrc: grokIcon },
]

const capabilityItems: CapabilityItem[] = [
  {
    key: 'models',
    icon: Network,
  },
  {
    key: 'access',
    icon: KeyRound,
  },
  {
    key: 'review',
    icon: ShieldCheck,
  },
]

const aboutHref = '#'
const backendProjectHref = 'https://github.com/router-for-me/CLIProxyAPIHome'
const privacyHref = '#'
const termsHref = '#'

export function ProductIntroPage() {
  const { t } = useTranslation()
  const managementStatus = useSessionStore((state) => state.status)
  const managementKey = useSessionStore((state) => state.managementKey)
  const userStatus = useUserSessionStore((state) => state.status)
  const managementConnected = managementStatus === 'connected'
  const managementCanResume =
    managementConnected || (managementStatus !== 'error' && Boolean(managementKey.trim()))
  const userAuthenticated = userStatus === 'authenticated'
  const managementHref = managementCanResume
    ? embeddedEntryLinks.managementDashboard
    : embeddedEntryLinks.managementConnect
  const userHref = userAuthenticated
    ? embeddedEntryLinks.userWorkspace
    : embeddedEntryLinks.userLogin
  const year = new Date().getFullYear()

  return (
    <PublicAccessShell
      mainClassName="max-w-none px-0 py-0 md:px-0 md:py-0"
      subtitleKey="embeddedPortal.shellSubtitle"
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="home-header-action"
            aria-label={
              userAuthenticated
                ? t('embeddedPortal.header.userWorkspace')
                : t('embeddedPortal.header.userLogin')
            }
          >
            <a href={userHref}>
              <UserRound className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                {userAuthenticated
                  ? t('embeddedPortal.header.userWorkspace')
                  : t('embeddedPortal.header.userLogin')}
              </span>
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="home-header-action"
            aria-label={
              managementCanResume
                ? t('embeddedPortal.header.adminConsole')
                : t('embeddedPortal.header.adminConnect')
            }
          >
            <a href={managementHref}>
              <KeyRound className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                {managementCanResume
                  ? t('embeddedPortal.header.adminConsole')
                  : t('embeddedPortal.header.adminConnect')}
              </span>
            </a>
          </Button>
        </div>
      }
    >
      <div className="w-full">
        <section className="home-intro-hero flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden px-4 py-6 md:px-6 md:py-8">
          <div className="relative z-[1] mx-auto grid w-full max-w-6xl justify-items-center gap-7 text-center md:gap-8">
            <div className="mx-auto max-w-5xl">
              <h1 className="home-hero-title text-foreground text-4xl leading-tight font-semibold tracking-normal text-balance [overflow-wrap:anywhere] break-words md:text-6xl">
                <span className="home-hero-title-line">{t('embeddedPortal.hero.titleLine1')}</span>
                <span className="home-hero-title-line home-hero-title-line-secondary">
                  {t('embeddedPortal.hero.titleLine2Prefix')}
                  <span className="home-hero-title-accent">
                    {t('embeddedPortal.hero.titleLine2Accent')}
                  </span>
                  {t('embeddedPortal.hero.titleLine2Suffix')}
                </span>
              </h1>
              <p className="text-muted-foreground mx-auto mt-4 max-w-3xl text-base leading-7 text-pretty md:text-lg">
                {t('embeddedPortal.hero.description')}
              </p>
            </div>

            <div className="home-provider-ecosystem">
              <div className="home-provider-map">
                <div
                  className="home-provider-gateway"
                  aria-label={t('embeddedPortal.providers.gateway')}
                  title={t('embeddedPortal.providers.gateway')}
                >
                  <Network className="home-provider-gateway-symbol" aria-hidden="true" />
                </div>
                <ul
                  className="home-provider-cloud"
                  aria-label={t('embeddedPortal.providers.ariaLabel')}
                >
                  {providerItems.map((item) => (
                    <ProviderIcon key={item.label} item={item} />
                  ))}
                  <li
                    className="home-provider-icon home-provider-more"
                    aria-label={t('embeddedPortal.providers.moreLabel')}
                    title={t('embeddedPortal.providers.moreLabel')}
                  >
                    ...
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="home-intro-operations border-border/70 border-t px-4 md:px-6">
          <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-col justify-between gap-7 py-8 md:gap-8 md:pt-20 md:pb-8 lg:pt-24">
            <div className="grid gap-5 md:gap-7">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
                <div className="max-w-xl lg:pt-2">
                  <h2 className="text-xl leading-tight font-semibold text-balance sm:text-2xl md:text-3xl">
                    {t('embeddedPortal.capabilities.title')}
                  </h2>
                  <p className="text-muted-foreground mt-3 text-sm leading-6 text-pretty md:text-base">
                    {t('embeddedPortal.capabilities.description')}
                  </p>
                </div>

                <section
                  className="grid gap-3"
                  aria-label={t('embeddedPortal.capabilities.ariaLabel')}
                >
                  {capabilityItems.map((item) => (
                    <CapabilityCard key={item.key} item={item} />
                  ))}
                </section>
              </div>
            </div>

            <HomeFooter year={year} />
          </div>
        </section>
      </div>
    </PublicAccessShell>
  )
}

function ProviderIcon({ item }: { item: ProviderItem }) {
  return (
    <li className="home-provider-icon" aria-label={item.label} title={item.label}>
      {item.darkIconSrc ? (
        <>
          <img
            src={item.iconSrc}
            alt=""
            aria-hidden="true"
            className="size-7 object-contain dark:hidden"
          />
          <img
            src={item.darkIconSrc}
            alt=""
            aria-hidden="true"
            className="hidden size-7 object-contain dark:block"
          />
        </>
      ) : (
        <img src={item.iconSrc} alt="" aria-hidden="true" className="size-7 object-contain" />
      )}
    </li>
  )
}

function CapabilityCard({ item }: { item: CapabilityItem }) {
  const { t } = useTranslation()
  const Icon = item.icon

  return (
    <article className="home-capability-card border-border/80 bg-card/80 flex min-w-0 gap-3 rounded-lg border p-4 sm:gap-4 sm:p-5">
      <span className="home-capability-icon text-primary flex size-9 shrink-0 items-center justify-center rounded-md sm:size-10">
        <Icon className="size-4 sm:size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold">
          {t(`embeddedPortal.capabilities.${item.key}.title`)}
        </h3>
        <p className="text-muted-foreground mt-2 text-sm leading-6 text-pretty">
          {t(`embeddedPortal.capabilities.${item.key}.description`)}
        </p>
      </div>
    </article>
  )
}

function HomeFooter({ year }: { year: number }) {
  const { t } = useTranslation()

  return (
    <footer className="home-intro-footer border-border/80 border-t pt-3 md:pt-6">
      <div className="grid gap-3 md:gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <span className="ring-primary/20 bg-muted flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 sm:size-10">
            <img src={productLogo} alt="" aria-hidden="true" className="size-full object-cover" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('productShortName')}</p>
            <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-5 text-pretty sm:text-sm sm:leading-6">
              {t('embeddedPortal.footer.slogan')}
            </p>
            <p className="text-muted-foreground mt-2 hidden text-xs sm:mt-3 sm:block">
              {t('embeddedPortal.footer.copyright', { year })}
            </p>
          </div>
        </div>

        <nav
          className="grid grid-cols-2 gap-2 sm:gap-5 lg:min-w-[360px]"
          aria-label={t('embeddedPortal.footer.ariaLabel')}
        >
          <FooterColumn title={t('embeddedPortal.footer.product.title')}>
            <FooterLink href={aboutHref}>{t('embeddedPortal.footer.product.about')}</FooterLink>
            <FooterLink href={backendProjectHref} external>
              {t('embeddedPortal.footer.product.backend')}
            </FooterLink>
          </FooterColumn>
          <FooterColumn title={t('embeddedPortal.footer.legal.title')}>
            <FooterLink href={privacyHref}>{t('embeddedPortal.footer.legal.privacy')}</FooterLink>
            <FooterLink href={termsHref}>{t('embeddedPortal.footer.legal.terms')}</FooterLink>
          </FooterColumn>
        </nav>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid content-start justify-items-center gap-2 text-center sm:justify-items-start sm:text-left">
      <h3 className="text-[11px] font-semibold sm:text-sm">{title}</h3>
      <div className="grid gap-1.5">{children}</div>
    </div>
  )
}

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string
  children: ReactNode
  external?: boolean
}) {
  return (
    <a
      href={href}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 w-fit rounded-sm text-[11px] leading-4 outline-none focus-visible:ring-3 sm:text-sm sm:leading-5"
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  )
}
