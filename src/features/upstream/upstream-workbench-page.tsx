import { useEffect, useState } from 'react'

import { useIsFetching, useQueryClient } from '@tanstack/react-query'

import { Loader2, Plus, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { AccountsPanel } from '@/features/credentials/accounts-panel'
import { ProvidersPanel } from '@/features/providers/providers-panel'
import {
  type UpstreamAccountsStats,
  type UpstreamProvidersStats,
  UpstreamSummaryCards,
} from '@/features/upstream/summary-cards'
import type { UpstreamTab } from '@/features/upstream/upstream-route'
import { useUpstreamQuota } from '@/features/upstream/use-upstream-quota'
import { cn } from '@/lib/utils'

const upstreamTabs: UpstreamTab[] = ['accounts', 'providers']

export function UpstreamWorkbenchPage({
  tab,
  initialCredentialId,
  initialSearch = '',
  onTabChange,
  onSearchChange,
}: {
  tab: UpstreamTab
  initialCredentialId?: string
  initialSearch?: string
  onTabChange: (tab: UpstreamTab) => void
  onSearchChange: (search: string) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<UpstreamTab>(tab)
  const [accountsCreateOpen, setAccountsCreateOpen] = useState(false)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [websocketOnly, setWebsocketOnly] = useState(false)
  const [accountsStats, setAccountsStats] = useState<UpstreamAccountsStats | null>(null)
  const [providersStats, setProvidersStats] = useState<UpstreamProvidersStats | null>(null)
  const [quotaSyncing, setQuotaSyncing] = useState(false)
  const quota = useUpstreamQuota()

  useEffect(() => {
    setActiveTab(tab)
  }, [tab])

  useEffect(() => {
    if (!quota.available) setAttentionOnly(false)
  }, [quota.available])

  const fetchingCount =
    useIsFetching({ queryKey: ['management-credentials'] }) +
    useIsFetching({ queryKey: ['management-providers'] }) +
    useIsFetching({ queryKey: ['upstream-quota-snapshot'] })
  const syncing = quotaSyncing || fetchingCount > 0

  const handleSync = async () => {
    setQuotaSyncing(true)
    try {
      if (quota.capabilities.quotaRecollect) {
        try {
          const result = await quota.syncQuota((queued) => {
            toast.info(
              queued.accepted > 0
                ? t('upstreamPage.sync.queued', { count: queued.accepted })
                : t('upstreamPage.sync.notQueued'),
            )
          })
          if (result?.completion === 'settled') {
            toast.success(t('upstreamPage.sync.updated'))
          } else if (result?.completion === 'pending') {
            toast.info(t('upstreamPage.sync.pending'))
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error))
        }
      } else {
        toast.info(t('upstreamPage.sync.unavailable'))
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['management-credentials'] }),
        queryClient.invalidateQueries({ queryKey: ['management-providers'] }),
        queryClient.invalidateQueries({ queryKey: ['upstream-quota-snapshot'] }),
        queryClient.invalidateQueries({ queryKey: ['upstream-quota-credential'] }),
      ])
    } finally {
      setQuotaSyncing(false)
    }
  }

  const handleTabChange = (nextTab: UpstreamTab) => {
    setActiveTab(nextTab)
    onTabChange(nextTab)
  }

  const handleFilterAttention = () => {
    setAttentionOnly(true)
    handleTabChange('accounts')
  }

  return (
    <section className="grid w-full gap-5">
      <PageHeader
        title={t('upstreamPage.header.title')}
        description={t('upstreamPage.header.description')}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={syncing}
              onClick={() => void handleSync()}
              aria-label={syncing ? t('upstreamPage.sync.syncing') : t('upstreamPage.sync.action')}
              title={syncing ? t('upstreamPage.sync.syncing') : t('upstreamPage.sync.action')}
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {syncing ? t('upstreamPage.sync.syncing') : t('upstreamPage.sync.action')}
            </Button>
            {activeTab === 'accounts' ? (
              <Button size="sm" onClick={() => setAccountsCreateOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                {t('credentialsPage.actions.addCredential')}
              </Button>
            ) : null}
          </>
        }
      />

      <UpstreamSummaryCards
        accounts={accountsStats}
        providers={providersStats}
        quotaAvailable={quota.available}
        quotaAttention={quota.attentionCount}
        onFilterAttention={handleFilterAttention}
      />

      <div
        className="bg-card grid grid-cols-2 gap-2 rounded-lg border p-1 shadow-sm sm:flex sm:w-fit sm:max-w-full sm:overflow-x-auto"
        role="tablist"
        aria-label={t('upstreamPage.tabs.label')}
      >
        {upstreamTabs.map((item) => (
          <Button
            key={item}
            type="button"
            role="tab"
            aria-selected={activeTab === item}
            variant={activeTab === item ? 'default' : 'ghost'}
            className="min-h-10 w-full justify-center sm:w-auto sm:min-w-32"
            onClick={() => handleTabChange(item)}
          >
            {t(`upstreamPage.tabs.${item}`)}
          </Button>
        ))}
      </div>

      <div className={cn(activeTab === 'accounts' ? undefined : 'hidden')}>
        <AccountsPanel
          initialCredentialId={initialCredentialId}
          initialSearch={initialSearch}
          onSearchChange={onSearchChange}
          createOpen={accountsCreateOpen}
          onCreateOpenChange={setAccountsCreateOpen}
          attentionOnly={attentionOnly}
          websocketOnly={websocketOnly}
          onAttentionOnlyChange={setAttentionOnly}
          onWebsocketOnlyChange={setWebsocketOnly}
          quotaAvailable={quota.available}
          quotaLoading={quota.isPending || quota.isFetching}
          quotaTruncated={quota.truncated}
          quotaMap={quota.map}
          onStatsChange={setAccountsStats}
        />
      </div>
      <div className={cn(activeTab === 'providers' ? undefined : 'hidden')}>
        <ProvidersPanel onStatsChange={setProvidersStats} />
      </div>
    </section>
  )
}
