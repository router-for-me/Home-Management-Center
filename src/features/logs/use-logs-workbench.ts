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
const maxBufferedRuntimeLogs = 500
const liveRefreshIntervalMs = 5_000
const errorLogsRefreshIntervalMs = 60_000
const settingsRefreshIntervalMs = 5 * 60_000

type RuntimeLogRead = {
  snapshot: RuntimeLogSnapshot
  generation: number
}

// Keep full reads distinct even across remounts and identical API responses.
let nextRuntimeLogGeneration = 0

function parsePositiveLogId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null
  const parsed = Number(value.trim())
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function mergeIncomingTailRuntimeLogs(
  accepted: RuntimeLogSnapshot,
  incoming: RuntimeLogSnapshot,
  maxRecords: number,
): RuntimeLogSnapshot {
  const seenIds = new Set<string>()
  const mergedRecords = [...incoming.records, ...accepted.records].filter((record) => {
    if (seenIds.has(record.id)) return false
    seenIds.add(record.id)
    return true
  })
  const boundedRecords = mergedRecords.slice(0, Math.max(1, maxRecords))
  return {
    ...incoming,
    records: boundedRecords,
    lines: boundedRecords.map((item) => item.line).filter(Boolean),
  }
}

export function mergeOlderRuntimeLogs(
  accepted: RuntimeLogSnapshot,
  older: RuntimeLogSnapshot,
  maxRecords = maxBufferedRuntimeLogs,
): RuntimeLogSnapshot {
  if (accepted.anchorId !== older.anchorId) return accepted
  const seenIds = new Set<string>()
  const mergedRecords = [...accepted.records, ...older.records].filter((record) => {
    if (seenIds.has(record.id)) return false
    seenIds.add(record.id)
    return true
  })
  const boundedRecords = mergedRecords.slice(0, Math.max(1, maxRecords))
  return {
    ...accepted,
    records: boundedRecords,
    lines: boundedRecords.map((item) => item.line).filter(Boolean),
  }
}

export function hasOlderRuntimeLogs(
  snapshot: RuntimeLogSnapshot | null | undefined,
  exhaustedBeforeId: number | null,
): boolean {
  if (!snapshot || snapshot.anchorId === null) return false
  const oldestId = parsePositiveLogId(snapshot.records[snapshot.records.length - 1]?.id)
  return (
    oldestId !== null &&
    oldestId !== exhaustedBeforeId &&
    snapshot.records.length < (snapshot.total ?? snapshot.lineCount) &&
    snapshot.records.length < maxBufferedRuntimeLogs
  )
}

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
  const [runtimeLogAnchorId, setRuntimeLogAnchorId] = useState<number | null>(null)
  const [exhaustedBeforeId, setExhaustedBeforeId] = useState<number | null>(null)
  const [isFollowingBottom, setIsFollowingBottomState] = useState(true)
  const isFollowingBottomRef = useRef(true)
  const [runtimeLogDetailOpen, setRuntimeLogDetailOpen] = useState(false)
  const [pendingRuntimeLogs, setPendingRuntimeLogs] = useState<
    (StagedRefresh<RuntimeLogSnapshot> & { generation: number }) | null
  >(null)
  const browserActivity = useBrowserActivity()

  const setIsFollowingBottom = (nextFollowing: boolean) => {
    isFollowingBottomRef.current = nextFollowing
    setIsFollowingBottomState(nextFollowing)
  }

  useEffect(() => {
    setRuntimeLogAnchorId(null)
    setExhaustedBeforeId(null)
    setIsFollowingBottom(true)
  }, [session.baseUrl, connectedAt])

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
    defaultEnabled: true,
    eligible: liveEligible,
    detailOpen: runtimeLogDetailOpen,
    ineligibleReason: liveIneligibleReason,
  })
  const effectiveAnchorId = runtimeLogOffset > 0 ? runtimeLogAnchorId : null
  const runtimeLogsQueryKey = useMemo(
    () =>
      [
        'management-runtime-logs',
        session.baseUrl,
        connectedAt,
        runtimeLogFilters,
        runtimeLogLimit,
        runtimeLogOffset,
        effectiveAnchorId,
      ] as const,
    [
      session.baseUrl,
      connectedAt,
      runtimeLogFilters,
      runtimeLogLimit,
      runtimeLogOffset,
      effectiveAnchorId,
    ],
  )

  const runtimeLogsQuery = useQuery({
    queryKey: runtimeLogsQueryKey,
    enabled: canQueryRuntimeLogs,
    placeholderData: keepPreviousData,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        const snapshot = await fetchRuntimeLogs(session, {
          ...runtimeLogFilters,
          limit: runtimeLogLimit,
          offset: runtimeLogOffset,
          anchorId: effectiveAnchorId,
        })
        return { snapshot, generation: ++nextRuntimeLogGeneration }
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })
  const runtimeLogs = runtimeLogsQuery.data?.snapshot
  const runtimeLogGeneration = runtimeLogsQuery.data?.generation
  const canPollRuntimeLogs =
    liveRefresh.active &&
    Boolean(runtimeLogs) &&
    !runtimeLogsQuery.isPlaceholderData &&
    !runtimeLogsQuery.isFetching

  const liveRuntimeLogsQuery = useQuery({
    queryKey: [
      'management-runtime-logs-live',
      session.baseUrl,
      connectedAt,
      runtimeLogFilters,
      runtimeLogLimit,
      runtimeLogGeneration,
    ],
    enabled: canPollRuntimeLogs,
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
    if (canPollRuntimeLogs && !wasLiveActive.current && !liveRuntimeLogsQuery.isFetching) {
      void liveRuntimeLogsQuery.refetch()
    }
    wasLiveActive.current = liveRefresh.active
  }, [canPollRuntimeLogs, liveRefresh.active, liveRuntimeLogsQuery])

  useEffect(() => {
    if (!liveRefresh.active || runtimeLogsQuery.isFetching || runtimeLogsQuery.isPlaceholderData) {
      setPendingRuntimeLogs(null)
      return
    }
    const accepted = runtimeLogsQuery.data
    const incoming = liveRuntimeLogsQuery.data
    if (!accepted || !incoming) {
      setPendingRuntimeLogs(null)
      return
    }

    const staged = getStagedItemCount(
      accepted.snapshot.records,
      incoming.records,
      (record) => record.id,
      runtimeLogLimit,
    )
    if (staged.count === 0) {
      setPendingRuntimeLogs(null)
      return
    }
    if (isFollowingBottomRef.current && runtimeLogOffset === 0) {
      queryClient.setQueryData<RuntimeLogRead>(runtimeLogsQueryKey, {
        ...accepted,
        snapshot: mergeIncomingTailRuntimeLogs(accepted.snapshot, incoming, runtimeLogLimit),
      })
      setPendingRuntimeLogs(null)
      return
    }
    setPendingRuntimeLogs((current) =>
      current?.data === incoming &&
      current.generation === accepted.generation &&
      current.count === staged.count &&
      current.truncated === staged.truncated
        ? current
        : { data: incoming, generation: accepted.generation, ...staged },
    )
  }, [
    liveRuntimeLogsQuery.data,
    liveRuntimeLogsQuery.dataUpdatedAt,
    liveRefresh.active,
    queryClient,
    runtimeLogLimit,
    runtimeLogOffset,
    runtimeLogsQuery.data,
    runtimeLogsQuery.isFetching,
    runtimeLogsQuery.isPlaceholderData,
    runtimeLogsQueryKey,
  ])

  useEffect(() => {
    setPendingRuntimeLogs(null)
    setExhaustedBeforeId(null)
  }, [runtimeLogFilters, runtimeLogLimit, runtimeLogOffset])

  useEffect(() => {
    if (!liveRefresh.enabled) setPendingRuntimeLogs(null)
  }, [liveRefresh.enabled])

  const loadOlderLogsMutation = useMutation({
    mutationFn: async ({
      beforeId,
      anchorId,
    }: {
      beforeId: number
      anchorId: number
      generation: number
      queryKey: typeof runtimeLogsQueryKey
    }) => {
      try {
        return await fetchRuntimeLogs(session, {
          ...runtimeLogFilters,
          limit: runtimeLogLimit,
          offset: 0,
          beforeId,
          anchorId,
        })
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
    onSuccess: (olderSnapshot, variables) => {
      if (JSON.stringify(variables.queryKey) !== JSON.stringify(runtimeLogsQueryKey)) {
        return
      }
      const current = queryClient.getQueryData<RuntimeLogRead>(variables.queryKey)
      if (
        !current ||
        queryClient.isFetching({ queryKey: variables.queryKey, exact: true }) > 0 ||
        current.generation !== variables.generation ||
        current.snapshot.anchorId !== variables.anchorId ||
        olderSnapshot.anchorId !== variables.anchorId ||
        parsePositiveLogId(current.snapshot.records.at(-1)?.id) !== variables.beforeId
      )
        return
      if (olderSnapshot.records.length < runtimeLogLimit) {
        const oldestReturnedId = parsePositiveLogId(
          olderSnapshot.records[olderSnapshot.records.length - 1]?.id,
        )
        setExhaustedBeforeId(oldestReturnedId ?? variables.beforeId)
      }
      if (olderSnapshot.records.length === 0) return
      queryClient.setQueryData<RuntimeLogRead>(runtimeLogsQueryKey, {
        ...current,
        snapshot: mergeOlderRuntimeLogs(current.snapshot, olderSnapshot),
      })
    },
  })
  const { reset: resetOlderLogsMutation } = loadOlderLogsMutation

  useEffect(() => {
    resetOlderLogsMutation()
  }, [
    resetOlderLogsMutation,
    session.baseUrl,
    connectedAt,
    runtimeLogFilters,
    runtimeLogLimit,
    runtimeLogOffset,
  ])

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
    setRuntimeLogAnchorId(null)
    setExhaustedBeforeId(null)
    setIsFollowingBottom(true)
    setRuntimeLogPagination({ limit: nextLimit, offset: 0 })
  }

  const setRuntimeLogFilters = (nextFilters: Partial<RuntimeLogFilters>) => {
    setRuntimeLogAnchorId(null)
    setExhaustedBeforeId(null)
    setIsFollowingBottom(true)
    setRuntimeLogFiltersState((currentFilters) => applyFilterPatch(currentFilters, nextFilters))
    setRuntimeLogPagination((current) =>
      current.offset === 0 ? current : { ...current, offset: 0 },
    )
  }

  const clearRuntimeLogFilters = () => {
    setRuntimeLogAnchorId(null)
    setExhaustedBeforeId(null)
    setIsFollowingBottom(true)
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
      resetOlderLogsMutation()
      setRuntimeLogAnchorId(null)
      setExhaustedBeforeId(null)
      setIsFollowingBottom(true)
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
    ...(loadOlderLogsMutation.error
      ? [{ scope: 'logs' as const, message: loadOlderLogsMutation.error.message }]
      : []),
  ]

  const mutating =
    clearLogsMutation.isPending ||
    downloadRequestErrorLogMutation.isPending ||
    downloadRequestLogByIdMutation.isPending

  const currentRecords = runtimeLogs?.records ?? []
  const oldestLoadedRecordId = parsePositiveLogId(currentRecords[currentRecords.length - 1]?.id)
  const canLoadOlderLogs =
    canQueryRuntimeLogs &&
    runtimeLogOffset === 0 &&
    !runtimeLogsQuery.isPlaceholderData &&
    !runtimeLogsQuery.isFetching &&
    !loadOlderLogsMutation.isError &&
    hasOlderRuntimeLogs(runtimeLogs, exhaustedBeforeId)

  return {
    connected,
    checking,
    capabilityReady,
    capabilities,
    runtimeMode,
    context,
    runtimeLogs: runtimeLogs ?? null,
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
      loadOlderLogsMutation.reset()
      setPendingRuntimeLogs(null)
      if (runtimeLogOffset === 0) {
        setRuntimeLogAnchorId(null)
        setExhaustedBeforeId(null)
        setIsFollowingBottom(true)
      }
      const queries: Array<Promise<unknown>> = [settingsQuery.refetch()]
      if (capabilities.requestErrorLogs) queries.push(errorLogsQuery.refetch())
      const runtimeLogsRefresh = canQueryRuntimeLogs ? runtimeLogsQuery.refetch() : null
      if (runtimeLogsRefresh) queries.push(runtimeLogsRefresh)
      void Promise.allSettled(queries)
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
      const accepted = runtimeLogsQuery.data
      if (
        !pendingRuntimeLogs ||
        !accepted ||
        pendingRuntimeLogs.generation !== accepted.generation ||
        runtimeLogsQuery.isPlaceholderData ||
        runtimeLogsQuery.isFetching
      )
        return
      setIsFollowingBottom(true)
      queryClient.setQueryData<RuntimeLogRead>(runtimeLogsQueryKey, {
        ...accepted,
        snapshot: mergeIncomingTailRuntimeLogs(
          accepted.snapshot,
          pendingRuntimeLogs.data,
          runtimeLogLimit,
        ),
      })
      setPendingRuntimeLogs(null)
    },
    isFollowingBottom,
    setIsFollowingBottom,
    canLoadOlderLogs,
    isLoadingOlderLogs: loadOlderLogsMutation.isPending,
    loadOlderRuntimeLogs: () => {
      const anchorId = runtimeLogs?.anchorId
      if (
        !canLoadOlderLogs ||
        oldestLoadedRecordId === null ||
        anchorId == null ||
        runtimeLogGeneration === undefined ||
        loadOlderLogsMutation.isPending
      ) {
        return
      }
      loadOlderLogsMutation.mutate({
        beforeId: oldestLoadedRecordId,
        anchorId,
        generation: runtimeLogGeneration,
        queryKey: runtimeLogsQueryKey,
      })
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
    runtimeLogAnchorId: effectiveAnchorId,
    runtimeLogFilters,
    runtimeLogSearchUnsupported:
      runtimeLogFilters.search.trim() !== '' &&
      Boolean(runtimeLogsQuery.data) &&
      !runtimeLogsQuery.isPlaceholderData &&
      !runtimeLogsQuery.isFetching &&
      runtimeLogs?.appliedSearch !== runtimeLogFilters.search.trim(),
    runtimeLogPageSizeOptions,
    setRuntimeLogLimit,
    setRuntimeLogFilters,
    clearRuntimeLogFilters,
    setRuntimeLogOffset: (nextOffset: number) => {
      const normalizedOffset = Math.max(0, nextOffset)
      if (normalizedOffset === 0) {
        setRuntimeLogAnchorId(null)
        setIsFollowingBottom(true)
      } else {
        setIsFollowingBottom(false)
        setRuntimeLogAnchorId((current) => {
          if (current !== null) return current
          return runtimeLogs?.anchorId ?? null
        })
      }
      setRuntimeLogPagination((current) => ({
        ...current,
        offset: normalizedOffset,
      }))
    },
    mutating,
  }
}
