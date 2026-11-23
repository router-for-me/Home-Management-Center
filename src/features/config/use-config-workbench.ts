import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type AntigravityPauseObservation,
  fetchAntigravityPauseStatus,
} from '@/lib/api/management/antigravity-pause-window'
import { toManagementApiError } from '@/lib/api/management/client'
import {
  type ConfigChange,
  ConfigFieldSaveError,
  applyConfigChanges,
  fetchConfigSnapshot,
  toConfigApiError,
} from '@/lib/api/management/config'
import {
  fetchProviderModelDefinitions,
  getProviderModelDefinitionChannels,
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
    checking: status === 'checking',
    runtimeMode,
  }
}

const pauseStatusKey = (baseUrl: string, connectedAt: string | null) =>
  ['management-antigravity-tos-pause', baseUrl, connectedAt] as const

const pausePollMs = 30_000

function pauseDuration(observation: AntigravityPauseObservation | null | undefined) {
  // Both timestamps come from Home, independently of the browser's wall clock.
  return observation?.resumeAt == null ? Infinity : observation.resumeAt - observation.observedAt
}

function pauseAccessStatus(error: unknown) {
  const status = error ? toManagementApiError(error).status : undefined
  return status === 401 || status === 403 ? status : undefined
}

export function useAntigravityPauseStatus() {
  const { session, connected, connectedAt } = useManagementSession()
  const supported = useCapabilityStore((state) => state.capabilities.antigravityTosPauseStatus)
  const enabled = connected && Boolean(session.managementKey) && supported
  const query = useQuery<AntigravityPauseObservation | null>({
    queryKey: pauseStatusKey(session.baseUrl, connectedAt),
    enabled: ({ state }) => enabled && !pauseAccessStatus(state.error),
    queryFn: ({ signal }) => fetchAntigravityPauseStatus(session, signal),
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchIntervalInBackground: false,
    // Keep confirmed data visible during routine polls, up to the deadline or a missed cycle.
    staleTime: ({ state }) => Math.min(pauseDuration(state.data), 2 * pausePollMs),
    refetchInterval: ({ state }) => {
      if (state.status === 'error') return pausePollMs
      if (state.data === null) return false
      return Math.max(1_000, Math.min(pausePollMs, pauseDuration(state.data)))
    },
  })
  return { enabled, query, accessStatus: pauseAccessStatus(query.error) }
}

export function useConfigWorkbench(oauthRuleChannel?: string) {
  const queryClient = useQueryClient()
  const { session, connected, checking, connectedAt, runtimeMode } = useManagementSession()
  const modelDefinitionChannel = getProviderModelDefinitionChannels(runtimeMode).find(
    (channel) => channel === oauthRuleChannel,
  )
  const queryKey = ['management-config', session.baseUrl, connectedAt]
  const modelDefinitionsQueryKey = [
    'management-config-model-definitions',
    session.baseUrl,
    connectedAt,
  ]

  const query = useQuery({
    queryKey,
    enabled: connected && Boolean(session.managementKey),
    retry: false,
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
    retry: false,
    queryFn: async () => {
      if (!modelDefinitionChannel) {
        throw new Error('Missing model definition channel')
      }

      try {
        return await fetchProviderModelDefinitions(session, modelDefinitionChannel)
      } catch (error) {
        const { status } = toManagementApiError(error)
        if (status === 400 || status === 404) return null
        throw toThrowableError(error)
      }
    },
  })

  const invalidate = async (keys: ConfigChange['key'][]) => {
    if (keys.includes('antigravityTosPauseWindow')) {
      void queryClient.invalidateQueries({ queryKey: pauseStatusKey(session.baseUrl, connectedAt) })
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ['management-dashboard-overview'] }),
    ])
  }

  const structuredMutation = useMutation({
    mutationFn: (changes: ConfigChange[]) => applyConfigChanges(session, changes),
    onError: async (error) => {
      if (
        error instanceof ConfigFieldSaveError &&
        (error.savedKeys.length || error.reason === 'conflict' || error.reason === 'failed')
      ) {
        await invalidate(error.savedKeys)
      }
    },
    onSuccess: (_, changes) => invalidate(changes.map((change) => change.key)),
  })

  return {
    connected,
    checking,
    runtimeMode,
    snapshot: query.data,
    getCachedSnapshot: () => queryClient.getQueryData<NonNullable<typeof query.data>>(queryKey),
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
    saveStructured: structuredMutation.mutateAsync,
    hasModelCatalog: Boolean(modelDefinitionChannel) && modelDefinitionsQuery.data !== null,
    refetchModelDefinitions: () => {
      void modelDefinitionsQuery.refetch()
    },
    modelDefinitions: modelDefinitionsQuery.data ?? null,
    modelDefinitionsErrorMessage: modelDefinitionsQuery.error?.message ?? null,
    isFetchingModelDefinitions: modelDefinitionsQuery.isFetching,
    mutating: structuredMutation.isPending,
  }
}
