import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type PluginStoreAuthCreateInput,
  type PluginStoreAuthRule,
  type PluginStoreAuthUpdateInput,
  createPluginStoreAuthRule,
  deletePluginStoreAuthRule,
  fetchPluginStoreAuthRule,
  fetchPluginStoreAuthRules,
  toPluginStoreAuthApiError,
  updatePluginStoreAuthRule,
} from '@/lib/api/management/plugin-store-auth'
import type { ManagementApiError } from '@/lib/api/management/types'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

type ThrowableManagementApiError = Error & ManagementApiError

function toThrowablePluginStoreAuthError(error: unknown): ThrowableManagementApiError {
  const apiError = toPluginStoreAuthApiError(error)
  const throwable = new Error(apiError.message) as ThrowableManagementApiError
  throwable.status = apiError.status
  throwable.code = apiError.code
  throwable.backendCode = apiError.backendCode
  throwable.requestId = apiError.requestId
  throwable.retryable = apiError.retryable
  throwable.fieldErrors = apiError.fieldErrors
  return throwable
}

async function runPluginStoreAuthRequest<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request()
  } catch (error) {
    throw toThrowablePluginStoreAuthError(error)
  }
}

export function usePluginStoreAuth(enabled: boolean) {
  const queryClient = useQueryClient()
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const connected = useSessionStore((state) => state.status === 'connected')
  const capabilityReady = useCapabilityStore((state) => state.status === 'ready')
  const session = { baseUrl, managementKey }

  const query = useQuery<PluginStoreAuthRule[], ThrowableManagementApiError>({
    queryKey: ['management-plugin-store-auth', baseUrl, connectedAt],
    enabled: enabled && connected && capabilityReady && Boolean(managementKey),
    queryFn: async () =>
      (await runPluginStoreAuthRequest(() => fetchPluginStoreAuthRules(session))).items,
    retry: (failureCount, error) =>
      error.status !== 404 && error.status !== 405 && failureCount < 1,
  })

  const refreshPluginStore = async () => {
    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ['management-plugin-workbench'] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: (input: PluginStoreAuthCreateInput) =>
      runPluginStoreAuthRequest(() => createPluginStoreAuthRule(session, input)),
    onSuccess: () => refreshPluginStore(),
  })

  const detailMutation = useMutation({
    mutationFn: (id: number) =>
      runPluginStoreAuthRequest(() => fetchPluginStoreAuthRule(session, id)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: PluginStoreAuthUpdateInput }) =>
      runPluginStoreAuthRequest(() => updatePluginStoreAuthRule(session, id, input)),
    onSuccess: () => refreshPluginStore(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      runPluginStoreAuthRequest(() => deletePluginStoreAuthRule(session, id)),
    onSuccess: () => refreshPluginStore(),
  })

  return {
    rules: query.data ?? [],
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    isUnsupported: query.error?.status === 404 || query.error?.status === 405,
    error: query.error ?? null,
    refetch: query.refetch,
    loadRule: detailMutation.mutateAsync,
    createRule: createMutation.mutateAsync,
    updateRule: (id: number, input: PluginStoreAuthUpdateInput) =>
      updateMutation.mutateAsync({ id, input }),
    deleteRule: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending,
    loadingRuleId: detailMutation.isPending ? (detailMutation.variables ?? null) : null,
    deletingId: deleteMutation.isPending ? (deleteMutation.variables ?? null) : null,
  }
}
