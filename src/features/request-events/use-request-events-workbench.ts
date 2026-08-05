import { useEffect, useRef, useState } from 'react'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getAdaptiveRefreshInterval,
  getStagedItemCount,
} from '@/features/observability/live-refresh'
import type { StagedRefresh } from '@/features/observability/live-refresh'
import { useLiveRefresh } from '@/features/observability/use-live-refresh'
import { useManagementSession } from '@/features/observability/use-management-session'
import { usePersistentPagination } from '@/hooks/use-persistent-pagination'
import { downloadRequestLogById, toLogsApiError } from '@/lib/api/management/logs'
import {
  defaultRequestEventFilters,
  exportRequestEvents,
  fetchRequestEventDetail,
  fetchRequestEventFilterOptions,
  fetchRequestEvents,
  getRequestEventOptionFilters,
  isRequestEventLatencyRangeValid,
  toRequestEventsApiError,
} from '@/lib/api/management/request-events'
import type {
  RequestEvent,
  RequestEventFilters,
  RequestEventStatusFilter,
  RequestEventsPage,
} from '@/lib/api/management/request-events'
import { uiPreferenceKeys } from '@/lib/ui-preferences'

const requestEventPageSizeOptions = [25, 50, 100, 200]
const liveRefreshIntervalMs = 5_000
const liveEligibleRanges = new Set<RequestEventFilters['range']>(['4h', '12h', '24h', 'today'])

const requestEventOptionFilterKeys = new Set<keyof RequestEventFilters>([
  'range',
  'customFrom',
  'customTo',
  'search',
  'requestId',
  'eventType',
  'status',
  'statusCode',
  'provider',
  'model',
  'homeIp',
  'cpaNode',
  'credentialId',
  'authIndex',
  'user',
  'clientKey',
  'minLatencyMs',
  'maxLatencyMs',
  'sort',
])

function getClearedFilters(limit: number): RequestEventFilters {
  return {
    ...defaultRequestEventFilters,
    limit,
    offset: 0,
  }
}

export function useRequestEventsWorkbench() {
  const queryClient = useQueryClient()
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const [filters, setFilters] = usePersistentPagination(
    uiPreferenceKeys.requestEventPageSize,
    defaultRequestEventFilters,
    requestEventPageSizeOptions,
  )
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [pendingEvents, setPendingEvents] = useState<StagedRefresh<RequestEventsPage> | null>(null)

  // Query keys are compared by value, so this stays cached while the user
  // switches dropdown filters — those are excluded from the option scope.
  const optionFilters = getRequestEventOptionFilters(filters)

  const filtersValid = isRequestEventLatencyRangeValid(filters)
  const requestEventsAvailable =
    connected && capabilityReady && Boolean(session.managementKey) && capabilities.requestEvents
  const canQueryEvents = requestEventsAvailable && filtersValid
  const liveEligible =
    canQueryEvents &&
    filters.offset === 0 &&
    filters.sort === 'timestamp_desc' &&
    liveEligibleRanges.has(filters.range)
  const liveIneligibleReason = !requestEventsAvailable
    ? 'unavailable'
    : !filtersValid
      ? 'invalidFilters'
      : filters.offset > 0
        ? 'nonFirstPage'
        : filters.sort !== 'timestamp_desc'
          ? 'nonLatestSort'
          : !liveEligibleRanges.has(filters.range)
            ? 'historicalRange'
            : 'ineligible'
  const liveRefresh = useLiveRefresh({
    storageKey: 'hmc:request-events:live',
    defaultEnabled: false,
    eligible: liveEligible,
    detailOpen: selectedEventId !== null,
    ineligibleReason: liveIneligibleReason,
  })
  const eventsQueryKey = [
    'management-request-events',
    session.baseUrl,
    connectedAt,
    capabilities.requestEvents,
    filters,
  ] as const

  const eventsQuery = useQuery({
    queryKey: eventsQueryKey,
    enabled: canQueryEvents,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        return await fetchRequestEvents(session, filters)
      } catch (error) {
        throw toRequestEventsApiError(error)
      }
    },
  })

  const liveEventsQuery = useQuery({
    queryKey: [
      'management-request-events-live',
      session.baseUrl,
      connectedAt,
      capabilities.requestEvents,
      filters,
    ],
    enabled:
      liveRefresh.active &&
      Boolean(eventsQuery.data) &&
      !eventsQuery.isPlaceholderData &&
      !eventsQuery.isFetching,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: liveRefresh.active ? getAdaptiveRefreshInterval(liveRefreshIntervalMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchRequestEvents(session, { ...filters, offset: 0 })
      } catch (error) {
        throw toRequestEventsApiError(error)
      }
    },
  })
  const wasLiveActive = useRef(liveRefresh.active)

  useEffect(() => {
    if (liveRefresh.active && !wasLiveActive.current && !liveEventsQuery.isFetching) {
      void liveEventsQuery.refetch()
    }
    wasLiveActive.current = liveRefresh.active
  }, [liveEventsQuery, liveRefresh.active])

  useEffect(() => {
    if (!liveRefresh.active) {
      setPendingEvents(null)
      return
    }
    const accepted = eventsQuery.data
    const incoming = liveEventsQuery.data
    if (!accepted || !incoming || eventsQuery.isPlaceholderData) return

    const staged = getStagedItemCount(
      accepted.items,
      incoming.items,
      (event) => event.id,
      filters.limit,
    )
    if (staged.count === 0) {
      setPendingEvents(null)
      return
    }
    setPendingEvents({ data: incoming, ...staged })
  }, [
    eventsQuery.data,
    eventsQuery.isPlaceholderData,
    filters.limit,
    liveEventsQuery.data,
    liveEventsQuery.dataUpdatedAt,
    liveRefresh.active,
  ])

  useEffect(() => {
    setPendingEvents(null)
  }, [filters])

  useEffect(() => {
    if (!liveRefresh.enabled) setPendingEvents(null)
  }, [liveRefresh.enabled])

  const filterOptionsQuery = useQuery({
    queryKey: [
      'management-request-event-filter-options',
      session.baseUrl,
      connectedAt,
      capabilities.requestEvents,
      capabilities.requestEventFilters,
      optionFilters,
    ],
    enabled: canQueryEvents,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        return await fetchRequestEventFilterOptions(session, optionFilters, {
          serverSide: capabilities.requestEventFilters,
        })
      } catch (error) {
        throw toRequestEventsApiError(error)
      }
    },
  })

  const detailQuery = useQuery({
    queryKey: [
      'management-request-event-detail',
      session.baseUrl,
      connectedAt,
      capabilities.requestEventDetails,
      selectedEventId,
    ],
    enabled:
      connected &&
      capabilityReady &&
      Boolean(session.managementKey) &&
      capabilities.requestEventDetails &&
      Boolean(selectedEventId),
    retry: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!selectedEventId) throw new Error('Request event is not selected')

      try {
        return await fetchRequestEventDetail(session, selectedEventId)
      } catch (error) {
        throw toRequestEventsApiError(error)
      }
    },
  })

  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'jsonl') => {
      try {
        return await exportRequestEvents(session, filters, format)
      } catch (error) {
        throw toRequestEventsApiError(error)
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

  const updateFilters = (nextFilters: Partial<RequestEventFilters>) => {
    const filterKeys = Object.keys(nextFilters) as Array<keyof RequestEventFilters>
    const shouldResetOffset = filterKeys.some(
      (key) => key !== 'offset' && requestEventOptionFilterKeys.has(key),
    )

    setFilters((currentFilters) => ({
      ...currentFilters,
      ...nextFilters,
      offset: nextFilters.offset ?? (shouldResetOffset ? 0 : currentFilters.offset),
    }))
    setPendingEvents(null)
  }

  const setLimit = (nextLimit: number) => {
    if (!requestEventPageSizeOptions.includes(nextLimit)) return
    updateFilters({ limit: nextLimit, offset: 0 })
  }

  const setOffset = (nextOffset: number) => {
    updateFilters({ offset: Math.max(0, nextOffset) })
  }

  const setStatus = (nextStatus: RequestEventStatusFilter) => {
    updateFilters({ status: nextStatus })
  }

  const selectEvent = (event: RequestEvent) => {
    setSelectedEventId(event.id)
  }

  const clearSelectedEvent = () => {
    setSelectedEventId(null)
  }

  const mutating = exportMutation.isPending || downloadRequestLogByIdMutation.isPending

  return {
    connected,
    checking,
    capabilityReady,
    capabilities,
    runtimeMode,
    filters,
    events: eventsQuery.data ?? null,
    filterOptions: filterOptionsQuery.data ?? null,
    filtersValid,
    canRefresh: canQueryEvents,
    selectedEventDetail: detailQuery.data ?? null,
    selectedEventId,
    isPending: eventsQuery.isPending,
    isFetching: eventsQuery.isFetching || filterOptionsQuery.isFetching,
    eventsUpdatedAt:
      eventsQuery.dataUpdatedAt > 0 ? new Date(eventsQuery.dataUpdatedAt).toISOString() : null,
    isError: eventsQuery.isError,
    errorMessage: eventsQuery.error?.message ?? null,
    filterOptionsErrorMessage: filterOptionsQuery.error?.message ?? null,
    isDetailPending: detailQuery.isPending || detailQuery.isFetching,
    detailError: detailQuery.error ?? null,
    isExporting: exportMutation.isPending,
    isDownloadingRequestLog: downloadRequestLogByIdMutation.isPending,
    downloadingRequestLogId: downloadRequestLogByIdMutation.variables?.requestId ?? null,
    pageSizeOptions: requestEventPageSizeOptions,
    mutating,
    refetch: () => {
      if (!canQueryEvents) return
      const eventsRefresh = eventsQuery.refetch()
      void Promise.allSettled([eventsRefresh, filterOptionsQuery.refetch()])
      void eventsRefresh.then((result) => {
        if (result.isSuccess) setPendingEvents(null)
      })
    },
    liveRefresh,
    liveRefreshIntervalMs,
    liveRefreshError: liveEventsQuery.isError,
    liveRefreshFetching: liveEventsQuery.isFetching,
    liveRefreshLastSuccessAt: liveEventsQuery.dataUpdatedAt || eventsQuery.dataUpdatedAt || null,
    pendingEventCount: pendingEvents?.count ?? 0,
    pendingEventsTruncated: pendingEvents?.truncated ?? false,
    acceptPendingEvents: () => {
      if (!pendingEvents) return
      queryClient.setQueryData(eventsQueryKey, pendingEvents.data)
      setPendingEvents(null)
    },
    updateFilters,
    setLimit,
    setOffset,
    setStatus,
    clearFilters: () => {
      setPendingEvents(null)
      setFilters((currentFilters) => getClearedFilters(currentFilters.limit))
    },
    selectEvent,
    clearSelectedEvent,
    exportRequestEvents: exportMutation.mutateAsync,
    downloadRequestLogById: downloadRequestLogByIdMutation.mutateAsync,
  }
}
