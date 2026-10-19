import type { AxiosInstance } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput, RuntimeMode } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type ProviderId =
  | 'gemini'
  | 'interactions'
  | 'claude'
  | 'codex'
  | 'xai'
  | 'meta'
  | 'vertex'
  | 'openaiCompatibility'
export type ProviderModelChannel =
  | 'claude'
  | 'gemini'
  | 'gemini-interactions'
  | 'vertex'
  | 'aistudio'
  | 'codex'
  | 'kimi'
  | 'antigravity'
  | 'xai'
  | 'meta'

export const PROVIDER_THINKING_LEVELS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'auto',
] as const

export const PROVIDER_ERROR_RULE_ACTIONS = [
  'stop',
  'stop-and-cooldown',
  'continue',
  'continue-and-cooldown',
] as const

export type ProviderErrorRuleAction = (typeof PROVIDER_ERROR_RULE_ACTIONS)[number]

export type ProviderRequestScopedErrorRule = {
  status: number
  match?: string[]
  'match-regexr'?: string[]
  action: ProviderErrorRuleAction
}

export type ProviderApiKeyEntryInput = {
  id?: string
  apiKey: string
  existingApiKey?: string
  proxyUrl: string
  weight?: number | null
}

export type ProviderDescriptor = {
  id: ProviderId
  path: string
  responseKey: string
  supportsName: boolean
  supportsApiKey: boolean
  disabledMode: 'auth-status' | 'provider-payload'
  requiresBaseUrl: boolean
  defaultBaseUrl: string
  modelDefinitionChannel: ProviderModelChannel | null
  supportsModelDiscovery: boolean
  supportsConnectivityTest: boolean
  supportsCloak: boolean
  supportsWebsockets: boolean
  supportsRichModelAliases: boolean
}

export type ProviderEntryFormInput = {
  apiKey: string
  name: string
  baseUrl: string
  proxyUrl: string
  prefix: string
  disabled: boolean
  disableCooling: boolean | null
  websockets: boolean
  priority?: number
  weight?: number | null
  requestRetry?: number | null
  models: ProviderModelEntryInput[]
  headers: ProviderHeaderEntryInput[]
  excludedModelsText: string
  testModel?: string
  cloak?: ProviderCloakInput
  requestScopedErrors?: ProviderRequestScopedErrorRule[]
  disableCodexCloaking?: boolean | null
  alphaSearch?: boolean
  rebuildMidSystemMessage?: boolean
  nativeToolSearch?: boolean
  fingerprintProfile?: string
  experimentalCchSigning?: boolean
  supportPromptCacheKey?: boolean
  apiKeyEntries?: ProviderApiKeyEntryInput[]
}

export type ProviderCloakInput = {
  mode: string
  strictMode: boolean
  cacheUserId: boolean
  sensitiveWordsText: string
}

export type ProviderModelEntryInput = {
  name: string
  alias: string
  displayName: string
  forceMapping: boolean
  maxContextLength?: string
  isCompat?: boolean
  supportConfigurationUpdate?: boolean
  image?: boolean
  inputModalitiesText?: string
  outputModalitiesText?: string
  useMaxCompletionTokens?: boolean
  thinkingEnabled?: boolean
  thinkingLevels?: string[]
  thinkingMin?: string
  thinkingMax?: string
  thinkingZeroAllowed?: boolean
  thinkingDynamicAllowed?: boolean
  raw?: UnknownRecord
}

export type ProviderHeaderEntryInput = {
  key: string
  value: string
}

export type ProviderDiscoveredModel = {
  name: string
  alias: string | null
  description: string | null
}

export type ProviderModelDiscoveryInput = {
  providerId: ProviderId
  baseUrl: string
  apiKey: string
  authIndex?: string | null
  headers: ProviderHeaderEntryInput[]
}

export type ProviderConnectivityTestInput = ProviderModelDiscoveryInput & {
  testModel?: string
  models: ProviderModelEntryInput[]
}

export type ProviderRequestIssue = {
  providerId: ProviderId
  kind: 'unsupported' | 'error'
  message: string
  status?: number
  code?: string
}

export type ProviderResource = {
  id: string
  providerId: ProviderId
  index: number
  identifier: string
  authIndex: string | null
  name: string | null
  apiKeyPreview: string | null
  baseUrl: string | null
  proxyUrl: string | null
  prefix: string | null
  disabled: boolean
  disableCooling: boolean
  disableCoolingOverride?: boolean | null
  websockets: boolean
  priority: number | null
  weight?: number | null
  requestRetry: number | null
  modelCount: number
  headerCount: number
  excludedModelCount: number
  apiKeyEntryCount: number
  selector: UnknownRecord
  raw: UnknownRecord
}

export type ProviderModelDefinition = {
  id: string
  displayName: string
  name: string | null
  version: string | null
  ownedBy: string | null
  type: string | null
  description: string | null
  inputTokenLimit: number | null
  outputTokenLimit: number | null
  contextLength: number | null
  maxCompletionTokens: number | null
  supportedParameters: string[]
  inputModalities: string[]
  outputModalities: string[]
  thinkingLevels: string[]
  raw: UnknownRecord
}

export type ProviderGroup = ProviderDescriptor & {
  resources: ProviderResource[]
  issue: ProviderRequestIssue | null
}

type ProvidersSnapshot = {
  fetchedAt: string
  groups: ProviderGroup[]
  issues: ProviderRequestIssue[]
}

type ProviderModelDefinitionsSnapshot = {
  channel: ProviderModelChannel
  fetchedAt: string
  models: ProviderModelDefinition[]
}

const providerModelDefinitionChannels: ProviderModelChannel[] = [
  'gemini',
  'gemini-interactions',
  'claude',
  'codex',
  'vertex',
  'aistudio',
  'kimi',
  'antigravity',
  'xai',
  'meta',
]

export function getProviderModelDefinitionChannels(runtimeMode: RuntimeMode) {
  return runtimeMode === 'cpa'
    ? providerModelDefinitionChannels.filter((channel) => channel !== 'xai')
    : providerModelDefinitionChannels
}

const providerDescriptors: ProviderDescriptor[] = [
  {
    id: 'gemini',
    path: '/config/api-keys/gemini',
    responseKey: 'gemini',
    supportsName: false,
    supportsApiKey: true,
    disabledMode: 'auth-status',
    requiresBaseUrl: false,
    defaultBaseUrl: '',
    modelDefinitionChannel: 'gemini',
    supportsModelDiscovery: true,
    supportsConnectivityTest: false,
    supportsCloak: false,
    supportsWebsockets: false,
    supportsRichModelAliases: true,
  },
  {
    id: 'interactions',
    path: '/config/api-keys/interactions',
    responseKey: 'interactions',
    supportsName: false,
    supportsApiKey: true,
    disabledMode: 'auth-status',
    requiresBaseUrl: false,
    defaultBaseUrl: '',
    modelDefinitionChannel: 'gemini-interactions',
    supportsModelDiscovery: true,
    supportsConnectivityTest: false,
    supportsCloak: false,
    supportsWebsockets: false,
    supportsRichModelAliases: true,
  },
  {
    id: 'claude',
    path: '/config/api-keys/claude',
    responseKey: 'claude',
    supportsName: false,
    supportsApiKey: true,
    disabledMode: 'auth-status',
    requiresBaseUrl: false,
    defaultBaseUrl: '',
    modelDefinitionChannel: 'claude',
    supportsModelDiscovery: true,
    supportsConnectivityTest: true,
    supportsCloak: true,
    supportsWebsockets: false,
    supportsRichModelAliases: true,
  },
  {
    id: 'codex',
    path: '/config/api-keys/codex',
    responseKey: 'codex',
    supportsName: false,
    supportsApiKey: true,
    disabledMode: 'auth-status',
    requiresBaseUrl: true,
    defaultBaseUrl: '',
    modelDefinitionChannel: 'codex',
    supportsModelDiscovery: true,
    supportsConnectivityTest: false,
    supportsCloak: false,
    supportsWebsockets: true,
    supportsRichModelAliases: true,
  },
  {
    id: 'xai',
    path: '/config/api-keys/xai',
    responseKey: 'xai',
    supportsName: false,
    supportsApiKey: true,
    disabledMode: 'auth-status',
    requiresBaseUrl: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    modelDefinitionChannel: 'xai',
    supportsModelDiscovery: false,
    supportsConnectivityTest: false,
    supportsCloak: false,
    supportsWebsockets: true,
    supportsRichModelAliases: true,
  },
  {
    id: 'meta',
    path: '/config/api-keys/meta',
    responseKey: 'meta',
    supportsName: false,
    supportsApiKey: true,
    disabledMode: 'auth-status',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.meta.ai/v1',
    modelDefinitionChannel: 'meta',
    supportsModelDiscovery: true,
    supportsConnectivityTest: false,
    supportsCloak: false,
    supportsWebsockets: true,
    supportsRichModelAliases: true,
  },
  {
    id: 'vertex',
    path: '/config/api-keys/vertex',
    responseKey: 'vertex',
    supportsName: false,
    supportsApiKey: true,
    disabledMode: 'auth-status',
    requiresBaseUrl: false,
    defaultBaseUrl: '',
    modelDefinitionChannel: 'vertex',
    supportsModelDiscovery: false,
    supportsConnectivityTest: false,
    supportsCloak: false,
    supportsWebsockets: false,
    supportsRichModelAliases: true,
  },
  {
    id: 'openaiCompatibility',
    path: '/config/api-keys/openai-compatibility',
    responseKey: 'openai-compatibility',
    supportsName: true,
    supportsApiKey: true,
    disabledMode: 'provider-payload',
    requiresBaseUrl: true,
    defaultBaseUrl: '',
    modelDefinitionChannel: null,
    supportsModelDiscovery: true,
    supportsConnectivityTest: true,
    supportsCloak: false,
    supportsWebsockets: false,
    supportsRichModelAliases: true,
  },
]

const DEFAULT_CLAUDE_BASE_URL = 'https://api.anthropic.com'
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com'
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_CONNECTIVITY_TIMEOUT_MS = 30_000

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readString(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readNonNegativeInteger(record: UnknownRecord, key: string): number | null {
  const value = readNumber(record, key)
  return value !== null && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function readStringArray(record: UnknownRecord, key: string): string[] {
  const value = record[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function readBoolean(record: UnknownRecord, key: string): boolean {
  return record[key] === true
}

function hasDisableAllModelsRule(record: UnknownRecord) {
  return readStringArray(record, 'excluded-models').some((item) => item.trim() === '*')
}

function countArray(record: UnknownRecord, key: string): number {
  const value = record[key]
  return Array.isArray(value) ? value.length : 0
}

function countRecordKeys(record: UnknownRecord, key: string): number {
  const value = record[key]
  return isRecord(value) ? Object.keys(value).length : 0
}

function readProviderEntries(responseData: unknown, responseKey: string): UnknownRecord[] {
  // v8 GET returns a bare group array; fall back to an object wrapper defensively.
  if (Array.isArray(responseData)) {
    return responseData.filter(isRecord)
  }
  const value = toRecord(responseData)[responseKey]
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function readModelDefinitionEntries(responseData: unknown): UnknownRecord[] {
  const value = toRecord(responseData).models
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function parseResponseBody(value: unknown) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

function maskSecret(value: string | null): string | null {
  if (!value) return null
  if (value.length <= 10) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function normalizeIssue(providerId: ProviderId, error: unknown): ProviderRequestIssue {
  const apiError = toManagementApiError(error)

  return {
    providerId,
    kind: apiError.status === 404 || apiError.code === 'not-found' ? 'unsupported' : 'error',
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
  }
}

function readGroupKeys(group: UnknownRecord): UnknownRecord[] {
  const value = group.keys
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function createSelector(descriptor: ProviderDescriptor, record: UnknownRecord, index: number) {
  const id = readString(record, 'id')
  const uuid = readString(record, 'uuid')
  const authIndex = readString(record, 'auth_index') ?? readString(record, 'auth-index')
  const name = readString(record, 'name')

  if (id) return { id }
  if (uuid) return { uuid }
  if (authIndex) return { auth_index: authIndex }

  if (descriptor.supportsName && name) {
    return { name }
  }

  return { index }
}

function createNativeKeySelector(key: UnknownRecord, group: UnknownRecord, index: number) {
  const id = readString(key, 'id') ?? readString(key, 'uuid')
  if (id) return { id }

  const authIndex =
    readString(key, 'auth_index') ??
    readString(key, 'auth-index') ??
    readString(group, 'auth_index') ??
    readString(group, 'auth-index')
  if (authIndex) return { auth_index: authIndex }

  const apiKey = readString(key, 'api-key')
  if (apiKey) {
    const baseUrl = readString(group, 'base-url')
    return baseUrl ? { 'api-key': apiKey, 'base-url': baseUrl } : { 'api-key': apiKey }
  }

  return { index }
}

function readAuthIndex(record: UnknownRecord) {
  return readString(record, 'auth_index') ?? readString(record, 'auth-index')
}

function normalizeNativeKeyResource(
  descriptor: ProviderDescriptor,
  group: UnknownRecord,
  key: UnknownRecord,
  index: number,
): ProviderResource {
  // Effective credential view: group fields with the key's own overrides winning.
  const record = { ...group, ...key }
  delete record.keys

  const authIndex = readAuthIndex(key) ?? readAuthIndex(group)
  const name = readString(record, 'name')
  const id =
    readString(key, 'id') ?? readString(key, 'uuid') ?? authIndex ?? `${descriptor.id}-${index + 1}`

  return {
    id: `${descriptor.id}:${id}`,
    providerId: descriptor.id,
    index,
    identifier: name ?? authIndex ?? id,
    authIndex,
    name,
    apiKeyPreview: maskSecret(readString(key, 'api-key')),
    baseUrl: readString(group, 'base-url'),
    proxyUrl: readString(record, 'proxy-url'),
    prefix: readString(record, 'prefix'),
    disabled: readBoolean(record, 'disabled') || hasDisableAllModelsRule(record),
    disableCooling: readBoolean(record, 'disable-cooling'),
    disableCoolingOverride:
      typeof record['disable-cooling'] === 'boolean' ? record['disable-cooling'] : null,
    websockets: readBoolean(key, 'websockets'),
    priority: readNumber(record, 'priority'),
    weight: readNumber(key, 'weight'),
    requestRetry:
      readNonNegativeInteger(record, 'request-retry') ??
      readNonNegativeInteger(record, 'request_retry'),
    modelCount: countArray(record, 'models'),
    headerCount: countRecordKeys(record, 'headers'),
    excludedModelCount: countArray(record, 'excluded-models'),
    apiKeyEntryCount: readGroupKeys(group).length,
    selector: createNativeKeySelector(key, group, index),
    raw: record,
  }
}

function normalizeCompatibilityResource(
  descriptor: ProviderDescriptor,
  record: UnknownRecord,
  index: number,
): ProviderResource {
  const authIndex = readAuthIndex(record)
  const name = readString(record, 'name')
  const firstKey = readGroupKeys(record)[0] ?? {}
  const id =
    readString(record, 'id') ??
    readString(record, 'uuid') ??
    authIndex ??
    name ??
    `${descriptor.id}-${index + 1}`

  return {
    id: `${descriptor.id}:${id}`,
    providerId: descriptor.id,
    index,
    identifier: name ?? authIndex ?? id,
    authIndex,
    name,
    apiKeyPreview: maskSecret(readString(firstKey, 'api-key') ?? readString(record, 'api-key')),
    baseUrl: readString(record, 'base-url'),
    proxyUrl: readString(record, 'proxy-url') ?? readString(firstKey, 'proxy-url'),
    prefix: readString(record, 'prefix'),
    disabled: readBoolean(record, 'disabled') || hasDisableAllModelsRule(record),
    disableCooling: readBoolean(record, 'disable-cooling'),
    disableCoolingOverride:
      typeof record['disable-cooling'] === 'boolean' ? record['disable-cooling'] : null,
    websockets: readBoolean(record, 'websockets'),
    priority: readNumber(record, 'priority'),
    weight: readNumber(firstKey, 'weight'),
    requestRetry:
      readNonNegativeInteger(record, 'request-retry') ??
      readNonNegativeInteger(record, 'request_retry'),
    modelCount: countArray(record, 'models'),
    headerCount: countRecordKeys(record, 'headers'),
    excludedModelCount: countArray(record, 'excluded-models'),
    apiKeyEntryCount: Array.isArray(record.keys)
      ? record.keys.length
      : countArray(record, 'api-key-entries'),
    selector: createSelector(descriptor, record, index),
    raw: record,
  }
}

function normalizeProviderResources(
  descriptor: ProviderDescriptor,
  family: UnknownRecord[],
): ProviderResource[] {
  if (descriptor.id === 'openaiCompatibility') {
    return family.map((record, index) => normalizeCompatibilityResource(descriptor, record, index))
  }

  // Home may persist one native group per credential or group several keys
  // together; the console lists one resource per key either way.
  const resources: ProviderResource[] = []
  for (const group of family) {
    for (const key of readGroupKeys(group)) {
      resources.push(normalizeNativeKeyResource(descriptor, group, key, resources.length))
    }
  }
  return resources
}

function normalizeProviderModelDefinition(
  record: UnknownRecord,
  index: number,
): ProviderModelDefinition {
  const id = readString(record, 'id') ?? readString(record, 'name') ?? `model-${index + 1}`
  const name = readString(record, 'name')
  const thinking = toRecord(record.thinking)

  return {
    id,
    displayName: readString(record, 'display_name') ?? name ?? id,
    name,
    version: readString(record, 'version'),
    ownedBy: readString(record, 'owned_by'),
    type: readString(record, 'type'),
    description: readString(record, 'description'),
    inputTokenLimit: readNumber(record, 'inputTokenLimit'),
    outputTokenLimit: readNumber(record, 'outputTokenLimit'),
    contextLength: readNumber(record, 'context_length'),
    maxCompletionTokens: readNumber(record, 'max_completion_tokens'),
    supportedParameters: readStringArray(record, 'supported_parameters'),
    inputModalities: readStringArray(record, 'supportedInputModalities'),
    outputModalities: readStringArray(record, 'supportedOutputModalities'),
    thinkingLevels: readStringArray(thinking, 'levels'),
    raw: record,
  }
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function createHeaderPayload(entries: ProviderHeaderEntryInput[]) {
  return entries.reduce<UnknownRecord>((payload, entry) => {
    const key = entry.key.trim()
    if (!key) return payload
    payload[key] = entry.value
    return payload
  }, {})
}

function createStringHeaderPayload(entries: ProviderHeaderEntryInput[]) {
  return entries.reduce<Record<string, string>>((payload, entry) => {
    const key = entry.key.trim()
    if (!key) return payload
    payload[key] = entry.value
    return payload
  }, {})
}

function hasHeader(headers: Record<string, string>, name: string) {
  const target = name.toLowerCase()
  return Object.keys(headers).some((key) => key.toLowerCase() === target)
}

function normalizeApiBase(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function buildModelsEndpoint(baseUrl: string) {
  const normalized = normalizeApiBase(baseUrl)
  if (!normalized) return ''
  const trimmed = normalized.replace(/\/+$/g, '')
  if (/\/models$/i.test(trimmed)) return trimmed
  return `${trimmed}/models`
}

function buildV1ModelsEndpoint(baseUrl: string) {
  const normalized = normalizeApiBase(baseUrl)
  if (!normalized) return ''
  const trimmed = normalized.replace(/\/+$/g, '')
  if (/\/v1\/models$/i.test(trimmed)) return trimmed
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/models`
  return `${trimmed}/v1/models`
}

function buildClaudeModelsEndpoint(baseUrl: string) {
  const normalized = normalizeApiBase(baseUrl) || DEFAULT_CLAUDE_BASE_URL
  let trimmed = normalized.replace(/\/+$/g, '')
  trimmed = trimmed.replace(/\/v1\/models$/i, '')
  trimmed = trimmed.replace(/\/v1(?:\/.*)?$/i, '')
  return `${trimmed}/v1/models`
}

function buildClaudeMessagesEndpoint(baseUrl: string) {
  const normalized = normalizeApiBase(baseUrl) || DEFAULT_CLAUDE_BASE_URL
  let trimmed = normalized.replace(/\/+$/g, '')
  trimmed = trimmed.replace(/\/v1\/messages$/i, '')
  trimmed = trimmed.replace(/\/v1(?:\/.*)?$/i, '')
  return `${trimmed}/v1/messages`
}

function buildOpenAIChatCompletionsEndpoint(baseUrl: string) {
  const normalized = normalizeApiBase(baseUrl)
  if (!normalized) return ''
  const trimmed = normalized.replace(/\/+$/g, '')
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

function buildGeminiModelsEndpoint(baseUrl: string) {
  const normalized = normalizeApiBase(baseUrl) || DEFAULT_GEMINI_BASE_URL
  let trimmed = normalized.replace(/\/+$/g, '')
  trimmed = trimmed.replace(/\/v1beta\/models$/i, '')
  trimmed = trimmed.replace(/\/v1beta(?:\/.*)?$/i, '')
  return `${trimmed}/v1beta/models`
}

function stripGeminiModelResourceName(value: string) {
  return value.trim().replace(/^\/?models\//i, '')
}

function normalizeDiscoveredModels(payload: unknown, { dedupe = true } = {}) {
  const toModel = (entry: unknown): ProviderDiscoveredModel | null => {
    if (typeof entry === 'string' && entry.trim()) {
      return { name: entry.trim(), alias: null, description: null }
    }
    if (!isRecord(entry)) return null

    const name =
      readString(entry, 'id') ??
      readString(entry, 'name') ??
      readString(entry, 'model') ??
      readString(entry, 'value')
    if (!name) return null

    const alias =
      readString(entry, 'alias') ??
      readString(entry, 'display_name') ??
      readString(entry, 'displayName')
    const description =
      readString(entry, 'description') ?? readString(entry, 'note') ?? readString(entry, 'comment')

    return {
      name,
      alias: alias && alias !== name ? alias : null,
      description,
    }
  }

  const record = toRecord(payload)
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.models)
        ? record.models
        : []
  const normalized = source
    .map(toModel)
    .filter((model): model is ProviderDiscoveredModel => Boolean(model))

  if (!dedupe) return normalized

  const seen = new Set<string>()
  return normalized.filter((model) => {
    const key = model.name.toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getApiCallErrorMessage(statusCode: number | null, payload: unknown, bodyText: string) {
  let message = ''
  const body = toRecord(payload)
  const error = body.error

  if (isRecord(error)) {
    message = readString(error, 'message') ?? ''
  } else if (typeof error === 'string') {
    message = error
  }

  if (!message) {
    message = readString(body, 'message') ?? ''
  }

  if (!message && bodyText.trim()) {
    message = bodyText.trim()
  }

  if (statusCode && message) return `${statusCode} ${message}`
  if (statusCode) return `HTTP ${statusCode}`
  return message || 'Request failed'
}

async function runProviderModelApiCall(
  client: AxiosInstance,
  input: { authIndex?: string; url: string; headers: Record<string, string> },
) {
  return runProviderApiCall(client, {
    authIndex: input.authIndex,
    method: 'GET',
    url: input.url,
    headers: input.headers,
  })
}

async function runProviderApiCall(
  client: AxiosInstance,
  input: {
    authIndex?: string
    method: 'GET' | 'POST'
    url: string
    headers: Record<string, string>
    data?: string
    timeout?: number
  },
) {
  const response = await client.post<unknown>(
    '/requests/api-call',
    {
      auth_index: input.authIndex?.trim() || undefined,
      method: input.method,
      url: input.url,
      header: Object.keys(input.headers).length ? input.headers : undefined,
      data: input.data,
    },
    input.timeout ? { timeout: input.timeout } : undefined,
  )
  const record = toRecord(response.data)
  const statusCode =
    typeof record.status_code === 'number' && Number.isFinite(record.status_code)
      ? record.status_code
      : null
  const bodyText = typeof record.body === 'string' ? record.body : ''
  const body = parseResponseBody(record.body)

  if (statusCode === null || statusCode < 200 || statusCode >= 300) {
    throw new Error(getApiCallErrorMessage(statusCode, body, bodyText))
  }

  return body
}

function parseModalityList(value: string | undefined): string[] {
  if (!value) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value.split(/[\s,]+/)) {
    const trimmed = item.trim().toLowerCase()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

function buildModelThinkingPayload(
  entry: ProviderModelEntryInput,
  existingThinking?: UnknownRecord,
): UnknownRecord | undefined {
  if (entry.thinkingEnabled === undefined) {
    return existingThinking
  }
  if (!entry.thinkingEnabled) {
    return undefined
  }

  const nextThinking: UnknownRecord = existingThinking ? { ...existingThinking } : {}
  delete nextThinking.zero_allowed
  delete nextThinking.dynamic_allowed

  if (entry.thinkingLevels !== undefined) {
    const levels = Array.from(
      new Set(entry.thinkingLevels.map((level) => level.trim().toLowerCase()).filter(Boolean)),
    )
    if (levels.length > 0) {
      nextThinking.levels = levels
    } else {
      delete nextThinking.levels
    }
  }

  if (entry.thinkingMin !== undefined) {
    const trimmed = entry.thinkingMin.trim()
    const parsed = trimmed ? Number(trimmed) : Number.NaN
    if (trimmed && Number.isSafeInteger(parsed) && parsed >= 0) {
      nextThinking.min = parsed
    } else {
      delete nextThinking.min
    }
  }

  if (entry.thinkingMax !== undefined) {
    const trimmed = entry.thinkingMax.trim()
    const parsed = trimmed ? Number(trimmed) : Number.NaN
    if (trimmed && Number.isSafeInteger(parsed) && parsed >= 0) {
      nextThinking.max = parsed
    } else {
      delete nextThinking.max
    }
  }

  if (entry.thinkingZeroAllowed !== undefined) {
    if (entry.thinkingZeroAllowed) {
      nextThinking['zero-allowed'] = true
    } else {
      delete nextThinking['zero-allowed']
    }
  }

  if (entry.thinkingDynamicAllowed !== undefined) {
    if (entry.thinkingDynamicAllowed) {
      nextThinking['dynamic-allowed'] = true
    } else {
      delete nextThinking['dynamic-allowed']
    }
  }

  // An explicit empty object suppresses backend defaults; omission inherits them.
  return nextThinking
}

function createModelPayload(
  entries: ProviderModelEntryInput[],
  descriptor: ProviderDescriptor,
  existingModels: UnknownRecord[] = [],
) {
  const existingByName = new Map<string, UnknownRecord>()
  for (const model of existingModels) {
    const name = readString(model, 'name')
    if (name && !existingByName.has(name)) {
      existingByName.set(name, model)
    }
  }

  return entries
    .map((entry) => {
      const name = entry.name.trim()
      if (!name) return null

      const baseRaw = entry.raw ?? existingByName.get(name)
      const payload: UnknownRecord = baseRaw ? { ...baseRaw } : {}
      payload.name = name

      const alias = entry.alias.trim()
      if (alias && alias !== name) {
        payload.alias = alias
      } else {
        delete payload.alias
      }

      if (descriptor.supportsRichModelAliases) {
        const displayName = entry.displayName.trim()
        if (displayName) {
          payload['display-name'] = displayName
        } else {
          delete payload['display-name']
        }

        if (entry.forceMapping) {
          payload['force-mapping'] = true
        } else {
          delete payload['force-mapping']
        }
      }

      if (descriptor.id !== 'vertex') {
        if (entry.maxContextLength !== undefined) {
          const trimmed = entry.maxContextLength.trim()
          const parsed = trimmed ? Number(trimmed) : Number.NaN
          if (trimmed && Number.isSafeInteger(parsed) && parsed > 0) {
            payload['max-context-length'] = parsed
          } else {
            delete payload['max-context-length']
          }
        }

        if (entry.isCompat !== undefined) {
          if (entry.isCompat) {
            payload['is-compat'] = true
          } else {
            delete payload['is-compat']
          }
        }
      }

      if (descriptor.id === 'codex' && entry.supportConfigurationUpdate !== undefined) {
        if (entry.supportConfigurationUpdate) {
          payload['support-configuration-update'] = true
        } else {
          delete payload['support-configuration-update']
        }
      }

      if (descriptor.id === 'openaiCompatibility') {
        if (entry.image !== undefined) {
          if (entry.image) {
            payload.image = true
          } else {
            delete payload.image
          }
        }

        if (entry.inputModalitiesText !== undefined) {
          const modalities = parseModalityList(entry.inputModalitiesText)
          if (modalities.length > 0) {
            payload['input-modalities'] = modalities
          } else {
            delete payload['input-modalities']
          }
        }

        if (entry.outputModalitiesText !== undefined) {
          const modalities = parseModalityList(entry.outputModalitiesText)
          if (modalities.length > 0) {
            payload['output-modalities'] = modalities
          } else {
            delete payload['output-modalities']
          }
        }

        if (entry.useMaxCompletionTokens !== undefined) {
          if (entry.useMaxCompletionTokens) {
            payload['use-max-completion-tokens'] = true
          } else {
            delete payload['use-max-completion-tokens']
          }
        }
      }

      const existingThinking = isRecord(baseRaw?.thinking) ? baseRaw.thinking : undefined
      const thinking = buildModelThinkingPayload(entry, existingThinking)
      if (thinking !== undefined) {
        payload.thinking = thinking
      } else {
        delete payload.thinking
      }

      return payload
    })
    .filter((entry): entry is UnknownRecord => Boolean(entry))
}

function pickConnectivityModel(input: ProviderConnectivityTestInput) {
  const explicit = input.testModel?.trim()
  if (explicit) return explicit

  for (const model of input.models) {
    const name = model.name.trim()
    if (name) return name
  }

  return ''
}

function createCloakPayload(input?: ProviderCloakInput) {
  if (!input) return undefined

  const mode = input.mode.trim()
  const sensitiveWords = parseTextList(input.sensitiveWordsText)
  const hasCloak = mode || input.strictMode || input.cacheUserId || sensitiveWords.length > 0
  if (!hasCloak) return undefined

  const payload: UnknownRecord = {
    'strict-mode': input.strictMode,
    'cache-user-id': input.cacheUserId,
  }

  if (mode) payload.mode = mode
  if (sensitiveWords.length) payload['sensitive-words'] = sensitiveWords

  return payload
}

function appendProviderOptions(
  payload: UnknownRecord,
  descriptor: ProviderDescriptor,
  input: ProviderEntryFormInput,
  existingModels: UnknownRecord[] = [],
) {
  payload.priority =
    typeof input.priority === 'number' && Number.isFinite(input.priority) ? input.priority : 0

  const headers = createHeaderPayload(input.headers)
  payload.headers = headers

  const models = createModelPayload(input.models, descriptor, existingModels)
  payload.models = models

  const excludedModels = parseTextList(input.excludedModelsText)
  payload['excluded-models'] = excludedModels

  if (typeof input.disableCooling === 'boolean') {
    payload['disable-cooling'] = input.disableCooling
  }

  if (input.requestRetry !== undefined) {
    payload['request-retry'] =
      input.requestRetry === null
        ? null
        : Number.isSafeInteger(input.requestRetry) && input.requestRetry >= 0
          ? input.requestRetry
          : null
  }

  if (descriptor.id !== 'vertex' && input.requestScopedErrors !== undefined) {
    if (input.requestScopedErrors.length > 0) {
      payload['request-scoped-errors'] = input.requestScopedErrors.map((rule) => {
        const match = rule.match?.map((item) => item.trim()).filter(Boolean) ?? []
        const regexes = rule['match-regexr']?.map((item) => item.trim()).filter(Boolean) ?? []
        return {
          status: rule.status,
          action: rule.action,
          ...(match.length ? { match } : {}),
          ...(regexes.length ? { 'match-regexr': regexes } : {}),
        }
      })
    } else {
      delete payload['request-scoped-errors']
    }
  }
}

// Group fields the entry form does not manage; carried over on update so an
// edit does not silently drop them from the strict-schema PUT.
const NATIVE_GROUP_CARRY_FIELDS = ['name', 'request-scoped-errors']
const COMPATIBILITY_GROUP_CARRY_FIELDS = ['id', 'support-prompt-cache-key', 'request-scoped-errors']
// Provider-specific key options the form does not manage; carried per key.
const NATIVE_KEY_CARRY_FIELDS = [
  'request-scoped-errors',
  'disable-codex-cloaking',
  'alpha-search',
  'experimental-cch-signing',
  'rebuild-mid-system-message',
  'native-tool-search',
  'fingerprint-profile',
]

function createNativeKeyPayload(
  descriptor: ProviderDescriptor,
  input: ProviderEntryFormInput,
  existingKey?: UnknownRecord,
) {
  const existing = existingKey ?? {}
  const payload: UnknownRecord = {}

  // `id` is the credential identity; keeping it preserves the binding on edit.
  const id = readString(existing, 'id') ?? readString(existing, 'uuid')
  if (id) payload.id = id

  const apiKey = input.apiKey.trim() || readString(existing, 'api-key') || ''
  if (apiKey) payload['api-key'] = apiKey

  if (input.weight !== undefined) {
    if (typeof input.weight === 'number' && Number.isSafeInteger(input.weight)) {
      payload.weight = input.weight
    }
  } else {
    const weight = readNumber(existing, 'weight')
    if (weight !== null) payload.weight = weight
  }

  for (const field of NATIVE_KEY_CARRY_FIELDS) {
    if (existing[field] !== undefined) payload[field] = existing[field]
  }

  if (descriptor.id === 'codex') {
    if (input.disableCodexCloaking !== undefined) {
      if (typeof input.disableCodexCloaking === 'boolean') {
        payload['disable-codex-cloaking'] = input.disableCodexCloaking
      } else {
        delete payload['disable-codex-cloaking']
      }
    }
    if (input.alphaSearch !== undefined) {
      if (input.alphaSearch) {
        payload['alpha-search'] = true
      } else {
        delete payload['alpha-search']
      }
    }
  }

  if (descriptor.id === 'claude') {
    if (input.rebuildMidSystemMessage !== undefined) {
      if (input.rebuildMidSystemMessage) {
        payload['rebuild-mid-system-message'] = true
      } else {
        delete payload['rebuild-mid-system-message']
      }
    }
    if (input.nativeToolSearch !== undefined) {
      if (input.nativeToolSearch) {
        payload['native-tool-search'] = true
      } else {
        delete payload['native-tool-search']
      }
    }
    if (input.fingerprintProfile !== undefined) {
      const profile = input.fingerprintProfile.trim()
      if (profile) {
        payload['fingerprint-profile'] = profile
      } else {
        delete payload['fingerprint-profile']
      }
    }
    if (input.experimentalCchSigning !== undefined) {
      if (input.experimentalCchSigning) {
        payload['experimental-cch-signing'] = true
      } else {
        delete payload['experimental-cch-signing']
      }
    }
  }

  // Provider-specific options live on the key, not on the group.
  if (descriptor.supportsWebsockets) {
    payload.websockets = input.websockets
  }

  if (descriptor.supportsCloak) {
    const cloak = createCloakPayload(input.cloak)
    if (cloak) payload.cloak = cloak
  }

  return payload
}

function createNativeGroupPayload(
  descriptor: ProviderDescriptor,
  input: ProviderEntryFormInput,
  existingModels: UnknownRecord[] = [],
) {
  const payload: UnknownRecord = {}

  if (input.baseUrl.trim()) {
    payload['base-url'] = input.baseUrl.trim()
  }

  if (input.proxyUrl.trim()) {
    payload['proxy-url'] = input.proxyUrl.trim()
  }

  if (input.prefix.trim()) {
    payload.prefix = input.prefix.trim()
  }

  appendProviderOptions(payload, descriptor, input, existingModels)

  return payload
}

function createCompatibilityGroupPayload(
  descriptor: ProviderDescriptor,
  input: ProviderEntryFormInput,
  existingModels: UnknownRecord[] = [],
) {
  const payload: UnknownRecord = {}

  if (input.name.trim()) {
    payload.name = input.name.trim()
  }

  if (input.baseUrl.trim()) {
    payload['base-url'] = input.baseUrl.trim()
  }

  if (input.prefix.trim()) {
    payload.prefix = input.prefix.trim()
  }

  payload.disabled = input.disabled

  if (input.supportPromptCacheKey !== undefined) {
    if (input.supportPromptCacheKey) {
      payload['support-prompt-cache-key'] = true
    }
  }

  appendProviderOptions(payload, descriptor, input, existingModels)

  return payload
}

function createCompatibilityKeys(input: ProviderEntryFormInput, existingKeys: UnknownRecord[]) {
  if (input.apiKeyEntries !== undefined) {
    return input.apiKeyEntries
      .map((entry) => {
        const entryId = entry.id?.trim()
        const existingApiKey = entry.existingApiKey?.trim()
        const existing = existingKeys.find((key) =>
          entryId
            ? (readString(key, 'id') ?? readString(key, 'uuid')) === entryId
            : Boolean(existingApiKey) && readString(key, 'api-key') === existingApiKey,
        )
        if ((entryId || existingApiKey) && !existing) {
          throw new Error('Provider credential not found')
        }
        const resolvedApiKey = entry.apiKey.trim() || readString(existing ?? {}, 'api-key') || ''
        if (!resolvedApiKey) return null

        const payload: UnknownRecord = {}
        const id = readString(existing ?? {}, 'id') ?? readString(existing ?? {}, 'uuid')
        if (id) payload.id = id

        payload['api-key'] = resolvedApiKey
        const proxyUrl = entry.proxyUrl.trim()
        if (proxyUrl) payload['proxy-url'] = proxyUrl

        if (entry.weight !== undefined) {
          if (typeof entry.weight === 'number' && Number.isSafeInteger(entry.weight)) {
            payload.weight = entry.weight
          }
        } else {
          const weight = readNumber(existing ?? {}, 'weight')
          if (weight !== null) payload.weight = weight
        }

        return payload
      })
      .filter((entry): entry is UnknownRecord => Boolean(entry))
  }

  const apiKey = input.apiKey.trim()
  const proxyUrl = input.proxyUrl.trim()

  // An empty keys list is the keyless fallback credential for the group.
  if (!existingKeys.length) {
    if (!apiKey) return []
    const key: UnknownRecord = { 'api-key': apiKey }
    if (proxyUrl) key['proxy-url'] = proxyUrl
    if (typeof input.weight === 'number' && Number.isSafeInteger(input.weight)) {
      key.weight = input.weight
    }
    return [key]
  }

  return existingKeys.map((existing, index) => {
    if (index !== 0) return existing

    const payload: UnknownRecord = {}
    const id = readString(existing, 'id') ?? readString(existing, 'uuid')
    if (id) payload.id = id

    const resolvedApiKey = apiKey || readString(existing, 'api-key') || ''
    if (resolvedApiKey) payload['api-key'] = resolvedApiKey
    if (proxyUrl) payload['proxy-url'] = proxyUrl

    if (input.weight !== undefined) {
      if (typeof input.weight === 'number' && Number.isSafeInteger(input.weight)) {
        payload.weight = input.weight
      }
    } else {
      const weight = readNumber(existing, 'weight')
      if (weight !== null) payload.weight = weight
    }

    return payload
  })
}

function createEntryPayload(descriptor: ProviderDescriptor, input: ProviderEntryFormInput) {
  if (descriptor.id === 'openaiCompatibility') {
    return {
      ...createCompatibilityGroupPayload(descriptor, input),
      keys: createCompatibilityKeys(input, []),
    }
  }

  const key = createNativeKeyPayload(descriptor, input)

  return {
    ...createNativeGroupPayload(descriptor, input),
    keys: readString(key, 'api-key') ? [key] : [],
  }
}

type NativeCredentialLocation = {
  groupIndex: number
  keyIndex: number
}

function locateNativeCredential(
  family: UnknownRecord[],
  resource: ProviderResource,
): NativeCredentialLocation | null {
  const selector = resource.selector

  const id =
    (typeof selector.id === 'string' ? selector.id : null) ??
    (typeof selector.uuid === 'string' ? selector.uuid : null)
  if (id) {
    for (let groupIndex = 0; groupIndex < family.length; groupIndex += 1) {
      const keyIndex = readGroupKeys(family[groupIndex]).findIndex(
        (key) => readString(key, 'id') === id || readString(key, 'uuid') === id,
      )
      if (keyIndex !== -1) return { groupIndex, keyIndex }
    }
  }

  const authIndex = typeof selector.auth_index === 'string' ? selector.auth_index : null
  if (authIndex) {
    for (let groupIndex = 0; groupIndex < family.length; groupIndex += 1) {
      const keyIndex = readGroupKeys(family[groupIndex]).findIndex(
        (key) => readAuthIndex(key) === authIndex,
      )
      if (keyIndex !== -1) return { groupIndex, keyIndex }
    }
  }

  const apiKey = typeof selector['api-key'] === 'string' ? selector['api-key'] : null
  if (apiKey) {
    const baseUrl = typeof selector['base-url'] === 'string' ? selector['base-url'] : null
    for (let groupIndex = 0; groupIndex < family.length; groupIndex += 1) {
      if (baseUrl && readString(family[groupIndex], 'base-url') !== baseUrl) continue
      const keyIndex = readGroupKeys(family[groupIndex]).findIndex(
        (key) => readString(key, 'api-key') === apiKey,
      )
      if (keyIndex !== -1) return { groupIndex, keyIndex }
    }
  }

  if (typeof selector.index === 'number') {
    let flatIndex = 0
    for (let groupIndex = 0; groupIndex < family.length; groupIndex += 1) {
      const keyCount = readGroupKeys(family[groupIndex]).length
      if (selector.index < flatIndex + keyCount) {
        return { groupIndex, keyIndex: selector.index - flatIndex }
      }
      flatIndex += keyCount
    }
  }

  return null
}

function locateCompatibilityGroup(family: UnknownRecord[], resource: ProviderResource) {
  const selector = resource.selector

  const id =
    (typeof selector.id === 'string' ? selector.id : null) ??
    (typeof selector.uuid === 'string' ? selector.uuid : null)
  if (id) {
    const index = family.findIndex(
      (group) => readString(group, 'id') === id || readString(group, 'uuid') === id,
    )
    if (index !== -1) return index
  }

  const name = typeof selector.name === 'string' ? selector.name : null
  if (name) {
    const index = family.findIndex((group) => readString(group, 'name') === name)
    if (index !== -1) return index
  }

  if (typeof selector.index === 'number' && selector.index >= 0 && selector.index < family.length) {
    return selector.index
  }

  return null
}

function replaceNativeCredential(
  family: UnknownRecord[],
  descriptor: ProviderDescriptor,
  resource: ProviderResource,
  input: ProviderEntryFormInput,
) {
  const location = locateNativeCredential(family, resource)
  if (!location) throw new Error('Provider credential not found')

  const group = family[location.groupIndex]
  const existingKeys = readGroupKeys(group)
  const existingModels = Array.isArray(group.models) ? group.models.filter(isRecord) : []
  const nextKey = createNativeKeyPayload(descriptor, input, existingKeys[location.keyIndex])
  const nextKeys = existingKeys.length
    ? existingKeys.map((key, index) => (index === location.keyIndex ? nextKey : key))
    : [nextKey]

  const nextGroup: UnknownRecord = {}
  for (const field of NATIVE_GROUP_CARRY_FIELDS) {
    if (group[field] !== undefined) nextGroup[field] = group[field]
  }
  Object.assign(nextGroup, createNativeGroupPayload(descriptor, input, existingModels))
  if (input.requestScopedErrors !== undefined && input.requestScopedErrors.length === 0) {
    delete nextGroup['request-scoped-errors']
  }
  nextGroup.keys = nextKeys

  const nextFamily = family.slice()
  nextFamily[location.groupIndex] = nextGroup
  return nextFamily
}

function replaceCompatibilityGroup(
  family: UnknownRecord[],
  descriptor: ProviderDescriptor,
  resource: ProviderResource,
  input: ProviderEntryFormInput,
) {
  const groupIndex = locateCompatibilityGroup(family, resource)
  if (groupIndex === null) throw new Error('Provider entry not found')

  const group = family[groupIndex]
  const existingModels = Array.isArray(group.models) ? group.models.filter(isRecord) : []
  const nextGroup: UnknownRecord = {}
  for (const field of COMPATIBILITY_GROUP_CARRY_FIELDS) {
    if (group[field] !== undefined) nextGroup[field] = group[field]
  }
  Object.assign(nextGroup, createCompatibilityGroupPayload(descriptor, input, existingModels))
  if (input.supportPromptCacheKey === false) {
    delete nextGroup['support-prompt-cache-key']
  }
  if (input.requestScopedErrors !== undefined && input.requestScopedErrors.length === 0) {
    delete nextGroup['request-scoped-errors']
  }
  nextGroup.keys = createCompatibilityKeys(input, readGroupKeys(group))

  const nextFamily = family.slice()
  nextFamily[groupIndex] = nextGroup
  return nextFamily
}

function removeNativeCredential(family: UnknownRecord[], resource: ProviderResource) {
  const location = locateNativeCredential(family, resource)
  if (!location) throw new Error('Provider credential not found')

  const group = family[location.groupIndex]
  const nextKeys = readGroupKeys(group).filter((_key, index) => index !== location.keyIndex)

  const nextFamily = family.slice()
  if (nextKeys.length) {
    nextFamily[location.groupIndex] = { ...group, keys: nextKeys }
  } else {
    // A group without keys no longer holds a credential; drop it.
    nextFamily.splice(location.groupIndex, 1)
  }
  return nextFamily
}

function removeCompatibilityGroup(family: UnknownRecord[], resource: ProviderResource) {
  const groupIndex = locateCompatibilityGroup(family, resource)
  if (groupIndex === null) throw new Error('Provider entry not found')

  return family.filter((_group, index) => index !== groupIndex)
}

async function fetchProviderFamily(
  client: AxiosInstance,
  descriptor: ProviderDescriptor,
): Promise<UnknownRecord[]> {
  try {
    const response = await client.get<unknown>(descriptor.path)
    return readProviderEntries(response.data, descriptor.responseKey)
  } catch (error) {
    // The persisted v8 config view prunes empty provider families, so the
    // subtree read answers 404 for "no keys configured" — an empty family,
    // not an unsupported endpoint.
    if (toManagementApiError(error).status === 404) {
      return []
    }
    throw error
  }
}

async function fetchProviderGroup(
  client: AxiosInstance,
  descriptor: ProviderDescriptor,
): Promise<ProviderGroup> {
  const family = await fetchProviderFamily(client, descriptor)

  return {
    ...descriptor,
    resources: normalizeProviderResources(descriptor, family),
    issue: null,
  }
}

export async function fetchProviderSnapshot(
  session: ManagementSessionInput,
  runtimeMode: RuntimeMode = 'unknown',
): Promise<ProvidersSnapshot> {
  const client = createManagementClient(session)
  const descriptors =
    runtimeMode === 'cpa'
      ? providerDescriptors.filter((descriptor) => descriptor.id !== 'xai')
      : providerDescriptors
  const groups = await Promise.all(
    descriptors.map(async (descriptor) => {
      try {
        return await fetchProviderGroup(client, descriptor)
      } catch (error) {
        const issue = normalizeIssue(descriptor.id, error)

        return {
          ...descriptor,
          resources: [],
          issue,
        }
      }
    }),
  )

  return {
    fetchedAt: new Date().toISOString(),
    groups,
    issues: groups.flatMap((group) => (group.issue ? [group.issue] : [])),
  }
}

export function getProviderBindingAuthId(resource: ProviderResource) {
  const selector = resource.selector

  return (
    (typeof selector.id === 'string' ? selector.id : null) ??
    (typeof selector.uuid === 'string' ? selector.uuid : null) ??
    (typeof selector.auth_index === 'string' ? selector.auth_index : null) ??
    resource.authIndex ??
    readString(resource.raw, 'id') ??
    readString(resource.raw, 'uuid') ??
    readString(resource.raw, 'auth_index') ??
    readString(resource.raw, 'auth-index')
  )
}

export async function fetchProviderModelDefinitions(
  session: ManagementSessionInput,
  channel: ProviderModelChannel,
): Promise<ProviderModelDefinitionsSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>(
    `/routing/model-definitions/${encodeURIComponent(channel)}`,
  )

  return {
    channel,
    fetchedAt: new Date().toISOString(),
    models: readModelDefinitionEntries(response.data).map((record, index) =>
      normalizeProviderModelDefinition(record, index),
    ),
  }
}

export async function fetchProviderDiscoveredModels(
  session: ManagementSessionInput,
  input: ProviderModelDiscoveryInput,
): Promise<ProviderDiscoveredModel[]> {
  const client = createManagementClient(session)
  const headers = createStringHeaderPayload(input.headers)
  const apiKey = input.apiKey.trim()
  const authIndex = input.authIndex?.trim() || undefined

  if (input.providerId === 'gemini' || input.providerId === 'interactions') {
    const endpoint = buildGeminiModelsEndpoint(input.baseUrl)
    const resolvedHeaders = { ...headers }
    if (apiKey && !hasHeader(resolvedHeaders, 'x-goog-api-key')) {
      resolvedHeaders['x-goog-api-key'] = apiKey
    } else if (authIndex && !hasHeader(resolvedHeaders, 'x-goog-api-key')) {
      resolvedHeaders['x-goog-api-key'] = '$TOKEN$'
    }

    const seen = new Set<string>()
    const collected: ProviderDiscoveredModel[] = []
    let pageToken = ''

    for (let page = 0; page < 20; page += 1) {
      const url = new URL(endpoint)
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken)
      }

      const payload = await runProviderModelApiCall(client, {
        authIndex,
        url: url.toString(),
        headers: resolvedHeaders,
      })

      normalizeDiscoveredModels(payload, { dedupe: false }).forEach((model) => {
        const name = stripGeminiModelResourceName(model.name)
        const key = name.toLowerCase()
        if (!key || seen.has(key)) return
        seen.add(key)
        collected.push({
          ...model,
          name,
          alias: model.alias === name ? null : model.alias,
        })
      })

      const nextToken = isRecord(payload) ? readString(payload, 'nextPageToken') : null
      if (!nextToken) break
      pageToken = nextToken
    }

    return collected
  }

  if (input.providerId === 'claude') {
    const resolvedHeaders = { ...headers }
    if (apiKey && !hasHeader(resolvedHeaders, 'x-api-key')) {
      resolvedHeaders['x-api-key'] = apiKey
    } else if (authIndex && !hasHeader(resolvedHeaders, 'x-api-key')) {
      resolvedHeaders['x-api-key'] = '$TOKEN$'
    }
    if (!hasHeader(resolvedHeaders, 'anthropic-version')) {
      resolvedHeaders['anthropic-version'] = DEFAULT_ANTHROPIC_VERSION
    }

    const payload = await runProviderModelApiCall(client, {
      authIndex,
      url: buildClaudeModelsEndpoint(input.baseUrl),
      headers: resolvedHeaders,
    })

    return normalizeDiscoveredModels(payload)
  }

  if (input.providerId === 'codex' || input.providerId === 'meta' || input.providerId === 'xai') {
    const resolvedHeaders = { ...headers }
    if (apiKey && !hasHeader(resolvedHeaders, 'authorization')) {
      resolvedHeaders.Authorization = `Bearer ${apiKey}`
    } else if (authIndex && !hasHeader(resolvedHeaders, 'authorization')) {
      resolvedHeaders.Authorization = 'Bearer $TOKEN$'
    }

    const defaultBaseUrl =
      input.providerId === 'meta'
        ? 'https://api.meta.ai/v1'
        : input.providerId === 'xai'
          ? 'https://api.x.ai/v1'
          : ''
    const payload = await runProviderModelApiCall(client, {
      authIndex,
      url: buildV1ModelsEndpoint(input.baseUrl || defaultBaseUrl),
      headers: resolvedHeaders,
    })

    return normalizeDiscoveredModels(payload)
  }

  if (input.providerId === 'openaiCompatibility') {
    const resolvedHeaders = { ...headers }
    if (apiKey && !hasHeader(resolvedHeaders, 'authorization')) {
      resolvedHeaders.Authorization = `Bearer ${apiKey}`
    } else if (authIndex && !hasHeader(resolvedHeaders, 'authorization')) {
      resolvedHeaders.Authorization = 'Bearer $TOKEN$'
    }

    try {
      const payload = await runProviderModelApiCall(client, {
        authIndex,
        url: buildModelsEndpoint(input.baseUrl),
        headers: resolvedHeaders,
      })

      return normalizeDiscoveredModels(payload)
    } catch (error) {
      if (!apiKey && !authIndex && !Object.keys(resolvedHeaders).length) {
        throw error
      }

      const payload = await runProviderModelApiCall(client, {
        url: buildModelsEndpoint(input.baseUrl),
        headers: {},
      })

      return normalizeDiscoveredModels(payload)
    }
  }

  return []
}

export async function testProviderConnectivity(
  session: ManagementSessionInput,
  input: ProviderConnectivityTestInput,
) {
  const client = createManagementClient(session)
  const headers = createStringHeaderPayload(input.headers)
  const apiKey = input.apiKey.trim()
  const authIndex = input.authIndex?.trim() || undefined
  const model = pickConnectivityModel(input)

  if (!model) {
    throw new Error('Missing test model')
  }

  if (input.providerId === 'claude') {
    const resolvedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    }
    if (!hasHeader(resolvedHeaders, 'anthropic-version')) {
      resolvedHeaders['anthropic-version'] = DEFAULT_ANTHROPIC_VERSION
    }
    if (apiKey && !hasHeader(resolvedHeaders, 'x-api-key')) {
      resolvedHeaders['x-api-key'] = apiKey
    } else if (authIndex && !hasHeader(resolvedHeaders, 'x-api-key')) {
      resolvedHeaders['x-api-key'] = '$TOKEN$'
    }

    await runProviderApiCall(client, {
      authIndex,
      method: 'POST',
      url: buildClaudeMessagesEndpoint(input.baseUrl),
      headers: resolvedHeaders,
      data: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
      timeout: DEFAULT_CONNECTIVITY_TIMEOUT_MS,
    })
    return
  }

  if (input.providerId === 'openaiCompatibility') {
    const resolvedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    }
    if (apiKey && !hasHeader(resolvedHeaders, 'authorization')) {
      resolvedHeaders.Authorization = `Bearer ${apiKey}`
    } else if (authIndex && !hasHeader(resolvedHeaders, 'authorization')) {
      resolvedHeaders.Authorization = 'Bearer $TOKEN$'
    }

    await runProviderApiCall(client, {
      authIndex,
      method: 'POST',
      url: buildOpenAIChatCompletionsEndpoint(input.baseUrl),
      headers: resolvedHeaders,
      data: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false,
        max_tokens: 5,
      }),
      timeout: DEFAULT_CONNECTIVITY_TIMEOUT_MS,
    })
    return
  }

  throw new Error(`Unsupported provider: ${input.providerId}`)
}

export async function createProviderResource(
  session: ManagementSessionInput,
  providerId: ProviderId,
  input: ProviderEntryFormInput,
) {
  const descriptor = providerDescriptors.find((item) => item.id === providerId)
  if (!descriptor) throw new Error(`Unknown provider: ${providerId}`)

  // v8 PUT replaces the whole family, so append requires read-modify-write.
  const client = createManagementClient(session)
  const family = await fetchProviderFamily(client, descriptor)
  await client.put(descriptor.path, [...family, createEntryPayload(descriptor, input)])
}

export async function updateProviderResource(
  session: ManagementSessionInput,
  resource: ProviderResource,
  input: ProviderEntryFormInput,
) {
  const descriptor = providerDescriptors.find((item) => item.id === resource.providerId)
  if (!descriptor) throw new Error(`Unknown provider: ${resource.providerId}`)

  const client = createManagementClient(session)
  const family = await fetchProviderFamily(client, descriptor)
  const nextFamily =
    descriptor.id === 'openaiCompatibility'
      ? replaceCompatibilityGroup(family, descriptor, resource, input)
      : replaceNativeCredential(family, descriptor, resource, input)
  await client.put(descriptor.path, nextFamily)
}

export async function deleteProviderResource(
  session: ManagementSessionInput,
  resource: ProviderResource,
) {
  const descriptor = providerDescriptors.find((item) => item.id === resource.providerId)
  if (!descriptor) throw new Error(`Unknown provider: ${resource.providerId}`)

  const client = createManagementClient(session)
  const family = await fetchProviderFamily(client, descriptor)
  const nextFamily =
    descriptor.id === 'openaiCompatibility'
      ? removeCompatibilityGroup(family, resource)
      : removeNativeCredential(family, resource)
  await client.put(descriptor.path, nextFamily)
}

export async function updateProviderStatus(
  session: ManagementSessionInput,
  resource: ProviderResource,
  disabled: boolean,
) {
  const descriptor = providerDescriptors.find((item) => item.id === resource.providerId)
  if (!descriptor) throw new Error(`Unknown provider: ${resource.providerId}`)
  if (descriptor.disabledMode !== 'auth-status') {
    throw new Error(`Provider status is managed through ${descriptor.path}`)
  }

  const authId = getProviderBindingAuthId(resource)
  if (!authId) throw new Error('Missing provider auth identifier')

  const client = createManagementClient(session)
  await client.patch('/credentials/status', {
    name: authId,
    disabled,
  })
}
