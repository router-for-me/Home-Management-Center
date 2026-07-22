import { useMemo } from 'react'

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

import { useManagementSession } from '@/features/observability/use-management-session'
import {
  type QuotaCollectResult,
  fetchQuotaCredentialDetail,
  fetchQuotaSnapshot,
  toQuotaApiError,
  triggerQuotaCollection,
} from '@/lib/api/management/quota'

import {
  buildUpstreamQuotaJoinMap,
  createUpstreamQuotaCollectionBaseline,
  getUpstreamQuotaCollectionProgress,
  isQuotaAttentionStatus,
} from './upstream-quota-model'

const upstreamQuotaRefreshIntervalMs = 30_000
const upstreamQuotaCollectionPollIntervalMs = 1_000
const upstreamQuotaCollectionMaxPolls = 30
export const upstreamQuotaListLimit = 200

type UpstreamQuotaSyncResult = QuotaCollectResult & {
  completion: 'settled' | 'pending' | 'not-started'
}

function waitForQuotaPoll() {
  return new Promise<void>((resolve) =>
    window.setTimeout(resolve, upstreamQuotaCollectionPollIntervalMs),
  )
}

export function useUpstreamQuota() {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt, capabilityReady, capabilities } = useManagementSession()
  const available = capabilities.quotaSnapshots
  const detailsAvailable = capabilities.quotaSnapshotDetails
  const canQuery = connected && capabilityReady && Boolean(session.managementKey) && available

  const query = useQuery({
    queryKey: ['upstream-quota-snapshot', session.baseUrl, connectedAt],
    enabled: canQuery,
    retry: false,
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: canQuery ? upstreamQuotaRefreshIntervalMs : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchQuotaSnapshot(session, {
          limit: upstreamQuotaListLimit,
          offset: 0,
          sort: 'risk_desc',
        })
      } catch (error) {
        throw toQuotaApiError(error)
      }
    },
  })

  const entries = useMemo(() => query.data?.items ?? [], [query.data])
  const map = useMemo(() => buildUpstreamQuotaJoinMap(entries), [entries])
  const attentionCount = useMemo(
    () => entries.filter((entry) => isQuotaAttentionStatus(entry.status)).length,
    [entries],
  )
  const total = query.data?.total ?? entries.length
  const truncated = total > entries.length

  return {
    available,
    detailsAvailable,
    capabilities,
    map,
    entries,
    attentionCount,
    total,
    truncated,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
    syncQuota: async (
      onQueued?: (result: QuotaCollectResult) => void,
    ): Promise<UpstreamQuotaSyncResult | null> => {
      if (!capabilities.quotaRecollect) return null
      try {
        const baseline = createUpstreamQuotaCollectionBaseline(query.data?.items ?? [])
        const initialProgress = getUpstreamQuotaCollectionProgress(
          query.data?.items ?? [],
          baseline,
        )
        const result = await triggerQuotaCollection(session, {})
        onQueued?.(result)
        if (result.accepted === 0) {
          return { ...result, completion: 'not-started' }
        }
        const canConfirmAllAccepted = result.accepted <= initialProgress.candidateCount
        if (!canConfirmAllAccepted) {
          return { ...result, completion: 'pending' }
        }
        for (let poll = 0; poll < upstreamQuotaCollectionMaxPolls; poll += 1) {
          await waitForQuotaPoll()
          const [refreshed] = await Promise.all([
            query.refetch(),
            queryClient.refetchQueries({
              queryKey: ['upstream-quota-credential'],
              type: 'active',
            }),
          ])
          if (!refreshed.data) continue
          const progress = getUpstreamQuotaCollectionProgress(refreshed.data.items, baseline)
          if (canConfirmAllAccepted && progress.completedCount >= result.accepted) {
            return { ...result, completion: 'settled' }
          }
        }
        return { ...result, completion: 'pending' }
      } catch (error) {
        throw toQuotaApiError(error)
      }
    },
  }
}

export function useUpstreamQuotaCredentialDetail(credentialId: string | null) {
  const { session, connected, connectedAt, capabilityReady, capabilities } = useManagementSession()
  const available = capabilities.quotaSnapshotDetails

  const query = useQuery({
    queryKey: ['upstream-quota-credential', session.baseUrl, connectedAt, credentialId],
    enabled:
      Boolean(credentialId) &&
      connected &&
      capabilityReady &&
      Boolean(session.managementKey) &&
      available,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!credentialId) throw new Error('Credential ID is required')

      try {
        return await fetchQuotaCredentialDetail(session, credentialId)
      } catch (error) {
        throw toQuotaApiError(error)
      }
    },
  })

  return {
    available,
    item: query.data ?? null,
    isPending: available && query.isPending,
    isError: query.isError,
    error: query.error ?? null,
  }
}
