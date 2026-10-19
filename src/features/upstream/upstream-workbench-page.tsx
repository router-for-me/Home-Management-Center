import { useEffect, useState } from 'react'

import { useIsFetching, useQueryClient } from '@tanstack/react-query'

import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountsPanel } from '@/features/credentials/accounts-panel'
import { getCredentialDisplayName } from '@/features/credentials/credential-display'
import { ProvidersPanel } from '@/features/providers/providers-panel'
import { getUpstreamQuotaErrorMessage } from '@/features/upstream/quota-format'
import {
  type UpstreamAccountsStats,
  type UpstreamProvidersStats,
  UpstreamSummaryCards,
} from '@/features/upstream/summary-cards'
import { getCredentialQuotaId } from '@/features/upstream/upstream-quota-model'
import type { UpstreamTab } from '@/features/upstream/upstream-route'
import { useUpstreamQuota } from '@/features/upstream/use-upstream-quota'
import type { CredentialResource } from '@/lib/api/management/credentials'

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
          if (!result) return
          if (result.completion === 'settled') {
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

  const handleCollectCredentialQuota = async (resource: CredentialResource) => {
    const credentialId = getCredentialQuotaId(resource)
    if (!credentialId) return
    try {
      const result = await quota.syncCredentialQuota(credentialId, (queued) => {
        toast.info(
          queued.accepted > 0
            ? t('upstreamPage.sync.credentialQueued', { name: getCredentialDisplayName(resource) })
            : t('upstreamPage.sync.notQueued'),
        )
      })
      if (!result) return
      if (result.completion === 'pending') {
        toast.info(t('upstreamPage.sync.credentialPending'))
      } else if (result.completion === 'settled' && result.item) {
        if (result.item.collectionStatus === 'failed') {
          toast.error(getUpstreamQuotaErrorMessage(result.item, t))
        } else if (result.item.collectionStatus === 'partial') {
          toast.warning(t('upstreamPage.sync.credentialPartial'))
        } else {
          toast.success(t('upstreamPage.sync.credentialUpdated'))
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="grid w-full gap-5">
      <PageHeader
        title={t('upstreamPage.header.title')}
        actions={
          <>
            <Button
              variant="outline"
              size="md"
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
          </>
        }
      />

      <UpstreamSummaryCards
        accounts={accountsStats}
        providers={providersStats}
        quotaAvailable={quota.available}
        quotaAttention={accountsStats?.attention ?? 0}
        onFilterAttention={handleFilterAttention}
      />

      <Tabs
        value={activeTab}
        className="grid gap-5"
        onValueChange={(value) => handleTabChange(value as UpstreamTab)}
      >
        <TabsList aria-label={t('upstreamPage.tabs.label')}>
          {upstreamTabs.map((item) => (
            <TabsTrigger key={item} value={item} className="min-w-32">
              {t(`upstreamPage.tabs.${item}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="accounts" forceMount className="data-[state=inactive]:hidden">
          <AccountsPanel
            initialCredentialId={initialCredentialId}
            initialSearch={initialSearch}
            onSearchChange={onSearchChange}
            attentionOnly={attentionOnly}
            websocketOnly={websocketOnly}
            onAttentionOnlyChange={setAttentionOnly}
            onWebsocketOnlyChange={setWebsocketOnly}
            quotaAvailable={quota.available}
            quotaLoading={quota.isPending}
            quotaTruncated={quota.truncated}
            quotaMap={quota.map}
            quotaRecollectAvailable={quota.capabilities.quotaRecollect}
            quotaCollectingIds={quota.collectingIds}
            quotaSyncing={quotaSyncing}
            onCollectQuota={handleCollectCredentialQuota}
            onStatsChange={setAccountsStats}
          />
        </TabsContent>
        <TabsContent value="providers" forceMount className="data-[state=inactive]:hidden">
          <ProvidersPanel onStatsChange={setProvidersStats} />
        </TabsContent>
      </Tabs>
    </section>
  )
}
