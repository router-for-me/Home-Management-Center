import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type ApiCallInput,
  type SystemNodesSnapshot,
  createCertificateClient,
  fetchSystemNodesSnapshot,
  renameCpaNode,
  runManagementApiCall,
  toSystemNodesApiError,
} from '@/lib/api/management/system-nodes'
import type { CapabilityMap } from '@/lib/api/management/types'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

export type SystemNodesOperationalLevel = 'ready' | 'limited' | 'degraded' | 'unavailable'

export type SystemNodesOperationalStatus = {
  level: SystemNodesOperationalLevel
  issueCount: number
  configAvailable: boolean
  latestVersionAvailable: boolean
  nodesSupported: boolean
  nodeCount: number
}

function deriveSystemNodesOperationalStatus(
  snapshot: SystemNodesSnapshot | undefined,
  capabilities: CapabilityMap,
): SystemNodesOperationalStatus | null {
  if (!snapshot) return null

  const configAvailable = Boolean(snapshot.config)
  const latestVersionAvailable = Boolean(snapshot.homeVersion || snapshot.latestVersion)
  const issueCount = snapshot.issues.length
  const nodesSupported = capabilities.topology || capabilities.nodes
  const nodeCount = snapshot.nodes.length

  let level: SystemNodesOperationalLevel = 'ready'

  if (issueCount > 0 && !configAvailable && !latestVersionAvailable) {
    level = 'unavailable'
  } else if (issueCount > 0) {
    level = 'degraded'
  } else if (!nodesSupported) {
    level = 'limited'
  }

  return {
    level,
    issueCount,
    configAvailable,
    latestVersionAvailable,
    nodesSupported,
    nodeCount,
  }
}

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)
  const capabilityStatus = useCapabilityStore((state) => state.status)
  const capabilities = useCapabilityStore((state) => state.capabilities)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)
  const serverInfo = useCapabilityStore((state) => state.serverInfo)
  const probedAt = useCapabilityStore((state) => state.probedAt)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
    checking: status === 'checking',
    capabilityReady: capabilityStatus === 'ready',
    capabilities,
    runtimeMode,
    serverInfo,
    probedAt,
  }
}

export function useSystemNodesWorkbench() {
  const {
    session,
    connected,
    checking,
    connectedAt,
    capabilityReady,
    capabilities,
    runtimeMode,
    serverInfo,
    probedAt,
  } = useManagementSession()
  const queryClient = useQueryClient()
  const queryKey = [
    'management-system-nodes',
    session.baseUrl,
    connectedAt,
    capabilities.topology,
    capabilities.nodes,
  ]

  const query = useQuery({
    queryKey,
    enabled: connected && capabilityReady && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchSystemNodesSnapshot(session, capabilities)
      } catch (error) {
        throw toSystemNodesApiError(error)
      }
    },
  })

  const apiCallMutation = useMutation({
    mutationFn: async (input: ApiCallInput) => {
      try {
        return await runManagementApiCall(session, input)
      } catch (error) {
        throw toSystemNodesApiError(error)
      }
    },
  })

  const createNodeClientMutation = useMutation({
    mutationFn: async (nodeName?: string | null) => {
      try {
        return await createCertificateClient(session, nodeName)
      } catch (error) {
        // Decorate so the caller can localize cpa_node_name_invalid from the
        // optional node_name bound at POST /certificates/clients.
        throw toSystemNodesApiError(error)
      }
    },
    onSuccess: () => {
      // A named enrollment should show its name in the topology immediately.
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const renameNodeMutation = useMutation({
    mutationFn: async (input: { nodeId: string; nodeName: string | null }) => {
      try {
        return await renameCpaNode(session, input.nodeId, input.nodeName)
      } catch (error) {
        // Throw a decorated Error so the caller can localize the backend code
        // (cpa_node_name_invalid / cpa_node_not_found) from PATCH /nodes.
        throw toSystemNodesApiError(error)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    connected,
    checking,
    capabilityReady,
    capabilities,
    managementEndpoint: session.baseUrl,
    runtimeMode,
    serverInfo,
    probedAt,
    snapshot: query.data,
    operationalStatus: deriveSystemNodesOperationalStatus(query.data, capabilities),
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
    apiCallResult: apiCallMutation.data,
    apiCallError: apiCallMutation.error?.message ?? null,
    runApiCall: apiCallMutation.mutateAsync,
    apiCallPending: apiCallMutation.isPending,
    createNodeClient: createNodeClientMutation.mutateAsync,
    createNodeClientPending: createNodeClientMutation.isPending,
    renameNode: renameNodeMutation.mutateAsync,
    renameNodePending: renameNodeMutation.isPending,
  }
}
