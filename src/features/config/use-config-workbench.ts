import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type ConfigChange,
  applyConfigChanges,
  fetchConfigSnapshot,
  toConfigApiError,
} from '@/lib/api/management/config'
import {
  type ProviderModelChannel,
  fetchProviderModelDefinitions,
} from '@/lib/api/management/providers'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

function toThrowableError(error: unknown) {
  const apiError = toConfigApiError(error)
  return apiError instanceof Error ? apiError : new Error(apiError.message)
}

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
    runtimeMode,
  }
}

export function useConfigWorkbench(modelDefinitionChannel?: ProviderModelChannel) {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt, runtimeMode } = useManagementSession()
  const queryKey = ['management-config', session.baseUrl, connectedAt]
  const modelDefinitionsQueryKey = [
    'management-config-model-definitions',
    session.baseUrl,
    connectedAt,
  ]

  const query = useQuery({
    queryKey,
    enabled: connected && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchConfigSnapshot(session)
      } catch (error) {
        throw toThrowableError(error)
      }
    },
  })

  const modelDefinitionsQuery = useQuery({
    queryKey: [...modelDefinitionsQueryKey, modelDefinitionChannel],
    enabled: connected && Boolean(session.managementKey) && Boolean(modelDefinitionChannel),
    queryFn: async () => {
      if (!modelDefinitionChannel) {
        throw new Error('Missing model definition channel')
      }

      try {
        return await fetchProviderModelDefinitions(session, modelDefinitionChannel)
      } catch (error) {
        throw toThrowableError(error)
      }
    },
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey })
  }

  const structuredMutation = useMutation({
    mutationFn: async (changes: ConfigChange[]) => {
      try {
        await applyConfigChanges(session, changes)
      } catch (error) {
        throw toThrowableError(error)
      }
    },
    onSuccess: invalidate,
  })

  return {
    connected,
    runtimeMode,
    snapshot: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
    saveStructured: structuredMutation.mutateAsync,
    refetchModelDefinitions: () => {
      void modelDefinitionsQuery.refetch()
    },
    modelDefinitions: modelDefinitionsQuery.data ?? null,
    modelDefinitionsErrorMessage: modelDefinitionsQuery.error?.message ?? null,
    isFetchingModelDefinitions: modelDefinitionsQuery.isFetching,
    mutating: structuredMutation.isPending,
  }
}
