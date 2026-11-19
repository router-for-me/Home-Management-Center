import {
  createManagementClient,
  isMissingConfigPath,
  toManagementApiError,
} from '@/lib/api/management/client'
import {
  canEditPayloadModel,
  canEditPayloadReplaceRule,
  getPayloadReplaceIssues,
  normalizePayloadReplaceContent,
} from '@/lib/api/management/payload-replace'
import { readManagementRoutingStrategy } from '@/lib/api/management/routing'
import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

import { ConfigEditConflict, sameConfigValue } from './config-edit'
import { hasIncompleteAliasChanges } from './oauth-model-aliases'
import { changedOAuthChannels, isOAuthChannelKey, oauthChannelValue } from './oauth-model-channels'
import { hasInvalidModelSettingChanges } from './oauth-model-settings'
import {
  type ReplacementKind,
  parseReplacementDraft,
  readReplacementRows,
  serializeReplacementRows,
} from './sensitive-replacements'

type UnknownRecord = Record<string, unknown>

export type ConfigFieldValue = string | number | boolean | null

export type ConfigFieldKey =
  | 'debug'
  | 'port'
  | 'pluginsEnabled'
  | 'pluginsDir'
  | 'pluginStoreSourcesJson'
  | 'loggingToFile'
  | 'usageStatisticsEnabled'
  | 'logsMaxTotalSizeMb'
  | 'errorLogsMaxFiles'
  | 'tlsEnable'
  | 'tlsCert'
  | 'tlsKey'
  | 'remoteManagementAllowRemote'
  | 'remoteManagementSecretKey'
  | 'remoteManagementDisableControlPanel'
  | 'proxyUrl'
  | 'requestLog'
  | 'requestRetry'
  | 'maxRetryCredentials'
  | 'maxRetryInterval'
  | 'forceModelPrefix'
  | 'disableCooling'
  | 'routingStrategy'
  | 'oauthExcludedModelsJson'
  | 'oauthModelAliasJson'
  | 'oauthModelSettingsJson'
  | 'payloadRulesJson'
  | 'antigravitySensitiveWordsJson'
  | 'antigravityLiteralReplacements'
  | 'antigravityPatternReplacements'
  | 'serverHost'
  | 'serverAllowHostJson'
  | 'serverTrustedProxiesJson'
  | 'serverCommercialMode'
  | 'discoveryEnabled'
  | 'discoveryServiceName'
  | 'discoveryServiceType'
  | 'discoveryAuthRequired'
  | 'discoverySubtypesJson'
  | 'discoveryInterfacesIncludeJson'
  | 'discoveryInterfacesExcludeJson'
  | 'managementBaseUrl'
  | 'userEmailEnabled'
  | 'userEmailPublicUrl'
  | 'userEmailFromAddress'
  | 'userEmailFromName'
  | 'userEmailSmtpHost'
  | 'userEmailSmtpPort'
  | 'userEmailSmtpUsername'
  | 'userEmailSmtpPasswordEnv'
  | 'userEmailSmtpStarttls'
  | 'userEmailVerificationTokenTtl'
  | 'userEmailResetTokenTtl'
  | 'concurrencyCpaHeartbeatTimeout'
  | 'concurrencyCpaCancelBound'
  | 'concurrencyReclaimGrace'
  | 'concurrencyCleanupInterval'
  | 'concurrencyReleaseFlushInterval'
  | 'concurrencyReleaseMaxBackoff'
  | 'concurrencyBusyRetryMin'
  | 'concurrencyBusyRetryMax'
  | 'concurrencyMaxLimit'
  | 'concurrencyLifecycleConfigRevision'
  | 'concurrencyObservationBarrierRevision'
  | 'inFlightSnapshotInterval'
  | 'inFlightStaleAfter'
  | 'inFlightStagingRetention'
  | 'inFlightMaxPartBytes'
  | 'inFlightMaxPartCount'
  | 'inFlightMaxRevisionBytes'
  | 'inFlightMaxAggregateGroups'
  | 'inFlightMaxDetails'
  | 'inFlightMaxStringBytes'
  | 'sessionAffinity'
  | 'sessionAffinityRebindOn'
  | 'sessionAffinityTtl'
  | 'sessionAffinitySubagents'
  | 'streamingKeepaliveSeconds'
  | 'streamingSendKeepaliveBeforeFt'
  | 'streamingBootstrapRetries'
  | 'passthroughHeaders'
  | 'nonstreamKeepaliveInterval'
  | 'upstreamCodexDisableCloaking'
  | 'upstreamCodexStreamBootstrapBuffering'
  | 'upstreamCodexModelLevelCooling'
  | 'upstreamCodexOrphanDelegationCompatibility'
  | 'upstreamCodexResponseSteering'
  | 'upstreamCodexStreamBootstrapTimeout'
  | 'upstreamClaudeModelLevelCooling'
  | 'upstreamClaudeToolSearch'
  | 'upstreamClaudeDisableCloakMode'
  | 'upstreamClaudeDisableCloakingModelList'
  | 'upstreamClaudeHeaderUserAgent'
  | 'upstreamClaudeHeaderPackageVersion'
  | 'upstreamClaudeHeaderRuntimeVersion'
  | 'upstreamClaudeHeaderOs'
  | 'upstreamClaudeHeaderArch'
  | 'upstreamClaudeHeaderTimeout'
  | 'upstreamClaudeHeaderTimezone'
  | 'upstreamClaudeHeaderStabilizeDeviceProfile'
  | 'upstreamXaiInjectXSearch'
  | 'clientCodexOptimizeMultiAgentV2'
  | 'oauthAuthDir'
  | 'oauthCodexHeaderUserAgent'
  | 'oauthCodexHeaderBetaFeatures'
  | 'liveMediaRelayEnabled'
  | 'liveMediaRelayDisablePrivateRemoteIps'
  | 'liveMediaRelayMaxSessions'
  | 'liveMediaRelayUdpPortMin'
  | 'liveMediaRelayUdpPortMax'
  | 'liveMediaRelayPublicIp'
  | 'liveMediaRelayIceServersJson'
  | 'devinSensitiveWordsJson'
  | 'devinLiteralReplacements'
  | 'devinPatternReplacements'
  | 'oauthRequestScopedErrorsJson'
  | 'antigravityTosPauseWindow'
  | 'antigravityCredits'
  | 'antigravitySignatureCacheEnabled'
  | 'antigravitySignatureBypassStrict'
  | 'antigravityConnPoolEnabled'
  | 'antigravityConnPoolIdleTimeout'
  | 'antigravityConnPoolMaxIdleConnsPerHost'
  | 'multimediaDisableImageGeneration'
  | 'multimediaGptImage2BaseModel'
  | 'multimediaVideoResultAuthCacheTtl'
  | 'pprofEnable'
  | 'pprofAddr'
  | 'redisUsageQueueRetentionSeconds'

const readOnlyFields = [
  'concurrencyLifecycleConfigRevision',
  'concurrencyObservationBarrierRevision',
  'usageStatisticsEnabled',
] as const satisfies readonly ConfigFieldKey[]

export type ReadOnlyConfigFieldKey = (typeof readOnlyFields)[number]

export function isReadOnlyConfigField(key: ConfigFieldKey): key is ReadOnlyConfigFieldKey {
  return readOnlyFields.some((field) => field === key)
}

export type WritableConfigFieldKey = Exclude<ConfigFieldKey, ReadOnlyConfigFieldKey>

export type ConfigStructuredValues = Record<ConfigFieldKey, ConfigFieldValue>

export type ConfigChange = {
  key: WritableConfigFieldKey
  previousValue: ConfigFieldValue
  nextValue: ConfigFieldValue
}

export type ConfigSnapshot = {
  fetchedAt: string
  rawConfig: UnknownRecord
  structured: ConfigStructuredValues
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readBoolean(record: UnknownRecord, key: string, fallback = false) {
  return typeof record[key] === 'boolean' ? record[key] : fallback
}

function readNullableBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

function readNumber(record: UnknownRecord, key: string, fallback = 0) {
  return typeof record[key] === 'number' && Number.isFinite(record[key]) ? record[key] : fallback
}

function readString(record: UnknownRecord, key: string, fallback = '') {
  return typeof record[key] === 'string' ? record[key] : fallback
}

function readImageGenerationMode(value: unknown): boolean | 'chat' | 'passthrough' {
  if (typeof value === 'boolean') return value
  if (value === 'chat' || value === 'passthrough') return value
  return false
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

const payloadSectionKeys = [
  'default',
  'default-raw',
  'override',
  'override-raw',
  'replace',
  'filter',
]

export function canEditPayloadConfig(value: unknown) {
  if (!isRecord(value)) return false
  return Object.entries(value).every(([key, rules]) => {
    if (!payloadSectionKeys.includes(key) || !Array.isArray(rules)) return false
    return rules.every((rule: unknown) => {
      if (key === 'replace') return true // Preserve opaque saved entries at their original positions.
      if (!isRecord(rule)) return false
      if (!Object.keys(rule).every((field) => field === 'models' || field === 'params'))
        return false
      if (!Array.isArray(rule.models) || !rule.models.every(canEditPayloadModel)) return false
      return key === 'filter'
        ? Array.isArray(rule.params) &&
            rule.params.every((path: unknown) => typeof path === 'string')
        : isRecord(rule.params)
    })
  })
}

function stringifyPayload(value: unknown) {
  if (value != null && !isRecord(value)) return JSON.stringify(value, null, 2)
  const payload = { ...toRecord(value) }
  for (const key of payloadSectionKeys) payload[key] ??= []
  return JSON.stringify(payload, null, 2)
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

  return value.flatMap((item: unknown) => {
    if (!isRecord(item)) return []

    const entries = Object.entries(item)
      .map(([path, conditionValue]) => [path.trim(), conditionValue] as const)
      .filter(([path]) => path.length > 0)
    return entries.length ? [Object.fromEntries(entries)] : []
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
  if (!Array.isArray(value) || !value.length) throw new Error('Missing requests.payload models')
  return value.map((item: unknown) => {
    const model = sanitizePayloadModel(item)
    if (!model) throw new Error('Missing requests.payload model name')
    return model
  })
}

function sanitizePayloadRuleSection(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const rule = toRecord(item)
    const models = sanitizePayloadModels(rule.models)
    const params = Object.entries(toRecord(rule.params))
    const normalized = Object.fromEntries(params.map(([path, param]) => [path.trim(), param]))
    if (!params.length || '' in normalized || Object.keys(normalized).length !== params.length) {
      throw new Error('Invalid requests.payload parameter paths')
    }
    return { models, params: normalized }
  })
}

function sanitizePayloadFilterSection(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const rule = toRecord(item)
    const models = sanitizePayloadModels(rule.models)
    const params = sanitizePayloadStringList(rule.params)
    if (!Array.isArray(rule.params) || !params.length || params.length !== rule.params.length) {
      throw new Error('Invalid requests.payload filter paths')
    }
    return { models, params }
  })
}

function sanitizePayloadForWrite(value: UnknownRecord, previous: UnknownRecord) {
  if (!canEditPayloadConfig(previous) || !canEditPayloadConfig(value)) {
    throw new Error('Unsupported requests.payload structure')
  }
  const replace = sanitizePayloadReplaceSection(value.replace, previous.replace)
  return {
    default: sanitizePayloadRuleSection(value.default),
    'default-raw': sanitizePayloadRuleSection(value['default-raw']),
    override: sanitizePayloadRuleSection(value.override),
    'override-raw': sanitizePayloadRuleSection(value['override-raw']),
    // Older Home SDKs reject this field even when the list is empty.
    ...(replace.length > 0 ? { replace } : {}),
    filter: sanitizePayloadFilterSection(value.filter),
  }
}

function sanitizePayloadReplaceSection(value: unknown, previous: unknown) {
  const rules = value === undefined ? [] : value
  if (!Array.isArray(rules)) throw new Error('Invalid requests.payload.replace')

  // A subtree PUT must carry through saved rules that the visual form can't represent.
  const savedReadOnly: unknown[] = (Array.isArray(previous) ? previous : []).filter(
    (rule: unknown) => !isRecord(rule) || !canEditPayloadReplaceRule(rule),
  )
  let preserved = 0
  const result = rules.map((rule: unknown) => {
    if (!isRecord(rule) || !canEditPayloadReplaceRule(rule)) {
      if (
        preserved >= savedReadOnly.length ||
        JSON.stringify(savedReadOnly[preserved]) !== JSON.stringify(rule)
      ) {
        throw new Error('Invalid requests.payload.replace rule')
      }
      return savedReadOnly[preserved++]
    }
    const models = sanitizePayloadModels(rule.models)
    const content = normalizePayloadReplaceContent(rule)
    if (getPayloadReplaceIssues(content).length > 0) {
      throw new Error('Invalid requests.payload.replace rule')
    }
    return {
      // Saved model objects can contain explicit defaults and grouped conditions.
      models: rule.models.map((model, index) => (isRecord(model) ? model : models[index])),
      target: rule.target,
      replacements: rule.replacements,
    }
  })
  if (preserved !== savedReadOnly.length)
    throw new Error('Missing saved requests.payload.replace rule')
  return result
}

export function readObservabilityFlags(config: UnknownRecord) {
  const observability = toRecord(config.observability)
  const logs = toRecord(observability.logs)
  const usage = toRecord(observability.usage)
  return {
    debug: readBoolean(logs, 'debug'),
    requestLog: readBoolean(logs, 'request-log'),
    loggingToFile: readBoolean(logs, 'logging-to-file'),
    usageStatisticsEnabled: readNullableBoolean(usage, 'usage-statistics-enabled'),
  }
}

export function normalizeConfigValues(rawConfig: UnknownRecord): ConfigStructuredValues {
  const server = toRecord(rawConfig.server)
  const serverTls = toRecord(server.tls)
  const discovery = toRecord(server.discovery)
  const discoveryInterfaces = toRecord(discovery.interfaces)
  const management = toRecord(rawConfig.management)
  const userEmail = toRecord(rawConfig['user-email'])
  const userEmailSender = toRecord(userEmail.sender)
  const userEmailSmtp = toRecord(userEmailSender.smtp)
  const requests = toRecord(rawConfig.requests)
  const requestsStreaming = toRecord(requests.streaming)
  const routing = toRecord(rawConfig.routing)
  const routingRetry = toRecord(routing.retry)
  const routingCooldown = toRecord(routing.cooldown)
  const observability = toRecord(rawConfig.observability)
  const observabilityLogs = toRecord(observability.logs)
  const observabilityUsage = toRecord(observability.usage)
  const observabilityPprof = toRecord(observability.pprof)
  const plugins = toRecord(rawConfig.plugins)
  const credentials = toRecord(rawConfig.credentials)
  const concurrency = toRecord(credentials.concurrency)
  const inFlight = toRecord(credentials['in-flight'])
  const upstream = toRecord(rawConfig.upstream)
  const upstreamCodex = toRecord(upstream.codex)
  const upstreamClaude = toRecord(upstream.claude)
  const upstreamClaudeHeaders = toRecord(upstreamClaude['header-defaults'])
  const upstreamXai = toRecord(upstream.xai)
  const client = toRecord(rawConfig.client)
  const clientCodex = toRecord(client.codex)
  const oauth = toRecord(rawConfig.oauth)
  const oauthProviders = toRecord(oauth.providers)
  const oauthCodex = toRecord(oauthProviders.codex)
  const oauthCodexHeaders = toRecord(oauthCodex['header-defaults'])
  const liveMediaRelay = toRecord(oauthCodex['live-media-relay'])
  const antigravity = toRecord(oauthProviders.antigravity)
  const pauseWindow = antigravity['tos-pause-window']
  const antigravityConnPool = toRecord(antigravity['connection-pool'])
  const devin = toRecord(oauthProviders.devin)
  const multimedia = toRecord(rawConfig.multimedia)

  return {
    ...readObservabilityFlags(rawConfig),
    port: readNumber(server, 'port', 8317),
    pluginsEnabled: readBoolean(plugins, 'enabled'),
    pluginsDir: readString(plugins, 'dir', 'plugins'),
    pluginStoreSourcesJson: stringifyJsonArray(plugins['store-sources']),
    logsMaxTotalSizeMb: readNumber(observabilityLogs, 'logs-max-total-size-mb'),
    errorLogsMaxFiles: readNumber(observabilityLogs, 'error-logs-max-files', 10),
    tlsEnable: readBoolean(serverTls, 'enable'),
    tlsCert: readString(serverTls, 'cert'),
    tlsKey: readString(serverTls, 'key'),
    remoteManagementAllowRemote: readBoolean(management, 'allow-remote'),
    remoteManagementSecretKey: readString(management, 'secret-key'),
    remoteManagementDisableControlPanel: readBoolean(management, 'disable-control-panel'),
    proxyUrl: readString(requests, 'proxy-url'),
    requestRetry: readNumber(routingRetry, 'request-retry'),
    maxRetryCredentials: readNumber(routingRetry, 'max-retry-credentials'),
    maxRetryInterval: readNumber(routingRetry, 'max-retry-interval'),
    forceModelPrefix: readBoolean(routing, 'force-model-prefix'),
    disableCooling: readBoolean(routingCooldown, 'disable-cooling'),
    routingStrategy: readManagementRoutingStrategy(rawConfig),
    oauthExcludedModelsJson: stringifyJsonObject(oauth['excluded-models']),
    oauthModelAliasJson: stringifyJsonObject(oauth['model-alias']),
    oauthModelSettingsJson: JSON.stringify(oauth.settings ?? {}, null, 2),
    payloadRulesJson: stringifyPayload(requests.payload),
    antigravitySensitiveWordsJson: stringifyJsonArray(antigravity['sensitive-words']),
    antigravityLiteralReplacements: JSON.stringify(
      readReplacementRows('literalReplacements', antigravity['sensitive-words-replace']),
      null,
      2,
    ),
    antigravityPatternReplacements: JSON.stringify(
      readReplacementRows('patternReplacements', antigravity['sensitive-patterns-replace']),
      null,
      2,
    ),
    serverHost: readString(server, 'host'),
    serverAllowHostJson: stringifyJsonArray(server['allow-host']),
    serverTrustedProxiesJson: stringifyJsonArray(server['trusted-proxies']),
    serverCommercialMode: readBoolean(server, 'commercial-mode'),
    discoveryEnabled: readBoolean(discovery, 'enabled'),
    discoveryServiceName: readString(discovery, 'service-name'),
    discoveryServiceType: readString(discovery, 'service-type'),
    discoveryAuthRequired: readNullableBoolean(discovery, 'auth-required'),
    discoverySubtypesJson: stringifyJsonArray(discovery.subtypes),
    discoveryInterfacesIncludeJson: stringifyJsonArray(discoveryInterfaces.include),
    discoveryInterfacesExcludeJson: stringifyJsonArray(discoveryInterfaces.exclude),
    managementBaseUrl: readString(management, 'base-url'),
    userEmailEnabled: readBoolean(userEmail, 'enabled'),
    userEmailPublicUrl: readString(userEmail, 'public-user-url'),
    userEmailFromAddress: readString(userEmail, 'from-address'),
    userEmailFromName: readString(userEmail, 'from-name'),
    userEmailSmtpHost: readString(userEmailSmtp, 'host'),
    userEmailSmtpPort: readNumber(userEmailSmtp, 'port'),
    userEmailSmtpUsername: readString(userEmailSmtp, 'username'),
    userEmailSmtpPasswordEnv: readString(userEmailSmtp, 'password-env'),
    userEmailSmtpStarttls: readBoolean(userEmailSmtp, 'starttls'),
    userEmailVerificationTokenTtl: readString(userEmail, 'verification-token-ttl'),
    userEmailResetTokenTtl: readString(userEmail, 'reset-token-ttl'),
    concurrencyCpaHeartbeatTimeout: readString(concurrency, 'cpa-heartbeat-timeout'),
    concurrencyCpaCancelBound: readString(concurrency, 'cpa-cancel-bound'),
    concurrencyReclaimGrace: readString(concurrency, 'reclaim-grace'),
    concurrencyCleanupInterval: readString(concurrency, 'cleanup-interval'),
    concurrencyReleaseFlushInterval: readString(concurrency, 'release-flush-interval'),
    concurrencyReleaseMaxBackoff: readString(concurrency, 'release-max-backoff'),
    concurrencyBusyRetryMin: readString(concurrency, 'busy-retry-min'),
    concurrencyBusyRetryMax: readString(concurrency, 'busy-retry-max'),
    concurrencyMaxLimit: readNumber(concurrency, 'max-limit', 1_000_000),
    concurrencyLifecycleConfigRevision: readNumber(concurrency, 'lifecycle-config-revision'),
    concurrencyObservationBarrierRevision: readNumber(concurrency, 'observation-barrier-revision'),
    inFlightSnapshotInterval: readString(inFlight, 'snapshot-interval'),
    inFlightStaleAfter: readString(inFlight, 'stale-after'),
    inFlightStagingRetention: readString(inFlight, 'staging-retention'),
    inFlightMaxPartBytes: readNumber(inFlight, 'max-part-bytes', 262_144),
    inFlightMaxPartCount: readNumber(inFlight, 'max-part-count', 64),
    inFlightMaxRevisionBytes: readNumber(inFlight, 'max-revision-bytes', 16_777_216),
    inFlightMaxAggregateGroups: readNumber(inFlight, 'max-aggregate-groups', 100_000),
    inFlightMaxDetails: readNumber(inFlight, 'max-details', 10_000),
    inFlightMaxStringBytes: readNumber(inFlight, 'max-string-bytes', 256),
    sessionAffinity: readBoolean(routing, 'session-affinity'),
    sessionAffinityRebindOn:
      readString(routing, 'session-affinity-rebind-on').trim().toLowerCase() || 'any',
    sessionAffinityTtl: readString(routing, 'session-affinity-ttl'),
    sessionAffinitySubagents: readNullableBoolean(routing, 'session-affinity-subagents'),
    streamingKeepaliveSeconds: readNumber(requestsStreaming, 'keepalive-seconds'),
    streamingSendKeepaliveBeforeFt: readBoolean(requestsStreaming, 'send-keepalive-before-ft'),
    streamingBootstrapRetries: readNumber(requestsStreaming, 'bootstrap-retries'),
    passthroughHeaders: readBoolean(requests, 'passthrough-headers'),
    nonstreamKeepaliveInterval: readNumber(requests, 'nonstream-keepalive-interval'),
    upstreamCodexDisableCloaking: readBoolean(upstreamCodex, 'disable-codex-cloaking'),
    upstreamCodexStreamBootstrapBuffering: readBoolean(upstreamCodex, 'stream-bootstrap-buffering'),
    upstreamCodexModelLevelCooling: readBoolean(upstreamCodex, 'model-level-cooling'),
    upstreamCodexOrphanDelegationCompatibility: readBoolean(
      upstreamCodex,
      'orphan-delegation-compatibility',
    ),
    upstreamCodexResponseSteering: readBoolean(upstreamCodex, 'response-steering'),
    upstreamCodexStreamBootstrapTimeout: readString(upstreamCodex, 'stream-bootstrap-timeout'),
    upstreamClaudeModelLevelCooling: readBoolean(upstreamClaude, 'model-level-cooling'),
    upstreamClaudeToolSearch: readBoolean(upstreamClaude, 'tool-search'),
    upstreamClaudeDisableCloakMode: readBoolean(upstreamClaude, 'disable-claude-cloak-mode'),
    upstreamClaudeDisableCloakingModelList: readBoolean(
      upstreamClaude,
      'disable-cloaking-model-list',
    ),
    upstreamClaudeHeaderUserAgent: readString(upstreamClaudeHeaders, 'user-agent'),
    upstreamClaudeHeaderPackageVersion: readString(upstreamClaudeHeaders, 'package-version'),
    upstreamClaudeHeaderRuntimeVersion: readString(upstreamClaudeHeaders, 'runtime-version'),
    upstreamClaudeHeaderOs: readString(upstreamClaudeHeaders, 'os'),
    upstreamClaudeHeaderArch: readString(upstreamClaudeHeaders, 'arch'),
    upstreamClaudeHeaderTimeout: readString(upstreamClaudeHeaders, 'timeout'),
    upstreamClaudeHeaderTimezone: readString(upstreamClaudeHeaders, 'timezone'),
    upstreamClaudeHeaderStabilizeDeviceProfile: readNullableBoolean(
      upstreamClaudeHeaders,
      'stabilize-device-profile',
    ),
    upstreamXaiInjectXSearch: readBoolean(upstreamXai, 'inject-x-search'),
    clientCodexOptimizeMultiAgentV2: readBoolean(clientCodex, 'optimize-multi-agent-v2'),
    oauthAuthDir: readString(oauth, 'auth-dir'),
    oauthCodexHeaderUserAgent: readString(oauthCodexHeaders, 'user-agent'),
    oauthCodexHeaderBetaFeatures: readString(oauthCodexHeaders, 'beta-features'),
    liveMediaRelayEnabled: readBoolean(liveMediaRelay, 'enabled'),
    liveMediaRelayDisablePrivateRemoteIps: readBoolean(
      liveMediaRelay,
      'disable-private-remote-ips',
    ),
    liveMediaRelayMaxSessions: readNumber(liveMediaRelay, 'max-sessions'),
    liveMediaRelayUdpPortMin: readNumber(liveMediaRelay, 'udp-port-min'),
    liveMediaRelayUdpPortMax: readNumber(liveMediaRelay, 'udp-port-max'),
    liveMediaRelayPublicIp: readString(liveMediaRelay, 'public-ip'),
    liveMediaRelayIceServersJson: stringifyJsonArray(liveMediaRelay['ice-servers']),
    devinSensitiveWordsJson: stringifyJsonArray(devin['sensitive-words']),
    devinLiteralReplacements: JSON.stringify(
      readReplacementRows('literalReplacements', devin['sensitive-words-replace']),
      null,
      2,
    ),
    devinPatternReplacements: JSON.stringify(
      readReplacementRows('patternReplacements', devin['sensitive-patterns-replace']),
      null,
      2,
    ),
    oauthRequestScopedErrorsJson: stringifyJsonObject(oauth['request-scoped-errors']),
    antigravityTosPauseWindow:
      typeof pauseWindow === 'string' || pauseWindow === 0 || pauseWindow === false
        ? String(pauseWindow).trim()
        : '',
    antigravityCredits: readBoolean(antigravity, 'antigravity-credits'),
    antigravitySignatureCacheEnabled: readNullableBoolean(antigravity, 'signature-cache-enabled'),
    antigravitySignatureBypassStrict: readNullableBoolean(antigravity, 'signature-bypass-strict'),
    antigravityConnPoolEnabled: readBoolean(antigravityConnPool, 'enabled'),
    antigravityConnPoolIdleTimeout: readString(antigravityConnPool, 'idle-conn-timeout'),
    antigravityConnPoolMaxIdleConnsPerHost: readNumber(
      antigravityConnPool,
      'max-idle-conns-per-host',
      2,
    ),
    multimediaDisableImageGeneration: readImageGenerationMode(
      multimedia['disable-image-generation'],
    ),
    multimediaGptImage2BaseModel: readString(multimedia, 'gpt-image-2-base-model'),
    multimediaVideoResultAuthCacheTtl: readString(multimedia, 'video-result-auth-cache-ttl'),
    pprofEnable: readBoolean(observabilityPprof, 'enable'),
    pprofAddr: readString(observabilityPprof, 'addr'),
    redisUsageQueueRetentionSeconds: readNumber(
      observabilityUsage,
      'redis-usage-queue-retention-seconds',
      60,
    ),
  }
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

  try {
    const configResponse = await client.get<unknown>('/config')
    const rawConfig = toRecord(configResponse.data)

    return {
      fetchedAt: new Date().toISOString(),
      rawConfig,
      structured: normalizeConfigValues(rawConfig),
    }
  } catch (error) {
    throw toThrowableManagementError(error)
  }
}

type ConfigWriteKind =
  | ReplacementKind
  | 'alias'
  | 'modelSettings'
  | 'payload'
  | 'imageGeneration'
  | 'boolean'
  | 'number'
  | 'string'
  | 'optionalBoolean'
  | 'nullableBoolean'
  | 'stringList'
  | 'jsonObject'
  | 'jsonArray'

type ConfigWriteTarget = {
  path: string
  kind: ConfigWriteKind
}

const configWriteTargets: Record<WritableConfigFieldKey, ConfigWriteTarget> = {
  oauthModelAliasJson: { path: 'oauth/model-alias', kind: 'alias' },
  oauthModelSettingsJson: { path: 'oauth/settings', kind: 'modelSettings' },
  payloadRulesJson: { path: 'requests/payload', kind: 'payload' },
  multimediaDisableImageGeneration: {
    path: 'multimedia/disable-image-generation',
    kind: 'imageGeneration',
  },
  debug: { path: 'observability/logs/debug', kind: 'boolean' },
  port: { path: 'server/port', kind: 'number' },
  pluginsEnabled: { path: 'plugins/enabled', kind: 'boolean' },
  pluginsDir: { path: 'plugins/dir', kind: 'string' },
  pluginStoreSourcesJson: { path: 'plugins/store-sources', kind: 'stringList' },
  loggingToFile: { path: 'observability/logs/logging-to-file', kind: 'boolean' },
  logsMaxTotalSizeMb: { path: 'observability/logs/logs-max-total-size-mb', kind: 'number' },
  errorLogsMaxFiles: { path: 'observability/logs/error-logs-max-files', kind: 'number' },
  tlsEnable: { path: 'server/tls/enable', kind: 'boolean' },
  tlsCert: { path: 'server/tls/cert', kind: 'string' },
  tlsKey: { path: 'server/tls/key', kind: 'string' },
  remoteManagementAllowRemote: { path: 'management/allow-remote', kind: 'boolean' },
  remoteManagementSecretKey: { path: 'management/secret-key', kind: 'string' },
  remoteManagementDisableControlPanel: {
    path: 'management/disable-control-panel',
    kind: 'boolean',
  },
  proxyUrl: { path: 'requests/proxy-url', kind: 'string' },
  requestLog: { path: 'observability/logs/request-log', kind: 'boolean' },
  requestRetry: { path: 'routing/retry/request-retry', kind: 'number' },
  maxRetryCredentials: { path: 'routing/retry/max-retry-credentials', kind: 'number' },
  maxRetryInterval: { path: 'routing/retry/max-retry-interval', kind: 'number' },
  forceModelPrefix: { path: 'routing/force-model-prefix', kind: 'boolean' },
  disableCooling: { path: 'routing/cooldown/disable-cooling', kind: 'boolean' },
  routingStrategy: { path: 'routing/strategy', kind: 'string' },
  oauthExcludedModelsJson: { path: 'oauth/excluded-models', kind: 'jsonObject' },
  antigravityLiteralReplacements: {
    path: 'oauth/providers/antigravity/sensitive-words-replace',
    kind: 'literalReplacements',
  },
  antigravityPatternReplacements: {
    path: 'oauth/providers/antigravity/sensitive-patterns-replace',
    kind: 'patternReplacements',
  },
  antigravitySensitiveWordsJson: {
    path: 'oauth/providers/antigravity/sensitive-words',
    kind: 'stringList',
  },
  serverHost: { path: 'server/host', kind: 'string' },
  serverAllowHostJson: { path: 'server/allow-host', kind: 'stringList' },
  serverTrustedProxiesJson: { path: 'server/trusted-proxies', kind: 'stringList' },
  serverCommercialMode: { path: 'server/commercial-mode', kind: 'boolean' },
  discoveryEnabled: { path: 'server/discovery/enabled', kind: 'boolean' },
  discoveryServiceName: { path: 'server/discovery/service-name', kind: 'string' },
  discoveryServiceType: { path: 'server/discovery/service-type', kind: 'string' },
  discoveryAuthRequired: { path: 'server/discovery/auth-required', kind: 'optionalBoolean' },
  discoverySubtypesJson: { path: 'server/discovery/subtypes', kind: 'stringList' },
  discoveryInterfacesIncludeJson: {
    path: 'server/discovery/interfaces/include',
    kind: 'stringList',
  },
  discoveryInterfacesExcludeJson: {
    path: 'server/discovery/interfaces/exclude',
    kind: 'stringList',
  },
  managementBaseUrl: { path: 'management/base-url', kind: 'string' },
  userEmailEnabled: { path: 'user-email/enabled', kind: 'boolean' },
  userEmailPublicUrl: { path: 'user-email/public-user-url', kind: 'string' },
  userEmailFromAddress: { path: 'user-email/from-address', kind: 'string' },
  userEmailFromName: { path: 'user-email/from-name', kind: 'string' },
  userEmailSmtpHost: { path: 'user-email/sender/smtp/host', kind: 'string' },
  userEmailSmtpPort: { path: 'user-email/sender/smtp/port', kind: 'number' },
  userEmailSmtpUsername: { path: 'user-email/sender/smtp/username', kind: 'string' },
  userEmailSmtpPasswordEnv: { path: 'user-email/sender/smtp/password-env', kind: 'string' },
  userEmailSmtpStarttls: { path: 'user-email/sender/smtp/starttls', kind: 'boolean' },
  userEmailVerificationTokenTtl: { path: 'user-email/verification-token-ttl', kind: 'string' },
  userEmailResetTokenTtl: { path: 'user-email/reset-token-ttl', kind: 'string' },
  concurrencyCpaHeartbeatTimeout: {
    path: 'credentials/concurrency/cpa-heartbeat-timeout',
    kind: 'string',
  },
  concurrencyCpaCancelBound: { path: 'credentials/concurrency/cpa-cancel-bound', kind: 'string' },
  concurrencyReclaimGrace: { path: 'credentials/concurrency/reclaim-grace', kind: 'string' },
  concurrencyCleanupInterval: { path: 'credentials/concurrency/cleanup-interval', kind: 'string' },
  concurrencyReleaseFlushInterval: {
    path: 'credentials/concurrency/release-flush-interval',
    kind: 'string',
  },
  concurrencyReleaseMaxBackoff: {
    path: 'credentials/concurrency/release-max-backoff',
    kind: 'string',
  },
  concurrencyBusyRetryMin: { path: 'credentials/concurrency/busy-retry-min', kind: 'string' },
  concurrencyBusyRetryMax: { path: 'credentials/concurrency/busy-retry-max', kind: 'string' },
  concurrencyMaxLimit: { path: 'credentials/concurrency/max-limit', kind: 'number' },
  inFlightSnapshotInterval: { path: 'credentials/in-flight/snapshot-interval', kind: 'string' },
  inFlightStaleAfter: { path: 'credentials/in-flight/stale-after', kind: 'string' },
  inFlightStagingRetention: { path: 'credentials/in-flight/staging-retention', kind: 'string' },
  inFlightMaxPartBytes: { path: 'credentials/in-flight/max-part-bytes', kind: 'number' },
  inFlightMaxPartCount: { path: 'credentials/in-flight/max-part-count', kind: 'number' },
  inFlightMaxRevisionBytes: { path: 'credentials/in-flight/max-revision-bytes', kind: 'number' },
  inFlightMaxAggregateGroups: {
    path: 'credentials/in-flight/max-aggregate-groups',
    kind: 'number',
  },
  inFlightMaxDetails: { path: 'credentials/in-flight/max-details', kind: 'number' },
  inFlightMaxStringBytes: { path: 'credentials/in-flight/max-string-bytes', kind: 'number' },
  sessionAffinity: { path: 'routing/session-affinity', kind: 'boolean' },
  sessionAffinityRebindOn: { path: 'routing/session-affinity-rebind-on', kind: 'string' },
  sessionAffinityTtl: { path: 'routing/session-affinity-ttl', kind: 'string' },
  sessionAffinitySubagents: { path: 'routing/session-affinity-subagents', kind: 'optionalBoolean' },
  streamingKeepaliveSeconds: { path: 'requests/streaming/keepalive-seconds', kind: 'number' },
  streamingSendKeepaliveBeforeFt: {
    path: 'requests/streaming/send-keepalive-before-ft',
    kind: 'boolean',
  },
  streamingBootstrapRetries: { path: 'requests/streaming/bootstrap-retries', kind: 'number' },
  passthroughHeaders: { path: 'requests/passthrough-headers', kind: 'boolean' },
  nonstreamKeepaliveInterval: { path: 'requests/nonstream-keepalive-interval', kind: 'number' },
  upstreamCodexDisableCloaking: { path: 'upstream/codex/disable-codex-cloaking', kind: 'boolean' },
  upstreamCodexStreamBootstrapBuffering: {
    path: 'upstream/codex/stream-bootstrap-buffering',
    kind: 'boolean',
  },
  upstreamCodexModelLevelCooling: { path: 'upstream/codex/model-level-cooling', kind: 'boolean' },
  upstreamCodexOrphanDelegationCompatibility: {
    path: 'upstream/codex/orphan-delegation-compatibility',
    kind: 'boolean',
  },
  upstreamCodexResponseSteering: { path: 'upstream/codex/response-steering', kind: 'boolean' },
  upstreamCodexStreamBootstrapTimeout: {
    path: 'upstream/codex/stream-bootstrap-timeout',
    kind: 'string',
  },
  upstreamClaudeModelLevelCooling: { path: 'upstream/claude/model-level-cooling', kind: 'boolean' },
  upstreamClaudeToolSearch: { path: 'upstream/claude/tool-search', kind: 'boolean' },
  upstreamClaudeDisableCloakMode: {
    path: 'upstream/claude/disable-claude-cloak-mode',
    kind: 'boolean',
  },
  upstreamClaudeDisableCloakingModelList: {
    path: 'upstream/claude/disable-cloaking-model-list',
    kind: 'boolean',
  },
  upstreamClaudeHeaderUserAgent: {
    path: 'upstream/claude/header-defaults/user-agent',
    kind: 'string',
  },
  upstreamClaudeHeaderPackageVersion: {
    path: 'upstream/claude/header-defaults/package-version',
    kind: 'string',
  },
  upstreamClaudeHeaderRuntimeVersion: {
    path: 'upstream/claude/header-defaults/runtime-version',
    kind: 'string',
  },
  upstreamClaudeHeaderOs: { path: 'upstream/claude/header-defaults/os', kind: 'string' },
  upstreamClaudeHeaderArch: { path: 'upstream/claude/header-defaults/arch', kind: 'string' },
  upstreamClaudeHeaderTimeout: { path: 'upstream/claude/header-defaults/timeout', kind: 'string' },
  upstreamClaudeHeaderTimezone: {
    path: 'upstream/claude/header-defaults/timezone',
    kind: 'string',
  },
  upstreamClaudeHeaderStabilizeDeviceProfile: {
    path: 'upstream/claude/header-defaults/stabilize-device-profile',
    kind: 'nullableBoolean',
  },
  upstreamXaiInjectXSearch: { path: 'upstream/xai/inject-x-search', kind: 'boolean' },
  clientCodexOptimizeMultiAgentV2: {
    path: 'client/codex/optimize-multi-agent-v2',
    kind: 'boolean',
  },
  oauthAuthDir: { path: 'oauth/auth-dir', kind: 'string' },
  oauthCodexHeaderUserAgent: {
    path: 'oauth/providers/codex/header-defaults/user-agent',
    kind: 'string',
  },
  oauthCodexHeaderBetaFeatures: {
    path: 'oauth/providers/codex/header-defaults/beta-features',
    kind: 'string',
  },
  liveMediaRelayEnabled: {
    path: 'oauth/providers/codex/live-media-relay/enabled',
    kind: 'boolean',
  },
  liveMediaRelayDisablePrivateRemoteIps: {
    path: 'oauth/providers/codex/live-media-relay/disable-private-remote-ips',
    kind: 'boolean',
  },
  liveMediaRelayMaxSessions: {
    path: 'oauth/providers/codex/live-media-relay/max-sessions',
    kind: 'number',
  },
  liveMediaRelayUdpPortMin: {
    path: 'oauth/providers/codex/live-media-relay/udp-port-min',
    kind: 'number',
  },
  liveMediaRelayUdpPortMax: {
    path: 'oauth/providers/codex/live-media-relay/udp-port-max',
    kind: 'number',
  },
  liveMediaRelayPublicIp: {
    path: 'oauth/providers/codex/live-media-relay/public-ip',
    kind: 'string',
  },
  liveMediaRelayIceServersJson: {
    path: 'oauth/providers/codex/live-media-relay/ice-servers',
    kind: 'jsonArray',
  },
  devinLiteralReplacements: {
    path: 'oauth/providers/devin/sensitive-words-replace',
    kind: 'literalReplacements',
  },
  devinPatternReplacements: {
    path: 'oauth/providers/devin/sensitive-patterns-replace',
    kind: 'patternReplacements',
  },
  devinSensitiveWordsJson: { path: 'oauth/providers/devin/sensitive-words', kind: 'stringList' },
  oauthRequestScopedErrorsJson: { path: 'oauth/request-scoped-errors', kind: 'jsonObject' },
  antigravityTosPauseWindow: {
    path: 'oauth/providers/antigravity/tos-pause-window',
    kind: 'string',
  },
  antigravityCredits: { path: 'oauth/providers/antigravity/antigravity-credits', kind: 'boolean' },
  antigravitySignatureCacheEnabled: {
    path: 'oauth/providers/antigravity/signature-cache-enabled',
    kind: 'nullableBoolean',
  },
  antigravitySignatureBypassStrict: {
    path: 'oauth/providers/antigravity/signature-bypass-strict',
    kind: 'nullableBoolean',
  },
  antigravityConnPoolEnabled: {
    path: 'oauth/providers/antigravity/connection-pool/enabled',
    kind: 'boolean',
  },
  antigravityConnPoolIdleTimeout: {
    path: 'oauth/providers/antigravity/connection-pool/idle-conn-timeout',
    kind: 'string',
  },
  antigravityConnPoolMaxIdleConnsPerHost: {
    path: 'oauth/providers/antigravity/connection-pool/max-idle-conns-per-host',
    kind: 'number',
  },
  multimediaGptImage2BaseModel: { path: 'multimedia/gpt-image-2-base-model', kind: 'string' },
  multimediaVideoResultAuthCacheTtl: {
    path: 'multimedia/video-result-auth-cache-ttl',
    kind: 'string',
  },
  pprofEnable: { path: 'observability/pprof/enable', kind: 'boolean' },
  pprofAddr: { path: 'observability/pprof/addr', kind: 'string' },
  redisUsageQueueRetentionSeconds: {
    path: 'observability/usage/redis-usage-queue-retention-seconds',
    kind: 'number',
  },
}

export function hasOAuthChannelConflict(change: ConfigChange, current: ConfigFieldValue) {
  const before = parseJsonObjectText(change.previousValue)
  const after = parseJsonObjectText(change.nextValue)
  const latest = typeof current === 'string' && current.trim() ? parseJsonText(current) : {}
  if (!isRecord(latest)) return true
  return changedOAuthChannels(before, after).some((channel) => {
    const value = oauthChannelValue(latest, channel)
    return (
      !sameConfigValue(value, oauthChannelValue(before, channel)) &&
      !sameConfigValue(value, oauthChannelValue(after, channel))
    )
  })
}

export async function applyConfigChange(session: ManagementSessionInput, change: ConfigChange) {
  const client = createManagementClient(session)
  // Keep false/0/null as request bodies and JSON-looking strings as strings.
  const putJson = (url: string, value: unknown) =>
    client.put(url, JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
  const deleteOptional = async (path: string) => {
    try {
      await client.delete(path)
    } catch (error) {
      if (!isMissingConfigPath(error)) throw error
    }
  }
  const target = configWriteTargets[change.key]
  const url = `/config/${target.path}`

  if (target.kind === 'alias' || target.kind === 'modelSettings') {
    const before = parseJsonObjectText(change.previousValue)
    const after = parseJsonObjectText(change.nextValue)
    const channels = changedOAuthChannels(before, after)
    const invalid =
      target.kind === 'alias'
        ? hasIncompleteAliasChanges(before, after)
        : hasInvalidModelSettingChanges(before, after)
    if (invalid || channels.some((channel) => !isOAuthChannelKey(channel))) {
      throw new Error(
        target.kind === 'alias' ? 'Invalid OAuth model alias' : 'Invalid OAuth model setting',
      )
    }
    const pending: { path: string; channel: string; value: unknown; shrinks: boolean }[] = []
    for (const channel of channels) {
      const path = url + '/' + encodeURIComponent(channel)
      let current: unknown
      try {
        current = (await client.get<unknown>(path)).data
      } catch (error) {
        if (!isMissingConfigPath(error)) throw error
      }
      const next = oauthChannelValue(after, channel)
      if (sameConfigValue(current, next)) continue
      if (!sameConfigValue(current, oauthChannelValue(before, channel)))
        throw new ConfigEditConflict()
      pending.push({
        path,
        channel,
        value: next,
        shrinks: Array.isArray(current) && Array.isArray(next) && next.length < current.length,
      })
    }
    // Store destinations before deleting sources when a rule moves to another channel.
    pending.sort((left, right) => Number(left.shrinks) - Number(right.shrinks))
    for (const { path, channel, value } of pending) {
      if (value === undefined) continue
      try {
        await putJson(path, value)
      } catch (error) {
        const { status, backendCode } = toManagementApiError(error)
        if (
          target.kind !== 'modelSettings' ||
          oauthChannelValue(before, channel) !== undefined ||
          status !== 400 ||
          backendCode !== 'invalid_path'
        )
          throw error
        // A child PUT cannot traverse an explicitly null mapping. A V8 PATCH
        // initializes it while merging just this provider into the OAuth tree.
        const { data: oauth } = await client.get<unknown>('/config/oauth')
        if (oauth !== null && !(isRecord(oauth) && oauth.settings === null)) throw error
        await client.patch('/config/oauth', { settings: { [channel]: value } })
      }
    }
    for (const { path, value } of pending) if (value === undefined) await deleteOptional(path)
    return
  }

  if (target.kind === 'payload') {
    const payload = sanitizePayloadForWrite(
      parseJsonObjectText(change.nextValue),
      parseJsonObjectText(change.previousValue),
    )
    const hasRules = Object.values(payload).some(
      (section) => Array.isArray(section) && section.length > 0,
    )

    if (hasRules) {
      await putJson(url, payload)
      return
    }

    await deleteOptional(url)
    return
  }

  if (target.kind === 'imageGeneration') {
    const value = change.nextValue

    if (typeof value === 'string' && !value.trim()) {
      await deleteOptional(url)
      return
    }

    await putJson(url, value)
    return
  }

  switch (target.kind) {
    case 'literalReplacements':
    case 'patternReplacements':
      await putJson(
        url,
        serializeReplacementRows(target.kind, parseReplacementDraft(change.nextValue)),
      )
      return
    case 'boolean':
      await putJson(url, change.nextValue)
      return
    case 'number':
      await putJson(url, Number(change.nextValue))
      return
    case 'optionalBoolean':
      if (change.nextValue === null) await deleteOptional(url)
      else await putJson(url, change.nextValue)
      return
    case 'nullableBoolean':
      await putJson(url, change.nextValue === null ? null : Boolean(change.nextValue))
      return
    case 'string': {
      const value = typeof change.nextValue === 'string' ? change.nextValue.trim() : ''
      if (!value) {
        await deleteOptional(url)
        return
      }
      await putJson(url, value)
      return
    }
    case 'stringList': {
      const items = parseJsonArrayText(change.nextValue)
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
      await putJson(url, items)
      return
    }
    case 'jsonObject':
      await putJson(url, parseJsonObjectText(change.nextValue))
      return
    case 'jsonArray':
      await putJson(url, parseJsonArrayText(change.nextValue))
      return
  }
}

// Home's V8 validator and older yaml.v3 KnownFields decoders report unknown keys differently.
const unknownConfigField =
  /^(?:unknown (?:configuration field|field|v8 configuration section|API-key provider)\b|removed configuration field\b|legacy field\b|api-keys\.\S+: unsupported group field\b)|^\s*(?:line \d+: )?field [\w.-]+ not found in type \S+/im

export class ConfigFieldSaveError extends Error {
  readonly key: WritableConfigFieldKey
  readonly savedKeys: WritableConfigFieldKey[]
  readonly reason: 'unavailable' | 'unsupported' | 'rejected' | 'conflict' | 'failed'
  readonly status?: number

  constructor(key: WritableConfigFieldKey, savedKeys: WritableConfigFieldKey[], cause: unknown) {
    const apiError = toManagementApiError(cause)
    super(apiError.message, { cause })
    this.key = key
    this.savedKeys = savedKeys
    const { status, backendCode, message } = apiError
    this.status = status
    if (cause instanceof ConfigEditConflict) this.reason = 'conflict'
    else if (status === 405 || status === 501 || (status === 404 && !backendCode))
      this.reason = 'unavailable'
    else if (
      (status === 400 || status === 422) &&
      backendCode === 'invalid_config' &&
      unknownConfigField.test(message)
    )
      this.reason = 'unsupported'
    else if (status === 400 || status === 422) this.reason = 'rejected'
    else this.reason = 'failed'
  }
}

export async function applyConfigChanges(session: ManagementSessionInput, changes: ConfigChange[]) {
  const savedKeys: WritableConfigFieldKey[] = []
  for (const change of changes) {
    try {
      await applyConfigChange(session, change)
      savedKeys.push(change.key)
    } catch (error) {
      throw new ConfigFieldSaveError(change.key, savedKeys, error)
    }
  }
}

export function toConfigApiError(error: unknown): ManagementApiError {
  return toManagementApiError(error)
}
