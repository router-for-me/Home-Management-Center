import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type ProxyPoolInput,
  type ProxyPoolItem,
  type ProxyPoolsApiError,
  createProxyPool,
  deleteProxyPool,
  fetchProxyPools,
  testProxyPool,
  toProxyPoolsApiError,
  updateProxyPool,
} from '@/lib/api/management/proxy-pools'
import { useSessionStore } from '@/stores/session-store'

function toError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function toProxyPoolsError(error: Error | null): ProxyPoolsApiError | null {
  if (!error) return null
  return error
}

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
    ready: status === 'connected' && Boolean(managementKey),
  }
}

export function useProxyPoolsWorkbench(enabled: boolean) {
  const queryClient = useQueryClient()
  const { session, connectedAt, ready } = useManagementSession()
  const queryKey = ['proxy-pools', session.baseUrl, connectedAt]

  const query = useQuery({
    queryKey,
    enabled: enabled && ready,
    queryFn: async () => {
      try {
        return await fetchProxyPools(session)
      } catch (error) {
        throw toProxyPoolsApiError(error)
      }
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['proxy-pools'] })

  const createMutation = useMutation({
    mutationFn: (input: ProxyPoolInput) => createProxyPool(session, input),
    onSuccess: () => {
      void invalidate()
    },
    onError: toError,
  })

  const updateMutation = useMutation({
    mutationFn: ({ resource, input }: { resource: ProxyPoolItem; input: ProxyPoolInput }) =>
      updateProxyPool(session, resource, input),
    onSuccess: () => {
      void invalidate()
    },
    onError: toError,
  })

  const deleteMutation = useMutation({
    mutationFn: (resource: ProxyPoolItem) => deleteProxyPool(session, resource),
    onSuccess: () => {
      void invalidate()
    },
    onError: toError,
  })

  const testMutation = useMutation({
    mutationFn: (resource: ProxyPoolItem) => testProxyPool(session, resource),
    onSuccess: () => {
      void invalidate()
    },
    onError: toError,
  })

  const error = toProxyPoolsError(query.error ? toError(query.error) : null)

  return {
    items: query.data?.items ?? [],
    fetchedAt: query.data?.fetchedAt ?? null,
    loading: query.isLoading,
    fetching: query.isFetching,
    errorMessage: error?.message ?? null,
    errorCode: error?.code,
    refetch: query.refetch,
    createProxyPool: createMutation.mutateAsync,
    updateProxyPool: updateMutation.mutateAsync,
    deleteProxyPool: deleteMutation.mutateAsync,
    testProxyPool: testMutation.mutateAsync,
    mutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      testMutation.isPending,
  }
}
