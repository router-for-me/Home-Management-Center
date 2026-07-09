import { useMemo, useState } from 'react'

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { useManagementSession } from '@/features/observability/use-management-session'
import { downloadRequestLogById, toLogsApiError } from '@/lib/api/management/logs'
import type { CapabilityMap } from '@/lib/api/management/types'
import {
  type UsageAggregateGroupBy,
  type UsageAggregateMetric,
  type UsageAggregateSortState,
  type UsageFilters,
  type UsageLogIssue,
  defaultUsageAggregatesQuery,
  defaultUsageFilters,
  exportUsageRecords,
  fetchUsageAggregates,
  fetchUsageRecordDetail,
  fetchUsageSnapshot,
  toUsageApiError,
} from '@/lib/api/management/usage'

const recordPageSizeOptions = [25, 50, 100, 200]
const credentialUsagePageSizeOptions = [10, 20, 50, 100]
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
type UsageWorkbenchScope = 'usage' | 'diagnostics'

function getScopedUsageCapabilities(capabilities: CapabilityMap, scope: UsageWorkbenchScope) {
  if (scope === 'diagnostics') {
    return {
      ...capabilities,
      usageRecords: false,
      usageRecordDetails: false,
      usageAggregates: false,
      usageExport: false,
      oauthUsage: false,
    }
  }

  return {
    ...capabilities,
    usageProviderHealth: false,
    usageCredentialHealth: false,
    usageRealtime: false,
    requestLogIndex: false,
  }
}

function findUsageIssue(issues: UsageLogIssue[] | undefined, scope: UsageLogIssue['scope']) {
  return issues?.find((issue) => issue.scope === scope) ?? null
}

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

export function useUsageObservabilityWorkbench({
  scope = 'usage',
}: { scope?: UsageWorkbenchScope } = {}) {
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const scopedCapabilities = getScopedUsageCapabilities(capabilities, scope)
  const [filters, setFilters] = useState<UsageFilters>(defaultUsageFilters)
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
  const [credentialUsageLimit, setCredentialUsageLimitValue] = useState(20)
  const [credentialUsageOffset, setCredentialUsageOffsetValue] = useState(0)
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

  const usageQuery = useQuery({
    queryKey: [
      'management-usage-observability',
      scope,
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageOverview,
      scopedCapabilities.usageRecords,
      scopedCapabilities.usageAggregates,
      scopedCapabilities.usageProviderHealth,
      scopedCapabilities.usageCredentialHealth,
      scopedCapabilities.usageRealtime,
      scopedCapabilities.requestLogIndex,
      filters,
    ],
    enabled: connected && capabilityReady && Boolean(session.managementKey),
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async () => {
      try {
        return await fetchUsageSnapshot(session, scopedCapabilities, filters)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const rankingQuery = useQuery({
    queryKey: [
      'management-usage-aggregate-drilldown',
      scope,
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageAggregates,
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
      scope === 'usage' &&
      scopedCapabilities.usageAggregates,
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async () => {
      try {
        return await fetchUsageAggregates(session, aggregateFilters, {
          groupBy: rankingGroup,
          metric: rankingMetric,
          sortDirection: defaultUsageAggregatesQuery.sortDirection,
          limit: rankingLimit,
          offset: 0,
        })
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const credentialUsageQuery = useQuery({
    queryKey: [
      'management-usage-credential-aggregate',
      scope,
      session.baseUrl,
      connectedAt,
      scopedCapabilities.usageAggregates,
      aggregateFilters,
      credentialUsageSort,
      credentialUsageLimit,
      credentialUsageOffset,
    ],
    enabled:
      connected &&
      capabilityReady &&
      Boolean(session.managementKey) &&
      scope === 'usage' &&
      scopedCapabilities.usageAggregates,
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async () => {
      try {
        return await fetchUsageAggregates(session, aggregateFilters, {
          groupBy: 'credential',
          metric: credentialUsageSort?.metric ?? defaultUsageAggregatesQuery.metric,
          sortDirection:
            credentialUsageSort?.direction ?? defaultUsageAggregatesQuery.sortDirection,
          limit: credentialUsageLimit,
          offset: credentialUsageOffset,
        })
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const detailQuery = useQuery({
    queryKey: ['management-usage-record-detail', session.baseUrl, connectedAt, selectedRecordId],
    enabled:
      connected &&
      capabilityReady &&
      Boolean(session.managementKey) &&
      scope === 'usage' &&
      scopedCapabilities.usageRecordDetails &&
      Boolean(selectedRecordId),
    retry: false,
    queryFn: async () => {
      if (!selectedRecordId) throw new Error('Usage record is not selected')

      try {
        return await fetchUsageRecordDetail(session, selectedRecordId)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

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
      setCredentialUsageOffsetValue(0)
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
    setCredentialUsageLimitValue(nextLimit)
    setCredentialUsageOffsetValue(0)
  }

  const setCredentialUsageOffset = (nextOffset: number) => {
    setCredentialUsageOffsetValue(Math.max(0, nextOffset))
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
    setCredentialUsageOffsetValue(0)
  }

  const usageRecordsIssue = findUsageIssue(usageQuery.data?.issues, 'usageRecords')
  const usageAggregatesIssue = findUsageIssue(usageQuery.data?.issues, 'usageAggregates')
  const usageRecordsUnavailable =
    !scopedCapabilities.usageRecords || isUnsupportedIssue(usageRecordsIssue)
  const usageRecordsErrorMessage =
    usageQuery.data?.records || usageRecordsUnavailable
      ? null
      : (usageRecordsIssue?.message ?? null)
  const credentialUsage = credentialUsageQuery.data ?? usageQuery.data?.credentialUsage ?? null
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

  return {
    connected,
    checking,
    capabilityReady,
    capabilities: effectiveCapabilities,
    runtimeMode,
    filters,
    snapshot: usageQuery.data,
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
    isPending: usageQuery.isPending,
    isFetching: usageQuery.isFetching,
    isError: usageQuery.isError,
    errorMessage: usageQuery.error?.message ?? null,
    refetch: () => {
      void usageQuery.refetch()
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
