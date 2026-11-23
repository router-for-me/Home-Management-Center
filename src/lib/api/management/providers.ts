import type { AxiosInstance } from 'axios'

import {
  createManagementClient,
  isMissingConfigPath,
  toManagementApiError,
} from '@/lib/api/management/client'
import type { ManagementSessionInput, RuntimeMode } from '@/lib/api/management/types'

import { ConfigEditConflict, mergeConfigEdits, sameConfigValue } from './config-edit'
import { type ProviderConnectionPool, withConnectionPool } from './provider-connection-pool'
import {
  createFormState,
  readProviderModels,
  readRequestScopedErrors,
  readVertexOptions,
} from './provider-form'
import type { ProviderErrorRuleAction } from './provider-form'
import { type ReplacementRow, serializeReplacementRows } from './sensitive-replacements'

export { PROVIDER_ERROR_RULE_ACTIONS, type ProviderErrorRuleAction } from './provider-form'

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
export const oauthModelChannels = [
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
  'copilot',
  'devin',
] as const
export type ProviderModelChannel = (typeof oauthModelChannels)[number]

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

export type ProviderRequestScopedErrorRule = {
  status: number
  match?: string[]
  'match-regexr'?: string[]
  raw?: UnknownRecord
  action: ProviderErrorRuleAction
}

export type ProviderApiKeyEntryInput = {
  connectionPool?: ProviderConnectionPool
  original?: UnknownRecord
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

export type VertexExecutionOptions = {
  interactions: boolean | null
  openapi: boolean | null
  location: string
}

export type ProviderEntryFormInput = {
  groupVertexOptions?: VertexExecutionOptions
  keyVertexOptions?: VertexExecutionOptions
  groupConnectionPool?: ProviderConnectionPool
  keyConnectionPool?: ProviderConnectionPool
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
  literalReplacements?: ReplacementRow[] | null
  patternReplacements?: ReplacementRow[] | null
}

export type ProviderModelEntryInput = {
  name: string
  alias: string
  displayName: string
  forceMapping: boolean
  openapi?: boolean | null
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
  thinkingDisableType?: string
  thinkingZeroAllowed?: boolean
  thinkingDynamicAllowed?: boolean
  raw?: UnknownRecord | null
}

export type ProviderHeaderEntryInput = {
  key: string
  value: string
}

export type ProviderDiscoveredModel = {
  name: string
  /** The provider's readable name for the model, for the model's display-name. */
  displayName: string | null
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
  source?: { group: UnknownRecord; key?: UnknownRecord }
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

export function getProviderModelDefinitionChannels(runtimeMode: RuntimeMode) {
  return oauthModelChannels.filter((channel) => {
    if (channel === 'copilot') return runtimeMode === 'cpa'
    if (channel === 'xai') return runtimeMode !== 'cpa'
    return true
  })
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
    kind: apiError.status === 404 || apiError.status === 405 ? 'unsupported' : 'error',
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

function compatibilityMemberIds(keys: UnknownRecord[]) {
  const ids = keys.map(
    (key) => readString(key, 'id') ?? readString(key, 'uuid') ?? readAuthIndex(key),
  )
  return ids.every((id): id is string => id !== null) ? ids.sort() : []
}

function normalizeNativeKeyResource(
  descriptor: ProviderDescriptor,
  group: UnknownRecord,
  key: UnknownRecord,
  index: number,
): ProviderResource {
  // Effective credential view: group fields with the key's own overrides winning.
  const record = { ...group, ...key }
  for (const field of nativeSharedFields) {
    if (key[field] === null) record[field] = group[field]
  }
  delete record.keys

  // Older Home versions return only the credential ID, which /requests/api-call
  // also accepts. Explicit auth indexes from Home and CPA take precedence.
  const authIndex =
    readAuthIndex(key) ?? readAuthIndex(group) ?? readString(key, 'id') ?? readString(key, 'uuid')
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
    source: { group, key },
    raw: record,
  }
}

function normalizeCompatibilityResource(
  descriptor: ProviderDescriptor,
  record: UnknownRecord,
  index: number,
): ProviderResource {
  const keys = readGroupKeys(record)
  const firstKey = keys[0] ?? {}
  // A multi-key group has no single credential binding. Only promote the key's
  // selector when the group represents one credential, including legacy Home.
  const credential = keys.length === 1 ? firstKey : keys.length === 0 ? record : null
  const authIndex =
    readAuthIndex(record) ??
    (credential
      ? (readAuthIndex(credential) ??
        readString(credential, 'id') ??
        readString(credential, 'uuid'))
      : null)
  const name = readString(record, 'name')
  const id =
    readString(record, 'id') ??
    readString(record, 'uuid') ??
    authIndex ??
    compatibilityMemberIds(keys)[0] ??
    `${name ?? descriptor.id}-${index + 1}`

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
    disabled: readBoolean(record, 'disabled'),
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
    excludedModelCount: 0,
    apiKeyEntryCount: Array.isArray(record.keys)
      ? record.keys.length
      : countArray(record, 'api-key-entries'),
    selector: createSelector(descriptor, record, index),
    source: { group: record },
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
  return Object.fromEntries(
    entries.filter((entry) => entry.key.trim()).map((entry) => [entry.key.trim(), entry.value]),
  )
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
      return { name: entry.trim(), displayName: null, description: null }
    }
    if (!isRecord(entry)) return null

    const name =
      readString(entry, 'id') ??
      readString(entry, 'name') ??
      readString(entry, 'model') ??
      readString(entry, 'value')
    if (!name) return null

    /*
     * A catalog's readable name is a display name, not an alias. Home publishes a
     * configured alias as the model's ID in place of the upstream name, so reading
     * display_name into alias renamed every imported model: gpt-6.1-sol became
     * "GPT-6.1 Sol", and clients still asking for gpt-6.1-sol got auth_not_found.
     * An upstream `alias` field only feeds the display name for the same reason;
     * renaming a model stays an explicit edit.
     */
    const displayName =
      readString(entry, 'display_name') ??
      readString(entry, 'displayName') ??
      readString(entry, 'alias')
    const description =
      readString(entry, 'description') ?? readString(entry, 'note') ?? readString(entry, 'comment')

    return {
      name,
      displayName: displayName && displayName !== name ? displayName : null,
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

  if (entry.thinkingDisableType !== undefined) {
    const type = entry.thinkingDisableType.trim()
    if (type) nextThinking['disable-type'] = type
    else delete nextThinking['disable-type']
  }

  // An explicit empty object suppresses backend defaults; omission inherits them.
  return nextThinking
}

function createModelPayload(
  entries: ProviderModelEntryInput[],
  descriptor: ProviderDescriptor,
  existingModels: UnknownRecord[] = [],
) {
  const used = new Set<UnknownRecord>()
  return entries
    .filter((entry) => entry.name.trim())
    .map((entry) => {
      let raw = entry.raw
      // Older callers may only provide a name. Repeated upstream names need an alias to bind a row.
      if (raw === undefined) {
        const matching = existingModels.filter(
          (model) => readString(model, 'name') === entry.name.trim(),
        )
        const candidates =
          matching.length > 1
            ? matching.filter((model) => (readString(model, 'alias') ?? '') === entry.alias.trim())
            : matching
        if (matching.length > 1 && candidates.length !== 1) throw new ConfigEditConflict()
        raw = candidates[0]
      }
      if (!raw) return serializeModelEntry(entry, descriptor)
      if (used.has(raw)) throw new ConfigEditConflict()
      used.add(raw)
      const [original] = readProviderModels({ models: [raw] })
      const draft = { ...original, ...entry }
      const next = mergeConfigEdits(
        raw,
        serializeModelEntry(original, descriptor, raw),
        serializeModelEntry(draft, descriptor, raw),
      )
      if (isRecord(next.thinking)) {
        const thinking = { ...next.thinking }
        // Only migrate a legacy spelling when that toggle was edited.
        if (original.thinkingZeroAllowed !== draft.thinkingZeroAllowed) delete thinking.zero_allowed
        if (original.thinkingDynamicAllowed !== draft.thinkingDynamicAllowed)
          delete thinking.dynamic_allowed
        next.thinking = thinking
      }
      return next
    })
}

function serializeModelEntry(
  entry: ProviderModelEntryInput,
  descriptor: ProviderDescriptor,
  baseRaw?: UnknownRecord,
) {
  const name = entry.name.trim()
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

  if (descriptor.id === 'vertex' && entry.openapi !== undefined) {
    if (entry.openapi === null) delete payload.openapi
    else payload.openapi = entry.openapi
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

function createCloakPayload(input?: ProviderCloakInput, editing = false) {
  if (!input) return undefined

  const mode = input.mode.trim()
  const sensitiveWords = parseTextList(input.sensitiveWordsText)
  const payload: UnknownRecord = {}
  if (editing || input.strictMode) payload['strict-mode'] = input.strictMode
  if (editing || input.cacheUserId) payload['cache-user-id'] = input.cacheUserId
  if (mode) payload.mode = mode
  if (sensitiveWords.length) payload['sensitive-words'] = sensitiveWords
  if (input.literalReplacements?.length) {
    payload['sensitive-words-replace'] = serializeReplacementRows(
      'literalReplacements',
      input.literalReplacements,
    )
  }
  if (input.patternReplacements?.length) {
    payload['sensitive-patterns-replace'] = serializeReplacementRows(
      'patternReplacements',
      input.patternReplacements,
    )
  }
  return Object.keys(payload).length ? payload : undefined
}

function serializeErrorRule(rule: ProviderRequestScopedErrorRule) {
  const match = rule.match?.map((item) => item.trim()).filter(Boolean) ?? []
  const regexes = rule['match-regexr']?.map((item) => item.trim()).filter(Boolean) ?? []
  return {
    status: rule.status,
    action: rule.action,
    ...(match.length ? { match } : {}),
    ...(regexes.length ? { 'match-regexr': regexes } : {}),
  }
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

  if (descriptor.id !== 'openaiCompatibility') {
    const excludedModels = parseTextList(input.excludedModelsText)
    payload['excluded-models'] = excludedModels
  }

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
        const next = serializeErrorRule(rule)
        if (!rule.raw) return next
        const [original] = readRequestScopedErrors({ 'request-scoped-errors': [rule.raw] })
        return mergeConfigEdits(rule.raw, serializeErrorRule(original), next)
      })
    } else {
      delete payload['request-scoped-errors']
    }
  }
}

const nativeSharedFields = [
  'priority',
  'prefix',
  'proxy-url',
  'headers',
  'models',
  'excluded-models',
  'disable-cooling',
  'request-retry',
  'request-scoped-errors',
  'connection-pool',
]

function vertexOptionsPayload(options?: VertexExecutionOptions): UnknownRecord {
  if (!options) return {}
  return {
    ...(options.interactions != null && { interactions: options.interactions }),
    ...(options.openapi != null && { openapi: options.openapi }),
    ...(options.location.trim() && { 'openapi-location': options.location.trim() }),
  }
}

function applyNativeGroupSettings(
  group: UnknownRecord,
  descriptor: ProviderDescriptor,
  input: ProviderEntryFormInput,
) {
  const next = withConnectionPool(group, input.groupConnectionPool)
  if (descriptor.id !== 'vertex' || !input.groupVertexOptions) return next
  return mergeConfigEdits(
    next,
    vertexOptionsPayload(readVertexOptions(group)),
    vertexOptionsPayload(input.groupVertexOptions),
  )
}

function createNativeKeyPayload(
  descriptor: ProviderDescriptor,
  input: ProviderEntryFormInput,
  existingKey?: UnknownRecord,
) {
  const existing = existingKey ?? {}
  const payload: UnknownRecord =
    descriptor.id === 'vertex' ? vertexOptionsPayload(input.keyVertexOptions) : {}

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
    const cloak = createCloakPayload(input.cloak, Boolean(existingKey))
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
  const entries: ProviderApiKeyEntryInput[] = input.apiKeyEntries ?? [
    {
      apiKey: input.apiKey,
      proxyUrl: input.proxyUrl,
      weight: input.weight,
      id:
        readString(existingKeys[0] ?? {}, 'id') ??
        readString(existingKeys[0] ?? {}, 'uuid') ??
        undefined,
      existingApiKey: readString(existingKeys[0] ?? {}, 'api-key') ?? undefined,
    },
  ]
  const used = new Set<UnknownRecord>()
  const result: UnknownRecord[] = []
  for (const entry of entries) {
    const matches = existingKeys.filter((key) => {
      if (entry.id) return (readString(key, 'id') ?? readString(key, 'uuid')) === entry.id
      if (entry.existingApiKey) return readString(key, 'api-key') === entry.existingApiKey
      return entry.original && sameConfigValue(key, entry.original)
    })
    const existing = matches[0]
    if ((entry.id || entry.existingApiKey || entry.original) && !existing) {
      throw new ConfigEditConflict('Provider credential not found')
    }
    if (matches.length > 1 || (existing && used.has(existing))) throw new ConfigEditConflict()
    if (existing) used.add(existing)
    if (!existing && !entry.apiKey.trim()) continue
    const key = withConnectionPool(existing ?? {}, entry.connectionPool)
    if (entry.apiKey.trim()) key['api-key'] = entry.apiKey.trim()
    const proxy = entry.proxyUrl.trim()
    if (entry.proxyUrl !== (typeof key['proxy-url'] === 'string' ? key['proxy-url'] : '')) {
      if (proxy) key['proxy-url'] = proxy
      else delete key['proxy-url']
    }
    if (entry.weight === null) delete key.weight
    else if (Number.isSafeInteger(entry.weight)) key.weight = entry.weight
    result.push(key)
  }
  return input.apiKeyEntries === undefined ? [...result, ...existingKeys.slice(1)] : result
}

function createEntryPayload(descriptor: ProviderDescriptor, input: ProviderEntryFormInput) {
  if (descriptor.id === 'openaiCompatibility') {
    return {
      ...withConnectionPool(
        createCompatibilityGroupPayload(descriptor, input),
        input.groupConnectionPool,
      ),
      keys: createCompatibilityKeys(input, []),
    }
  }

  const key = withConnectionPool(createNativeKeyPayload(descriptor, input), input.keyConnectionPool)

  return {
    ...applyNativeGroupSettings(createNativeGroupPayload(descriptor, input), descriptor, input),
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
  const { selector, source } = resource
  const matches: NativeCredentialLocation[] = []
  let flatIndex = 0
  function matchesKey(group: UnknownRecord, key: UnknownRecord, index: number) {
    const id = selector.id ?? selector.uuid
    if (id) return key.id === id || key.uuid === id
    if (selector.auth_index)
      return (readAuthIndex(key) ?? readAuthIndex(group)) === selector.auth_index
    if (selector['api-key'])
      return (
        key['api-key'] === selector['api-key'] &&
        (!selector['base-url'] || group['base-url'] === selector['base-url'])
      )
    if (source)
      return (
        sameConfigValue(source.key, key) &&
        sameConfigValue(withoutKeys(source.group), withoutKeys(group))
      )
    return index === selector.index
  }
  family.forEach((group, groupIndex) => {
    readGroupKeys(group).forEach((key, keyIndex) => {
      if (matchesKey(group, key, flatIndex)) matches.push({ groupIndex, keyIndex })
      flatIndex++
    })
  })
  if (matches.length > 1) throw new ConfigEditConflict()
  return matches[0] ?? null
}

function locateCompatibilityGroup(family: UnknownRecord[], resource: ProviderResource) {
  const { selector, source } = resource
  const id = selector.id ?? selector.uuid
  function matchesGroup(group: UnknownRecord, index: number) {
    if (id) return group.id === id || group.uuid === id
    if (selector.auth_index) return readAuthIndex(group) === selector.auth_index
    if (selector.name) return group.name === selector.name
    if (source) return sameConfigValue(source.group, group)
    return index === selector.index
  }
  const matches = family.flatMap((group, index) => (matchesGroup(group, index) ? [index] : []))
  if (matches.length <= 1) return matches[0] ?? null
  // Home can return several groups with the same name when their per-key options differ.
  if (selector.name && source) {
    const ids = compatibilityMemberIds(readGroupKeys(source.group))
    const exact = ids.length
      ? matches.filter((index) =>
          sameConfigValue(ids, compatibilityMemberIds(readGroupKeys(family[index]))),
        )
      : []
    if (exact.length === 1) return exact[0]
  }
  throw new ConfigEditConflict()
}

function withoutKeys(group: UnknownRecord) {
  const copy = { ...group }
  delete copy.keys
  return copy
}

function sameCredential(opened: UnknownRecord, current: UnknownRecord, replacingSecret: boolean) {
  // A blank secret input means keep the latest secret of this same credential.
  const stableId = opened.id ?? opened.uuid
  if (!replacingSecret && stableId && stableId === (current.id ?? current.uuid)) {
    return sameConfigValue({ ...opened, 'api-key': null }, { ...current, 'api-key': null })
  }
  return sameConfigValue(opened, current)
}

function replaceNativeCredential(
  family: UnknownRecord[],
  descriptor: ProviderDescriptor,
  resource: ProviderResource,
  input: ProviderEntryFormInput,
) {
  const location = locateNativeCredential(family, resource)
  if (!location) throw new ConfigEditConflict('Provider credential not found')
  const group = family[location.groupIndex]
  const keys = readGroupKeys(group)
  const key = keys[location.keyIndex]
  const source = resource.source
  if (
    source?.key &&
    (!sameConfigValue(withoutKeys(source.group), withoutKeys(group)) ||
      !sameCredential(source.key, key, Boolean(input.apiKey.trim())))
  )
    throw new ConfigEditConflict()

  const form = createFormState(resource, descriptor)
  const draft = { ...form, ...input }
  if (form.cloak && input.cloak) draft.cloak = { ...form.cloak, ...input.cloak }
  const models = Array.isArray(resource.raw.models) ? resource.raw.models.filter(isRecord) : []
  const before = createNativeGroupPayload(descriptor, form, models)
  const after = createNativeGroupPayload(descriptor, draft, models)
  const scopedGroup = applyNativeGroupSettings(group, descriptor, input)
  if (source && !sameConfigValue(group, scopedGroup)) {
    // A group edit affects its siblings. Verify the membership the operator opened.
    const identity = (item: UnknownRecord) =>
      item.id ?? item.uuid ?? readAuthIndex(item) ?? item['api-key'] ?? item
    if (!sameConfigValue(readGroupKeys(source.group).map(identity), keys.map(identity)))
      throw new ConfigEditConflict()
  }
  const nextKey = mergeConfigEdits(
    withConnectionPool(key, input.keyConnectionPool),
    createNativeKeyPayload(descriptor, form, key),
    createNativeKeyPayload(descriptor, draft, key),
  )
  if (
    isRecord(key.cloak) &&
    Object.keys(key.cloak).length > 0 &&
    isRecord(nextKey.cloak) &&
    !Object.keys(nextKey.cloak).length
  ) {
    delete nextKey.cloak
  }
  const groupBefore = { ...before }
  const groupAfter = { ...after }
  for (const field of nativeSharedFields) {
    if (sameConfigValue(before[field], after[field])) continue
    if (
      field === 'excluded-models' &&
      Array.isArray(resource.raw[field]) &&
      resource.raw[field].includes('*')
    ) {
      after[field] = [...new Set(['*', ...(after[field] as string[])])]
      groupAfter[field] = after[field]
    }
    if (keys.length === 1 && key[field] == null) continue
    // Each credential in the UI edits its effective value. A key-level override must
    // include the full effective map or list, because Home replaces inherited values.
    const effective = mergeConfigEdits(
      resource.raw,
      { [field]: before[field] },
      Object.hasOwn(after, field) ? { [field]: after[field] } : {},
    )
    const cleared =
      field === 'prefix' || field === 'proxy-url'
        ? ''
        : field === 'request-scoped-errors'
          ? []
          : null
    nextKey[field] = effective[field] ?? cleared
    delete groupBefore[field]
    delete groupAfter[field]
  }
  const nextGroup = mergeConfigEdits(scopedGroup, groupBefore, groupAfter)
  const result = family.slice()
  if (keys.length > 1 && !sameConfigValue(group['base-url'], nextGroup['base-url'])) {
    result.splice(
      location.groupIndex,
      1,
      { ...scopedGroup, keys: keys.filter((_, i) => i !== location.keyIndex) },
      { ...nextGroup, keys: [nextKey] },
    )
  } else {
    result[location.groupIndex] = {
      ...nextGroup,
      keys: keys.map((item, i) => (i === location.keyIndex ? nextKey : item)),
    }
  }
  return result
}

function replaceCompatibilityGroup(
  family: UnknownRecord[],
  descriptor: ProviderDescriptor,
  resource: ProviderResource,
  input: ProviderEntryFormInput,
) {
  const index = locateCompatibilityGroup(family, resource)
  if (index === null) throw new ConfigEditConflict('Provider entry not found')
  const group = family[index]
  const keys = readGroupKeys(group)
  const form = createFormState(resource, descriptor)
  const keysEdited =
    input.apiKeyEntries !== undefined
      ? !sameConfigValue(form.apiKeyEntries, input.apiKeyEntries)
      : Boolean(input.apiKey.trim()) ||
        input.proxyUrl !== form.proxyUrl ||
        (input.weight !== undefined && input.weight !== form.weight)
  const opened = resource.source?.group
  if (opened) {
    const originalKeys = readGroupKeys(opened)
    if (!sameConfigValue(withoutKeys(opened), withoutKeys(group))) throw new ConfigEditConflict()
    if (originalKeys.length !== keys.length)
      throw new ConfigEditConflict('Provider credential not found')
    originalKeys.forEach((key, index) => {
      const id = key.id ?? key.uuid
      if (id && id !== (keys[index].id ?? keys[index].uuid))
        throw new ConfigEditConflict('Provider credential not found')
      const replacing =
        input.apiKeyEntries?.some(
          (entry) =>
            (id ? entry.id === id : entry.existingApiKey === key['api-key']) && entry.apiKey.trim(),
        ) ??
        (index === 0 && Boolean(input.apiKey.trim()))
      if (!sameCredential(key, keys[index], Boolean(replacing))) throw new ConfigEditConflict()
    })
  }
  const models = Array.isArray(group.models) ? group.models.filter(isRecord) : []
  const next = mergeConfigEdits(
    withConnectionPool(group, input.groupConnectionPool),
    createCompatibilityGroupPayload(descriptor, form, models),
    createCompatibilityGroupPayload(descriptor, { ...form, ...input }, models),
  )
  if (keysEdited) next.keys = createCompatibilityKeys(input, keys)
  return family.map((item, i) => (i === index ? next : item))
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
    if (isMissingConfigPath(error)) {
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
          displayName: model.displayName === name ? null : model.displayName,
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
