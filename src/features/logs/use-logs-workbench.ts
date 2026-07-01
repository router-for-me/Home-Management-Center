import { useState } from 'react'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useManagementSession } from '@/features/observability/use-management-session'
import {
  clearRuntimeLogs,
  defaultRuntimeLogFilters,
  downloadRequestErrorLog,
  downloadRequestLogById,
  fetchRuntimeLogContext,
  fetchRuntimeLogs,
  toLogsApiError,
} from '@/lib/api/management/logs'
import type { RuntimeLogFilters } from '@/lib/api/management/logs'

const runtimeLogPageSizeOptions = [50, 100, 200]
const defaultRuntimeLogPageSize = 50

export function useLogsWorkbench() {
  const queryClient = useQueryClient()
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const [runtimeLogFilters, setRuntimeLogFiltersState] =
    useState<RuntimeLogFilters>(defaultRuntimeLogFilters)
  const [runtimeLogLimit, setRuntimeLogLimitState] = useState(defaultRuntimeLogPageSize)
  const [runtimeLogOffset, setRuntimeLogOffset] = useState(0)

  const contextQuery = useQuery({
    queryKey: [
      'management-log-context',
      session.baseUrl,
      connectedAt,
      capabilities.logs,
      capabilities.requestErrorLogs,
    ],
    enabled: connected && capabilityReady && Boolean(session.managementKey),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      try {
        return await fetchRuntimeLogContext(session, capabilities)
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })

  const canQueryRuntimeLogs =
    connected &&
    capabilityReady &&
    Boolean(session.managementKey) &&
    capabilities.logs &&
    contextQuery.data?.settings.fileLoggingEnabled === true

  const runtimeLogsQuery = useQuery({
    queryKey: [
      'management-runtime-logs',
      session.baseUrl,
      connectedAt,
      runtimeLogFilters,
      runtimeLogLimit,
      runtimeLogOffset,
    ],
    enabled: canQueryRuntimeLogs,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      try {
        return await fetchRuntimeLogs(session, {
          ...runtimeLogFilters,
          limit: runtimeLogLimit,
          offset: runtimeLogOffset,
        })
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })

  const invalidateRuntimeLogs = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['management-runtime-logs', session.baseUrl, connectedAt],
    })
    await queryClient.invalidateQueries({
      queryKey: ['management-log-context', session.baseUrl, connectedAt],
    })
  }

  const setRuntimeLogLimit = (nextLimit: number) => {
    if (!runtimeLogPageSizeOptions.includes(nextLimit)) return
    setRuntimeLogLimitState(nextLimit)
    setRuntimeLogOffset(0)
  }

  const setRuntimeLogFilters = (nextFilters: Partial<RuntimeLogFilters>) => {
    setRuntimeLogFiltersState((currentFilters) => ({
      ...currentFilters,
      ...nextFilters,
    }))
    setRuntimeLogOffset(0)
  }

  const clearRuntimeLogFilters = () => {
    setRuntimeLogFiltersState(defaultRuntimeLogFilters)
    setRuntimeLogOffset(0)
  }

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      try {
        return await clearRuntimeLogs(session)
      } catch (error) {
        throw toLogsApiError(error)
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
        throw toLogsApiError(error)
      }
    },
  })

  const downloadRequestLogByIdMutation = useMutation({
    mutationFn: async ({ requestId, homeIp }: { requestId: string; homeIp?: string | null }) => {
      try {
        return await downloadRequestLogById(session, requestId, homeIp)
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })

  const issues = [
    ...(contextQuery.data?.issues ?? []),
    ...(runtimeLogsQuery.error
      ? [
          {
            scope: 'logs' as const,
            message: runtimeLogsQuery.error.message,
          },
        ]
      : []),
  ]

  const mutating =
    clearLogsMutation.isPending ||
    downloadRequestErrorLogMutation.isPending ||
    downloadRequestLogByIdMutation.isPending

  return {
    connected,
    checking,
    capabilityReady,
    capabilities,
    runtimeMode,
    context: contextQuery.data,
    runtimeLogs: runtimeLogsQuery.data ?? null,
    issues,
    isPending: contextQuery.isPending || (canQueryRuntimeLogs && runtimeLogsQuery.isPending),
    isFetching: contextQuery.isFetching || runtimeLogsQuery.isFetching,
    isError: contextQuery.isError,
    errorMessage: contextQuery.error?.message ?? null,
    refetch: () => {
      void Promise.all(
        canQueryRuntimeLogs
          ? [contextQuery.refetch(), runtimeLogsQuery.refetch()]
          : [contextQuery.refetch()],
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
    runtimeLogFilters,
    runtimeLogPageSizeOptions,
    setRuntimeLogLimit,
    setRuntimeLogFilters,
    clearRuntimeLogFilters,
    setRuntimeLogOffset,
    mutating,
  }
}
