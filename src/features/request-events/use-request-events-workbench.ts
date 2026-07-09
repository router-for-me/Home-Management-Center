import { useMemo, useState } from 'react'

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { useManagementSession } from '@/features/observability/use-management-session'
import { downloadRequestLogById, toLogsApiError } from '@/lib/api/management/logs'
import {
  defaultRequestEventFilters,
  exportRequestEvents,
  fetchRequestEventDetail,
  fetchRequestEventFilterOptions,
  fetchRequestEvents,
  isRequestEventLatencyRangeValid,
  toRequestEventsApiError,
} from '@/lib/api/management/request-events'
import type {
  RequestEvent,
  RequestEventFilters,
  RequestEventStatusFilter,
} from '@/lib/api/management/request-events'

const requestEventPageSizeOptions = [25, 50, 100, 200]

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

function getClearedFilters(): RequestEventFilters {
  return {
    ...defaultRequestEventFilters,
    limit: defaultRequestEventFilters.limit,
    offset: 0,
  }
}

export function useRequestEventsWorkbench() {
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const [filters, setFilters] = useState<RequestEventFilters>(defaultRequestEventFilters)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const optionFilters = useMemo<RequestEventFilters>(
    () => ({
      ...defaultRequestEventFilters,
      range: filters.range,
      customFrom: filters.customFrom,
      customTo: filters.customTo,
      search: filters.search,
      requestId: filters.requestId,
      eventType: filters.eventType,
      status: filters.status,
      statusCode: filters.statusCode,
      provider: filters.provider,
      model: filters.model,
      homeIp: filters.homeIp,
      cpaNode: filters.cpaNode,
      credentialId: filters.credentialId,
      authIndex: filters.authIndex,
      user: filters.user,
      clientKey: filters.clientKey,
      minLatencyMs: filters.minLatencyMs,
      maxLatencyMs: filters.maxLatencyMs,
      limit: 200,
      offset: 0,
    }),
    [
      filters.authIndex,
      filters.clientKey,
      filters.cpaNode,
      filters.credentialId,
      filters.customFrom,
      filters.customTo,
      filters.eventType,
      filters.homeIp,
      filters.maxLatencyMs,
      filters.minLatencyMs,
      filters.model,
      filters.provider,
      filters.range,
      filters.requestId,
      filters.search,
      filters.status,
      filters.statusCode,
      filters.user,
    ],
  )

  const filtersValid = isRequestEventLatencyRangeValid(filters)
  const canQueryEvents =
    connected &&
    capabilityReady &&
    Boolean(session.managementKey) &&
    capabilities.requestEvents &&
    filtersValid

  const eventsQuery = useQuery({
    queryKey: [
      'management-request-events',
      session.baseUrl,
      connectedAt,
      capabilities.requestEvents,
      filters,
    ],
    enabled: canQueryEvents,
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async () => {
      try {
        return await fetchRequestEvents(session, filters)
      } catch (error) {
        throw toRequestEventsApiError(error)
      }
    },
  })

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
      void Promise.all([eventsQuery.refetch(), filterOptionsQuery.refetch()])
    },
    updateFilters,
    setLimit,
    setOffset,
    setStatus,
    clearFilters: () => setFilters(getClearedFilters()),
    selectEvent,
    clearSelectedEvent,
    exportRequestEvents: exportMutation.mutateAsync,
    downloadRequestLogById: downloadRequestLogByIdMutation.mutateAsync,
  }
}
