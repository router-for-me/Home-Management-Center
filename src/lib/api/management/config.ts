import { Document, isMap, isScalar, parseDocument, parse as parseYaml } from 'yaml'
import type { Scalar } from 'yaml'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type ConfigMode = 'structured' | 'yaml'

export type ConfigFieldKey =
  | 'debug'
  | 'loggingToFile'
  | 'logsMaxTotalSizeMb'
  | 'errorLogsMaxFiles'
  | 'usageStatisticsEnabled'
  | 'tlsEnable'
  | 'tlsCert'
  | 'tlsKey'
  | 'remoteManagementAllowRemote'
  | 'remoteManagementSecretKey'
  | 'remoteManagementDisableControlPanel'
  | 'remoteManagementDisableAutoUpdatePanel'
  | 'remoteManagementPanelGithubRepository'
  | 'proxyUrl'
  | 'requestLog'
  | 'wsAuth'
  | 'requestRetry'
  | 'maxRetryInterval'
  | 'forceModelPrefix'
  | 'routingStrategy'
  | 'quotaSwitchProject'
  | 'quotaSwitchPreviewModel'
  | 'ampcodeUpstreamUrl'
  | 'ampcodeUpstreamApiKey'
  | 'ampcodeRestrictManagementToLocalhost'
  | 'ampcodeForceModelMappings'
  | 'ampcodeModelMappingsJson'
  | 'ampcodeUpstreamApiKeysJson'
  | 'oauthExcludedModelsJson'
  | 'oauthModelAliasJson'

export type ConfigStructuredValues = Record<ConfigFieldKey, boolean | number | string>

export type ConfigChange = {
  key: ConfigFieldKey
  previousValue: boolean | number | string
  nextValue: boolean | number | string
}

type ConfigSnapshot = {
  fetchedAt: string
  rawConfig: UnknownRecord
  structured: ConfigStructuredValues
  yaml: string
  issues: Array<{
    scope: 'config' | 'yaml' | 'ampcode' | 'oauthRules'
    message: string
    status?: number
    code?: ManagementApiError['code']
  }>
}

type YamlDocument = ReturnType<typeof parseDocument>
type YamlPath = string[]
type YamlScalar = Scalar<unknown> & { range: [number, number, number] }
type YamlTextPatch = {
  start: number
  end: number
  value: string
}

const yamlBackedConfigKeys = new Set<ConfigFieldKey>([
  'tlsEnable',
  'tlsCert',
  'tlsKey',
  'remoteManagementAllowRemote',
  'remoteManagementSecretKey',
  'remoteManagementDisableControlPanel',
  'remoteManagementDisableAutoUpdatePanel',
  'remoteManagementPanelGithubRepository',
])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readBoolean(record: UnknownRecord, key: string, fallback = false) {
  return typeof record[key] === 'boolean' ? record[key] : fallback
}

function readNumber(record: UnknownRecord, key: string, fallback = 0) {
  return typeof record[key] === 'number' && Number.isFinite(record[key]) ? record[key] : fallback
}

function readString(record: UnknownRecord, key: string, fallback = '') {
  return typeof record[key] === 'string' ? record[key] : fallback
}

function docHas(doc: YamlDocument, path: YamlPath) {
  return doc.hasIn(path)
}

function ensureMapInDoc(doc: YamlDocument, path: YamlPath) {
  const existing: unknown = doc.getIn(path, true)
  if (isMap(existing)) return
  doc.setIn(path, doc.createNode({}))
}

function deleteIfMapEmpty(doc: YamlDocument, path: YamlPath) {
  const value: unknown = doc.getIn(path, true)
  if (!isMap(value)) return
  if (value.items.length === 0) doc.deleteIn(path)
}

function setBooleanInDoc(doc: YamlDocument, path: YamlPath, value: boolean) {
  doc.setIn(path, value)
}

function setStringInDoc(doc: YamlDocument, path: YamlPath, value: unknown) {
  const safe = typeof value === 'string' ? value : ''
  doc.setIn(path, safe)
}

function stringifyInlineYamlScalar(value: boolean | string) {
  const doc = new Document({ value })
  const serialized = doc.toString().trim()
  const prefix = 'value: '

  if (!serialized.startsWith(prefix)) return ''

  return serialized.slice(prefix.length)
}

function getExistingScalar(doc: YamlDocument, path: YamlPath): YamlScalar | null {
  const node: unknown = doc.getIn(path, true)

  if (!isScalar(node) || !node.range) return null

  return node as YamlScalar
}

function createExistingYamlScalarPatch(
  doc: YamlDocument,
  path: YamlPath,
  value: boolean | string,
): YamlTextPatch | null {
  const node = getExistingScalar(doc, path)
  if (!node) return null

  const nextValue = stringifyInlineYamlScalar(value)
  if (!nextValue || nextValue.includes('\n')) return null

  return {
    start: node.range[0],
    end: node.range[1],
    value: nextValue,
  }
}

function parseJsonText(value: string): unknown {
  return JSON.parse(value) as unknown
}

function stringifyJsonArray(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2)
}

function stringifyJsonObject(value: unknown) {
  return JSON.stringify(isRecord(value) ? value : {}, null, 2)
}

function parseJsonArrayText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return []
  const parsed = parseJsonText(value)

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array')
  }

  return parsed as unknown[]
}

function parseJsonObjectText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return {}
  const parsed = parseJsonText(value)

  if (!isRecord(parsed)) {
    throw new Error('Expected a JSON object')
  }

  return parsed
}

function readYamlBackedConfig(yaml: string): UnknownRecord {
  if (!yaml.trim()) return {}

  const parsedRaw = parseYaml(yaml) as unknown
  const parsed = toRecord(parsedRaw)
  const tls = toRecord(parsed.tls)
  const remoteManagement = toRecord(parsed['remote-management'])

  return {
    tls: {
      enable: readBoolean(tls, 'enable'),
      cert: readString(tls, 'cert'),
      key: readString(tls, 'key'),
    },
    'remote-management': {
      'allow-remote': readBoolean(remoteManagement, 'allow-remote'),
      'secret-key': readString(remoteManagement, 'secret-key'),
      'disable-control-panel': readBoolean(remoteManagement, 'disable-control-panel'),
      'disable-auto-update-panel': readBoolean(remoteManagement, 'disable-auto-update-panel'),
      'panel-github-repository':
        readString(remoteManagement, 'panel-github-repository') ||
        readString(remoteManagement, 'panel-repo'),
    },
  }
}

function patchYamlBackedConfig(yaml: string, changes: ConfigChange[]) {
  const doc = parseDocument(yaml || '{}', { keepSourceTokens: true })

  if (doc.errors.length > 0) {
    throw new Error(doc.errors[0]?.message ?? 'Invalid YAML')
  }

  const minimallyPatchedYaml = patchYamlBackedConfigText(yaml, doc, changes)
  if (minimallyPatchedYaml !== null) return minimallyPatchedYaml

  if (!isMap(doc.contents)) {
    doc.contents = doc.createNode({}) as unknown as typeof doc.contents
  }

  for (const change of changes) {
    switch (change.key) {
      case 'tlsEnable':
        ensureMapInDoc(doc, ['tls'])
        setBooleanInDoc(doc, ['tls', 'enable'], Boolean(change.nextValue))
        break
      case 'tlsCert':
        ensureMapInDoc(doc, ['tls'])
        setStringInDoc(doc, ['tls', 'cert'], change.nextValue)
        break
      case 'tlsKey':
        ensureMapInDoc(doc, ['tls'])
        setStringInDoc(doc, ['tls', 'key'], change.nextValue)
        break
      case 'remoteManagementAllowRemote':
        ensureMapInDoc(doc, ['remote-management'])
        setBooleanInDoc(doc, ['remote-management', 'allow-remote'], Boolean(change.nextValue))
        break
      case 'remoteManagementSecretKey':
        ensureMapInDoc(doc, ['remote-management'])
        setStringInDoc(doc, ['remote-management', 'secret-key'], change.nextValue)
        break
      case 'remoteManagementDisableControlPanel':
        ensureMapInDoc(doc, ['remote-management'])
        setBooleanInDoc(
          doc,
          ['remote-management', 'disable-control-panel'],
          Boolean(change.nextValue),
        )
        break
      case 'remoteManagementDisableAutoUpdatePanel':
        ensureMapInDoc(doc, ['remote-management'])
        setBooleanInDoc(
          doc,
          ['remote-management', 'disable-auto-update-panel'],
          Boolean(change.nextValue),
        )
        break
      case 'remoteManagementPanelGithubRepository':
        ensureMapInDoc(doc, ['remote-management'])
        setStringInDoc(doc, ['remote-management', 'panel-github-repository'], change.nextValue)
        if (docHas(doc, ['remote-management', 'panel-repo'])) {
          doc.deleteIn(['remote-management', 'panel-repo'])
        }
        break
      default:
        break
    }
  }

  deleteIfMapEmpty(doc, ['tls'])
  deleteIfMapEmpty(doc, ['remote-management'])

  return doc.toString()
}

function patchYamlBackedConfigText(yaml: string, doc: YamlDocument, changes: ConfigChange[]) {
  const patches: YamlTextPatch[] = []

  for (const change of changes) {
    const patch = createYamlBackedChangeTextPatch(doc, change)
    if (patch === null) return null

    patches.push(patch)
  }

  let nextYaml = yaml

  for (const patch of patches.sort((left, right) => right.start - left.start)) {
    nextYaml = `${nextYaml.slice(0, patch.start)}${patch.value}${nextYaml.slice(patch.end)}`
  }

  return nextYaml
}

function createYamlBackedChangeTextPatch(
  doc: YamlDocument,
  change: ConfigChange,
): YamlTextPatch | null {
  switch (change.key) {
    case 'tlsEnable':
      return createExistingYamlScalarPatch(doc, ['tls', 'enable'], Boolean(change.nextValue))
    case 'tlsCert':
      return createExistingYamlScalarPatch(doc, ['tls', 'cert'], String(change.nextValue))
    case 'tlsKey':
      return createExistingYamlScalarPatch(doc, ['tls', 'key'], String(change.nextValue))
    case 'remoteManagementAllowRemote':
      return createExistingYamlScalarPatch(
        doc,
        ['remote-management', 'allow-remote'],
        Boolean(change.nextValue),
      )
    case 'remoteManagementSecretKey':
      return createExistingYamlScalarPatch(
        doc,
        ['remote-management', 'secret-key'],
        String(change.nextValue),
      )
    case 'remoteManagementDisableControlPanel':
      return createExistingYamlScalarPatch(
        doc,
        ['remote-management', 'disable-control-panel'],
        Boolean(change.nextValue),
      )
    case 'remoteManagementDisableAutoUpdatePanel':
      return createExistingYamlScalarPatch(
        doc,
        ['remote-management', 'disable-auto-update-panel'],
        Boolean(change.nextValue),
      )
    case 'remoteManagementPanelGithubRepository':
      if (docHas(doc, ['remote-management', 'panel-repo'])) return null
      return createExistingYamlScalarPatch(
        doc,
        ['remote-management', 'panel-github-repository'],
        String(change.nextValue),
      )
    default:
      return null
  }
}

function normalizeConfigValues(rawConfig: UnknownRecord): ConfigStructuredValues {
  const routing = toRecord(rawConfig.routing)
  const quotaExceeded = toRecord(rawConfig['quota-exceeded'])
  const tls = toRecord(rawConfig.tls)
  const remoteManagement = toRecord(rawConfig['remote-management'])
  const ampcode = toRecord(rawConfig.ampcode)
  const oauthExcludedModels = toRecord(rawConfig['oauth-excluded-models'])
  const oauthModelAlias = toRecord(rawConfig['oauth-model-alias'])

  return {
    debug: readBoolean(rawConfig, 'debug'),
    loggingToFile: readBoolean(rawConfig, 'logging-to-file'),
    logsMaxTotalSizeMb: readNumber(rawConfig, 'logs-max-total-size-mb'),
    errorLogsMaxFiles: readNumber(rawConfig, 'error-logs-max-files', 10),
    usageStatisticsEnabled: readBoolean(rawConfig, 'usage-statistics-enabled'),
    tlsEnable: readBoolean(tls, 'enable'),
    tlsCert: readString(tls, 'cert'),
    tlsKey: readString(tls, 'key'),
    remoteManagementAllowRemote: readBoolean(remoteManagement, 'allow-remote'),
    remoteManagementSecretKey: readString(remoteManagement, 'secret-key'),
    remoteManagementDisableControlPanel: readBoolean(remoteManagement, 'disable-control-panel'),
    remoteManagementDisableAutoUpdatePanel: readBoolean(
      remoteManagement,
      'disable-auto-update-panel',
    ),
    remoteManagementPanelGithubRepository: readString(remoteManagement, 'panel-github-repository'),
    proxyUrl: readString(rawConfig, 'proxy-url'),
    requestLog: readBoolean(rawConfig, 'request-log'),
    wsAuth: readBoolean(rawConfig, 'ws-auth'),
    requestRetry: readNumber(rawConfig, 'request-retry'),
    maxRetryInterval: readNumber(rawConfig, 'max-retry-interval'),
    forceModelPrefix: readBoolean(rawConfig, 'force-model-prefix'),
    routingStrategy: readString(routing, 'strategy', 'round-robin'),
    quotaSwitchProject: readBoolean(quotaExceeded, 'switch-project'),
    quotaSwitchPreviewModel: readBoolean(quotaExceeded, 'switch-preview-model'),
    ampcodeUpstreamUrl: readString(ampcode, 'upstream-url'),
    ampcodeUpstreamApiKey: readString(ampcode, 'upstream-api-key'),
    ampcodeRestrictManagementToLocalhost: readBoolean(ampcode, 'restrict-management-to-localhost'),
    ampcodeForceModelMappings: readBoolean(ampcode, 'force-model-mappings'),
    ampcodeModelMappingsJson: stringifyJsonArray(ampcode['model-mappings']),
    ampcodeUpstreamApiKeysJson: stringifyJsonArray(ampcode['upstream-api-keys']),
    oauthExcludedModelsJson: stringifyJsonObject(oauthExcludedModels),
    oauthModelAliasJson: stringifyJsonObject(oauthModelAlias),
  }
}

function normalizeIssue(scope: ConfigSnapshot['issues'][number]['scope'], error: unknown) {
  const apiError = toManagementApiError(error)

  return {
    scope,
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
  }
}

function normalizeYamlResponse(data: unknown) {
  if (typeof data === 'string') return data
  if (data === null || data === undefined) return ''
  return JSON.stringify(data)
}

function toThrowableManagementError(error: unknown) {
  const apiError = toManagementApiError(error)
  const throwable = new Error(apiError.message)
  throwable.name = apiError.code ?? 'ManagementApiError'
  return throwable
}

export async function fetchConfigSnapshot(
  session: ManagementSessionInput,
): Promise<ConfigSnapshot> {
  const client = createManagementClient(session)
  const issues: ConfigSnapshot['issues'] = []
  let rawConfig: UnknownRecord
  let yaml = ''

  try {
    const configResponse = await client.get<unknown>('/config')
    rawConfig = toRecord(configResponse.data)
  } catch (error) {
    throw toThrowableManagementError(error)
  }

  try {
    const ampcodeResponse = await client.get<unknown>('/ampcode')
    const ampcode = toRecord(ampcodeResponse.data).ampcode
    if (isRecord(ampcode)) {
      rawConfig = { ...rawConfig, ampcode }
    }
  } catch (error) {
    issues.push(normalizeIssue('ampcode', error))
  }

  try {
    const excludedModelsResponse = await client.get<unknown>('/oauth-excluded-models')
    const excludedModels = toRecord(excludedModelsResponse.data)['oauth-excluded-models']
    const modelAliasResponse = await client.get<unknown>('/oauth-model-alias')
    const modelAlias = toRecord(modelAliasResponse.data)['oauth-model-alias']

    rawConfig = {
      ...rawConfig,
      'oauth-excluded-models': isRecord(excludedModels) ? excludedModels : {},
      'oauth-model-alias': isRecord(modelAlias) ? modelAlias : {},
    }
  } catch (error) {
    issues.push(normalizeIssue('oauthRules', error))
  }

  try {
    const yamlResponse = await client.get<unknown>('/config.yaml', {
      responseType: 'text',
      transformResponse: [(data: unknown) => data],
    })
    yaml = normalizeYamlResponse(yamlResponse.data)
    rawConfig = { ...rawConfig, ...readYamlBackedConfig(yaml) }
  } catch (error) {
    issues.push(normalizeIssue('yaml', error))
  }

  return {
    fetchedAt: new Date().toISOString(),
    rawConfig,
    structured: normalizeConfigValues(rawConfig),
    yaml,
    issues,
  }
}

async function applyConfigChange(session: ManagementSessionInput, change: ConfigChange) {
  const client = createManagementClient(session)
  const value = change.nextValue

  switch (change.key) {
    case 'debug':
      await client.put('/debug', { value })
      return
    case 'loggingToFile':
      await client.put('/logging-to-file', { value })
      return
    case 'logsMaxTotalSizeMb':
      await client.put('/logs-max-total-size-mb', { value })
      return
    case 'errorLogsMaxFiles':
      await client.put('/error-logs-max-files', { value })
      return
    case 'usageStatisticsEnabled':
      await client.put('/usage-statistics-enabled', { value })
      return
    case 'proxyUrl':
      if (typeof value === 'string' && value.trim()) {
        await client.put('/proxy-url', { value: value.trim() })
        return
      }
      await client.delete('/proxy-url')
      return
    case 'requestLog':
      await client.put('/request-log', { value })
      return
    case 'wsAuth':
      await client.put('/ws-auth', { value })
      return
    case 'requestRetry':
      await client.put('/request-retry', { value })
      return
    case 'maxRetryInterval':
      await client.put('/max-retry-interval', { value })
      return
    case 'forceModelPrefix':
      await client.put('/force-model-prefix', { value })
      return
    case 'routingStrategy':
      await client.put('/routing/strategy', { value })
      return
    case 'quotaSwitchProject':
      await client.put('/quota-exceeded/switch-project', { value })
      return
    case 'quotaSwitchPreviewModel':
      await client.put('/quota-exceeded/switch-preview-model', { value })
      return
    case 'ampcodeUpstreamUrl':
      if (typeof value === 'string' && value.trim()) {
        await client.put('/ampcode/upstream-url', { value: value.trim() })
        return
      }
      await client.delete('/ampcode/upstream-url')
      return
    case 'ampcodeUpstreamApiKey':
      if (typeof value === 'string' && value.trim()) {
        await client.put('/ampcode/upstream-api-key', { value: value.trim() })
        return
      }
      await client.delete('/ampcode/upstream-api-key')
      return
    case 'ampcodeRestrictManagementToLocalhost':
      await client.put('/ampcode/restrict-management-to-localhost', { value })
      return
    case 'ampcodeForceModelMappings':
      await client.put('/ampcode/force-model-mappings', { value })
      return
    case 'ampcodeModelMappingsJson':
      await client.put('/ampcode/model-mappings', { value: parseJsonArrayText(value) })
      return
    case 'ampcodeUpstreamApiKeysJson':
      await client.put('/ampcode/upstream-api-keys', { value: parseJsonArrayText(value) })
      return
    case 'oauthExcludedModelsJson':
      await client.put('/oauth-excluded-models', parseJsonObjectText(value))
      return
    case 'oauthModelAliasJson':
      await client.put('/oauth-model-alias', parseJsonObjectText(value))
      return
  }
}

export async function applyConfigChanges(session: ManagementSessionInput, changes: ConfigChange[]) {
  const leafChanges = changes.filter((change) => !yamlBackedConfigKeys.has(change.key))
  const yamlBackedChanges = changes.filter((change) => yamlBackedConfigKeys.has(change.key))

  for (const change of leafChanges) {
    await applyConfigChange(session, change)
  }

  if (yamlBackedChanges.length === 0) return

  const client = createManagementClient(session)
  const yamlResponse = await client.get<unknown>('/config.yaml', {
    responseType: 'text',
    transformResponse: [(data: unknown) => data],
  })
  const yaml = normalizeYamlResponse(yamlResponse.data)
  const patchedYaml = patchYamlBackedConfig(yaml, yamlBackedChanges)

  await client.put('/config.yaml', patchedYaml, {
    headers: {
      'Content-Type': 'application/yaml; charset=utf-8',
    },
  })
}

export async function replaceConfigYaml(session: ManagementSessionInput, yaml: string) {
  const client = createManagementClient(session)
  await client.put('/config.yaml', yaml, {
    headers: {
      'Content-Type': 'application/yaml; charset=utf-8',
    },
  })
}

export function toConfigApiError(error: unknown): ManagementApiError {
  return toManagementApiError(error)
}
