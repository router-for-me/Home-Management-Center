import type { AxiosProgressEvent } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput, RuntimeMode } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type CredentialStatusFilter = 'all' | 'active' | 'disabled' | 'unavailable'

export type CredentialMetadataInput = {
  prefix: string
  proxyUrl: string
  priority: string
  note: string
  websockets?: boolean
}

export type CredentialOAuthProvider = 'claude' | 'codex' | 'antigravity' | 'kimi' | 'xai'
export type CredentialOAuthCallbackProvider = Exclude<CredentialOAuthProvider, 'kimi'>

export type CredentialOAuthStartInput = {
  provider: CredentialOAuthProvider
}

export type CredentialOAuthStatus = {
  status: string
  error: string | null
}

export type CredentialOAuthCallbackInput = {
  provider: CredentialOAuthCallbackProvider
  redirectUrl: string
  code: string
  state: string
  error: string
}

export type VertexImportInput = {
  file: File
  location: string
}

export type VertexImportResult = {
  status: string
  authFile: string | null
  projectId: string | null
  email: string | null
  location: string | null
}

export type CredentialResource = {
  id: string
  index: number
  identifier: string
  name: string | null
  authIndex: string | null
  provider: string
  type: string
  label: string | null
  status: string
  statusMessage: string | null
  disabled: boolean
  unavailable: boolean
  runtimeOnly: boolean
  source: string
  size: number | null
  email: string | null
  accountType: string | null
  account: string | null
  createdAt: string | null
  updatedAt: string | null
  modifiedAt: string | null
  lastRefresh: string | null
  nextRetryAfter: string | null
  success: number | null
  failed: number | null
  path: string | null
  priority: number | null
  note: string | null
  prefix: string | null
  proxyUrl: string | null
  websockets: boolean
  selector: UnknownRecord
  raw: UnknownRecord
}

type CredentialsResponse = {
  files?: unknown[]
}

type OAuthUrlResponse = {
  status?: string
  url?: string
  state?: string
}

type OAuthStatusResponse = {
  status?: string
  error?: string
}

type VertexImportResponse = {
  status?: string
  'auth-file'?: string
  auth_file?: string
  project_id?: string
  email?: string
  location?: string
}

type CredentialModelResponse = {
  models?: unknown[]
}

type CredentialUploadResponse = {
  status?: string
  uploaded?: number
  files?: unknown[]
  name?: string
}

export type CredentialUploadResult = {
  status: string
  uploaded: number
  files: string[]
}

type CredentialModel = {
  id: string
  displayName: string | null
  type: string | null
  ownedBy: string | null
}

type CredentialsSnapshot = {
  fetchedAt: string
  resources: CredentialResource[]
}

type CredentialOAuthStartResult = {
  provider: CredentialOAuthProvider
  url: string
  state: string | null
}

const oauthRoutes: Record<CredentialOAuthProvider, string> = {
  claude: '/anthropic-auth-url',
  codex: '/codex-auth-url',
  antigravity: '/antigravity-auth-url',
  kimi: '/kimi-auth-url',
  xai: '/xai-auth-url',
}

const credentialOAuthProviders = Object.keys(oauthRoutes) as CredentialOAuthProvider[]

export function getCredentialOAuthProviders(runtimeMode: RuntimeMode) {
  return runtimeMode === 'cpa'
    ? credentialOAuthProviders.filter((provider) => provider !== 'xai')
    : credentialOAuthProviders
}

const xaiCallbackUrl = 'http://127.0.0.1:56121/callback'

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function readBoolean(record: UnknownRecord, key: string): boolean {
  return record[key] === true
}

function readFlexibleBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) return true
    if (['false', '0', 'no', 'off'].includes(normalizedValue)) return false
  }

  return null
}

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readFiles(responseData: unknown): UnknownRecord[] {
  const response = responseData as CredentialsResponse
  return Array.isArray(response.files) ? response.files.filter(isRecord) : []
}

function createSelector(record: UnknownRecord, index: number) {
  const id = readString(record, 'id')
  const uuid = readString(record, 'uuid')
  const authIndex = readString(record, 'auth_index')
  const name = readString(record, 'name')

  if (id) return { id }
  if (uuid) return { uuid }
  if (authIndex) return { auth_index: authIndex }
  if (name) return { name }

  return { index }
}

function getStatusSelector(resource: CredentialResource) {
  return (
    resource.name ??
    resource.authIndex ??
    (typeof resource.selector.id === 'string' ? resource.selector.id : null) ??
    resource.identifier
  )
}

function getDownloadFileName(resource: CredentialResource) {
  const rawName = resource.name ?? `${resource.identifier}.json`
  return rawName.endsWith('.json') ? rawName : `${rawName}.json`
}

function normalizeCredentialProvider(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function isCodexCredentialResource(resource: Pick<CredentialResource, 'provider' | 'type'>) {
  return (
    normalizeCredentialProvider(resource.provider) === 'codex' ||
    normalizeCredentialProvider(resource.provider) === 'codex-api-key' ||
    normalizeCredentialProvider(resource.type) === 'codex' ||
    normalizeCredentialProvider(resource.type) === 'codex-api-key'
  )
}

function readNestedFlexibleBoolean(record: UnknownRecord, rootKey: string, key: string) {
  const nested = record[rootKey]
  return isRecord(nested) ? readFlexibleBoolean(nested, key) : null
}

function readCredentialWebsockets(record: UnknownRecord) {
  return (
    readFlexibleBoolean(record, 'websockets') ??
    readFlexibleBoolean(record, 'websocket') ??
    readNestedFlexibleBoolean(record, 'attributes', 'websockets') ??
    readNestedFlexibleBoolean(record, 'metadata', 'websockets') ??
    false
  )
}

function isAbsoluteUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function readQueryLikeCallbackInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const queryStart = trimmed.indexOf('?')
  const hashStart = trimmed.indexOf('#')
  const rawParams =
    queryStart >= 0
      ? trimmed.slice(queryStart + 1)
      : hashStart >= 0
        ? trimmed.slice(hashStart + 1)
        : trimmed

  if (!/(^|[&#?])(code|state|error)=/i.test(rawParams)) return null

  return new URLSearchParams(rawParams.replace(/^[?#]/, ''))
}

function extractDisplayedXaiCode(value: string) {
  const trimmed = value.trim()
  const codeMatch = trimmed.match(/\bcode\s*[:=]\s*([^\s&]+)/i)

  return (codeMatch?.[1] ?? trimmed).trim()
}

function buildXaiCallbackUrl(input: string, state: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (isAbsoluteUrl(trimmed)) return trimmed

  const params = readQueryLikeCallbackInput(trimmed)
  if (params) {
    const callbackState = params.get('state')?.trim() || state
    if (!callbackState) return ''

    const callbackUrl = new URL(xaiCallbackUrl)
    const code = params.get('code')?.trim()
    const error = params.get('error')?.trim()
    const errorDescription = params.get('error_description')?.trim()

    callbackUrl.searchParams.set('state', callbackState)
    if (code) callbackUrl.searchParams.set('code', code)
    if (error) callbackUrl.searchParams.set('error', error)
    if (errorDescription) callbackUrl.searchParams.set('error_description', errorDescription)

    return callbackUrl.toString()
  }

  const code = extractDisplayedXaiCode(trimmed)
  if (!code || !state) return ''

  const callbackUrl = new URL(xaiCallbackUrl)
  callbackUrl.searchParams.set('code', code)
  callbackUrl.searchParams.set('state', state)

  return callbackUrl.toString()
}

function createOAuthCallbackPayload(input: CredentialOAuthCallbackInput) {
  const payload = {
    provider: input.provider,
    redirect_url: input.redirectUrl.trim(),
    code: input.code.trim(),
    state: input.state.trim(),
    error: input.error.trim(),
  }

  if (input.provider !== 'xai') return payload

  const callbackSource = payload.redirect_url || payload.code
  const redirectUrl = buildXaiCallbackUrl(callbackSource, payload.state)
  const normalizedCode = payload.code ? extractDisplayedXaiCode(payload.code) : ''

  return {
    ...payload,
    redirect_url: redirectUrl || payload.redirect_url,
    code: redirectUrl ? '' : normalizedCode,
  }
}

function normalizeCredentialResource(record: UnknownRecord, index: number): CredentialResource {
  const id = readString(record, 'id')
  const authIndex = readString(record, 'auth_index')
  const name = readString(record, 'name')
  const provider = readString(record, 'provider') ?? readString(record, 'type') ?? 'unknown'
  const type = readString(record, 'type') ?? provider
  const identifier = id ?? authIndex ?? name ?? `${provider}-${index + 1}`

  return {
    id: `${provider}:${identifier}`,
    index,
    identifier,
    name,
    authIndex,
    provider,
    type,
    label: readString(record, 'label'),
    status: readString(record, 'status') ?? 'unknown',
    statusMessage: readString(record, 'status_message'),
    disabled: readBoolean(record, 'disabled'),
    unavailable: readBoolean(record, 'unavailable'),
    runtimeOnly: readBoolean(record, 'runtime_only'),
    source: readString(record, 'source') ?? 'unknown',
    size: readNumber(record, 'size'),
    email: readString(record, 'email'),
    accountType: readString(record, 'account_type'),
    account: readString(record, 'account'),
    createdAt: readString(record, 'created_at'),
    updatedAt: readString(record, 'updated_at'),
    modifiedAt: readString(record, 'modtime'),
    lastRefresh: readString(record, 'last_refresh'),
    nextRetryAfter: readString(record, 'next_retry_after'),
    success: readNumber(record, 'success'),
    failed: readNumber(record, 'failed'),
    path: readString(record, 'path'),
    priority: readNumber(record, 'priority'),
    note: readString(record, 'note'),
    prefix: readString(record, 'prefix'),
    proxyUrl: readString(record, 'proxy_url') ?? readString(record, 'proxy-url'),
    websockets: readCredentialWebsockets(record),
    selector: createSelector(record, index),
    raw: record,
  }
}

function createFieldsPayload(resource: CredentialResource, input: CredentialMetadataInput) {
  const payload: UnknownRecord = {
    name: getStatusSelector(resource),
    ...resource.selector,
    prefix: input.prefix.trim(),
    proxy_url: input.proxyUrl.trim(),
    'proxy-url': input.proxyUrl.trim(),
    note: input.note.trim(),
  }

  const priority = Number(input.priority)
  if (input.priority.trim() && Number.isFinite(priority)) {
    payload.priority = priority
  }

  if (isCodexCredentialResource(resource) && typeof input.websockets === 'boolean') {
    payload.websockets = input.websockets
  }

  return payload
}

function createDownloadParams(resource: CredentialResource) {
  return resource.selector
}

export async function fetchCredentialSnapshot(
  session: ManagementSessionInput,
): Promise<CredentialsSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/auth-files')

  return {
    fetchedAt: new Date().toISOString(),
    resources: readFiles(response.data).map((record, index) =>
      normalizeCredentialResource(record, index),
    ),
  }
}

export function getCredentialBindingAuthId(resource: CredentialResource) {
  return (
    resource.authIndex ??
    readString(resource.raw, 'id') ??
    readString(resource.raw, 'uuid') ??
    readString(resource.raw, 'auth_index') ??
    resource.identifier
  )
}

export async function updateCredentialStatus(
  session: ManagementSessionInput,
  resource: CredentialResource,
  disabled: boolean,
) {
  const client = createManagementClient(session)
  await client.patch('/auth-files/status', {
    name: getStatusSelector(resource),
    disabled,
  })
}

export async function updateCredentialMetadata(
  session: ManagementSessionInput,
  resource: CredentialResource,
  input: CredentialMetadataInput,
) {
  const client = createManagementClient(session)
  await client.patch('/auth-files/fields', createFieldsPayload(resource, input))
}

export async function deleteCredentialResource(
  session: ManagementSessionInput,
  resource: CredentialResource,
) {
  const client = createManagementClient(session)
  await client.delete('/auth-files', {
    params: resource.selector,
  })
}

export async function uploadCredentialFile(
  session: ManagementSessionInput,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<CredentialUploadResult> {
  const client = createManagementClient(session)
  const formData = new FormData()
  formData.append('file', file)

  const response = await client.post<CredentialUploadResponse>('/auth-files', formData, {
    onUploadProgress: (event: AxiosProgressEvent) => {
      const ratio =
        event.progress ??
        (typeof event.total === 'number' && event.total > 0 ? event.loaded / event.total : 0)
      onProgress?.(Math.min(99, Math.max(0, Math.round(ratio * 100))))
    },
  })
  const files = Array.isArray(response.data.files)
    ? response.data.files.filter((item): item is string => typeof item === 'string')
    : typeof response.data.name === 'string'
      ? [response.data.name]
      : [file.name]

  onProgress?.(100)

  return {
    status: response.data.status ?? 'ok',
    uploaded:
      typeof response.data.uploaded === 'number' && Number.isFinite(response.data.uploaded)
        ? response.data.uploaded
        : 1,
    files,
  }
}

export async function downloadCredentialResource(
  session: ManagementSessionInput,
  resource: CredentialResource,
) {
  const client = createManagementClient(session)
  const response = await client.get<Blob>('/auth-files/download', {
    params: createDownloadParams(resource),
    responseType: 'blob',
  })

  return {
    blob: response.data,
    fileName: getDownloadFileName(resource),
  }
}

export async function fetchCredentialModels(
  session: ManagementSessionInput,
  resource: CredentialResource,
): Promise<CredentialModel[]> {
  const client = createManagementClient(session)
  const response = await client.get<CredentialModelResponse>('/auth-files/models', {
    params: {
      name: getStatusSelector(resource),
    },
  })

  return Array.isArray(response.data.models)
    ? response.data.models.filter(isRecord).map((record) => ({
        id: readString(record, 'id') ?? 'unknown',
        displayName: readString(record, 'display_name'),
        type: readString(record, 'type'),
        ownedBy: readString(record, 'owned_by'),
      }))
    : []
}

export async function startCredentialOAuth(
  session: ManagementSessionInput,
  input: CredentialOAuthStartInput,
): Promise<CredentialOAuthStartResult> {
  const client = createManagementClient(session)
  const response = await client.get<OAuthUrlResponse>(oauthRoutes[input.provider], {
    params: {
      is_webui: true,
    },
  })

  if (!response.data.url) {
    throw new Error('OAuth URL was not returned')
  }

  return {
    provider: input.provider,
    url: response.data.url,
    state: response.data.state ?? null,
  }
}

export async function fetchCredentialOAuthStatus(
  session: ManagementSessionInput,
  state?: string,
): Promise<CredentialOAuthStatus> {
  const client = createManagementClient(session)
  const response = await client.get<OAuthStatusResponse>('/get-auth-status', {
    params: {
      state: state?.trim() || undefined,
    },
  })

  return {
    status: response.data.status ?? 'unknown',
    error: response.data.error ?? null,
  }
}

export async function submitCredentialOAuthCallback(
  session: ManagementSessionInput,
  input: CredentialOAuthCallbackInput,
) {
  const client = createManagementClient(session)
  await client.post('/oauth-callback', createOAuthCallbackPayload(input))
}

export async function importVertexCredential(
  session: ManagementSessionInput,
  input: VertexImportInput,
): Promise<VertexImportResult> {
  const client = createManagementClient(session)
  const formData = new FormData()
  const location = input.location.trim()

  formData.append('file', input.file)
  if (location) {
    formData.append('location', location)
  }

  const response = await client.post<VertexImportResponse>('/vertex/import', formData)

  return {
    status: response.data.status ?? 'unknown',
    authFile: response.data['auth-file'] ?? response.data.auth_file ?? null,
    projectId: response.data.project_id ?? null,
    email: response.data.email ?? null,
    location: response.data.location ?? (location || null),
  }
}

export function toCredentialApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return Object.assign(new Error(apiError.message, { cause: error }), {
    status: apiError.status,
    code: apiError.code,
  })
}
