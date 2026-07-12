import { Info, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import {
  LiveRefreshControl,
  LiveRefreshStatusNotice,
} from '@/features/observability/live-refresh-control'
import {
  CapabilityStrip,
  type CapabilityStripItem,
  CostBreakdownPanel,
  CredentialUsageTable,
  IssueList,
  ObservabilityDisconnectedState,
  ObservabilityErrorState,
  ObservabilityLoadingState,
  RankingGrid,
  RequestDetailSheet,
  RequestRecordsTable,
  UsageFiltersToolbar,
  UsageKpiStrip,
  UsageTrendPanel,
  downloadBlob,
  getObservabilityVerdictBadgeClassName,
} from '@/features/observability/observability-components'
import { useUsageObservabilityWorkbench } from '@/features/usage-observability/use-usage-observability-workbench'
import type { RuntimeMode } from '@/lib/api/management/types'
import type { CapabilityMap } from '@/lib/api/management/types'
import type { UsageSnapshot } from '@/lib/api/management/usage'
import { cn } from '@/lib/utils'

type UsagePageVerdict = 'ready' | 'empty' | 'partial' | 'disabled' | 'unsupported'
type UsageIssue = UsageSnapshot['issues'][number]

function isUnsupportedIssue(issue: UsageIssue) {
  return issue.status === 404 || issue.status === 405
}

function isFailedUsageIssue(issue: UsageIssue) {
  return (
    (issue.scope === 'runtimeSettings' || issue.scope.startsWith('usage')) &&
    !isUnsupportedIssue(issue)
  )
}

function hasUsageActivity(snapshot: UsageSnapshot) {
  const overviewRequestCount = snapshot.overview?.totals.requestCount ?? 0
  const overviewTokenCount = snapshot.overview?.totals.totalTokens ?? 0
  const recordCount = snapshot.records?.total ?? 0
  const credentialUsageCount = snapshot.credentialUsage?.total ?? 0

  return (
    overviewRequestCount > 0 ||
    overviewTokenCount > 0 ||
    recordCount > 0 ||
    credentialUsageCount > 0
  )
}

function getUsagePageVerdict(snapshot: UsageSnapshot): UsagePageVerdict {
  if (!snapshot.settings.usageStatisticsEnabled) return 'disabled'
  if (snapshot.issues.some(isFailedUsageIssue)) return 'partial'
  if (!snapshot.overview && !snapshot.records && !snapshot.credentialUsage) {
    return 'unsupported'
  }
  return hasUsageActivity(snapshot) ? 'ready' : 'empty'
}

function UsageCapabilityStrip({ capabilities }: { capabilities: CapabilityMap }) {
  const { t } = useTranslation()
  const capabilityItems = [
    {
      available: capabilities.usageOverview,
      label: t('usageLogsPage.capabilities.usageOverview'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.usageRecords,
      label: t('usageLogsPage.capabilities.usageRecords'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.usageAggregates,
      label: t('usageLogsPage.capabilities.usageAggregates'),
      unavailableTone: 'info',
    },
  ] satisfies CapabilityStripItem[]

  return <CapabilityStrip items={capabilityItems} />
}

function UsageObservabilityHeader({
  snapshot,
  capabilities,
  runtimeMode,
  manualRefreshing,
  autoRefresh,
  onRefresh,
}: {
  snapshot: UsageSnapshot
  capabilities: CapabilityMap
  runtimeMode: RuntimeMode
  manualRefreshing: boolean
  autoRefresh: ReturnType<typeof useUsageObservabilityWorkbench>['autoRefresh']
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const verdict = getUsagePageVerdict(snapshot)

  return (
    <PageHeader
      title={t(`usagePage.verdict.${verdict}.title`)}
      titleMeta={
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
            getObservabilityVerdictBadgeClassName(verdict),
          )}
        >
          {t(`usagePage.verdict.${verdict}.badge`)}
        </span>
      }
      description={t(`usagePage.verdict.${verdict}.description`, {
        mode: t(`runtimeMode.${runtimeMode}`),
      })}
      meta={
        <span>{t('usageLogsPage.header.runtime', { mode: t(`runtimeMode.${runtimeMode}`) })}</span>
      }
      tags={<UsageCapabilityStrip capabilities={capabilities} />}
      actions={
        <>
          <LiveRefreshControl
            mode="auto"
            enabled={autoRefresh.enabled}
            disabled={!autoRefresh.available}
            describedBy={!autoRefresh.available ? 'usage-auto-refresh-status' : undefined}
            onEnabledChange={autoRefresh.setEnabled}
          />
          <Button variant="outline" disabled={manualRefreshing} onClick={onRefresh}>
            {manualRefreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {manualRefreshing
              ? t('usageLogsPage.actions.syncing')
              : t('usageLogsPage.actions.refresh')}
          </Button>
        </>
      }
    />
  )
}

export function UsageObservabilityPage() {
  const { t } = useTranslation()
  const workbench = useUsageObservabilityWorkbench()
  const capabilities = workbench.capabilities
  const noUsageCapabilities =
    !capabilities.usageOverview &&
    !capabilities.usageRecords &&
    !capabilities.usageAggregates &&
    !capabilities.oauthUsage

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return <ObservabilityLoadingState />
  }
  if (!workbench.connected) return <ObservabilityDisconnectedState copyKey="usagePage" />
  if (workbench.isPending) return <ObservabilityLoadingState />
  if (workbench.isError || !workbench.snapshot) {
    return (
      <ObservabilityErrorState
        copyKey="usagePage"
        errorMessage={workbench.errorMessage}
        onRetry={workbench.refetch}
      />
    )
  }

  const snapshot = workbench.snapshot

  const handleExportUsage = async () => {
    try {
      const result = await workbench.exportUsageRecords('csv')
      downloadBlob(result.blob, result.fileName)
      toast.success(t('usageLogsPage.toast.exportDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="grid w-full gap-4">
      <UsageObservabilityHeader
        snapshot={snapshot}
        capabilities={capabilities}
        runtimeMode={workbench.runtimeMode}
        manualRefreshing={workbench.manualRefreshing}
        autoRefresh={workbench.autoRefresh}
        onRefresh={workbench.refetch}
      />

      <LiveRefreshStatusNotice
        id="usage-auto-refresh-status"
        mode="auto"
        enabled={workbench.autoRefresh.enabled}
        active={workbench.autoRefresh.active}
        pauseReason={workbench.autoRefresh.pauseReason}
        intervalMs={workbench.autoRefreshIntervalMs}
        hasError={workbench.autoRefreshError}
        lastSuccessAt={workbench.autoRefreshLastSuccessAt}
      />

      {noUsageCapabilities ? (
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <div className="flex gap-4">
            <div className="border-info/20 bg-info/10 text-info flex size-10 shrink-0 items-center justify-center rounded-md border">
              <Info className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">{t('usagePage.unavailable.title')}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {t('usagePage.unavailable.description', {
                  mode: t(`runtimeMode.${workbench.runtimeMode}`),
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <IssueList
        issues={snapshot.issues.filter(
          (issue) =>
            !isUnsupportedIssue(issue) &&
            issue.scope !== 'logs' &&
            issue.scope !== 'requestErrorLogs' &&
            issue.scope !== 'clearLogs',
        )}
      />

      <UsageFiltersToolbar
        filters={workbench.filters}
        options={snapshot.filterOptions}
        onChange={workbench.updateFilters}
      />

      <UsageKpiStrip overview={snapshot.overview} />

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(480px,0.75fr)]">
        <UsageTrendPanel overview={snapshot.overview} />
        <CostBreakdownPanel overview={snapshot.overview} />
      </div>

      {snapshot.overview || workbench.rankingAggregate ? (
        <RankingGrid
          overview={snapshot.overview}
          aggregate={workbench.rankingAggregate}
          selectedGroup={workbench.rankingGroup}
          selectedMetric={workbench.rankingMetric}
          detailOpen={workbench.rankingDetailOpen}
          expanded={workbench.rankingExpanded}
          pending={workbench.isRankingPending}
          errorMessage={workbench.rankingErrorMessage}
          onGroupChange={workbench.setRankingGroup}
          onMetricChange={workbench.setRankingMetric}
          onDetailOpenChange={workbench.setRankingDetailOpen}
          onExpandedChange={workbench.setRankingExpanded}
        />
      ) : null}

      <RequestRecordsTable
        records={snapshot.records}
        filters={workbench.filters}
        filterOptions={snapshot.filterOptions}
        pageSizeOptions={workbench.recordPageSizeOptions}
        fetching={workbench.isFetching}
        mutating={workbench.mutating}
        canExport={capabilities.usageExport}
        isExporting={workbench.isExportingUsage}
        unavailable={workbench.isUsageRecordsUnavailable}
        errorMessage={workbench.usageRecordsErrorMessage}
        onInspect={(record) => workbench.selectRecord(record.id)}
        onFilterChange={workbench.updateFilters}
        onLimitChange={workbench.setRecordLimit}
        onOffsetChange={workbench.setRecordOffset}
        onExport={() => void handleExportUsage()}
      />

      <CredentialUsageTable
        response={workbench.credentialUsage}
        pageSizeOptions={workbench.credentialUsagePageSizeOptions}
        sort={workbench.credentialUsageSort}
        pending={workbench.isCredentialUsagePending}
        unavailable={workbench.isCredentialUsageUnavailable}
        errorMessage={workbench.credentialUsageErrorMessage}
        mutating={workbench.mutating}
        onSortChange={workbench.setCredentialUsageSort}
        onLimitChange={workbench.setCredentialUsageLimit}
        onOffsetChange={workbench.setCredentialUsageOffset}
      />

      <RequestDetailSheet
        detail={workbench.selectedRecordDetail}
        pending={workbench.isRecordDetailPending}
        error={workbench.recordDetailError}
        mutating={workbench.mutating}
        downloadingRequestLogId={workbench.downloadingRequestLogId}
        isDownloadingRequestLog={workbench.isDownloadingRequestLog}
        onOpenChange={(open) => {
          if (!open) workbench.clearSelectedRecord()
        }}
      />
    </section>
  )
}
