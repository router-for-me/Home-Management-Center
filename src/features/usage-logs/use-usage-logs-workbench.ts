import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type UsageAnalyticsFilters,
  clearRuntimeLogs,
  downloadRequestErrorLog,
  downloadRequestLogById,
  fetchUsageLogsSnapshot,
  fetchUsageQueueRecords,
  fetchUsageRequestRecordDetail,
  fetchUsageRequestRecords,
  toUsageLogsApiError,
} from '@/lib/api/management/usage-logs'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)
  const capabilityStatus = useCapabilityStore((state) => state.status)
  const capabilities = useCapabilityStore((state) => state.capabilities)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
    capabilityReady: capabilityStatus === 'ready',
    capabilities,
    runtimeMode,
  }
}

function getAnalyticsFilterQueryKey(filters: UsageAnalyticsFilters | undefined) {
  return [
    filters?.scope ?? null,
    filters?.start ?? null,
    filters?.end ?? null,
    filters?.userId ?? null,
    filters?.apiKeyDescription ?? null,
    filters?.provider ?? null,
    filters?.model ?? null,
    filters?.sourceKey ?? null,
    filters?.endpoint ?? null,
    filters?.failed ?? null,
    filters?.requestId ?? null,
  ]
}

export function useUsageLogsWorkbench(
  analyticsFilters?: UsageAnalyticsFilters,
  usageRecordsPage = 1,
  usageRecordsPageSize = 20,
) {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const queryKey = [
    'management-usage-logs',
    session.baseUrl,
    connectedAt,
    capabilities.usage,
    capabilities.usageAnalytics,
    capabilities.logs,
    capabilities.requestErrorLogs,
    ...getAnalyticsFilterQueryKey(capabilities.usageAnalytics ? analyticsFilters : undefined),
  ]
  const recordsQueryKey = [
    'management-usage-records',
    session.baseUrl,
    connectedAt,
    capabilities.usageAnalytics,
    usageRecordsPage,
    usageRecordsPageSize,
    ...getAnalyticsFilterQueryKey(capabilities.usageAnalytics ? analyticsFilters : undefined),
  ]

  const query = useQuery({
    queryKey,
    enabled: connected && capabilityReady && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchUsageLogsSnapshot(session, capabilities, analyticsFilters)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })
  const analyticsOverviewReady = Boolean(query.data?.analyticsOverview)

  const recordsQuery = useQuery({
    queryKey: recordsQueryKey,
    enabled:
      connected &&
      capabilityReady &&
      capabilities.usageAnalytics &&
      analyticsOverviewReady &&
      Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchUsageRequestRecords(session, {
          ...analyticsFilters,
          page: usageRecordsPage,
          pageSize: usageRecordsPageSize,
        })
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: recordsQueryKey }),
    ])
  }

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      try {
        return await clearRuntimeLogs(session)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const usageQueueMutation = useMutation({
    mutationFn: async () => {
      try {
        return await fetchUsageQueueRecords(session, 20)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })

  const downloadRequestErrorLogMutation = useMutation({
    mutationFn: async (fileName: string) => {
      try {
        return await downloadRequestErrorLog(session, fileName)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })

  const downloadRequestLogByIdMutation = useMutation({
    mutationFn: async (requestId: string) => {
      try {
        return await downloadRequestLogById(session, requestId)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })

  const usageRequestRecordDetailMutation = useMutation({
    mutationFn: async (recordId: string) => {
      try {
        return await fetchUsageRequestRecordDetail(session, recordId)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })

  return {
    connected,
    capabilityReady,
    capabilities,
    runtimeMode,
    snapshot: query.data,
    usageRequestRecords: recordsQuery.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    isFetchingUsageRequestRecords: recordsQuery.isFetching,
    isUsageRequestRecordsPending: recordsQuery.isPending,
    isUsageRequestRecordsError: recordsQuery.isError,
    usageRequestRecordsErrorMessage: recordsQuery.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
    refetchUsageRequestRecords: () => {
      void recordsQuery.refetch()
    },
    clearLogs: clearLogsMutation.mutateAsync,
    fetchUsageQueue: usageQueueMutation.mutateAsync,
    fetchUsageRequestRecordDetail: usageRequestRecordDetailMutation.mutateAsync,
    downloadRequestErrorLog: downloadRequestErrorLogMutation.mutateAsync,
    downloadRequestLogById: downloadRequestLogByIdMutation.mutateAsync,
    usageRequestRecordDetail: usageRequestRecordDetailMutation.data ?? null,
    isFetchingUsageRequestRecordDetail: usageRequestRecordDetailMutation.isPending,
    usageQueueRecords: usageQueueMutation.data ?? [],
    usageQueueLoaded: usageQueueMutation.isSuccess,
    isClearingLogs: clearLogsMutation.isPending,
    isFetchingUsageQueue: usageQueueMutation.isPending,
    downloadingErrorLogName: downloadRequestErrorLogMutation.variables ?? null,
    downloadingRequestLogId: downloadRequestLogByIdMutation.variables ?? null,
    isDownloadingErrorLog: downloadRequestErrorLogMutation.isPending,
    isDownloadingRequestLog: downloadRequestLogByIdMutation.isPending,
    mutating:
      clearLogsMutation.isPending ||
      usageQueueMutation.isPending ||
      usageRequestRecordDetailMutation.isPending ||
      downloadRequestErrorLogMutation.isPending ||
      downloadRequestLogByIdMutation.isPending,
  }
}
