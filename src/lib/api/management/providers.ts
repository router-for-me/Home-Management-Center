import type { AxiosInstance } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput, RuntimeMode } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type ProviderId = 'gemini' | 'claude' | 'codex' | 'xai' | 'vertex' | 'openaiCompatibility'
export type ProviderModelChannel =
  | 'claude'
  | 'gemini'
  | 'vertex'
  | 'aistudio'
  | 'codex'
  | 'kimi'
  | 'antigravity'
  | 'xai'

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
  disableCooling: boolean
  websockets: boolean
  priority?: number
  models: ProviderModelEntryInput[]
  headers: ProviderHeaderEntryInput[]
  excludedModelsText: string
  testModel?: string
  cloak?: ProviderCloakInput
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
  websockets: boolean
  priority: number | null
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
  'claude',
  'codex',
  'vertex',
  'aistudio',
  'kimi',
  'antigravity',
  'xai',
]

export function getProviderModelDefinitionChannels(runtimeMode: RuntimeMode) {
  return runtimeMode === 'cpa'
    ? providerModelDefinitionChannels.filter((channel) => channel !== 'xai')
    : providerModelDefinitionChannels
}

const providerDescriptors: ProviderDescriptor[] = [
  {
    id: 'gemini',
    path: '/gemini-api-key',
    responseKey: 'gemini-api-key',
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
    supportsRichModelAliases: false,
  },
  {
    id: 'claude',
    path: '/claude-api-key',
    responseKey: 'claude-api-key',
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
    supportsRichModelAliases: false,
  },
  {
    id: 'codex',
    path: '/codex-api-key',
    responseKey: 'codex-api-key',
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
    path: '/xai-api-key',
    responseKey: 'xai-api-key',
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
    id: 'vertex',
    path: '/vertex-api-key',
    responseKey: 'vertex-api-key',
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
    supportsRichModelAliases: false,
  },
  {
    id: 'openaiCompatibility',
    path: '/openai-compatibility',
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
    supportsRichModelAliases: false,
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

function createSelector(descriptor: ProviderDescriptor, record: UnknownRecord, index: number) {
  const id = readString(record, 'id')
  const uuid = readString(record, 'uuid')
  const authIndex = readString(record, 'auth_index') ?? readString(record, 'auth-index')
  const apiKey = readString(record, 'api-key')
  const name = readString(record, 'name')
  const baseUrl = readString(record, 'base-url')

  if (id) return { id }
  if (uuid) return { uuid }
  if (authIndex) return { auth_index: authIndex }

  if (descriptor.supportsName && name) {
    return { name }
  }

  if (apiKey) {
    return baseUrl ? { 'api-key': apiKey, 'base-url': baseUrl } : { 'api-key': apiKey }
  }

  return { index }
}

function normalizeProviderResource(
  descriptor: ProviderDescriptor,
  record: UnknownRecord,
  index: number,
): ProviderResource {
  const authIndex = readString(record, 'auth_index') ?? readString(record, 'auth-index')
  const name = readString(record, 'name')
  const apiKey = readString(record, 'api-key')
  const baseUrl = readString(record, 'base-url')
  const prefix = readString(record, 'prefix')
  const id =
    readString(record, 'id') ??
    readString(record, 'uuid') ??
    authIndex ??
    name ??
    `${descriptor.id}-${index + 1}`
  const identifier = name ?? authIndex ?? id

  return {
    id: `${descriptor.id}:${id}`,
    providerId: descriptor.id,
    index,
    identifier,
    authIndex,
    name,
    apiKeyPreview: maskSecret(apiKey),
    baseUrl,
    proxyUrl: readString(record, 'proxy-url'),
    prefix,
    disabled: readBoolean(record, 'disabled') || hasDisableAllModelsRule(record),
    disableCooling: readBoolean(record, 'disable-cooling'),
    websockets: readBoolean(record, 'websockets'),
    priority: readNumber(record, 'priority'),
    modelCount: countArray(record, 'models'),
    headerCount: countRecordKeys(record, 'headers'),
    excludedModelCount: countArray(record, 'excluded-models'),
    apiKeyEntryCount: countArray(record, 'api-key-entries'),
    selector: createSelector(descriptor, record, index),
    raw: record,
  }
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
    '/api-call',
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

function createModelPayload(entries: ProviderModelEntryInput[], supportsRichModelAliases: boolean) {
  return entries
    .map((entry) => {
      const name = entry.name.trim()
      if (!name) return null

      const payload: UnknownRecord = { name }
      const alias = entry.alias.trim()

      if (alias && alias !== name) payload.alias = alias
      if (supportsRichModelAliases) {
        const displayName = entry.displayName.trim()
        if (displayName) payload['display-name'] = displayName
        if (entry.forceMapping) payload['force-mapping'] = true
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
) {
  payload.priority =
    typeof input.priority === 'number' && Number.isFinite(input.priority) ? input.priority : 0

  const headers = createHeaderPayload(input.headers)
  payload.headers = headers

  const models = createModelPayload(input.models, descriptor.supportsRichModelAliases)
  payload.models = models

  const excludedModels = parseTextList(input.excludedModelsText)
  payload['excluded-models'] = excludedModels
  payload['disable-cooling'] = input.disableCooling

  if (descriptor.supportsWebsockets) {
    payload.websockets = input.websockets
  }
}

function createEntryPayload(descriptor: ProviderDescriptor, input: ProviderEntryFormInput) {
  const payload: UnknownRecord = {}

  if (descriptor.supportsName && input.name.trim()) {
    payload.name = input.name.trim()
  }

  if (input.baseUrl.trim()) {
    payload['base-url'] = input.baseUrl.trim()
  }

  if (input.proxyUrl.trim() && descriptor.id !== 'openaiCompatibility') {
    payload['proxy-url'] = input.proxyUrl.trim()
  }

  if (input.prefix.trim()) {
    payload.prefix = input.prefix.trim()
  }

  if (descriptor.disabledMode === 'provider-payload') {
    payload.disabled = input.disabled
  }

  if (descriptor.supportsCloak) {
    const cloak = createCloakPayload(input.cloak)
    if (cloak) payload.cloak = cloak
  }

  appendProviderOptions(payload, descriptor, input)

  if (descriptor.id === 'openaiCompatibility') {
    if (input.testModel?.trim()) {
      payload['test-model'] = input.testModel.trim()
    }

    if (input.apiKey.trim()) {
      payload['api-key-entries'] = [{ 'api-key': input.apiKey.trim() }]
    }
    return payload
  }

  if (input.apiKey.trim()) {
    payload['api-key'] = input.apiKey.trim()
  }

  return payload
}

function createPatchSelector(resource: ProviderResource) {
  const selector = resource.selector

  if (typeof selector.id === 'string') return { id: selector.id }
  if (typeof selector.uuid === 'string') return { uuid: selector.uuid }
  if (typeof selector.name === 'string') return { name: selector.name }
  if (typeof selector['api-key'] === 'string') return { match: selector['api-key'] }

  return { index: resource.index }
}

async function fetchProviderGroup(
  client: AxiosInstance,
  descriptor: ProviderDescriptor,
): Promise<ProviderGroup> {
  const response = await client.get<unknown>(descriptor.path)
  const resources = readProviderEntries(response.data, descriptor.responseKey).map(
    (record, index) => normalizeProviderResource(descriptor, record, index),
  )

  return {
    ...descriptor,
    resources,
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
  const response = await client.get<unknown>(`/model-definitions/${encodeURIComponent(channel)}`)

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

  if (input.providerId === 'gemini') {
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

  if (input.providerId === 'codex') {
    const resolvedHeaders = { ...headers }
    if (apiKey && !hasHeader(resolvedHeaders, 'authorization')) {
      resolvedHeaders.Authorization = `Bearer ${apiKey}`
    } else if (authIndex && !hasHeader(resolvedHeaders, 'authorization')) {
      resolvedHeaders.Authorization = 'Bearer $TOKEN$'
    }

    const payload = await runProviderModelApiCall(client, {
      authIndex,
      url: buildV1ModelsEndpoint(input.baseUrl),
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

  const client = createManagementClient(session)
  const currentGroup = await fetchProviderGroup(client, descriptor)
  const payload = createEntryPayload(descriptor, input)
  await client.put(descriptor.path, [
    ...currentGroup.resources.map((resource) => resource.raw),
    payload,
  ])
}

export async function updateProviderResource(
  session: ManagementSessionInput,
  resource: ProviderResource,
  input: ProviderEntryFormInput,
) {
  const descriptor = providerDescriptors.find((item) => item.id === resource.providerId)
  if (!descriptor) throw new Error(`Unknown provider: ${resource.providerId}`)

  const client = createManagementClient(session)
  await client.patch(descriptor.path, {
    ...createPatchSelector(resource),
    value: createEntryPayload(descriptor, input),
  })
}

export async function deleteProviderResource(
  session: ManagementSessionInput,
  resource: ProviderResource,
) {
  const descriptor = providerDescriptors.find((item) => item.id === resource.providerId)
  if (!descriptor) throw new Error(`Unknown provider: ${resource.providerId}`)

  const client = createManagementClient(session)
  await client.delete(descriptor.path, {
    params: resource.selector,
  })
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
  await client.patch('/auth-files/status', {
    name: authId,
    disabled,
  })
}
