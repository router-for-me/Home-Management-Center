import { Document, isMap, isScalar, parseDocument, parse as parseYaml } from 'yaml'
import type { Scalar } from 'yaml'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type ConfigFieldKey =
  | 'debug'
  | 'pluginsEnabled'
  | 'pluginsDir'
  | 'pluginStoreSourcesJson'
  | 'pluginStoreAuthJson'
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
  | 'requestRetry'
  | 'maxRetryInterval'
  | 'forceModelPrefix'
  | 'routingStrategy'
  | 'quotaSwitchProject'
  | 'quotaSwitchPreviewModel'
  | 'oauthExcludedModelsJson'
  | 'oauthModelAliasJson'
  | 'payloadRulesJson'

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
    scope: 'config' | 'yaml' | 'oauthRules'
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
  'pluginsEnabled',
  'pluginsDir',
  'pluginStoreSourcesJson',
  'pluginStoreAuthJson',
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

function stringifyPayload(value: unknown) {
  const payload = toRecord(value)

  return JSON.stringify(
    {
      default: Array.isArray(payload.default) ? payload.default : [],
      'default-raw': Array.isArray(payload['default-raw']) ? payload['default-raw'] : [],
      override: Array.isArray(payload.override) ? payload.override : [],
      'override-raw': Array.isArray(payload['override-raw']) ? payload['override-raw'] : [],
      filter: Array.isArray(payload.filter) ? payload.filter : [],
    },
    null,
    2,
  )
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

function sanitizePayloadStringMap(value: unknown) {
  if (!isRecord(value)) return {}

  return Object.entries(value).reduce<Record<string, string>>((nextValue, [key, item]) => {
    const name = key.trim()
    if (!name || typeof item !== 'string') return nextValue

    return {
      ...nextValue,
      [name]: item,
    }
  }, {})
}

function sanitizePayloadConditions(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!isRecord(item)) return []

    return Object.entries(item).flatMap(([path, conditionValue]) => {
      const normalizedPath = path.trim()
      if (!normalizedPath) return []

      return [{ [normalizedPath]: conditionValue }]
    })
  })
}

function sanitizePayloadStringList(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : []))
}

function sanitizePayloadModel(value: unknown) {
  if (typeof value === 'string') {
    const name = value.trim()
    return name ? { name } : null
  }
  if (!isRecord(value)) return null

  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (!name) return null

  const protocol = typeof value.protocol === 'string' ? value.protocol.trim() : ''
  const fromProtocol =
    typeof value['from-protocol'] === 'string' ? value['from-protocol'].trim() : ''
  const headers = sanitizePayloadStringMap(value.headers)
  const match = sanitizePayloadConditions(value.match)
  const notMatch = sanitizePayloadConditions(value['not-match'])
  const exist = sanitizePayloadStringList(value.exist)
  const notExist = sanitizePayloadStringList(value['not-exist'])

  return {
    name,
    ...(protocol ? { protocol } : {}),
    ...(fromProtocol ? { 'from-protocol': fromProtocol } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(match.length > 0 ? { match } : {}),
    ...(notMatch.length > 0 ? { 'not-match': notMatch } : {}),
    ...(exist.length > 0 ? { exist } : {}),
    ...(notExist.length > 0 ? { 'not-exist': notExist } : {}),
  }
}

function sanitizePayloadModels(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    const model = sanitizePayloadModel(item)
    return model ? [model] : []
  })
}

function sanitizePayloadRuleSection(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    const rule = toRecord(item)
    const models = sanitizePayloadModels(rule.models)
    const params = toRecord(rule.params)
    const nextParams = Object.entries(params).reduce<Record<string, unknown>>(
      (nextValue, [path, paramValue]) => {
        const normalizedPath = path.trim()
        if (!normalizedPath) return nextValue

        return {
          ...nextValue,
          [normalizedPath]: paramValue,
        }
      },
      {},
    )

    if (models.length === 0 || Object.keys(nextParams).length === 0) return []

    return [{ models, params: nextParams }]
  })
}

function sanitizePayloadFilterSection(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    const rule = toRecord(item)
    const models = sanitizePayloadModels(rule.models)
    const params = sanitizePayloadStringList(rule.params)

    if (models.length === 0 || params.length === 0) return []

    return [{ models, params }]
  })
}

function sanitizePayloadForWrite(value: UnknownRecord) {
  return {
    default: sanitizePayloadRuleSection(value.default),
    'default-raw': sanitizePayloadRuleSection(value['default-raw']),
    override: sanitizePayloadRuleSection(value.override),
    'override-raw': sanitizePayloadRuleSection(value['override-raw']),
    filter: sanitizePayloadFilterSection(value.filter),
  }
}

function readYamlBackedConfig(yaml: string): UnknownRecord {
  if (!yaml.trim()) return {}

  const parsedRaw = parseYaml(yaml) as unknown
  const parsed = toRecord(parsedRaw)
  const tls = toRecord(parsed.tls)
  const remoteManagement = toRecord(parsed['remote-management'])
  const plugins = toRecord(parsed.plugins)

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
    plugins: {
      enabled: readBoolean(plugins, 'enabled'),
      dir: readString(plugins, 'dir', 'plugins'),
      'store-sources': Array.isArray(plugins['store-sources']) ? plugins['store-sources'] : [],
      'store-auth': Array.isArray(plugins['store-auth']) ? plugins['store-auth'] : [],
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
      case 'pluginsEnabled':
        ensureMapInDoc(doc, ['plugins'])
        setBooleanInDoc(doc, ['plugins', 'enabled'], Boolean(change.nextValue))
        break
      case 'pluginsDir':
        ensureMapInDoc(doc, ['plugins'])
        setStringInDoc(doc, ['plugins', 'dir'], change.nextValue)
        break
      case 'pluginStoreSourcesJson': {
        ensureMapInDoc(doc, ['plugins'])
        const sources = parseJsonArrayText(change.nextValue)
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0)
        if (sources.length > 0) {
          doc.setIn(['plugins', 'store-sources'], sources)
        } else if (docHas(doc, ['plugins', 'store-sources'])) {
          doc.deleteIn(['plugins', 'store-sources'])
        }
        break
      }
      case 'pluginStoreAuthJson': {
        ensureMapInDoc(doc, ['plugins'])
        const authRules = parseJsonArrayText(change.nextValue)
        if (authRules.length > 0) {
          doc.setIn(['plugins', 'store-auth'], authRules)
        } else if (docHas(doc, ['plugins', 'store-auth'])) {
          doc.deleteIn(['plugins', 'store-auth'])
        }
        break
      }
      default:
        break
    }
  }

  deleteIfMapEmpty(doc, ['tls'])
  deleteIfMapEmpty(doc, ['remote-management'])
  deleteIfMapEmpty(doc, ['plugins'])

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
    case 'pluginsEnabled':
      return createExistingYamlScalarPatch(doc, ['plugins', 'enabled'], Boolean(change.nextValue))
    case 'pluginsDir':
      return createExistingYamlScalarPatch(doc, ['plugins', 'dir'], String(change.nextValue))
    default:
      return null
  }
}

function normalizeConfigValues(rawConfig: UnknownRecord): ConfigStructuredValues {
  const routing = toRecord(rawConfig.routing)
  const quotaExceeded = toRecord(rawConfig['quota-exceeded'])
  const tls = toRecord(rawConfig.tls)
  const remoteManagement = toRecord(rawConfig['remote-management'])
  const plugins = toRecord(rawConfig.plugins)
  const oauthExcludedModels = toRecord(rawConfig['oauth-excluded-models'])
  const oauthModelAlias = toRecord(rawConfig['oauth-model-alias'])

  return {
    debug: readBoolean(rawConfig, 'debug'),
    pluginsEnabled: readBoolean(plugins, 'enabled'),
    pluginsDir: readString(plugins, 'dir', 'plugins'),
    pluginStoreSourcesJson: stringifyJsonArray(plugins['store-sources']),
    pluginStoreAuthJson: stringifyJsonArray(plugins['store-auth']),
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
    requestRetry: readNumber(rawConfig, 'request-retry'),
    maxRetryInterval: readNumber(rawConfig, 'max-retry-interval'),
    forceModelPrefix: readBoolean(rawConfig, 'force-model-prefix'),
    routingStrategy: readString(routing, 'strategy', 'round-robin'),
    quotaSwitchProject: readBoolean(quotaExceeded, 'switch-project'),
    quotaSwitchPreviewModel: readBoolean(quotaExceeded, 'switch-preview-model'),
    oauthExcludedModelsJson: stringifyJsonObject(oauthExcludedModels),
    oauthModelAliasJson: stringifyJsonObject(oauthModelAlias),
    payloadRulesJson: stringifyPayload(rawConfig.payload),
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
    const payloadResponse = await client.get<unknown>('/payload')
    const payloadRoot = toRecord(payloadResponse.data)
    const payload = isRecord(payloadRoot.payload) ? payloadRoot.payload : payloadRoot

    rawConfig = {
      ...rawConfig,
      payload,
    }
  } catch (error) {
    issues.push(normalizeIssue('config', error))
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
    case 'oauthExcludedModelsJson':
      await client.put('/oauth-excluded-models', parseJsonObjectText(value))
      return
    case 'oauthModelAliasJson':
      await client.put('/oauth-model-alias', parseJsonObjectText(value))
      return
    case 'payloadRulesJson': {
      const payload = sanitizePayloadForWrite(parseJsonObjectText(value))
      const hasRules = Object.values(payload).some(
        (section) => Array.isArray(section) && section.length > 0,
      )

      if (hasRules) {
        await client.patch('/payload', { payload })
        return
      }

      await client.delete('/payload')
      return
    }
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

export function toConfigApiError(error: unknown): ManagementApiError {
  return toManagementApiError(error)
}
