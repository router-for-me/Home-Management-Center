import { useEffect, useMemo, useRef, useState } from 'react'

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { getAdaptiveRefreshInterval } from '@/features/observability/live-refresh'
import { useLiveRefresh } from '@/features/observability/use-live-refresh'
import { useManagementSession } from '@/features/observability/use-management-session'
import { usePersistentPagination } from '@/hooks/use-persistent-pagination'
import { downloadRequestLogById, toLogsApiError } from '@/lib/api/management/logs'
import {
  type UsageAggregateGroupBy,
  type UsageAggregateMetric,
  type UsageAggregateSortState,
  type UsageFilters,
  type UsageLogIssue,
  type UsageSnapshot,
  defaultUsageAggregatesQuery,
  defaultUsageFilters,
  deriveUsageFilterOptions,
  exportUsageRecords,
  fetchUsageAggregates,
  fetchUsageOverview,
  fetchUsageRecordDetail,
  fetchUsageRecords,
  fetchUsageRuntimeSettings,
  getUsageOptionFilters,
  hasActiveUsageDropdownFilter,
  toUsageApiError,
} from '@/lib/api/management/usage'
import { uiPreferenceKeys } from '@/lib/ui-preferences'

const recordPageSizeOptions = [25, 50, 100, 200]
const credentialUsagePageSizeOptions = [10, 20, 50, 100]
const usageRecordsRefreshMs = 30_000
const usageSummaryRefreshMs = 60_000
const usageSettingsRefreshMs = 5 * 60_000
const usageScopeFilterKeys = new Set<keyof UsageFilters>([
  'range',
  'provider',
  'model',
  'credentialType',
  'homeIp',
  'endpoint',
  'customFrom',
  'customTo',
])
function isUnsupportedStatus(status: number | null | undefined) {
  return status === 404 || status === 405
}

function isUnsupportedIssue(issue: UsageLogIssue | null) {
  return isUnsupportedStatus(issue?.status)
}

function getApiErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : null
}

function toUsageIssue(scope: UsageLogIssue['scope'], error: Error | null): UsageLogIssue | null {
  if (!error) return null
  const status = getApiErrorStatus(error)
  return {
    scope,
    message: error.message,
    ...(status === null ? {} : { status }),
  }
}

export function useUsageObservabilityWorkbench() {
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const scopedCapabilities = {
    ...capabilities,
    usageProviderHealth: false,
    usageCredentialHealth: false,
    usageRealtime: false,
    requestLogIndex: false,
  }
  const [filters, setFilters] = usePersistentPagination(
    uiPreferenceKeys.usageRecordPageSize,
    defaultUsageFilters,
    recordPageSizeOptions,
  )
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [rankingGroup, setRankingGroup] = useState<UsageAggregateGroupBy>(
    defaultUsageAggregatesQuery.groupBy,
  )
  const [rankingMetric, setRankingMetric] = useState<UsageAggregateMetric>(
    defaultUsageAggregatesQuery.metric,
  )
  const [rankingDetailOpen, setRankingDetailOpen] = useState(false)
  const [rankingExpanded, setRankingExpanded] = useState(false)
  const [credentialUsageSort, setCredentialUsageSortValue] = useState<UsageAggregateSortState>(null)
  const [credentialUsagePagination, setCredentialUsagePagination] = usePersistentPagination(
    uiPreferenceKeys.credentialUsagePageSize,
    { limit: 20, offset: 0 },
    credentialUsagePageSizeOptions,
  )
  const { limit: credentialUsageLimit, offset: credentialUsageOffset } = credentialUsagePagination
  const rankingLimit = rankingExpanded ? 50 : 10
  const aggregateFilters = useMemo<UsageFilters>(
    () => ({
      ...defaultUsageFilters,
      range: filters.range,
      provider: filters.provider,
      model: filters.model,
      credentialType: filters.credentialType,
      homeIp: filters.homeIp,
      endpoint: filters.endpoint,
      customFrom: filters.customFrom,
      customTo: filters.customTo,
      sort: null,
      limit: defaultUsageFilters.limit,
      offset: 0,
    }),
    [
      filters.range,
      filters.provider,
      filters.model,
      filters.credentialType,
      filters.homeIp,
      filters.endpoint,
      filters.customFrom,
      filters.customTo,
    ],
  )

  // Query keys are compared by value, so this stays cached while the user
  // switches dropdown filters — those are excluded from the option scope.
  const optionFilters = getUsageOptionFilters(filters)
  const dropdownFiltersActive = hasActiveUsageDropdownFilter(filters)

  const canQuery = connected && capabilityReady && Boolean(session.managementKey)
  const autoRefreshEligible =
    canQuery && filters.range !== 'yesterday' && filters.range !== 'custom'
  const recordsAutoRefreshEligible =
    autoRefreshEligible &&
    filters.offset === 0 &&
    (filters.sort === null || filters.sort === 'timestamp_desc') &&
    selectedRecordId === null
  const autoRefresh = useLiveRefresh({
    storageKey: 'hmc:usage-observability:auto-refresh',
    defaultEnabled: false,
    eligible: autoRefreshEligible,
    detailOpen: selectedRecordId !== null,
    ineligibleReason: canQuery ? 'historicalRange' : 'unavailable',
  })

  const settingsQuery = useQuery({
    queryKey: ['management-usage-settings', session.baseUrl, connectedAt],
    enabled: canQuery,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: autoRefresh.active
      ? getAdaptiveRefreshInterval(usageSettingsRefreshMs)
      : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageRuntimeSettings(session)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const overviewQuery = useQuery({
    queryKey: [
      'management-usage-overview',
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageOverview,
      scopedCapabilities.usageTokenBreakdownV2,
      aggregateFilters,
    ],
    enabled: canQuery && scopedCapabilities.usageOverview,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: autoRefresh.active ? getAdaptiveRefreshInterval(usageSummaryRefreshMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageOverview(
          session,
          aggregateFilters,
          scopedCapabilities.usageTokenBreakdownV2,
        )
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const recordsQuery = useQuery({
    queryKey: [
      'management-usage-records',
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageRecords,
      scopedCapabilities.usageTokenBreakdownV2,
      filters,
    ],
    enabled: canQuery && scopedCapabilities.usageRecords,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval:
      autoRefresh.active && recordsAutoRefreshEligible
        ? getAdaptiveRefreshInterval(usageRecordsRefreshMs)
        : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageRecords(session, filters, scopedCapabilities.usageTokenBreakdownV2)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const rankingQuery = useQuery({
    queryKey: [
      'management-usage-aggregate-drilldown',
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageAggregates,
      scopedCapabilities.usageTokenBreakdownV2,
      aggregateFilters,
      rankingGroup,
      rankingMetric,
      rankingLimit,
    ],
    enabled:
      connected &&
      capabilityReady &&
      Boolean(session.managementKey) &&
      rankingDetailOpen &&
      scopedCapabilities.usageAggregates,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: autoRefresh.active ? getAdaptiveRefreshInterval(usageSummaryRefreshMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageAggregates(
          session,
          aggregateFilters,
          {
            groupBy: rankingGroup,
            metric: rankingMetric,
            sortDirection: defaultUsageAggregatesQuery.sortDirection,
            limit: rankingLimit,
            offset: 0,
          },
          scopedCapabilities.usageTokenBreakdownV2,
        )
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const credentialUsageQuery = useQuery({
    queryKey: [
      'management-usage-credential-aggregate',
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageAggregates,
      scopedCapabilities.usageTokenBreakdownV2,
      aggregateFilters,
      credentialUsageSort,
      credentialUsageLimit,
      credentialUsageOffset,
    ],
    enabled:
      connected &&
      capabilityReady &&
      Boolean(session.managementKey) &&
      scopedCapabilities.usageAggregates,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval:
      autoRefresh.active && credentialUsageOffset === 0
        ? getAdaptiveRefreshInterval(usageSummaryRefreshMs)
        : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageAggregates(
          session,
          aggregateFilters,
          {
            groupBy: 'credential',
            metric: credentialUsageSort?.metric ?? defaultUsageAggregatesQuery.metric,
            sortDirection:
              credentialUsageSort?.direction ?? defaultUsageAggregatesQuery.sortDirection,
            limit: credentialUsageLimit,
            offset: credentialUsageOffset,
          },
          scopedCapabilities.usageTokenBreakdownV2,
        )
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const filterOptionsQuery = useQuery({
    queryKey: [
      'management-usage-filter-options',
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageOverview,
      scopedCapabilities.usageRecords,
      scopedCapabilities.usageTokenBreakdownV2,
      optionFilters,
    ],
    enabled:
      canQuery &&
      dropdownFiltersActive &&
      (scopedCapabilities.usageOverview || scopedCapabilities.usageRecords),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const [overview, records] = await Promise.allSettled([
        scopedCapabilities.usageOverview
          ? fetchUsageOverview(session, optionFilters, scopedCapabilities.usageTokenBreakdownV2)
          : Promise.resolve(null),
        scopedCapabilities.usageRecords
          ? fetchUsageRecords(session, optionFilters, scopedCapabilities.usageTokenBreakdownV2)
          : Promise.resolve(null),
      ])

      // Falling back to the narrowed lists is better than emptying the
      // dropdowns, so only a total failure is surfaced as a query error.
      if (overview.status === 'rejected' && records.status === 'rejected') {
        throw toUsageApiError(overview.reason)
      }

      return deriveUsageFilterOptions({
        overview: overview.status === 'fulfilled' ? overview.value : null,
        records: records.status === 'fulfilled' ? records.value : null,
        credentialUsage: null,
      })
    },
  })

  const detailQuery = useQuery({
    queryKey: [
      'management-usage-record-detail',
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageTokenBreakdownV2,
      selectedRecordId,
    ],
    enabled:
      connected &&
      capabilityReady &&
      Boolean(session.managementKey) &&
      scopedCapabilities.usageRecordDetails &&
      Boolean(selectedRecordId),
    retry: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!selectedRecordId) throw new Error('Usage record is not selected')

      try {
        return await fetchUsageRecordDetail(
          session,
          selectedRecordId,
          scopedCapabilities.usageTokenBreakdownV2,
        )
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })
  const wasAutoRefreshActive = useRef(autoRefresh.active)

  useEffect(() => {
    if (autoRefresh.active && !wasAutoRefreshActive.current && canQuery) {
      const refreshes: Array<Promise<unknown>> = [settingsQuery.refetch()]
      if (scopedCapabilities.usageOverview) refreshes.push(overviewQuery.refetch())
      if (scopedCapabilities.usageRecords && recordsAutoRefreshEligible) {
        refreshes.push(recordsQuery.refetch())
      }
      if (scopedCapabilities.usageAggregates && credentialUsageOffset === 0) {
        refreshes.push(credentialUsageQuery.refetch())
      }
      if (scopedCapabilities.usageAggregates && rankingDetailOpen) {
        refreshes.push(rankingQuery.refetch())
      }
      void Promise.allSettled(refreshes)
    }
    wasAutoRefreshActive.current = autoRefresh.active
  }, [
    autoRefresh.active,
    canQuery,
    credentialUsageOffset,
    credentialUsageQuery,
    overviewQuery,
    rankingDetailOpen,
    rankingQuery,
    recordsAutoRefreshEligible,
    recordsQuery,
    scopedCapabilities.usageAggregates,
    scopedCapabilities.usageOverview,
    scopedCapabilities.usageRecords,
    settingsQuery,
  ])

  const exportUsageMutation = useMutation({
    mutationFn: async (format: 'csv' | 'jsonl') => {
      try {
        return await exportUsageRecords(session, filters, format)
      } catch (error) {
        throw toUsageApiError(error)
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

  const updateFilters = (nextFilters: Partial<UsageFilters>) => {
    const filterKeys = Object.keys(nextFilters) as Array<keyof UsageFilters>
    const affectsCredentialUsage = filterKeys.some((key) => usageScopeFilterKeys.has(key))

    if (affectsCredentialUsage) {
      setCredentialUsagePagination((current) => ({ ...current, offset: 0 }))
    }

    setFilters((currentFilters) => ({
      ...currentFilters,
      ...nextFilters,
      offset: nextFilters.offset ?? 0,
    }))
  }

  const setRecordLimit = (nextLimit: number) => {
    if (!recordPageSizeOptions.includes(nextLimit)) return
    updateFilters({ limit: nextLimit })
  }

  const setRecordOffset = (nextOffset: number) => {
    updateFilters({ offset: Math.max(0, nextOffset) })
  }

  const setCredentialUsageLimit = (nextLimit: number) => {
    if (!credentialUsagePageSizeOptions.includes(nextLimit)) return
    setCredentialUsagePagination({ limit: nextLimit, offset: 0 })
  }

  const setCredentialUsageOffset = (nextOffset: number) => {
    setCredentialUsagePagination((current) => ({
      ...current,
      offset: Math.max(0, nextOffset),
    }))
  }

  const setCredentialUsageSort = (nextMetric: UsageAggregateMetric) => {
    setCredentialUsageSortValue((currentSort) => {
      if (!currentSort || currentSort.metric !== nextMetric) {
        return { metric: nextMetric, direction: 'desc' }
      }

      if (currentSort.direction === 'desc') {
        return { metric: nextMetric, direction: 'asc' }
      }

      return null
    })
    setCredentialUsagePagination((current) => ({ ...current, offset: 0 }))
  }

  const settingsIssue = toUsageIssue('runtimeSettings', settingsQuery.error)
  const usageOverviewIssue = toUsageIssue('usageOverview', overviewQuery.error)
  const usageRecordsIssue = toUsageIssue('usageRecords', recordsQuery.error)
  const usageAggregatesIssue = toUsageIssue('usageAggregates', credentialUsageQuery.error)
  const issues = [
    settingsIssue,
    usageOverviewIssue,
    usageRecordsIssue,
    usageAggregatesIssue,
  ].filter((issue): issue is UsageLogIssue => issue !== null)
  const usageRecordsUnavailable =
    !scopedCapabilities.usageRecords || isUnsupportedIssue(usageRecordsIssue)
  const usageRecordsErrorMessage =
    recordsQuery.data || usageRecordsUnavailable ? null : (usageRecordsIssue?.message ?? null)
  const credentialUsage = credentialUsageQuery.data ?? null
  const credentialUsageQueryUnsupported = isUnsupportedStatus(
    getApiErrorStatus(credentialUsageQuery.error),
  )
  const credentialUsageUnavailable =
    !scopedCapabilities.usageAggregates ||
    isUnsupportedIssue(usageAggregatesIssue) ||
    credentialUsageQueryUnsupported
  const credentialUsageErrorMessage =
    credentialUsage || credentialUsageUnavailable
      ? null
      : (credentialUsageQuery.error?.message ?? usageAggregatesIssue?.message ?? null)
  const isCredentialUsagePending =
    scopedCapabilities.usageAggregates &&
    !credentialUsageUnavailable &&
    !credentialUsageErrorMessage &&
    !credentialUsage &&
    (credentialUsageQuery.isPending || credentialUsageQuery.isFetching)
  const effectiveCapabilities = {
    ...scopedCapabilities,
    usageRecords: !usageRecordsUnavailable,
    usageRecordDetails: scopedCapabilities.usageRecordDetails && !usageRecordsUnavailable,
    usageAggregates: !credentialUsageUnavailable,
    usageExport: scopedCapabilities.usageExport && !usageRecordsUnavailable,
    oauthUsage: scopedCapabilities.oauthUsage && !credentialUsageUnavailable,
  }
  const dataUpdatedAt = Math.max(
    settingsQuery.dataUpdatedAt,
    overviewQuery.dataUpdatedAt,
    recordsQuery.dataUpdatedAt,
    credentialUsageQuery.dataUpdatedAt,
  )
  const hasData =
    settingsQuery.data !== undefined ||
    overviewQuery.data !== undefined ||
    recordsQuery.data !== undefined ||
    credentialUsageQuery.data !== undefined
  const snapshot: UsageSnapshot | undefined = hasData
    ? {
        fetchedAt: new Date(dataUpdatedAt || Date.now()).toISOString(),
        settings: settingsQuery.data ?? {
          usageStatisticsEnabled:
            overviewQuery.data !== undefined ||
            recordsQuery.data !== undefined ||
            credentialUsageQuery.data !== undefined,
          fileLoggingEnabled: false,
        },
        overview: overviewQuery.data ?? null,
        records: recordsQuery.data ?? null,
        credentialUsage,
        providerHealth: null,
        credentialHealth: null,
        realtime: null,
        requestLogs: null,
        apiKeyUsage: [],
        runtimeLogs: null,
        requestErrorLogs: [],
        filterOptions:
          (dropdownFiltersActive ? filterOptionsQuery.data : null) ??
          deriveUsageFilterOptions({
            overview: overviewQuery.data ?? null,
            records: recordsQuery.data ?? null,
            credentialUsage,
          }),
        issues,
      }
    : undefined
  const primaryRefresh =
    scopedCapabilities.usageRecords && recordsAutoRefreshEligible
      ? { intervalMs: usageRecordsRefreshMs, updatedAt: recordsQuery.dataUpdatedAt }
      : scopedCapabilities.usageOverview
        ? { intervalMs: usageSummaryRefreshMs, updatedAt: overviewQuery.dataUpdatedAt }
        : scopedCapabilities.usageAggregates
          ? { intervalMs: usageSummaryRefreshMs, updatedAt: credentialUsageQuery.dataUpdatedAt }
          : { intervalMs: usageSettingsRefreshMs, updatedAt: settingsQuery.dataUpdatedAt }

  return {
    connected,
    checking,
    capabilityReady,
    capabilities: effectiveCapabilities,
    runtimeMode,
    filters,
    snapshot,
    autoRefresh,
    autoRefreshIntervalMs: primaryRefresh.intervalMs,
    autoRefreshLastSuccessAt: primaryRefresh.updatedAt || null,
    autoRefreshError: issues.length > 0,
    manualRefreshing,
    credentialUsage,
    isCredentialUsagePending,
    isUsageRecordsUnavailable: usageRecordsUnavailable,
    usageRecordsErrorMessage,
    isCredentialUsageUnavailable: credentialUsageUnavailable,
    credentialUsageErrorMessage,
    rankingAggregate: rankingQuery.data ?? null,
    rankingGroup,
    rankingMetric,
    rankingDetailOpen,
    rankingExpanded,
    isRankingPending:
      rankingDetailOpen &&
      (rankingQuery.isPending || rankingQuery.isFetching) &&
      scopedCapabilities.usageAggregates,
    rankingErrorMessage: rankingQuery.error?.message ?? null,
    selectedRecordId,
    selectedRecordDetail: selectedRecordId ? detailQuery.data : undefined,
    isRecordDetailPending: detailQuery.isPending && Boolean(selectedRecordId),
    recordDetailError: selectedRecordId ? (detailQuery.error?.message ?? null) : null,
    isPending:
      settingsQuery.isPending ||
      (scopedCapabilities.usageOverview && overviewQuery.isPending) ||
      (scopedCapabilities.usageRecords && recordsQuery.isPending) ||
      (scopedCapabilities.usageAggregates && credentialUsageQuery.isPending),
    isFetching:
      settingsQuery.isFetching ||
      overviewQuery.isFetching ||
      recordsQuery.isFetching ||
      credentialUsageQuery.isFetching ||
      (rankingDetailOpen && rankingQuery.isFetching),
    isError: !snapshot && (settingsQuery.isError || overviewQuery.isError || recordsQuery.isError),
    errorMessage:
      settingsQuery.error?.message ??
      overviewQuery.error?.message ??
      recordsQuery.error?.message ??
      null,
    refetch: () => {
      if (!canQuery) return
      setManualRefreshing(true)
      const queries: Array<Promise<unknown>> = [settingsQuery.refetch()]
      if (scopedCapabilities.usageOverview) queries.push(overviewQuery.refetch())
      if (scopedCapabilities.usageRecords) queries.push(recordsQuery.refetch())
      if (scopedCapabilities.usageAggregates) queries.push(credentialUsageQuery.refetch())
      if (rankingDetailOpen && scopedCapabilities.usageAggregates) {
        queries.push(rankingQuery.refetch())
      }
      if (dropdownFiltersActive) queries.push(filterOptionsQuery.refetch())
      void Promise.allSettled(queries).finally(() => setManualRefreshing(false))
    },
    updateFilters,
    setRankingGroup: (group: UsageAggregateGroupBy) => {
      setRankingGroup(group)
      setRankingDetailOpen(true)
      setRankingExpanded(false)
    },
    setRankingMetric: (metric: UsageAggregateMetric) => {
      setRankingMetric(metric)
      setRankingDetailOpen(true)
    },
    setRankingDetailOpen,
    setRankingExpanded,
    setRecordLimit,
    setRecordOffset,
    setCredentialUsageLimit,
    setCredentialUsageOffset,
    setCredentialUsageSort,
    selectRecord: setSelectedRecordId,
    clearSelectedRecord: () => setSelectedRecordId(null),
    exportUsageRecords: exportUsageMutation.mutateAsync,
    downloadRequestLogById: downloadRequestLogByIdMutation.mutateAsync,
    isExportingUsage: exportUsageMutation.isPending,
    downloadingRequestLogId: downloadRequestLogByIdMutation.variables?.requestId ?? null,
    isDownloadingRequestLog: downloadRequestLogByIdMutation.isPending,
    recordPageSizeOptions,
    credentialUsagePageSizeOptions,
    credentialUsageSort,
    mutating: exportUsageMutation.isPending || downloadRequestLogByIdMutation.isPending,
  }
}
