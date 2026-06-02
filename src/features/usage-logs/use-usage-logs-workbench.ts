import { useState } from 'react'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  clearRuntimeLogs,
  downloadRequestErrorLog,
  downloadRequestLogById,
  fetchRuntimeLogs,
  fetchUsageLogsSnapshot,
  toUsageLogsApiError,
} from '@/lib/api/management/usage-logs'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

const runtimeLogPageSizeOptions = [50, 100, 200]
const defaultRuntimeLogPageSize = 50

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
  const [runtimeLogLimit, setRuntimeLogLimitState] = useState(defaultRuntimeLogPageSize)
  const [runtimeLogOffset, setRuntimeLogOffset] = useState(0)
  const canQueryRuntimeLogs =
    connected && capabilityReady && Boolean(session.managementKey) && capabilities.logs
  const overviewQueryKey = [
    'management-usage-logs',
    session.baseUrl,
    connectedAt,
    capabilities.usage,
    capabilities.logs,
    capabilities.requestErrorLogs,
  ]
  const runtimeLogsQueryKey = [
    'management-runtime-logs',
    session.baseUrl,
    connectedAt,
    capabilities.logs,
    runtimeLogLimit,
    runtimeLogOffset,
  ]

  const overviewQuery = useQuery({
    queryKey: overviewQueryKey,
    enabled: connected && capabilityReady && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchUsageLogsSnapshot(session, capabilities)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })

  const runtimeLogsQuery = useQuery({
    queryKey: runtimeLogsQueryKey,
    enabled: canQueryRuntimeLogs,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      try {
        return await fetchRuntimeLogs(session, {
          limit: runtimeLogLimit,
          offset: runtimeLogOffset,
        })
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
  })

  const invalidateRuntimeLogs = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['management-runtime-logs', session.baseUrl, connectedAt],
    })
  }

  const setRuntimeLogLimit = (nextLimit: number) => {
    if (!runtimeLogPageSizeOptions.includes(nextLimit)) return
    setRuntimeLogLimitState(nextLimit)
    setRuntimeLogOffset(0)
  }

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      try {
        return await clearRuntimeLogs(session)
      } catch (error) {
        throw toUsageLogsApiError(error)
      }
    },
    onSuccess: async () => {
      setRuntimeLogOffset(0)
      await invalidateRuntimeLogs()
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

  const snapshot = overviewQuery.data
    ? {
        ...overviewQuery.data,
        runtimeLogs: runtimeLogsQuery.data ?? overviewQuery.data.runtimeLogs,
        issues: runtimeLogsQuery.error
          ? [
              ...overviewQuery.data.issues,
              {
                scope: 'logs' as const,
                message: runtimeLogsQuery.error.message,
              },
            ]
          : overviewQuery.data.issues,
      }
    : undefined

  return {
    connected,
    capabilityReady,
    capabilities,
    runtimeMode,
    snapshot,
    isPending: overviewQuery.isPending || (canQueryRuntimeLogs && runtimeLogsQuery.isPending),
    isFetching: overviewQuery.isFetching || runtimeLogsQuery.isFetching,
    isError: overviewQuery.isError,
    errorMessage: overviewQuery.error?.message ?? null,
    refetch: () => {
      void Promise.all(
        canQueryRuntimeLogs
          ? [overviewQuery.refetch(), runtimeLogsQuery.refetch()]
          : [overviewQuery.refetch()],
      )
    },
    clearLogs: clearLogsMutation.mutateAsync,
    downloadRequestErrorLog: downloadRequestErrorLogMutation.mutateAsync,
    downloadRequestLogById: downloadRequestLogByIdMutation.mutateAsync,
    isClearingLogs: clearLogsMutation.isPending,
    downloadingErrorLogName: downloadRequestErrorLogMutation.variables ?? null,
    downloadingRequestLogId: downloadRequestLogByIdMutation.variables?.requestId ?? null,
    isDownloadingErrorLog: downloadRequestErrorLogMutation.isPending,
    isDownloadingRequestLog: downloadRequestLogByIdMutation.isPending,
    runtimeLogLimit,
    runtimeLogOffset,
    runtimeLogPageSizeOptions,
    setRuntimeLogLimit,
    setRuntimeLogOffset,
    mutating:
      clearLogsMutation.isPending ||
      downloadRequestErrorLogMutation.isPending ||
      downloadRequestLogByIdMutation.isPending,
  }
}
