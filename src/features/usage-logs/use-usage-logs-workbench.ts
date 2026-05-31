import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  clearRuntimeLogs,
  downloadRequestErrorLog,
  downloadRequestLogById,
  fetchUsageLogsSnapshot,
  fetchUsageQueueRecords,
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

export function useUsageLogsWorkbench() {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const queryKey = [
    'management-usage-logs',
    session.baseUrl,
    connectedAt,
    capabilities.usage,
    capabilities.usageQueue,
    capabilities.logs,
    capabilities.requestErrorLogs,
  ]

  const query = useQuery({
    queryKey,
    enabled: connected && capabilityReady && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchUsageLogsSnapshot(session, capabilities)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey })
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
    mutationFn: async ({ requestId, homeIp }: { requestId: string; homeIp?: string | null }) => {
      try {
        return await downloadRequestLogById(session, requestId, homeIp)
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
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
    clearLogs: clearLogsMutation.mutateAsync,
    fetchUsageQueue: usageQueueMutation.mutateAsync,
    downloadRequestErrorLog: downloadRequestErrorLogMutation.mutateAsync,
    downloadRequestLogById: downloadRequestLogByIdMutation.mutateAsync,
    usageQueueRecords: usageQueueMutation.data ?? [],
    usageQueueLoaded: usageQueueMutation.isSuccess,
    isClearingLogs: clearLogsMutation.isPending,
    isFetchingUsageQueue: usageQueueMutation.isPending,
    downloadingErrorLogName: downloadRequestErrorLogMutation.variables ?? null,
    downloadingRequestLogId: downloadRequestLogByIdMutation.variables?.requestId ?? null,
    isDownloadingErrorLog: downloadRequestErrorLogMutation.isPending,
    isDownloadingRequestLog: downloadRequestLogByIdMutation.isPending,
    mutating:
      clearLogsMutation.isPending ||
      usageQueueMutation.isPending ||
      downloadRequestErrorLogMutation.isPending ||
      downloadRequestLogByIdMutation.isPending,
  }
}
