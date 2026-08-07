import { useEffect, useMemo, useRef, useState } from 'react'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getAdaptiveRefreshInterval,
  getStagedItemCount,
} from '@/features/observability/live-refresh'
import type { StagedRefresh } from '@/features/observability/live-refresh'
import { useBrowserActivity, useLiveRefresh } from '@/features/observability/use-live-refresh'
import { useManagementSession } from '@/features/observability/use-management-session'
import { usePersistentPagination } from '@/hooks/use-persistent-pagination'
import {
  clearRuntimeLogs,
  defaultRuntimeLogFilters,
  downloadRequestErrorLog,
  downloadRequestLogById,
  fetchRequestErrorLogs,
  fetchRuntimeLogs,
  fetchUsageRuntimeSettings,
  toLogsApiError,
} from '@/lib/api/management/logs'
import type {
  RuntimeLogContext,
  RuntimeLogFilters,
  RuntimeLogSnapshot,
} from '@/lib/api/management/logs'
import { applyFilterPatch } from '@/lib/filter-patch'
import { uiPreferenceKeys } from '@/lib/ui-preferences'

const runtimeLogPageSizeOptions = [50, 100, 200]
const defaultRuntimeLogPageSize = 50
const liveRefreshIntervalMs = 5_000
const errorLogsRefreshIntervalMs = 60_000
const settingsRefreshIntervalMs = 5 * 60_000

export function useLogsWorkbench() {
  const queryClient = useQueryClient()
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const [runtimeLogFilters, setRuntimeLogFiltersState] =
    useState<RuntimeLogFilters>(defaultRuntimeLogFilters)
  const [runtimeLogPagination, setRuntimeLogPagination] = usePersistentPagination(
    uiPreferenceKeys.runtimeLogPageSize,
    { limit: defaultRuntimeLogPageSize, offset: 0 },
    runtimeLogPageSizeOptions,
  )
  const { limit: runtimeLogLimit, offset: runtimeLogOffset } = runtimeLogPagination
  const [runtimeLogDetailOpen, setRuntimeLogDetailOpen] = useState(false)
  const [pendingRuntimeLogs, setPendingRuntimeLogs] =
    useState<StagedRefresh<RuntimeLogSnapshot> | null>(null)
  const browserActivity = useBrowserActivity()

  const canQueryContext = connected && capabilityReady && Boolean(session.managementKey)
  const settingsQuery = useQuery({
    queryKey: ['management-log-settings', session.baseUrl, connectedAt],
    enabled: canQueryContext,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval:
      browserActivity.visible && browserActivity.online
        ? getAdaptiveRefreshInterval(settingsRefreshIntervalMs)
        : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageRuntimeSettings(session)
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })

  const errorLogsQuery = useQuery({
    queryKey: ['management-request-error-logs', session.baseUrl, connectedAt],
    enabled: canQueryContext && capabilities.requestErrorLogs,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval:
      browserActivity.visible && browserActivity.online && capabilities.requestErrorLogs
        ? getAdaptiveRefreshInterval(errorLogsRefreshIntervalMs)
        : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchRequestErrorLogs(session)
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })
  const browserRefreshActive = browserActivity.visible && browserActivity.online
  const wasBrowserRefreshActive = useRef(browserRefreshActive)

  useEffect(() => {
    if (browserRefreshActive && !wasBrowserRefreshActive.current && canQueryContext) {
      void settingsQuery.refetch()
      if (capabilities.requestErrorLogs) void errorLogsQuery.refetch()
    }
    wasBrowserRefreshActive.current = browserRefreshActive
  }, [
    browserRefreshActive,
    canQueryContext,
    capabilities.requestErrorLogs,
    errorLogsQuery,
    settingsQuery,
  ])

  const canQueryRuntimeLogs =
    connected &&
    capabilityReady &&
    Boolean(session.managementKey) &&
    capabilities.logs &&
    settingsQuery.data?.fileLoggingEnabled === true

  const liveEligible =
    canQueryRuntimeLogs && runtimeLogOffset === 0 && runtimeLogFilters.before.trim() === ''
  const liveIneligibleReason = !canQueryRuntimeLogs
    ? 'unavailable'
    : runtimeLogOffset > 0
      ? 'nonFirstPage'
      : runtimeLogFilters.before.trim()
        ? 'historicalRange'
        : 'ineligible'
  const liveRefresh = useLiveRefresh({
    storageKey: 'hmc:runtime-logs:live',
    defaultEnabled: false,
    eligible: liveEligible,
    detailOpen: runtimeLogDetailOpen,
    ineligibleReason: liveIneligibleReason,
  })
  const runtimeLogsQueryKey = [
    'management-runtime-logs',
    session.baseUrl,
    connectedAt,
    runtimeLogFilters,
    runtimeLogLimit,
    runtimeLogOffset,
  ] as const

  const runtimeLogsQuery = useQuery({
    queryKey: runtimeLogsQueryKey,
    enabled: canQueryRuntimeLogs,
    placeholderData: keepPreviousData,
    refetchOnReconnect: false,
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

  const liveRuntimeLogsQuery = useQuery({
    queryKey: [
      'management-runtime-logs-live',
      session.baseUrl,
      connectedAt,
      runtimeLogFilters,
      runtimeLogLimit,
    ],
    enabled:
      liveRefresh.active &&
      Boolean(runtimeLogsQuery.data) &&
      !runtimeLogsQuery.isPlaceholderData &&
      !runtimeLogsQuery.isFetching,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: liveRefresh.active ? getAdaptiveRefreshInterval(liveRefreshIntervalMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchRuntimeLogs(session, {
          ...runtimeLogFilters,
          limit: runtimeLogLimit,
          offset: 0,
        })
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })
  const wasLiveActive = useRef(liveRefresh.active)

  useEffect(() => {
    if (liveRefresh.active && !wasLiveActive.current && !liveRuntimeLogsQuery.isFetching) {
      void liveRuntimeLogsQuery.refetch()
    }
    wasLiveActive.current = liveRefresh.active
  }, [liveRefresh.active, liveRuntimeLogsQuery])

  useEffect(() => {
    if (!liveRefresh.active) {
      setPendingRuntimeLogs(null)
      return
    }
    const accepted = runtimeLogsQuery.data
    const incoming = liveRuntimeLogsQuery.data
    if (!accepted || !incoming || runtimeLogsQuery.isPlaceholderData) return

    const staged = getStagedItemCount(
      accepted.records,
      incoming.records,
      (record) => record.id,
      runtimeLogLimit,
    )
    if (staged.count === 0) {
      setPendingRuntimeLogs(null)
      return
    }
    setPendingRuntimeLogs({ data: incoming, ...staged })
  }, [
    liveRuntimeLogsQuery.data,
    liveRuntimeLogsQuery.dataUpdatedAt,
    liveRefresh.active,
    runtimeLogLimit,
    runtimeLogsQuery.data,
    runtimeLogsQuery.isPlaceholderData,
  ])

  useEffect(() => {
    setPendingRuntimeLogs(null)
  }, [runtimeLogFilters, runtimeLogLimit, runtimeLogOffset])

  useEffect(() => {
    if (!liveRefresh.enabled) setPendingRuntimeLogs(null)
  }, [liveRefresh.enabled])

  const invalidateRuntimeLogs = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['management-runtime-logs', session.baseUrl, connectedAt],
    })
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['management-log-settings', session.baseUrl, connectedAt],
      }),
      queryClient.invalidateQueries({
        queryKey: ['management-request-error-logs', session.baseUrl, connectedAt],
      }),
    ])
  }

  const setRuntimeLogLimit = (nextLimit: number) => {
    if (!runtimeLogPageSizeOptions.includes(nextLimit)) return
    setRuntimeLogPagination({ limit: nextLimit, offset: 0 })
  }

  const setRuntimeLogFilters = (nextFilters: Partial<RuntimeLogFilters>) => {
    setRuntimeLogFiltersState((currentFilters) => applyFilterPatch(currentFilters, nextFilters))
    setRuntimeLogPagination((current) =>
      current.offset === 0 ? current : { ...current, offset: 0 },
    )
  }

  const clearRuntimeLogFilters = () => {
    setRuntimeLogFiltersState((currentFilters) =>
      applyFilterPatch(currentFilters, defaultRuntimeLogFilters),
    )
    setRuntimeLogPagination((current) =>
      current.offset === 0 ? current : { ...current, offset: 0 },
    )
  }

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      try {
        return await clearRuntimeLogs(session)
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
    onMutate: async () => {
      liveRefresh.setEnabled(false)
      setPendingRuntimeLogs(null)
      await queryClient.cancelQueries({
        queryKey: ['management-runtime-logs-live', session.baseUrl, connectedAt],
      })
      queryClient.removeQueries({
        queryKey: ['management-runtime-logs-live', session.baseUrl, connectedAt],
      })
    },
    onSuccess: async () => {
      setRuntimeLogPagination((current) => ({ ...current, offset: 0 }))
      queryClient.removeQueries({
        queryKey: ['management-runtime-logs-live', session.baseUrl, connectedAt],
      })
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
    mutationFn: async ({
      requestId,
      homeIp,
      homePort,
    }: {
      requestId: string
      homeIp?: string | null
      homePort?: number | null
    }) => {
      try {
        return await downloadRequestLogById(session, requestId, homeIp, homePort)
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })

  const context = useMemo<RuntimeLogContext | undefined>(() => {
    if (!settingsQuery.data) return undefined
    const fetchedAt = new Date(
      Math.max(settingsQuery.dataUpdatedAt, errorLogsQuery.dataUpdatedAt) || Date.now(),
    ).toISOString()
    return {
      fetchedAt,
      settings: settingsQuery.data,
      requestErrorLogs: errorLogsQuery.data ?? [],
      issues: [],
    }
  }, [
    errorLogsQuery.data,
    errorLogsQuery.dataUpdatedAt,
    settingsQuery.data,
    settingsQuery.dataUpdatedAt,
  ])
  const issues = [
    ...(settingsQuery.error
      ? [{ scope: 'runtimeSettings' as const, message: settingsQuery.error.message }]
      : []),
    ...(errorLogsQuery.error
      ? [{ scope: 'requestErrorLogs' as const, message: errorLogsQuery.error.message }]
      : []),
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
    context,
    runtimeLogs: runtimeLogsQuery.data ?? null,
    runtimeLogsUpdatedAt:
      runtimeLogsQuery.dataUpdatedAt > 0
        ? new Date(runtimeLogsQuery.dataUpdatedAt).toISOString()
        : context?.fetchedAt,
    errorLogsUpdatedAt:
      errorLogsQuery.dataUpdatedAt > 0
        ? new Date(errorLogsQuery.dataUpdatedAt).toISOString()
        : null,
    issues,
    isPending: settingsQuery.isPending || (canQueryRuntimeLogs && runtimeLogsQuery.isPending),
    isFetching:
      settingsQuery.isFetching || errorLogsQuery.isFetching || runtimeLogsQuery.isFetching,
    isErrorLogsPending:
      capabilities.requestErrorLogs && errorLogsQuery.isPending && !errorLogsQuery.data,
    isError: settingsQuery.isError && !settingsQuery.data,
    errorMessage: settingsQuery.error?.message ?? null,
    refetch: () => {
      const queries: Array<Promise<unknown>> = [settingsQuery.refetch()]
      if (capabilities.requestErrorLogs) queries.push(errorLogsQuery.refetch())
      const runtimeLogsRefresh = canQueryRuntimeLogs ? runtimeLogsQuery.refetch() : null
      if (runtimeLogsRefresh) queries.push(runtimeLogsRefresh)
      void Promise.allSettled(queries)
      if (runtimeLogsRefresh) {
        void runtimeLogsRefresh.then((result) => {
          if (result.isSuccess) setPendingRuntimeLogs(null)
        })
      }
    },
    liveRefresh,
    liveRefreshIntervalMs,
    liveRefreshError: liveRuntimeLogsQuery.isError,
    liveRefreshFetching: liveRuntimeLogsQuery.isFetching,
    liveRefreshLastSuccessAt:
      liveRuntimeLogsQuery.dataUpdatedAt || runtimeLogsQuery.dataUpdatedAt || null,
    pendingRuntimeLogCount: pendingRuntimeLogs?.count ?? 0,
    pendingRuntimeLogsTruncated: pendingRuntimeLogs?.truncated ?? false,
    acceptPendingRuntimeLogs: () => {
      if (!pendingRuntimeLogs) return
      queryClient.setQueryData(runtimeLogsQueryKey, pendingRuntimeLogs.data)
      setPendingRuntimeLogs(null)
    },
    setRuntimeLogDetailOpen,
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
    setRuntimeLogOffset: (nextOffset: number) => {
      setRuntimeLogPagination((current) => ({
        ...current,
        offset: Math.max(0, nextOffset),
      }))
    },
    mutating,
  }
}
