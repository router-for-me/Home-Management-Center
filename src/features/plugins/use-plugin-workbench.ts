import { useMemo, useState } from 'react'

import { useMutation, useQuery } from '@tanstack/react-query'

import {
  type PluginStatusFilter,
  matchesPluginStatusFilter,
} from '@/features/plugins/plugin-store-model'
import {
  type PluginConfigFieldDescriptor,
  type PluginConfigObject,
  type PluginConfigSaveInput,
  type PluginStoreEntry,
  type PluginStoreInstallInput,
  type PluginStoreResponse,
  fetchPluginConfig,
  fetchPluginConfigFields,
  fetchPluginStore,
  installPluginFromStore,
  savePluginConfig,
  toPluginStoreApiError,
  uninstallPluginFromStore,
  updatePluginEnabled,
} from '@/lib/api/management/plugin-store'
import {
  type SystemNodePluginReportSnapshot,
  fetchSystemNodePluginReports,
  toSystemNodesApiError,
} from '@/lib/api/management/system-nodes'
import type { ManagementApiError } from '@/lib/api/management/types'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

export type PluginPageVerdict =
  | 'ready'
  | 'unsupported'
  | 'storeError'
  | 'sourceDegraded'
  | 'globalDisabled'
  | 'rolloutFailed'
  | 'rolloutPending'
  | 'updatesAvailable'

type PluginWorkbenchSnapshot = {
  store: PluginStoreResponse
  nodeReports: SystemNodePluginReportSnapshot | null
  nodeReportError: ManagementApiError | null
}

type PluginWorkbenchStats = {
  available: number
  installed: number
  updates: number
  authRequired: number
  sourceErrors: number
  sources: number
}

const PLUGIN_POLL_TIMEOUT_MS = 15_000
const PLUGIN_POLL_INTERVAL_MS = 700

type ThrowableManagementApiError = Error & ManagementApiError

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)
  const capabilityStatus = useCapabilityStore((state) => state.status)
  const capabilities = useCapabilityStore((state) => state.capabilities)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)
  const probedAt = useCapabilityStore((state) => state.probedAt)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
    capabilityReady: capabilityStatus === 'ready',
    capabilities,
    runtimeMode,
    probedAt,
  }
}

function getPluginSearchText(plugin: PluginStoreEntry) {
  return [
    plugin.id,
    plugin.name,
    plugin.description,
    plugin.author,
    plugin.repository,
    plugin.sourceId,
    plugin.sourceName,
    plugin.sourceUrl,
    plugin.license,
    plugin.installType,
    ...plugin.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getPluginSourceFilterKey(plugin: Pick<PluginStoreEntry, 'sourceId' | 'sourceUrl'>) {
  return plugin.sourceId || plugin.sourceUrl
}

function hasRequiredNodeReportIssue(snapshot: SystemNodePluginReportSnapshot | null) {
  if (!snapshot?.pluginReportRequired) return false
  return snapshot.nodes.some((node) =>
    ['missing_report', 'reported_partial', 'reported_failed'].includes(node.pluginReportState),
  )
}

function hasFailedNodeReport(snapshot: SystemNodePluginReportSnapshot | null) {
  if (!snapshot?.pluginReportRequired) return false
  return snapshot.nodes.some((node) => node.pluginReportState === 'reported_failed')
}

function deriveVerdict(snapshot: PluginWorkbenchSnapshot | undefined): PluginPageVerdict {
  if (!snapshot) return 'storeError'

  if (snapshot.store.sourceErrors.length > 0) return 'sourceDegraded'
  if (!snapshot.store.pluginsEnabled) return 'globalDisabled'
  if (hasFailedNodeReport(snapshot.nodeReports)) return 'rolloutFailed'
  if (hasRequiredNodeReportIssue(snapshot.nodeReports)) return 'rolloutPending'
  if (snapshot.store.plugins.some((plugin) => plugin.installed && plugin.updateAvailable)) {
    return 'updatesAvailable'
  }
  return 'ready'
}

function getPluginStateKey(plugin: Pick<PluginStoreEntry, 'id' | 'sourceId' | 'sourceUrl'>) {
  return `${getPluginSourceFilterKey(plugin) || 'default'}:${plugin.id}`
}

function toThrowablePluginStoreError(error: unknown): ThrowableManagementApiError {
  const apiError = toPluginStoreApiError(error)
  const throwable = new Error(apiError.message) as ThrowableManagementApiError
  throwable.status = apiError.status
  throwable.code = apiError.code
  return throwable
}

async function fetchPluginWorkbenchSnapshot({
  session,
  topologyAvailable,
  nodesAvailable,
}: {
  session: ReturnType<typeof useManagementSession>['session']
  topologyAvailable: boolean
  nodesAvailable: boolean
}): Promise<PluginWorkbenchSnapshot> {
  const store = await fetchPluginStore(session)
  let nodeReports: SystemNodePluginReportSnapshot | null = null
  let nodeReportError: ManagementApiError | null = null

  if (topologyAvailable || nodesAvailable) {
    try {
      nodeReports = await fetchSystemNodePluginReports(session, {
        topology: topologyAvailable,
        nodes: nodesAvailable,
      })
    } catch (error) {
      nodeReportError = toSystemNodesApiError(error)
    }
  }

  return {
    store,
    nodeReports,
    nodeReportError,
  }
}

export function usePluginWorkbench() {
  const { session, connected, connectedAt, capabilityReady, capabilities, runtimeMode, probedAt } =
    useManagementSession()
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<PluginStatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  const query = useQuery<PluginWorkbenchSnapshot, ManagementApiError>({
    queryKey: [
      'management-plugin-workbench',
      session.baseUrl,
      connectedAt,
      capabilities.topology,
      capabilities.nodes,
    ],
    enabled: connected && capabilityReady && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchPluginWorkbenchSnapshot({
          session,
          topologyAvailable: capabilities.topology,
          nodesAvailable: capabilities.nodes,
        })
      } catch (error) {
        throw toThrowablePluginStoreError(error)
      }
    },
  })

  const installMutation = useMutation({
    mutationFn: async (input: PluginStoreInstallInput) => installPluginFromStore(session, input),
  })

  const uninstallMutation = useMutation({
    mutationFn: async (id: string) => uninstallPluginFromStore(session, id),
  })

  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      updatePluginEnabled(session, id, enabled),
  })

  const saveConfigMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PluginConfigSaveInput }) =>
      savePluginConfig(session, id, input),
  })

  const stats = useMemo<PluginWorkbenchStats>(() => {
    const store = query.data?.store
    const plugins = store?.plugins ?? []

    return {
      available: plugins.length,
      installed: plugins.filter((plugin) => plugin.installed).length,
      updates: plugins.filter((plugin) => plugin.installed && plugin.updateAvailable).length,
      authRequired: plugins.filter((plugin) => plugin.authRequired).length,
      sourceErrors: store?.sourceErrors.length ?? 0,
      sources: store?.sources.length ?? 0,
    }
  }, [query.data?.store])

  const visiblePlugins = useMemo(() => {
    const plugins = query.data?.store.plugins ?? []
    const normalizedFilter = filter.trim().toLowerCase()

    return plugins.filter((plugin) => {
      const sourceMatches =
        sourceFilter === 'all' || getPluginSourceFilterKey(plugin) === sourceFilter
      const statusMatches = matchesPluginStatusFilter(plugin, statusFilter)
      const textMatches =
        !normalizedFilter || getPluginSearchText(plugin).includes(normalizedFilter)

      return sourceMatches && statusMatches && textMatches
    })
  }, [filter, query.data?.store.plugins, sourceFilter, statusFilter])

  const waitForStoreState = async (
    plugin: PluginStoreEntry,
    predicate: (candidate: PluginStoreEntry, store: PluginStoreResponse) => boolean,
  ) => {
    const deadline = Date.now() + PLUGIN_POLL_TIMEOUT_MS
    let latest = await fetchPluginStore(session)
    const pluginSourceKey = getPluginSourceFilterKey(plugin)

    for (;;) {
      const candidate =
        latest.plugins.find(
          (item) =>
            item.id === plugin.id &&
            (!pluginSourceKey || getPluginSourceFilterKey(item) === pluginSourceKey),
        ) ?? null

      if (candidate && predicate(candidate, latest)) {
        return { store: latest, plugin: candidate, timedOut: false }
      }
      if (Date.now() >= deadline) {
        return { store: latest, plugin: candidate, timedOut: true }
      }

      await wait(Math.min(PLUGIN_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())))
      latest = await fetchPluginStore(session)
    }
  }

  const refetch = () => {
    void query.refetch()
  }

  return {
    connected,
    capabilityReady,
    capabilities,
    runtimeMode,
    probedAt,
    snapshot: query.data,
    verdict: query.isError
      ? query.error?.status === 404 || query.error?.status === 405
        ? 'unsupported'
        : 'storeError'
      : deriveVerdict(query.data),
    stats,
    visiblePlugins,
    filter,
    setFilter,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error ?? null,
    refetch,
    installPlugin: async (plugin: PluginStoreEntry, version?: string, sourceId?: string) => {
      const targetVersion = version?.trim()
      const result = await installMutation.mutateAsync({
        id: plugin.id,
        sourceId: sourceId?.trim() || plugin.sourceId || undefined,
        version: targetVersion || undefined,
      })
      const state = await waitForStoreState(
        plugin,
        (candidate) =>
          candidate.installed &&
          candidate.configured &&
          (!targetVersion ||
            candidate.installedVersion.replace(/^v/i, '') === targetVersion.replace(/^v/i, '')),
      )
      await query.refetch()
      return { result, state }
    },
    uninstallPlugin: async (plugin: PluginStoreEntry) => {
      const result = await uninstallMutation.mutateAsync(plugin.id)
      const state = await waitForStoreState(plugin, (candidate) => !candidate.installed)
      await query.refetch()
      return { result, state }
    },
    installingKey:
      installMutation.isPending && installMutation.variables
        ? getPluginStateKey(
            query.data?.store.plugins.find(
              (plugin) =>
                plugin.id === installMutation.variables?.id &&
                (!installMutation.variables?.sourceId ||
                  plugin.sourceId === installMutation.variables.sourceId),
            ) ?? {
              id: installMutation.variables.id,
              sourceId: installMutation.variables.sourceId ?? '',
              sourceUrl: '',
            },
          )
        : null,
    togglePluginEnabled: async (plugin: PluginStoreEntry, enabled: boolean) => {
      await toggleEnabledMutation.mutateAsync({ id: plugin.id, enabled })
      await query.refetch()
    },
    savePluginConfig: async (plugin: PluginStoreEntry, input: PluginConfigSaveInput) => {
      const updated = await saveConfigMutation.mutateAsync({ id: plugin.id, input })
      await query.refetch()
      return updated
    },
    togglingId:
      toggleEnabledMutation.isPending && toggleEnabledMutation.variables
        ? toggleEnabledMutation.variables.id
        : null,
    savingConfigId:
      saveConfigMutation.isPending && saveConfigMutation.variables
        ? saveConfigMutation.variables.id
        : null,
    uninstallingId:
      uninstallMutation.isPending && uninstallMutation.variables
        ? uninstallMutation.variables
        : null,
    getPluginStateKey,
  }
}

const EMPTY_PLUGIN_FIELDS: PluginConfigFieldDescriptor[] = []

export function usePluginConfig(pluginId: string | null, open: boolean) {
  const { session, connected, connectedAt } = useManagementSession()
  const query = useQuery<{
    config: PluginConfigObject
    fields: PluginConfigFieldDescriptor[]
  }>({
    queryKey: ['management-plugin-config', session.baseUrl, connectedAt, pluginId],
    enabled: connected && Boolean(session.managementKey) && open && Boolean(pluginId),
    queryFn: async () => {
      if (!pluginId) return { config: {}, fields: [] }
      const [config, fields] = await Promise.all([
        fetchPluginConfig(session, pluginId),
        fetchPluginConfigFields(session, pluginId),
      ])
      return { config, fields }
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  return {
    config: query.data?.config ?? null,
    fields: query.data?.fields ?? EMPTY_PLUGIN_FIELDS,
    isPending: query.isPending,
    isFetching: query.isFetching,
    sessionKey: JSON.stringify([session.baseUrl, connectedAt, pluginId]),
    errorMessage: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  }
}
