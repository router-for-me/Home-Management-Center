import type { AxiosInstance } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type ProviderId = 'gemini' | 'claude' | 'codex' | 'vertex' | 'openaiCompatibility'
export type ProviderModelChannel =
  | 'claude'
  | 'gemini'
  | 'vertex'
  | 'gemini-cli'
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
  supportsDisabled: boolean
}

export type ProviderEntryFormInput = {
  apiKey: string
  name: string
  baseUrl: string
  proxyUrl: string
  prefix: string
  disabled: boolean
}

export type ProviderRequestIssue = {
  providerId: ProviderId
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

const providerDescriptors: ProviderDescriptor[] = [
  {
    id: 'gemini',
    path: '/gemini-api-key',
    responseKey: 'gemini-api-key',
    supportsName: false,
    supportsApiKey: true,
    supportsDisabled: false,
  },
  {
    id: 'claude',
    path: '/claude-api-key',
    responseKey: 'claude-api-key',
    supportsName: false,
    supportsApiKey: true,
    supportsDisabled: false,
  },
  {
    id: 'codex',
    path: '/codex-api-key',
    responseKey: 'codex-api-key',
    supportsName: false,
    supportsApiKey: true,
    supportsDisabled: false,
  },
  {
    id: 'vertex',
    path: '/vertex-api-key',
    responseKey: 'vertex-api-key',
    supportsName: false,
    supportsApiKey: true,
    supportsDisabled: false,
  },
  {
    id: 'openaiCompatibility',
    path: '/openai-compatibility',
    responseKey: 'openai-compatibility',
    supportsName: true,
    supportsApiKey: true,
    supportsDisabled: true,
  },
]

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

function maskSecret(value: string | null): string | null {
  if (!value) return null
  if (value.length <= 10) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function normalizeIssue(providerId: ProviderId, error: unknown): ProviderRequestIssue {
  const apiError = toManagementApiError(error)

  return {
    providerId,
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
    disabled: readBoolean(record, 'disabled'),
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

  if (descriptor.supportsDisabled) {
    payload.disabled = input.disabled
  }

  if (descriptor.id === 'openaiCompatibility') {
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
): Promise<ProvidersSnapshot> {
  const client = createManagementClient(session)
  const groups = await Promise.all(
    providerDescriptors.map(async (descriptor) => {
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
