import { useState } from 'react'

import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useLogsWorkbench } from '@/features/logs/use-logs-workbench'
import {
  CapabilityStrip,
  type CapabilityStripItem,
  ErrorLogFilesPanel,
  IssueList,
  ObservabilityDisconnectedState,
  ObservabilityErrorState,
  ObservabilityLoadingState,
  RuntimeLogViewer,
  downloadBlob,
  formatDateTime,
  getObservabilityVerdictBadgeClassName,
  isFileLoggingDisabledError,
} from '@/features/observability/observability-components'
import type { RuntimeLogContext, RuntimeLogSnapshot } from '@/lib/api/management/logs'
import type { CapabilityMap, RuntimeMode } from '@/lib/api/management/types'
import { cn } from '@/lib/utils'

type LogsPageVerdict = 'ready' | 'partial' | 'disabled' | 'errorFilesOnly' | 'unsupported'

function getLogsPageVerdict({
  context,
  runtimeLogs,
  capabilities,
  hasIssues,
}: {
  context: RuntimeLogContext
  runtimeLogs: RuntimeLogSnapshot | null
  capabilities: CapabilityMap
  hasIssues: boolean
}): LogsPageVerdict {
  if (!capabilities.logs && !capabilities.requestErrorLogs) return 'unsupported'
  if (hasIssues) return 'partial'
  if (capabilities.logs && context.settings.fileLoggingEnabled && runtimeLogs) return 'ready'
  if (capabilities.requestErrorLogs && !capabilities.logs) return 'errorFilesOnly'
  if (!context.settings.fileLoggingEnabled) return 'disabled'
  return 'unsupported'
}

function LogsCapabilityStrip({ capabilities }: { capabilities: CapabilityMap }) {
  const { t } = useTranslation()
  const capabilityItems = [
    {
      available: capabilities.logs,
      label: t('usageLogsPage.capabilities.logs'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.requestErrorLogs,
      label: t('usageLogsPage.capabilities.requestErrorLogs'),
      unavailableTone: 'info',
    },
  ] satisfies CapabilityStripItem[]

  return <CapabilityStrip items={capabilityItems} />
}

function LogsHeader({
  context,
  runtimeLogs,
  capabilities,
  runtimeMode,
  isFetching,
  updatedAt,
  hasIssues,
  onRefresh,
}: {
  context: RuntimeLogContext
  runtimeLogs: RuntimeLogSnapshot | null
  capabilities: CapabilityMap
  runtimeMode: RuntimeMode
  isFetching: boolean
  updatedAt: string
  hasIssues: boolean
  onRefresh: () => void
}) {
  const { t, i18n } = useTranslation()
  const verdict = getLogsPageVerdict({ context, runtimeLogs, capabilities, hasIssues })

  return (
    <PageHeader
      title={t(`logsPage.verdict.${verdict}.title`)}
      titleMeta={
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
            getObservabilityVerdictBadgeClassName(verdict),
          )}
        >
          {t(`logsPage.verdict.${verdict}.badge`)}
        </span>
      }
      description={t(`logsPage.verdict.${verdict}.description`, {
        mode: t(`runtimeMode.${runtimeMode}`),
      })}
      meta={
        <>
          <span>
            {t('usageLogsPage.header.runtime', { mode: t(`runtimeMode.${runtimeMode}`) })}
          </span>
          <span>
            {t('usageLogsPage.header.updatedAt', {
              time: formatDateTime(updatedAt, i18n) ?? updatedAt,
            })}
          </span>
        </>
      }
      tags={<LogsCapabilityStrip capabilities={capabilities} />}
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

export function LogsWorkbenchPage() {
  const { t } = useTranslation()
  const workbench = useLogsWorkbench()
  const [clearLogsDialogOpen, setClearLogsDialogOpen] = useState(false)

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return <ObservabilityLoadingState />
  }
  if (!workbench.connected) return <ObservabilityDisconnectedState copyKey="logsPage" />
  if (workbench.isPending) return <ObservabilityLoadingState />
  if (workbench.isError || !workbench.context) {
    return (
      <ObservabilityErrorState
        copyKey="logsPage"
        errorMessage={workbench.errorMessage}
        onRetry={workbench.refetch}
      />
    )
  }

  const context = workbench.context

  const handleClearLogs = async () => {
    if (!context.settings.fileLoggingEnabled) {
      setClearLogsDialogOpen(false)
      toast.error(t('usageLogsPage.toast.fileLoggingDisabled'))
      return
    }

    try {
      await workbench.clearLogs()
      setClearLogsDialogOpen(false)
      toast.success(t('usageLogsPage.toast.logsCleared'))
    } catch (error) {
      toast.error(
        isFileLoggingDisabledError(error)
          ? t('usageLogsPage.toast.fileLoggingDisabled')
          : error instanceof Error
            ? error.message
            : String(error),
      )
    }
  }

  const handleDownloadErrorLog = async (fileName: string) => {
    try {
      const result = await workbench.downloadRequestErrorLog(fileName)
      downloadBlob(result.blob, result.fileName)
      toast.success(t('usageLogsPage.toast.logDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

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
      <LogsHeader
        context={context}
        runtimeLogs={workbench.runtimeLogs}
        capabilities={workbench.capabilities}
        runtimeMode={workbench.runtimeMode}
        isFetching={workbench.isFetching}
        updatedAt={workbench.runtimeLogsUpdatedAt ?? context.fetchedAt}
        hasIssues={workbench.issues.length > 0}
        onRefresh={workbench.refetch}
      />

      <IssueList issues={workbench.issues} />

      <RuntimeLogViewer
        runtimeLogs={workbench.runtimeLogs}
        canRead={workbench.capabilities.logs && context.settings.fileLoggingEnabled}
        canClear={workbench.capabilities.logs && context.settings.fileLoggingEnabled}
        fileLoggingEnabled={context.settings.fileLoggingEnabled}
        filters={workbench.runtimeLogFilters}
        searchUnsupported={workbench.runtimeLogSearchUnsupported}
        pageSizeOptions={workbench.runtimeLogPageSizeOptions}
        pageSize={workbench.runtimeLogLimit}
        offset={workbench.runtimeLogOffset}
        downloadingRequestLogId={workbench.downloadingRequestLogId}
        isDownloadingRequestLog={workbench.isDownloadingRequestLog}
        clearing={workbench.isClearingLogs}
        fetching={workbench.isFetching || workbench.liveRefreshFetching}
        mutating={workbench.mutating}
        onClear={() => setClearLogsDialogOpen(true)}
        onFilterChange={workbench.setRuntimeLogFilters}
        onClearFilters={workbench.clearRuntimeLogFilters}
        onPageSizeChange={workbench.setRuntimeLogLimit}
        onOffsetChange={workbench.setRuntimeLogOffset}
        onDownloadRequestLog={(requestId, homeIp, homePort) =>
          void handleDownloadRequestLog(requestId, homeIp, homePort)
        }
        liveRefresh={workbench.liveRefresh}
        liveRefreshIntervalMs={workbench.liveRefreshIntervalMs}
        liveRefreshError={workbench.liveRefreshError}
        liveRefreshLastSuccessAt={workbench.liveRefreshLastSuccessAt}
        pendingItemCount={workbench.pendingRuntimeLogCount}
        pendingItemsTruncated={workbench.pendingRuntimeLogsTruncated}
        onAcceptPendingItems={workbench.acceptPendingRuntimeLogs}
        onDetailOpenChange={workbench.setRuntimeLogDetailOpen}
      />

      <ErrorLogFilesPanel
        requestErrorLogs={context.requestErrorLogs}
        canRead={workbench.capabilities.requestErrorLogs}
        loading={workbench.isErrorLogsPending}
        updatedAt={workbench.errorLogsUpdatedAt}
        mutating={workbench.mutating}
        downloadingErrorLogName={workbench.downloadingErrorLogName}
        isDownloadingErrorLog={workbench.isDownloadingErrorLog}
        onDownloadErrorLog={(fileName) => void handleDownloadErrorLog(fileName)}
      />

      <AlertDialog
        open={clearLogsDialogOpen && context.settings.fileLoggingEnabled}
        onOpenChange={setClearLogsDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('usageLogsPage.confirm.clearLogsTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('usageLogsPage.confirm.clearLogs')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                void handleClearLogs()
              }}
            >
              {workbench.isClearingLogs ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('usageLogsPage.actions.clearLogs')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
