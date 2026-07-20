import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type CredentialInFlightRequest,
  type CredentialMetadataInput,
  type CredentialOAuthCallbackInput,
  type CredentialOAuthStartInput,
  type CredentialResource,
  type VertexImportInput,
  deleteCredentialResource,
  downloadCredentialResource,
  fetchCredentialInFlightDetail,
  fetchCredentialInFlightSummary,
  fetchCredentialModels,
  fetchCredentialOAuthStatus,
  fetchCredentialSnapshot,
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

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: inFlightQueryKey }),
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
  const { session, connected, connectedAt } = useManagementSession()
  const credentialInFlight = useCapabilityStore((state) => state.capabilities.credentialInFlight)
  const query = useInfiniteQuery({
    queryKey: [
      'management-credential-in-flight-detail',
      session.baseUrl,
      connectedAt,
      credentialId,
    ],
    enabled:
      connected &&
      Boolean(session.managementKey) &&
      credentialInFlight &&
      enabled &&
      Boolean(credentialId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchCredentialInFlightDetail(session, credentialId ?? '', pageParam)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: enabled && credentialInFlight ? 5_000 : false,
    refetchIntervalInBackground: false,
  })

  const pages = query.data?.pages ?? []
  const latestPage = pages.at(-1) ?? null
  const requests: CredentialInFlightRequest[] = []
  const seenLeaseIds = new Set<string>()
  for (const page of pages) {
    for (const request of page.requests) {
      if (seenLeaseIds.has(request.leaseId)) continue
      seenLeaseIds.add(request.leaseId)
      requests.push(request)
    }
  }
  return {
    detail:
      pages.length > 0 && latestPage
        ? {
            observedAt: latestPage.observedAt,
            credential: latestPage.credential,
            requests,
          }
        : null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isStale: query.isError && query.data !== undefined,
    errorMessage: query.error?.message ?? null,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  }
}
