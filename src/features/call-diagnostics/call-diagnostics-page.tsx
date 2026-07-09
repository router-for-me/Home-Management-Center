import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import {
  ActivityHeatmap,
  CapabilityStrip,
  type CapabilityStripItem,
  IssueList,
  ObservabilityDisconnectedState,
  ObservabilityErrorState,
  ObservabilityLoadingState,
  RealtimeUsagePanel,
  RequestLogIndexTable,
  UsageHealthPanel,
  downloadBlob,
  formatDateTime,
  getObservabilityVerdictBadgeClassName,
} from '@/features/observability/observability-components'
import { useUsageObservabilityWorkbench } from '@/features/usage-observability/use-usage-observability-workbench'
import type { CapabilityMap, RuntimeMode } from '@/lib/api/management/types'
import type { UsageSnapshot } from '@/lib/api/management/usage'
import { cn } from '@/lib/utils'

type CallDiagnosticsVerdict = 'ready' | 'partial' | 'disabled' | 'unsupported'

const diagnosticIssueScopes = new Set([
  'usageOverview',
  'usageProviderHealth',
  'usageCredentialHealth',
  'usageRealtime',
  'requestLogIndex',
])

function hasDiagnosticsData(snapshot: UsageSnapshot) {
  return Boolean(
    snapshot.realtime ||
    snapshot.providerHealth ||
    snapshot.credentialHealth ||
    snapshot.requestLogs ||
    snapshot.overview?.activity.length,
  )
}

function getAttentionCount(snapshot: UsageSnapshot) {
  const healthItems = [
    ...(snapshot.providerHealth?.items ?? []),
    ...(snapshot.credentialHealth?.items ?? []),
  ]
  const unhealthyCount = healthItems.filter((item) =>
    ['degraded', 'unavailable', 'disabled'].includes(item.status),
  ).length
  const latestBucket = snapshot.realtime?.velocity.at(-1) ?? null

  return unhealthyCount + (latestBucket && latestBucket.errorRate > 0 ? 1 : 0)
}

function getCallDiagnosticsVerdict(snapshot: UsageSnapshot): CallDiagnosticsVerdict {
  if (snapshot.issues.some((issue) => diagnosticIssueScopes.has(issue.scope))) return 'partial'
  if (hasDiagnosticsData(snapshot)) return 'ready'
  if (!snapshot.settings.usageStatisticsEnabled) return 'disabled'
  return 'unsupported'
}

function CallDiagnosticsCapabilityStrip({ capabilities }: { capabilities: CapabilityMap }) {
  const { t } = useTranslation()
  const capabilityItems = [
    {
      available: capabilities.usageRealtime,
      label: t('usageLogsPage.capabilities.usageRealtime'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.usageOverview,
      label: t('usageLogsPage.capabilities.usageOverview'),
      unavailableTone: 'info',
    },
    {
      available: capabilities.usageProviderHealth,
      label: t('usageLogsPage.capabilities.usageProviderHealth'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.usageCredentialHealth,
      label: t('usageLogsPage.capabilities.usageCredentialHealth'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.requestLogIndex,
      label: t('usageLogsPage.capabilities.requestLogIndex'),
      unavailableTone: 'info',
    },
  ] satisfies CapabilityStripItem[]

  return <CapabilityStrip items={capabilityItems} />
}

function CallDiagnosticsHeader({
  snapshot,
  capabilities,
  runtimeMode,
  isFetching,
  onRefresh,
}: {
  snapshot: UsageSnapshot
  capabilities: CapabilityMap
  runtimeMode: RuntimeMode
  isFetching: boolean
  onRefresh: () => void
}) {
  const { t, i18n } = useTranslation()
  const verdict = getCallDiagnosticsVerdict(snapshot)
  const attentionCount = getAttentionCount(snapshot)

  return (
    <PageHeader
      title={t(`callDiagnosticsPage.verdict.${verdict}.title`)}
      titleMeta={
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
            getObservabilityVerdictBadgeClassName(verdict),
          )}
        >
          {t(`callDiagnosticsPage.verdict.${verdict}.badge`)}
        </span>
      }
      description={t(`callDiagnosticsPage.verdict.${verdict}.description`, {
        mode: t(`runtimeMode.${runtimeMode}`),
        count: attentionCount,
      })}
      meta={
        <>
          <span>
            {t('usageLogsPage.header.runtime', { mode: t(`runtimeMode.${runtimeMode}`) })}
          </span>
          <span>
            {t('usageLogsPage.header.updatedAt', {
              time: formatDateTime(snapshot.fetchedAt, i18n) ?? snapshot.fetchedAt,
            })}
          </span>
        </>
      }
      tags={<CallDiagnosticsCapabilityStrip capabilities={capabilities} />}
      actions={
        <Button variant="outline" disabled={isFetching} onClick={onRefresh}>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {isFetching ? t('usageLogsPage.actions.syncing') : t('usageLogsPage.actions.refresh')}
        </Button>
      }
    />
  )
}

export function CallDiagnosticsPage() {
  const { t } = useTranslation()
  const workbench = useUsageObservabilityWorkbench({ scope: 'diagnostics' })
  const capabilities = workbench.capabilities
  const noDiagnosticsCapabilities =
    !capabilities.usageOverview &&
    !capabilities.usageProviderHealth &&
    !capabilities.usageCredentialHealth &&
    !capabilities.usageRealtime &&
    !capabilities.requestLogIndex

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return <ObservabilityLoadingState />
  }
  if (!workbench.connected) return <ObservabilityDisconnectedState copyKey="callDiagnosticsPage" />
  if (workbench.isPending) return <ObservabilityLoadingState />
  if (workbench.isError || !workbench.snapshot) {
    return (
      <ObservabilityErrorState
        copyKey="callDiagnosticsPage"
        errorMessage={workbench.errorMessage}
        onRetry={workbench.refetch}
      />
    )
  }

  const snapshot = workbench.snapshot

  const handleDownloadRequestLog = async (
    requestId: string,
    homeIp?: string | null,
    homePort?: number | null,
  ) => {
    try {
      const result = await workbench.downloadRequestLogById({ requestId, homeIp, homePort })
      downloadBlob(result.blob, result.fileName)
      toast.success(t('usageLogsPage.toast.logDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="grid w-full gap-4">
      <CallDiagnosticsHeader
        snapshot={snapshot}
        capabilities={capabilities}
        runtimeMode={workbench.runtimeMode}
        isFetching={workbench.isFetching}
        onRefresh={workbench.refetch}
      />

      {noDiagnosticsCapabilities ? (
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex gap-4">
            <AlertTriangle className="text-muted-foreground mt-0.5 size-5" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold">
                {t('callDiagnosticsPage.unavailable.title')}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('callDiagnosticsPage.unavailable.description', {
                  mode: t(`runtimeMode.${workbench.runtimeMode}`),
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <IssueList issues={snapshot.issues} />

      {!hasDiagnosticsData(snapshot) && !noDiagnosticsCapabilities ? (
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <h2 className="text-base font-semibold">{t('callDiagnosticsPage.empty.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('callDiagnosticsPage.empty.description')}
          </p>
        </div>
      ) : null}

      {snapshot.overview ? <ActivityHeatmap overview={snapshot.overview} /> : null}

      <RealtimeUsagePanel realtime={snapshot.realtime} />

      <UsageHealthPanel
        providerHealth={snapshot.providerHealth}
        credentialHealth={snapshot.credentialHealth}
      />

      <RequestLogIndexTable
        index={snapshot.requestLogs}
        mutating={workbench.mutating}
        downloadingRequestLogId={workbench.downloadingRequestLogId}
        isDownloadingRequestLog={workbench.isDownloadingRequestLog}
        onDownloadRequestLog={(requestId, homeIp, homePort) =>
          void handleDownloadRequestLog(requestId, homeIp, homePort)
        }
      />
    </section>
  )
}
