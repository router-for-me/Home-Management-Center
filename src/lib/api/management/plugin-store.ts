import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type PluginStorePlatform = {
  goos: string
  goarch: string
}

export type PluginStoreSource = {
  id: string
  name: string
  url: string
}

export type PluginStoreSourceError = {
  sourceId: string
  sourceName: string
  sourceUrl: string
  message: string
}

export type PluginStoreEntry = {
  storeId: string
  sourceId: string
  sourceName: string
  sourceUrl: string
  id: string
  name: string
  description: string
  author: string
  version: string
  repository: string
  installType: string
  authRequired: boolean
  platforms: PluginStorePlatform[]
  logo: string
  homepage: string
  license: string
  tags: string[]
  installed: boolean
  installedVersion: string
  path: string
  configured: boolean
  registered: boolean
  enabled: boolean
  effectiveEnabled: boolean
  updateAvailable: boolean
}

export type PluginStoreResponse = {
  fetchedAt: string
  pluginsEnabled: boolean
  pluginsDir: string
  sources: PluginStoreSource[]
  sourceErrors: PluginStoreSourceError[]
  plugins: PluginStoreEntry[]
}

export type PluginStoreInstallInput = {
  id: string
  sourceId?: string
  version?: string
}

type PluginStoreInstallResult = {
  status: string
  sourceId: string
  sourceName: string
  sourceUrl: string
  id: string
  version: string
  installType: string
  path: string
  pluginsEnabled: boolean
  restartRequired: boolean
}

type PluginStoreUninstallResult = {
  status: string
  id: string
  configuredRemoved: boolean
  targetNodeType: string
  restartRequired: boolean
  task: {
    id: number | null
    operation: string
    pluginId: string
    targetNodeType: string
  } | null
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

function readBoolean(record: UnknownRecord, key: string) {
  return record[key] === true
}

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
    : []
}

function normalizePlatform(value: unknown): PluginStorePlatform | null {
  const record = toRecord(value)
  const goos = readString(record, 'goos')
  const goarch = readString(record, 'goarch')

  if (!goos && !goarch) return null

  return {
    goos,
    goarch,
  }
}

function normalizeSource(value: unknown): PluginStoreSource | null {
  const record = toRecord(value)
  const id = readString(record, 'id')
  const url = readString(record, 'url')

  if (!id && !url) return null

  return {
    id,
    name: readString(record, 'name'),
    url,
  }
}

function normalizeSourceError(value: unknown): PluginStoreSourceError | null {
  const record = toRecord(value)
  const sourceId = readString(record, 'source_id')
  const sourceUrl = readString(record, 'source_url')
  const message = readString(record, 'message')

  if (!sourceId && !sourceUrl && !message) return null

  return {
    sourceId,
    sourceName: readString(record, 'source_name'),
    sourceUrl,
    message,
  }
}

function normalizePluginStoreEntry(value: unknown): PluginStoreEntry | null {
  const record = toRecord(value)
  const id = readString(record, 'id')
  if (!id) return null

  const sourceId = readString(record, 'source_id')
  const storeId = readString(record, 'store_id') || (sourceId ? `${sourceId}/${id}` : id)

  return {
    storeId,
    sourceId,
    sourceName: readString(record, 'source_name'),
    sourceUrl: readString(record, 'source_url'),
    id,
    name: readString(record, 'name'),
    description: readString(record, 'description'),
    author: readString(record, 'author'),
    version: readString(record, 'version'),
    repository: readString(record, 'repository'),
    installType: readString(record, 'install_type'),
    authRequired: readBoolean(record, 'auth_required'),
    platforms: Array.isArray(record.platforms)
      ? record.platforms.flatMap((item) => {
          const platform = normalizePlatform(item)
          return platform ? [platform] : []
        })
      : [],
    logo: readString(record, 'logo'),
    homepage: readString(record, 'homepage'),
    license: readString(record, 'license'),
    tags: readStringArray(record.tags),
    installed: readBoolean(record, 'installed'),
    installedVersion: readString(record, 'installed_version'),
    path: readString(record, 'path'),
    configured: readBoolean(record, 'configured'),
    registered: readBoolean(record, 'registered'),
    enabled: readBoolean(record, 'enabled'),
    effectiveEnabled: readBoolean(record, 'effective_enabled'),
    updateAvailable: readBoolean(record, 'update_available'),
  }
}

export function normalizePluginStoreResponse(value: unknown): PluginStoreResponse {
  const record = toRecord(value)

  return {
    fetchedAt: new Date().toISOString(),
    pluginsEnabled: readBoolean(record, 'plugins_enabled'),
    pluginsDir: readString(record, 'plugins_dir') || 'plugins',
    sources: Array.isArray(record.sources)
      ? record.sources.flatMap((item) => {
          const source = normalizeSource(item)
          return source ? [source] : []
        })
      : [],
    sourceErrors: Array.isArray(record.source_errors)
      ? record.source_errors.flatMap((item) => {
          const error = normalizeSourceError(item)
          return error ? [error] : []
        })
      : [],
    plugins: Array.isArray(record.plugins)
      ? record.plugins.flatMap((item) => {
          const plugin = normalizePluginStoreEntry(item)
          return plugin ? [plugin] : []
        })
      : [],
  }
}

function normalizeInstallResult(value: unknown): PluginStoreInstallResult {
  const record = toRecord(value)

  return {
    status: readString(record, 'status'),
    sourceId: readString(record, 'source_id'),
    sourceName: readString(record, 'source_name'),
    sourceUrl: readString(record, 'source_url'),
    id: readString(record, 'id'),
    version: readString(record, 'version'),
    installType: readString(record, 'install_type'),
    path: readString(record, 'path'),
    pluginsEnabled: readBoolean(record, 'plugins_enabled'),
    restartRequired: readBoolean(record, 'restart_required'),
  }
}

function normalizeUninstallResult(value: unknown): PluginStoreUninstallResult {
  const record = toRecord(value)
  const taskRecord = isRecord(record.task) ? record.task : null

  return {
    status: readString(record, 'status'),
    id: readString(record, 'id'),
    configuredRemoved: readBoolean(record, 'configured_removed'),
    targetNodeType: readString(record, 'target_node_type'),
    restartRequired: readBoolean(record, 'restart_required'),
    task: taskRecord
      ? {
          id: readNumber(taskRecord, 'id'),
          operation: readString(taskRecord, 'operation'),
          pluginId: readString(taskRecord, 'plugin_id'),
          targetNodeType: readString(taskRecord, 'target_node_type'),
        }
      : null,
  }
}

export async function fetchPluginStore(
  session: ManagementSessionInput,
): Promise<PluginStoreResponse> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/plugins/store')
  return normalizePluginStoreResponse(response.data)
}

export async function installPluginFromStore(
  session: ManagementSessionInput,
  input: PluginStoreInstallInput,
): Promise<PluginStoreInstallResult> {
  const client = createManagementClient(session)
  const sourceId = input.sourceId?.trim()
  const version = input.version?.trim()
  const params = new URLSearchParams()

  if (sourceId) params.set('source', sourceId)
  if (version) params.set('version', version)

  const response = await client.post<unknown>(
    `/plugins/store/${encodeURIComponent(input.id)}/install${params.size ? `?${params}` : ''}`,
    version ? { version } : undefined,
  )

  return normalizeInstallResult(response.data)
}

export async function uninstallPluginFromStore(
  session: ManagementSessionInput,
  id: string,
): Promise<PluginStoreUninstallResult> {
  const client = createManagementClient(session)
  const response = await client.post<unknown>(`/plugins/store/${encodeURIComponent(id)}/uninstall`)
  return normalizeUninstallResult(response.data)
}

export function toPluginStoreApiError(error: unknown): ManagementApiError {
  return toManagementApiError(error)
}
