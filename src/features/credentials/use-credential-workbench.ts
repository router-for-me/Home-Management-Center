import { useEffect, useMemo } from 'react'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type CredentialInFlightDetail,
  type CredentialInFlightRequest,
  type CredentialMetadataInput,
  type CredentialOAuthCallbackInput,
  type CredentialOAuthStartInput,
  type CredentialResource,
  type VertexImportInput,
  deleteCredentialResource,
  downloadCredentialResource,
  fetchCredentialConcurrencyPolicy,
  fetchCredentialConcurrencySnapshot,
  fetchCredentialInFlightDetail,
  fetchCredentialInFlightSummary,
  fetchCredentialModels,
  fetchCredentialOAuthStatus,
  fetchCredentialSnapshot,
  getCredentialBindingAuthId,
  getCredentialOAuthProviders,
  importVertexCredential,
  startCredentialOAuth,
  submitCredentialOAuthCallback,
  toCredentialApiError,
  updateCredentialMetadata,
  updateCredentialStatus,
  uploadCredentialFile,
} from '@/lib/api/management/credentials'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
    checking: status === 'checking',
  }
}

function credentialConcurrencyPolicyQueryKey(
  baseUrl: string,
  connectedAt: string | null,
  credentialId?: string | null,
) {
  return [
    'management-credential-concurrency-policy',
    baseUrl,
    connectedAt,
    ...(credentialId ? [credentialId] : []),
  ]
}

function hasCredentialBackendCode(error: unknown, code: string) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'backendCode' in error &&
    String(error.backendCode) === code
  )
}

export function shouldResetCredentialInFlightPagination(error: unknown) {
  return hasCredentialBackendCode(error, 'in_flight_snapshot_cursor_expired')
}

export function shouldRetryCredentialInFlightPagination(failureCount: number, error: unknown) {
  if (failureCount >= 3 || error === null || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  const backendCode = typeof record.backendCode === 'string' ? record.backendCode : null
  if (
    backendCode === 'in_flight_snapshot_cursor_expired' ||
    backendCode === 'in_flight_snapshot_cursor_store_failed' ||
    backendCode === 'in_flight_snapshot_cursor_load_failed'
  ) {
    return false
  }
  const status = typeof record.status === 'number' ? record.status : null
  if (status !== null && status >= 400 && status < 500) return false
  if (record.code === 'network') return true
  return status !== null && status >= 500 && status < 600 && record.retryable === true
}

export function flattenCredentialInFlightRequests(pages: CredentialInFlightDetail[]) {
  return pages.flatMap((page) => page.requests)
}

export function useCredentialWorkbench() {
  const queryClient = useQueryClient()
  const { session, connected, checking, connectedAt } = useManagementSession()
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)
  const credentialInFlight = useCapabilityStore((state) => state.capabilities.credentialInFlight)
  const credentialConcurrencyLimits = useCapabilityStore(
    (state) => state.capabilities.credentialConcurrencyLimits,
  )
  const queryKey = ['management-credentials', session.baseUrl, connectedAt]

  const query = useQuery({
    queryKey,
    enabled: connected && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchCredentialSnapshot(session)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const inFlightQueryKey = ['management-credential-in-flight', session.baseUrl, connectedAt]
  const inFlightQuery = useQuery({
    queryKey: inFlightQueryKey,
    enabled: connected && Boolean(session.managementKey) && credentialInFlight,
    queryFn: async () => {
      try {
        return await fetchCredentialInFlightSummary(session)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    refetchInterval: credentialInFlight ? 5_000 : false,
    refetchIntervalInBackground: false,
  })

  const concurrencyQueryKey = ['management-credential-concurrency', session.baseUrl, connectedAt]
  const concurrencyQuery = useQuery({
    queryKey: concurrencyQueryKey,
    enabled: connected && Boolean(session.managementKey) && credentialConcurrencyLimits,
    queryFn: async () => {
      try {
        return await fetchCredentialConcurrencySnapshot(session)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    refetchInterval: credentialConcurrencyLimits ? 5_000 : false,
    refetchIntervalInBackground: false,
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: inFlightQueryKey }),
      queryClient.invalidateQueries({ queryKey: concurrencyQueryKey }),
      queryClient.invalidateQueries({
        queryKey: credentialConcurrencyPolicyQueryKey(session.baseUrl, connectedAt),
      }),
    ])
  }

  const statusMutation = useMutation({
    mutationFn: async ({
      resource,
      disabled,
    }: {
      resource: CredentialResource
      disabled: boolean
    }) => {
      try {
        return await updateCredentialStatus(session, resource, disabled)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const metadataMutation = useMutation({
    mutationFn: async ({
      resource,
      input,
    }: {
      resource: CredentialResource
      input: CredentialMetadataInput
    }) => {
      try {
        return await updateCredentialMetadata(session, resource, input)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
    onError: (error, { resource }) => {
      const backendCode =
        error && typeof error === 'object' && 'backendCode' in error
          ? String(error.backendCode)
          : null
      if (backendCode !== 'concurrency_policy_version_conflict') return
      void queryClient.invalidateQueries({
        queryKey: credentialConcurrencyPolicyQueryKey(
          session.baseUrl,
          connectedAt,
          getCredentialBindingAuthId(resource),
        ),
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (resource: CredentialResource) => {
      try {
        return await deleteCredentialResource(session, resource)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async ({
      resources,
      disabled,
    }: {
      resources: CredentialResource[]
      disabled: boolean
    }) => {
      try {
        await Promise.all(
          resources.map((resource) => updateCredentialStatus(session, resource, disabled)),
        )
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (resources: CredentialResource[]) => {
      try {
        await Promise.all(resources.map((resource) => deleteCredentialResource(session, resource)))
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const downloadMutation = useMutation({
    mutationFn: async (resource: CredentialResource) => {
      try {
        return await downloadCredentialResource(session, resource)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const modelsMutation = useMutation({
    mutationFn: async (resource: CredentialResource) => {
      try {
        return await fetchCredentialModels(session, resource)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const oauthMutation = useMutation({
    mutationFn: async (input: CredentialOAuthStartInput) => {
      try {
        return await startCredentialOAuth(session, input)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const oauthStatusMutation = useMutation({
    mutationFn: async (state?: string) => {
      try {
        return await fetchCredentialOAuthStatus(session, state)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const oauthCallbackMutation = useMutation({
    mutationFn: async (input: CredentialOAuthCallbackInput) => {
      try {
        return await submitCredentialOAuthCallback(session, input)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const vertexImportMutation = useMutation({
    mutationFn: async (input: VertexImportInput) => {
      try {
        return await importVertexCredential(session, input)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  return {
    connected,
    checking,
    credentialInFlight,
    credentialConcurrencyLimits,
    oauthProviders: getCredentialOAuthProviders(runtimeMode),
    snapshot: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    inFlightSnapshot: inFlightQuery.data ?? null,
    inFlightPending: inFlightQuery.isPending,
    concurrencySnapshot: concurrencyQuery.data ?? null,
    concurrencyPending: concurrencyQuery.isPending,
    concurrencyStale: concurrencyQuery.isError && concurrencyQuery.data !== undefined,
    concurrencyErrorMessage: concurrencyQuery.error?.message ?? null,
    inFlightStale: inFlightQuery.isError && inFlightQuery.data !== undefined,
    inFlightErrorMessage: inFlightQuery.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
    updateStatus: statusMutation.mutateAsync,
    updateMetadata: metadataMutation.mutateAsync,
    deleteCredential: deleteMutation.mutateAsync,
    bulkUpdateStatus: bulkStatusMutation.mutateAsync,
    bulkDeleteCredentials: bulkDeleteMutation.mutateAsync,
    uploadCredential: async (file: File, onProgress?: (progress: number) => void) => {
      try {
        return await uploadCredentialFile(session, file, onProgress)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    refreshCredentials: invalidate,
    downloadCredential: downloadMutation.mutateAsync,
    fetchModels: modelsMutation.mutateAsync,
    startOAuth: oauthMutation.mutateAsync,
    checkOAuthStatus: oauthStatusMutation.mutateAsync,
    submitOAuthCallback: oauthCallbackMutation.mutateAsync,
    importVertexCredential: vertexImportMutation.mutateAsync,
    models: modelsMutation.data ?? null,
    oauthResult: oauthMutation.data ?? null,
    oauthStatus: oauthStatusMutation.data ?? null,
    vertexImportResult: vertexImportMutation.data ?? null,
    mutating:
      statusMutation.isPending ||
      metadataMutation.isPending ||
      deleteMutation.isPending ||
      bulkStatusMutation.isPending ||
      bulkDeleteMutation.isPending ||
      downloadMutation.isPending ||
      modelsMutation.isPending ||
      oauthMutation.isPending ||
      oauthStatusMutation.isPending ||
      oauthCallbackMutation.isPending ||
      vertexImportMutation.isPending,
  }
}

export function useCredentialInFlightDetail(credentialId: string | null, enabled: boolean) {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt } = useManagementSession()
  const credentialInFlight = useCapabilityStore((state) => state.capabilities.credentialInFlight)
  const credentialInFlightSnapshotCursor = useCapabilityStore(
    (state) => state.capabilities.credentialInFlightSnapshotCursor,
  )
  const queryKey = useMemo(
    () => [
      'management-credential-in-flight-detail',
      session.baseUrl,
      connectedAt,
      credentialId,
      credentialInFlightSnapshotCursor,
    ],
    [connectedAt, credentialId, credentialInFlightSnapshotCursor, session.baseUrl],
  )
  const query = useInfiniteQuery({
    queryKey,
    enabled:
      connected &&
      Boolean(session.managementKey) &&
      credentialInFlight &&
      enabled &&
      Boolean(credentialId),
    initialPageParam: {
      offset: 0,
      snapshotCursor: null as string | null,
      expectedTotal: null as number | null,
      expectedSnapshotExpiresAt: null as string | null,
    },
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchCredentialInFlightDetail(session, credentialId ?? '', {
          offset: pageParam.offset,
          stableSnapshot: credentialInFlightSnapshotCursor && pageParam.snapshotCursor === null,
          snapshotCursor: pageParam.snapshotCursor,
          expectedTotal: pageParam.expectedTotal,
          expectedSnapshotExpiresAt: pageParam.expectedSnapshotExpiresAt,
        })
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    getNextPageParam: (lastPage) =>
      lastPage.nextOffset === null
        ? undefined
        : {
            offset: lastPage.nextOffset,
            snapshotCursor: lastPage.snapshotCursor,
            expectedTotal: lastPage.total,
            expectedSnapshotExpiresAt: lastPage.snapshotExpiresAt,
          },
    retry: (failureCount, error) => shouldRetryCredentialInFlightPagination(failureCount, error),
    refetchInterval: (currentQuery) => {
      if (!enabled || !credentialInFlight) return false
      const pages = currentQuery.state.data?.pages ?? []
      return pages.some((page) => page.snapshotCursor !== null) ? false : 5_000
    },
    refetchIntervalInBackground: false,
  })

  const cursorExpired = shouldResetCredentialInFlightPagination(query.error)
  useEffect(() => {
    if (!cursorExpired) return
    void queryClient.resetQueries({ queryKey, exact: true })
  }, [cursorExpired, queryClient, queryKey])

  const pages = query.data?.pages ?? []
  const latestPage = pages.at(-1) ?? null
  const requests: CredentialInFlightRequest[] = flattenCredentialInFlightRequests(pages)
  return {
    detail:
      pages.length > 0 && latestPage
        ? {
            ...latestPage,
            requests,
            paginationLimited: pages.some((page) => page.paginationLimited),
          }
        : null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isStale: !cursorExpired && query.isError && query.data !== undefined,
    errorMessage: cursorExpired ? null : (query.error?.message ?? null),
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refresh: () => queryClient.resetQueries({ queryKey, exact: true }),
  }
}

export function useCredentialConcurrencyPolicy(credentialId: string | null, enabled: boolean) {
  const { session, connected, connectedAt } = useManagementSession()
  const credentialConcurrencyLimits = useCapabilityStore(
    (state) => state.capabilities.credentialConcurrencyLimits,
  )
  const query = useQuery({
    queryKey: credentialConcurrencyPolicyQueryKey(session.baseUrl, connectedAt, credentialId),
    enabled:
      connected &&
      Boolean(session.managementKey) &&
      credentialConcurrencyLimits &&
      enabled &&
      Boolean(credentialId),
    queryFn: async () => {
      try {
        return await fetchCredentialConcurrencyPolicy(session, credentialId ?? '')
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  return {
    policy: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    errorMessage: query.error?.message ?? null,
    refetch: query.refetch,
  }
}
