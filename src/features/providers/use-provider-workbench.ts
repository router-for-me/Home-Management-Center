import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toManagementApiError } from '@/lib/api/management/client'
import {
  type ProviderConnectivityTestInput,
  type ProviderDiscoveredModel,
  type ProviderEntryFormInput,
  type ProviderId,
  type ProviderModelChannel,
  type ProviderModelDiscoveryInput,
  type ProviderResource,
  createProviderResource,
  deleteProviderResource,
  fetchProviderDiscoveredModels,
  fetchProviderModelDefinitions,
  fetchProviderSnapshot,
  testProviderConnectivity,
  updateProviderResource,
} from '@/lib/api/management/providers'
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
  }
}

function toError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}

export function useProviderWorkbench(modelDefinitionChannel?: ProviderModelChannel) {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt } = useManagementSession()
  const queryKey = ['management-providers', session.baseUrl, connectedAt]
  const modelDefinitionsQueryKey = [
    'management-provider-model-definitions',
    session.baseUrl,
    connectedAt,
  ]

  const query = useQuery({
    queryKey,
    enabled: connected && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchProviderSnapshot(session)
      } catch (error) {
        throw toError(error)
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
        throw toError(error)
      }
    },
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey })
  }

  const createMutation = useMutation({
    mutationFn: async ({
      providerId,
      input,
    }: {
      providerId: ProviderId
      input: ProviderEntryFormInput
    }) => {
      try {
        return await createProviderResource(session, providerId, input)
      } catch (error) {
        throw toError(error)
      }
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      resource,
      input,
    }: {
      resource: ProviderResource
      input: ProviderEntryFormInput
    }) => {
      try {
        return await updateProviderResource(session, resource, input)
      } catch (error) {
        throw toError(error)
      }
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: async (resource: ProviderResource) => {
      try {
        return await deleteProviderResource(session, resource)
      } catch (error) {
        throw toError(error)
      }
    },
    onSuccess: invalidate,
  })

  const discoverModelsMutation = useMutation({
    mutationFn: async (input: ProviderModelDiscoveryInput): Promise<ProviderDiscoveredModel[]> => {
      try {
        return await fetchProviderDiscoveredModels(session, input)
      } catch (error) {
        throw toError(error)
      }
    },
  })

  const testProviderModelMutation = useMutation({
    mutationFn: async (input: ProviderConnectivityTestInput): Promise<void> => {
      try {
        await testProviderConnectivity(session, input)
      } catch (error) {
        throw toError(error)
      }
    },
  })

  return {
    connected,
    snapshot: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
    createProvider: createMutation.mutateAsync,
    updateProvider: updateMutation.mutateAsync,
    deleteProvider: deleteMutation.mutateAsync,
    discoverProviderModels: discoverModelsMutation.mutateAsync,
    testProviderModel: testProviderModelMutation.mutateAsync,
    refetchModelDefinitions: () => {
      void modelDefinitionsQuery.refetch()
    },
    modelDefinitions: modelDefinitionsQuery.data ?? null,
    modelDefinitionsErrorMessage: modelDefinitionsQuery.error?.message ?? null,
    isFetchingModelDefinitions: modelDefinitionsQuery.isFetching,
    isDiscoveringProviderModels: discoverModelsMutation.isPending,
    isTestingProviderModel: testProviderModelMutation.isPending,
    mutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  }
}
