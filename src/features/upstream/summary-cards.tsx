import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export type UpstreamAccountsStats = {
  total: number
  active: number
  disabled: number
  unavailable: number
  websockets: number
}

export type UpstreamProvidersStats = {
  totalKeys: number
  groupIds: string[]
}

function SummaryCard({
  label,
  value,
  meta,
  alert = false,
  onClick,
}: {
  label: string
  value: string
  meta: string
  alert?: boolean
  onClick?: () => void
}) {
  const clickable = Boolean(onClick)

  return (
    <article
      className={cn(
        'bg-card rounded-lg border p-4 shadow-sm',
        clickable && 'hover:border-primary/30 hover:bg-accent/35 cursor-pointer transition-colors',
      )}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          'mt-2 text-xl font-semibold tabular-nums',
          alert && 'text-warning-foreground dark:text-warning',
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 truncate text-xs">{meta}</p>
    </article>
  )
}

export function UpstreamSummaryCards({
  accounts,
  providers,
  quotaAvailable,
  quotaAttention,
  onFilterAttention,
}: {
  accounts: UpstreamAccountsStats | null
  providers: UpstreamProvidersStats | null
  quotaAvailable: boolean
  quotaAttention: number | null
  onFilterAttention: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <SummaryCard
        label={t('upstreamPage.summary.accounts')}
        value={accounts ? String(accounts.total) : '—'}
        meta={
          accounts
            ? t('upstreamPage.summary.accountsMeta', {
                active: accounts.active,
                disabled: accounts.disabled,
                unavailable: accounts.unavailable,
              })
            : t('upstreamPage.summary.pending')
        }
      />
      <SummaryCard
        label={t('upstreamPage.summary.providerKeys')}
        value={providers ? String(providers.totalKeys) : '—'}
        meta={
          providers
            ? providers.groupIds.map((id) => t(`providersPage.providerNames.${id}`)).join(' · ')
            : t('upstreamPage.summary.pending')
        }
      />
      <SummaryCard
        label={t('upstreamPage.summary.attention')}
        value={quotaAvailable ? String(quotaAttention ?? 0) : '—'}
        meta={
          quotaAvailable
            ? t('upstreamPage.summary.attentionHint')
            : t('upstreamPage.summary.unsupported')
        }
        alert={quotaAvailable && (quotaAttention ?? 0) > 0}
        onClick={quotaAvailable ? onFilterAttention : undefined}
      />
      <SummaryCard
        label={t('upstreamPage.summary.websockets')}
        value={accounts ? String(accounts.websockets) : '—'}
        meta={t('upstreamPage.summary.websocketsHint')}
      />
    </section>
  )
}
