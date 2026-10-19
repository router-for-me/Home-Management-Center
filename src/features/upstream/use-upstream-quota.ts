import { useEffect, useMemo, useState } from 'react'

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import { useManagementSession } from '@/features/observability/use-management-session'
import {
  type QuotaCollectResult,
  type QuotaCredential,
  fetchQuotaCredentialDetail,
  fetchQuotaSnapshot,
  toQuotaApiError,
  triggerQuotaCollection,
} from '@/lib/api/management/quota'

import {
  buildUpstreamQuotaJoinMap,
  createUpstreamQuotaCollectionBaseline,
  getUpstreamQuotaCollectionProgress,
  hasNewActiveProbeResult,
} from './upstream-quota-model'

const upstreamQuotaRefreshIntervalMs = 30_000
const upstreamQuotaCollectionPollIntervalMs = 1_000
const upstreamQuotaCollectionMaxPolls = 30
export const upstreamQuotaListLimit = 200

type UpstreamQuotaSyncResult = QuotaCollectResult & {
  completion: 'settled' | 'pending' | 'not-started'
}

type CredentialQuotaSyncResult = {
  completion: 'settled' | 'pending' | 'not-started'
  item: QuotaCredential | null
}

function waitForQuotaPoll(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => {
      window.clearTimeout(timer)
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('Quota polling cancelled', 'AbortError'),
      )
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, upstreamQuotaCollectionPollIntervalMs)
    signal.addEventListener('abort', abort, { once: true })
  })
}

function isSettledQuotaEntry(entry: QuotaCredential) {
  return ['success', 'partial', 'failed'].includes(entry.collectionStatus)
}

// A late list read must not replace a newer probe result from a detail read.
function compareQuotaEntries(left: QuotaCredential, right: QuotaCredential) {
  if (left.provider !== right.provider || left.credentialType !== right.credentialType) return 0
  const attempt = Date.parse(left.lastAttemptAt ?? '') - Date.parse(right.lastAttemptAt ?? '')
  if (Number.isFinite(attempt) && attempt !== 0) return attempt
  if (Boolean(left.lastAttemptAt) !== Boolean(right.lastAttemptAt))
    return left.lastAttemptAt ? 1 : -1
  if (left.lastAttemptAt === right.lastAttemptAt) {
    if (isSettledQuotaEntry(left) && right.collectionStatus === 'collecting') return 1
    if (isSettledQuotaEntry(right) && left.collectionStatus === 'collecting') return -1
  }
  return 0
}

export function useUpstreamQuota() {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt, capabilityReady, capabilities } = useManagementSession()
  const available = capabilities.quotaSnapshots
  const detailsAvailable = capabilities.quotaSnapshotDetails
  const canQuery = connected && capabilityReady && Boolean(session.managementKey) && available
  const scope = useMemo(
    () => ({ controller: new AbortController(), jobs: new Set<string>() }),
    [
      session.baseUrl,
      session.managementKey,
      connectedAt,
      canQuery,
      capabilities.quotaRecollect,
      detailsAvailable,
    ],
  )
  const [collecting, setCollecting] = useState({ scope, ids: new Set<string>() })
  const [tracked, setTracked] = useState({ scope, ids: [] as string[] })
  const detailKey = (id: string) =>
    ['upstream-quota-credential', session.baseUrl, connectedAt, id] as const

  useEffect(() => {
    const controller = new AbortController()
    scope.controller = controller
    setCollecting({ scope, ids: new Set() })
    return () => {
      controller.abort()
      for (const id of scope.jobs) {
        void queryClient.cancelQueries({
          queryKey: ['upstream-quota-credential', session.baseUrl, connectedAt, id],
          exact: true,
        })
      }
      scope.jobs.clear()
    }
  }, [scope, queryClient, session.baseUrl, connectedAt])

  const query = useQuery({
    queryKey: ['upstream-quota-snapshot', session.baseUrl, connectedAt],
    enabled: canQuery,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: canQuery ? upstreamQuotaRefreshIntervalMs : false,
    refetchIntervalInBackground: false,
    queryFn: async ({ signal }) => {
      try {
        return await fetchQuotaSnapshot(
          session,
          {
            limit: upstreamQuotaListLimit,
            offset: 0,
            sort: 'risk_desc',
          },
          signal,
        )
      } catch (error) {
        throw toQuotaApiError(error)
      }
    },
  })

  const listEntries = useMemo(() => query.data?.items ?? [], [query.data])
  const detailOptions = (id: string) => ({
    queryKey: detailKey(id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchQuotaCredentialDetail(session, id, signal),
    retry: false as const,
    staleTime: 0,
  })
  const details = useQueries({
    queries: (tracked.scope === scope ? tracked.ids : []).map((id) => ({
      ...detailOptions(id),
      // Rows outside the risk-sorted page still need ordinary refreshes after polling ends.
      enabled: canQuery && detailsAvailable && !listEntries.some((entry) => entry.id === id),
      refetchInterval: upstreamQuotaRefreshIntervalMs,
      refetchIntervalInBackground: false,
    })),
    combine: (results) => results.map(({ data, dataUpdatedAt }) => ({ data, dataUpdatedAt })),
  })
  const entries = useMemo(() => {
    const merged = new Map(
      listEntries.map((entry) => [entry.id, { entry, updatedAt: query.dataUpdatedAt }]),
    )
    for (const detail of details) {
      if (!detail.data) continue
      const previous = merged.get(detail.data.id)
      const order = previous ? compareQuotaEntries(detail.data, previous.entry) : 1
      if (!previous || order > 0 || (order === 0 && detail.dataUpdatedAt >= previous.updatedAt)) {
        merged.set(detail.data.id, { entry: detail.data, updatedAt: detail.dataUpdatedAt })
      }
    }
    return [...merged.values()].map(({ entry }) => entry)
  }, [listEntries, query.dataUpdatedAt, details])
  const map = useMemo(() => buildUpstreamQuotaJoinMap(entries), [entries])
  const total = query.data?.total ?? listEntries.length
  const truncated = total > listEntries.length

  return {
    available,
    detailsAvailable,
    capabilities,
    map,
    entries,
    total,
    truncated,
    collectingIds: collecting.scope === scope ? collecting.ids : new Set<string>(),
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
    syncCredentialQuota: async (
      credentialId: string,
      onQueued?: (result: QuotaCollectResult) => void,
    ): Promise<CredentialQuotaSyncResult | null> => {
      if (!canQuery || !capabilities.quotaRecollect || scope.jobs.has(credentialId)) return null
      const { signal } = scope.controller
      if (signal.aborted) return null
      scope.jobs.add(credentialId)
      setCollecting({ scope, ids: new Set(scope.jobs) })
      if (detailsAvailable) {
        setTracked((current) => ({
          scope,
          ids: [...new Set([...(current.scope === scope ? current.ids : []), credentialId])],
        }))
      }
      try {
        // Read a baseline before POST so cached results cannot masquerade as completion.
        const baseline = detailsAvailable
          ? await queryClient.fetchQuery(detailOptions(credentialId))
          : null
        signal.throwIfAborted()
        if (
          baseline &&
          (baseline.credentialStatus === 'disabled' ||
            baseline.credentialType === 'provider_api_key' ||
            baseline.status === 'unsupported' ||
            baseline.collectionStatus === 'unsupported')
        ) {
          return { completion: 'not-started', item: baseline }
        }
        const result = await triggerQuotaCollection(
          session,
          { credentialIds: [credentialId] },
          signal,
        )
        signal.throwIfAborted()
        onQueued?.(result)
        if (!detailsAvailable) {
          await query.refetch()
          signal.throwIfAborted()
          return { completion: result.accepted > 0 ? 'pending' : 'not-started', item: null }
        }
        for (let poll = 0; poll < upstreamQuotaCollectionMaxPolls; poll += 1) {
          if (poll > 0) await waitForQuotaPoll(signal)
          const item = await queryClient.fetchQuery(detailOptions(credentialId))
          signal.throwIfAborted()
          const settled =
            baseline &&
            (hasNewActiveProbeResult(item, baseline) ||
              (baseline.collectionStatus === 'collecting' &&
                item.lastAttemptAt === baseline.lastAttemptAt &&
                isSettledQuotaEntry(item)))
          if (settled) return { completion: 'settled', item }
          if (result.accepted === 0 && item.collectionStatus !== 'collecting')
            return { completion: 'not-started', item }
        }
        return { completion: 'pending', item: null }
      } catch (error) {
        if (signal.aborted) return null
        throw toQuotaApiError(error)
      } finally {
        if (!signal.aborted) {
          scope.jobs.delete(credentialId)
          setCollecting({ scope, ids: new Set(scope.jobs) })
        }
      }
    },
    syncQuota: async (
      onQueued?: (result: QuotaCollectResult) => void,
    ): Promise<UpstreamQuotaSyncResult | null> => {
      if (!canQuery || !capabilities.quotaRecollect) return null
      const { signal } = scope.controller
      try {
        signal.throwIfAborted()
        const baseline = createUpstreamQuotaCollectionBaseline(query.data?.items ?? [])
        const initialProgress = getUpstreamQuotaCollectionProgress(
          query.data?.items ?? [],
          baseline,
        )
        const result = await triggerQuotaCollection(session, {}, signal)
        signal.throwIfAborted()
        onQueued?.(result)
        if (result.accepted === 0) return { ...result, completion: 'not-started' }
        if (result.accepted > initialProgress.candidateCount)
          return { ...result, completion: 'pending' }
        for (let poll = 0; poll < upstreamQuotaCollectionMaxPolls; poll += 1) {
          await waitForQuotaPoll(signal)
          const [refreshed] = await Promise.all([
            query.refetch(),
            queryClient.refetchQueries({
              queryKey: ['upstream-quota-credential', session.baseUrl, connectedAt],
              type: 'active',
            }),
          ])
          signal.throwIfAborted()
          if (!refreshed.data) continue
          const progress = getUpstreamQuotaCollectionProgress(refreshed.data.items, baseline)
          if (progress.completedCount >= result.accepted)
            return { ...result, completion: 'settled' }
        }
        return { ...result, completion: 'pending' }
      } catch (error) {
        if (signal.aborted) return null
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
    refetchInterval: upstreamQuotaRefreshIntervalMs,
    refetchIntervalInBackground: false,
    queryFn: async ({ signal }) => {
      if (!credentialId) throw new Error('Credential ID is required')
      try {
        return await fetchQuotaCredentialDetail(session, credentialId, signal)
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
