import type { AxiosProgressEvent, AxiosResponse } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput, RuntimeMode } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type CredentialStatusFilter = 'all' | 'active' | 'disabled' | 'unavailable'

export type CredentialMetadataInput = {
  prefix: string
  proxyUrl: string
  // An empty string leaves priority unchanged; null clears it back to unset.
  priority: string | null
  note: string
  websockets?: boolean
  maxInFlight?: number | null
  maxInFlightByModel?: Record<string, number>
  concurrencyVersion?: number
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
  maxInFlight: number | null
  maxInFlightByModel: Record<string, number>
  concurrencyFieldsValid: boolean
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

type CredentialUploadResult = {
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

export type CredentialInFlightModelSummary = {
  model: string
  observedInFlight: number | null
  admittedInFlight: number | null
  maxInFlight: number | null
  remaining: number | null
  saturated: boolean
}

export type CredentialInFlightObservedState = {
  inFlight: number
  accounted: number
  unaccounted: number
  stale: boolean
  coverageComplete: boolean
  aggregatesComplete: boolean
  detailsTruncated: boolean
}

export type CredentialConcurrencyEnforcement = 'unknown' | 'false' | 'true'

export type CredentialInFlightSummary = {
  credentialId: string
  observedInFlight: number | null
  admittedInFlight: number | null
  maxInFlight: number | null
  remaining: number | null
  totalSaturated: boolean
  saturatedModelCount: number
  models: CredentialInFlightModelSummary[]
  policyVersion: number | null
  effectiveAt: string | null
  observationBarrierRevision: number | null
  fullyEnforced: CredentialConcurrencyEnforcement
  observed: CredentialInFlightObservedState | null
}

export type CredentialInFlightRequest = {
  requestId: string
  credentialId: string
  model: string
  requestKind: string
  startedAt: string
}

export type CredentialInFlightObservationMetadata = {
  observedAt: string | null
  stale: boolean
  coverageComplete: boolean
  aggregatesComplete: boolean
  protocolCoverageComplete: boolean
  minimumProcessedBarrierRevision: number | null
  detailsTruncated: boolean
}

type CredentialInFlightSnapshot = CredentialInFlightObservationMetadata & {
  items: CredentialInFlightSummary[]
}

export type CredentialInFlightDetail = CredentialInFlightObservationMetadata & {
  requests: CredentialInFlightRequest[]
  total: number | null
  nextOffset: number | null
  snapshotCursor: string | null
  snapshotExpiresAt: string | null
  paginationLimited: boolean
}

export type CredentialInFlightDetailPageRequest = {
  offset?: number
  stableSnapshot?: boolean
  snapshotCursor?: string | null
  expectedTotal?: number | null
  expectedSnapshotExpiresAt?: string | null
}

type CredentialConcurrencySnapshot = {
  items: CredentialInFlightSummary[]
}

export type CredentialConcurrencyPolicy = {
  credentialId: string
  maxInFlight: number | null
  maxInFlightByModel: Record<string, number>
  version: number
  effectiveAt: string | null
  observationBarrierRevision: number
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

function readNonNegativeInteger(record: UnknownRecord, key: string): number | null {
  const value = readNumber(record, key)
  return value !== null && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function readNullableNonNegativeInteger(
  record: UnknownRecord,
  key: string,
): { valid: true; value: number | null } | { valid: false } {
  const value = record[key]
  if (value === null) return { valid: true, value: null }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return { valid: true, value }
  }
  return { valid: false }
}

function readRequiredBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

function readDateTime(record: UnknownRecord, key: string): string | null {
  const value = readString(record, key)
  return value && Number.isFinite(Date.parse(value)) ? value : null
}

function hasOwn(record: UnknownRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function readNullableDateTime(
  record: UnknownRecord,
  key: string,
): { valid: true; value: string | null } | { valid: false } {
  if (!hasOwn(record, key)) return { valid: false }
  if (record[key] === null) return { valid: true, value: null }
  const value = readDateTime(record, key)
  return value ? { valid: true, value } : { valid: false }
}

function readNullableString(
  record: UnknownRecord,
  key: string,
): { valid: true; value: string | null } | { valid: false } {
  if (!hasOwn(record, key)) return { valid: false }
  if (record[key] === null) return { valid: true, value: null }
  const value = readString(record, key)
  return value ? { valid: true, value } : { valid: false }
}

function readOptionalNullableNonNegativeInteger(
  record: UnknownRecord,
  key: string,
): { valid: true; value: number | null } | { valid: false } {
  if (!hasOwn(record, key) || record[key] === null) return { valid: true, value: null }
  return readNullableNonNegativeInteger(record, key)
}

function invalidCredentialInFlightContract(): never {
  throw new Error('Home returned an invalid credential in-flight response.')
}

function invalidCredentialConcurrencyContract(): never {
  throw new Error('Home returned an invalid credential concurrency response.')
}

function readConcurrencyModelLimits(
  record: UnknownRecord,
  key: string,
): { valid: true; value: Record<string, number> } | { valid: false } {
  const value = record[key]
  if (value === null) return { valid: true, value: {} }
  if (!isRecord(value)) return { valid: false }
  const limits: Record<string, number> = {}
  for (const [rawModel, rawLimit] of Object.entries(value)) {
    const model = rawModel.trim()
    if (
      !model ||
      typeof rawLimit !== 'number' ||
      !Number.isSafeInteger(rawLimit) ||
      rawLimit < 0 ||
      Object.prototype.hasOwnProperty.call(limits, model)
    ) {
      return { valid: false }
    }
    if (rawLimit > 0) limits[model] = rawLimit
  }
  return { valid: true, value: limits }
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

// WebSocket metadata is writable for Codex and xAI (Grok) credentials. Keep this in
// sync with the backend auth-files field whitelist; other providers ignore the field.
export function supportsCredentialWebsockets(
  resource: Pick<CredentialResource, 'provider' | 'type'>,
) {
  const candidates = [resource.provider, resource.type].map(normalizeCredentialProvider)
  return candidates.some(
    (value) =>
      value === 'codex' || value === 'codex-api-key' || value === 'xai' || value === 'xai-api-key',
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
  const maxInFlight = readNullableNonNegativeInteger(record, 'max_in_flight')
  const maxInFlightByModel = readConcurrencyModelLimits(record, 'max_in_flight_by_model')

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
    maxInFlight:
      maxInFlight.valid && maxInFlight.value && maxInFlight.value > 0 ? maxInFlight.value : null,
    maxInFlightByModel: maxInFlightByModel.valid ? maxInFlightByModel.value : {},
    concurrencyFieldsValid: maxInFlight.valid && maxInFlightByModel.valid,
    selector: createSelector(record, index),
    raw: record,
  }
}

function normalizeCredentialInFlightObservedState(
  record: UnknownRecord,
): CredentialInFlightObservedState | null {
  const inFlight = readNonNegativeInteger(record, 'in_flight')
  const accounted = readNonNegativeInteger(record, 'accounted')
  const unaccounted = readNonNegativeInteger(record, 'unaccounted')
  const stale = readRequiredBoolean(record, 'stale')
  const coverageComplete = readRequiredBoolean(record, 'coverage_complete')
  const aggregatesComplete = readRequiredBoolean(record, 'aggregates_complete')
  const detailsTruncated = readRequiredBoolean(record, 'details_truncated')
  if (
    inFlight === null ||
    accounted === null ||
    unaccounted === null ||
    stale === null ||
    coverageComplete === null ||
    aggregatesComplete === null ||
    detailsTruncated === null
  ) {
    return null
  }
  const classifiedInFlight = accounted + unaccounted
  if (!Number.isSafeInteger(classifiedInFlight) || classifiedInFlight !== inFlight) return null
  return {
    inFlight,
    accounted,
    unaccounted,
    stale,
    coverageComplete,
    aggregatesComplete,
    detailsTruncated,
  }
}

function normalizeCredentialInFlightObservationMetadata(
  record: UnknownRecord,
): CredentialInFlightObservationMetadata | null {
  const observedAt = readNullableDateTime(record, 'observed_at')
  const stale = readRequiredBoolean(record, 'stale')
  const coverageComplete = readRequiredBoolean(record, 'coverage_complete')
  const aggregatesComplete = readRequiredBoolean(record, 'aggregates_complete')
  const protocolCoverageComplete = readRequiredBoolean(record, 'protocol_coverage_complete')
  const minimumProcessedBarrierRevision = readNullableNonNegativeInteger(
    record,
    'minimum_processed_barrier_revision',
  )
  const detailsTruncated = readRequiredBoolean(record, 'details_truncated')
  if (
    !observedAt.valid ||
    stale === null ||
    coverageComplete === null ||
    aggregatesComplete === null ||
    protocolCoverageComplete === null ||
    !minimumProcessedBarrierRevision.valid ||
    detailsTruncated === null
  ) {
    return null
  }
  return {
    observedAt: observedAt.value,
    stale,
    coverageComplete,
    aggregatesComplete,
    protocolCoverageComplete,
    minimumProcessedBarrierRevision: minimumProcessedBarrierRevision.value,
    detailsTruncated,
  }
}

function normalizeCredentialObservedModel(
  record: UnknownRecord,
): CredentialInFlightModelSummary | null {
  const model = readString(record, 'model')
  const observedInFlight = readNonNegativeInteger(record, 'in_flight')
  const saturated = readRequiredBoolean(record, 'saturated')
  const maxInFlight = readNullableNonNegativeInteger(record, 'max_in_flight')
  const remaining = readNullableNonNegativeInteger(record, 'remaining')
  if (
    !model ||
    observedInFlight === null ||
    saturated === null ||
    !maxInFlight.valid ||
    !remaining.valid
  ) {
    return null
  }
  return {
    model,
    observedInFlight,
    admittedInFlight: null,
    maxInFlight: maxInFlight.value,
    remaining: remaining.value,
    saturated,
  }
}

function normalizeCredentialLimiterModel(
  record: UnknownRecord,
): CredentialInFlightModelSummary | null {
  const model = readString(record, 'model')
  const maxInFlight = readNonNegativeInteger(record, 'max_in_flight')
  const admittedInFlight = readNonNegativeInteger(record, 'admitted_in_flight')
  const remaining = readNonNegativeInteger(record, 'remaining')
  const saturated = readRequiredBoolean(record, 'saturated')
  if (
    !model ||
    maxInFlight === null ||
    maxInFlight === 0 ||
    admittedInFlight === null ||
    remaining === null ||
    saturated === null
  ) {
    return null
  }
  const expectedRemaining = Math.max(0, maxInFlight - admittedInFlight)
  if (remaining !== expectedRemaining || saturated !== admittedInFlight >= maxInFlight) {
    return null
  }
  return {
    model,
    observedInFlight: null,
    admittedInFlight,
    maxInFlight,
    remaining,
    saturated,
  }
}

function readCredentialConcurrencyEnforcement(
  record: UnknownRecord,
): CredentialConcurrencyEnforcement | null {
  const value = readString(record, 'fully_enforced')
  return value === 'unknown' || value === 'false' || value === 'true' ? value : null
}

function normalizeCredentialConcurrencyState(
  record: UnknownRecord,
): CredentialInFlightSummary | null {
  const credentialId = readString(record, 'credential_id')
  const maxInFlight = readNullableNonNegativeInteger(record, 'max_in_flight')
  const admittedInFlight = readNonNegativeInteger(record, 'admitted_in_flight')
  const remaining = readNullableNonNegativeInteger(record, 'remaining')
  const totalSaturated = readRequiredBoolean(record, 'total_saturated')
  const policyVersion = readNonNegativeInteger(record, 'policy_version')
  const effectiveAt = readDateTime(record, 'effective_at')
  const observationBarrierRevision = readNonNegativeInteger(record, 'observation_barrier_revision')
  const fullyEnforced = readCredentialConcurrencyEnforcement(record)
  const observedValue = record.observed
  const observed =
    observedValue === null
      ? null
      : isRecord(observedValue)
        ? normalizeCredentialInFlightObservedState(observedValue)
        : null
  if (
    !credentialId ||
    !maxInFlight.valid ||
    admittedInFlight === null ||
    !remaining.valid ||
    totalSaturated === null ||
    policyVersion === null ||
    !effectiveAt ||
    observationBarrierRevision === null ||
    fullyEnforced === null ||
    !hasOwn(record, 'observed') ||
    (observedValue !== null && observed === null) ||
    !Array.isArray(record.models) ||
    !record.models.every(isRecord)
  ) {
    return null
  }
  if (
    (maxInFlight.value === null && remaining.value !== null) ||
    (maxInFlight.value !== null &&
      (remaining.value !== Math.max(0, maxInFlight.value - admittedInFlight) ||
        totalSaturated !== admittedInFlight >= maxInFlight.value))
  ) {
    return null
  }
  const normalizedModels = record.models.map(normalizeCredentialLimiterModel)
  if (normalizedModels.some((item) => item === null)) return null
  const models = normalizedModels as CredentialInFlightModelSummary[]
  return {
    credentialId,
    observedInFlight: observed?.inFlight ?? null,
    admittedInFlight,
    maxInFlight: maxInFlight.value,
    remaining: remaining.value,
    totalSaturated,
    saturatedModelCount: models.filter((model) => model.saturated).length,
    models,
    policyVersion,
    effectiveAt,
    observationBarrierRevision,
    fullyEnforced,
    observed,
  }
}

function mergeCredentialConcurrencyModels(
  observedModels: CredentialInFlightModelSummary[],
  limiterModels: CredentialInFlightModelSummary[],
) {
  const models = new Map<string, CredentialInFlightModelSummary>()
  for (const model of observedModels) {
    models.set(model.model, {
      model: model.model,
      observedInFlight: model.observedInFlight,
      admittedInFlight: null,
      maxInFlight: null,
      remaining: null,
      saturated: false,
    })
  }
  for (const limiterModel of limiterModels) {
    const observedModel = models.get(limiterModel.model)
    models.set(limiterModel.model, {
      ...limiterModel,
      observedInFlight: observedModel?.observedInFlight ?? limiterModel.observedInFlight,
    })
  }
  return [...models.values()]
}

function selectCredentialConcurrencyAuthority(
  observed: CredentialInFlightSummary | null,
  limiter: CredentialInFlightSummary | null,
) {
  // Snapshot and limiter endpoints poll independently, so their policy projections can briefly
  // straddle an update. Policy versions are monotonic for one stable credential ID.
  const observedVersion = observed?.policyVersion ?? null
  const limiterVersion = limiter?.policyVersion ?? null
  if (observedVersion === null) return limiterVersion === null ? null : limiter
  if (limiterVersion === null) return observed
  return limiterVersion >= observedVersion ? limiter : observed
}

export function mergeCredentialConcurrencySummary(
  observed: CredentialInFlightSummary | null,
  limiter: CredentialInFlightSummary | null,
): CredentialInFlightSummary | null {
  if (!observed && !limiter) return null
  if (observed && limiter && observed.credentialId !== limiter.credentialId) return null
  const source = observed ?? limiter
  if (!source) return null
  const authority = selectCredentialConcurrencyAuthority(observed, limiter)
  const models =
    authority === limiter
      ? mergeCredentialConcurrencyModels(observed?.models ?? [], limiter?.models ?? [])
      : (observed?.models ?? limiter?.models ?? [])
  let fullyEnforced: CredentialConcurrencyEnforcement = 'unknown'
  if (!authority) {
    fullyEnforced = observed?.fullyEnforced ?? 'unknown'
  } else if (authority === observed || authority.observed !== null) {
    fullyEnforced = authority.fullyEnforced
  } else if (
    observed?.policyVersion !== null &&
    observed?.policyVersion === authority.policyVersion &&
    observed.observationBarrierRevision === authority.observationBarrierRevision
  ) {
    fullyEnforced = observed.fullyEnforced
  }
  return {
    credentialId: source.credentialId,
    observedInFlight: observed?.observedInFlight ?? authority?.observedInFlight ?? null,
    admittedInFlight: authority?.admittedInFlight ?? null,
    maxInFlight: authority?.maxInFlight ?? null,
    remaining: authority?.remaining ?? null,
    totalSaturated: authority?.totalSaturated ?? false,
    saturatedModelCount: models.filter((model) => model.saturated).length,
    models,
    policyVersion: authority?.policyVersion ?? null,
    effectiveAt: authority?.effectiveAt ?? null,
    observationBarrierRevision: authority?.observationBarrierRevision ?? null,
    fullyEnforced,
    observed: observed?.observed ?? authority?.observed ?? null,
  }
}

function normalizeCredentialInFlightSummary(
  record: UnknownRecord,
): CredentialInFlightSummary | null {
  const credentialId = readString(record, 'credential_id')
  const observedInFlight = readNonNegativeInteger(record, 'in_flight')
  const admittedInFlight = readOptionalNullableNonNegativeInteger(record, 'admitted_in_flight')
  const totalSaturated = readRequiredBoolean(record, 'total_saturated')
  const saturatedModelCount = readNonNegativeInteger(record, 'saturated_model_count')
  const maxInFlight = readNullableNonNegativeInteger(record, 'max_in_flight')
  const remaining = readNullableNonNegativeInteger(record, 'remaining')
  const observedValue = record.observed
  const observed = isRecord(observedValue)
    ? normalizeCredentialInFlightObservedState(observedValue)
    : null
  const limiterValue = record.limiter
  const limiter = isRecord(limiterValue) ? normalizeCredentialConcurrencyState(limiterValue) : null
  if (
    !credentialId ||
    observedInFlight === null ||
    !admittedInFlight.valid ||
    totalSaturated === null ||
    saturatedModelCount === null ||
    !maxInFlight.valid ||
    !remaining.valid ||
    !observed ||
    !hasOwn(record, 'limiter') ||
    (limiterValue !== null && limiter === null) ||
    (limiter && limiter.credentialId !== credentialId) ||
    !Array.isArray(record.models) ||
    !record.models.every(isRecord)
  ) {
    return null
  }
  if (observed.inFlight !== observedInFlight) return null
  const normalizedModels = record.models.map(normalizeCredentialObservedModel)
  if (normalizedModels.some((item) => item === null)) return null
  const models = normalizedModels as CredentialInFlightModelSummary[]
  if (!limiter) {
    if (
      admittedInFlight.value !== null ||
      maxInFlight.value !== null ||
      remaining.value !== null ||
      totalSaturated ||
      saturatedModelCount !== 0 ||
      models.some(
        (model) => model.maxInFlight !== null || model.remaining !== null || model.saturated,
      )
    ) {
      return null
    }
  } else {
    if (
      admittedInFlight.value !== limiter.admittedInFlight ||
      maxInFlight.value !== limiter.maxInFlight ||
      remaining.value !== limiter.remaining ||
      totalSaturated !== limiter.totalSaturated ||
      saturatedModelCount !== limiter.saturatedModelCount
    ) {
      return null
    }
    const limiterModels = new Map(limiter.models.map((model) => [model.model, model]))
    for (const model of models) {
      const limiterModel = limiterModels.get(model.model)
      if (
        model.maxInFlight !== (limiterModel?.maxInFlight ?? null) ||
        model.remaining !== (limiterModel?.remaining ?? null) ||
        model.saturated !== (limiterModel?.saturated ?? false)
      ) {
        return null
      }
    }
  }
  const summary: CredentialInFlightSummary = {
    credentialId,
    observedInFlight,
    admittedInFlight: admittedInFlight.value,
    maxInFlight: maxInFlight.value,
    remaining: remaining.value,
    totalSaturated,
    saturatedModelCount,
    models,
    policyVersion: null,
    effectiveAt: null,
    observationBarrierRevision: null,
    fullyEnforced: 'unknown',
    observed,
  }
  return mergeCredentialConcurrencySummary(summary, limiter)
}

function normalizeCredentialInFlightRequest(
  record: UnknownRecord,
): CredentialInFlightRequest | null {
  const requestId = readString(record, 'request_id')
  const credentialId = readString(record, 'credential_id')
  const model = readString(record, 'model')
  const requestKind = readString(record, 'request_kind')
  const startedAt = readDateTime(record, 'started_at')
  const limiterValue = record.limiter
  const limiter = isRecord(limiterValue) ? normalizeCredentialConcurrencyState(limiterValue) : null
  if (
    !requestId ||
    !credentialId ||
    !model ||
    !requestKind ||
    !startedAt ||
    !hasOwn(record, 'limiter') ||
    (limiterValue !== null && limiter === null) ||
    (limiter && limiter.credentialId !== credentialId)
  ) {
    return null
  }
  return {
    requestId,
    credentialId,
    model,
    requestKind,
    startedAt,
  }
}

function normalizeCredentialConcurrencyPolicy(
  record: UnknownRecord,
): CredentialConcurrencyPolicy | null {
  const credentialId = readString(record, 'credential_id')
  const maxInFlight = readNullableNonNegativeInteger(record, 'max_in_flight')
  const maxInFlightByModel = readConcurrencyModelLimits(record, 'max_in_flight_by_model')
  const version = readNonNegativeInteger(record, 'version')
  const effectiveAt = readNullableDateTime(record, 'effective_at')
  const observationBarrierRevision = readNonNegativeInteger(record, 'observation_barrier_revision')
  if (
    !credentialId ||
    !maxInFlight.valid ||
    !maxInFlightByModel.valid ||
    version === null ||
    !effectiveAt.valid ||
    observationBarrierRevision === null
  ) {
    return null
  }
  return {
    credentialId,
    maxInFlight: maxInFlight.value,
    maxInFlightByModel: maxInFlightByModel.value,
    version,
    effectiveAt: effectiveAt.value,
    observationBarrierRevision,
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

  if (input.priority === null) {
    payload.priority = null
  } else {
    const priority = Number(input.priority)
    if (input.priority.trim() && Number.isFinite(priority)) {
      payload.priority = priority
    }
  }

  if (supportsCredentialWebsockets(resource) && typeof input.websockets === 'boolean') {
    payload.websockets = input.websockets
  }

  if (input.maxInFlight !== undefined) {
    payload.max_in_flight = input.maxInFlight
  }
  if (input.maxInFlightByModel !== undefined) {
    payload.max_in_flight_by_model = input.maxInFlightByModel
  }
  if (input.concurrencyVersion !== undefined) {
    payload.version = input.concurrencyVersion
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

export async function fetchCredentialInFlightSummary(
  session: ManagementSessionInput,
): Promise<CredentialInFlightSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/credentials/in-flight/summary')
  if (!isRecord(response.data)) {
    invalidCredentialInFlightContract()
  }
  const root = response.data
  const metadata = normalizeCredentialInFlightObservationMetadata(root)
  const rawItems = root.items
  if (!metadata || !Array.isArray(rawItems)) invalidCredentialInFlightContract()
  if (!rawItems.every(isRecord)) invalidCredentialInFlightContract()
  const items = rawItems.map(normalizeCredentialInFlightSummary)
  if (items.some((item) => item === null)) invalidCredentialInFlightContract()
  return {
    ...metadata,
    items: items as CredentialInFlightSummary[],
  }
}

export async function fetchCredentialConcurrencySnapshot(
  session: ManagementSessionInput,
): Promise<CredentialConcurrencySnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/credentials/concurrency')
  if (!isRecord(response.data) || !Array.isArray(response.data.items)) {
    invalidCredentialConcurrencyContract()
  }
  const rawItems = response.data.items
  if (!rawItems.every(isRecord)) invalidCredentialConcurrencyContract()
  const items = rawItems.map(normalizeCredentialConcurrencyState)
  if (
    items.some(
      (item) =>
        item === null ||
        item.observed !== null ||
        item.observedInFlight !== null ||
        item.fullyEnforced !== 'unknown',
    )
  ) {
    invalidCredentialConcurrencyContract()
  }
  return { items: items as CredentialInFlightSummary[] }
}

export async function fetchCredentialConcurrencyPolicy(
  session: ManagementSessionInput,
  credentialId: string,
): Promise<CredentialConcurrencyPolicy> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>(
    `/credentials/${encodeURIComponent(credentialId)}/concurrency-policy`,
  )
  if (!isRecord(response.data)) invalidCredentialConcurrencyContract()
  const policy = normalizeCredentialConcurrencyPolicy(response.data)
  if (!policy || policy.credentialId !== credentialId) invalidCredentialConcurrencyContract()
  return policy
}

const credentialInFlightPageSize = 50

export async function fetchCredentialInFlightDetail(
  session: ManagementSessionInput,
  credentialId: string,
  page: CredentialInFlightDetailPageRequest = {},
): Promise<CredentialInFlightDetail> {
  const offset = page.offset ?? 0
  const snapshotCursor = page.snapshotCursor?.trim() || null
  const expectedTotal = page.expectedTotal ?? null
  const expectedSnapshotExpiresAt = page.expectedSnapshotExpiresAt?.trim() || null
  const stablePagination = page.stableSnapshot === true || snapshotCursor !== null
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    (expectedTotal !== null && (!Number.isSafeInteger(expectedTotal) || expectedTotal < 0)) ||
    (expectedSnapshotExpiresAt !== null &&
      !Number.isFinite(Date.parse(expectedSnapshotExpiresAt))) ||
    (snapshotCursor === null && (expectedTotal !== null || expectedSnapshotExpiresAt !== null)) ||
    (snapshotCursor !== null && (expectedTotal === null || expectedSnapshotExpiresAt === null))
  ) {
    invalidCredentialInFlightContract()
  }
  const client = createManagementClient(session)
  let usesStablePagination = stablePagination
  let response: AxiosResponse<unknown>
  try {
    response = await client.get<unknown>('/credentials/in-flight', {
      params: {
        credential_id: credentialId,
        limit: stablePagination ? credentialInFlightPageSize : credentialInFlightPageSize + 1,
        offset,
        ...(page.stableSnapshot === true && snapshotCursor === null
          ? { stable_snapshot: true }
          : {}),
        ...(snapshotCursor ? { snapshot_cursor: snapshotCursor } : {}),
      },
    })
  } catch (error) {
    const apiError = toManagementApiError(error)
    if (
      page.stableSnapshot !== true ||
      snapshotCursor !== null ||
      offset !== 0 ||
      apiError.backendCode !== 'in_flight_snapshot_cursor_store_failed'
    ) {
      throw error
    }
    response = await client.get<unknown>('/credentials/in-flight', {
      params: {
        credential_id: credentialId,
        limit: credentialInFlightPageSize + 1,
        offset: 0,
      },
    })
    usesStablePagination = false
  }
  if (!isRecord(response.data)) invalidCredentialInFlightContract()
  const root = response.data
  const metadata = normalizeCredentialInFlightObservationMetadata(root)
  if (!metadata || !Array.isArray(root.items) || !root.items.every(isRecord)) {
    invalidCredentialInFlightContract()
  }
  const requests = root.items.map(normalizeCredentialInFlightRequest)
  if (requests.some((item) => item === null)) invalidCredentialInFlightContract()
  const normalizedRequests = requests as CredentialInFlightRequest[]
  if (normalizedRequests.some((request) => request.credentialId !== credentialId)) {
    invalidCredentialInFlightContract()
  }

  if (usesStablePagination) {
    const total = readNonNegativeInteger(root, 'total')
    const nextOffset = readNullableNonNegativeInteger(root, 'next_offset')
    const responseCursor = readNullableString(root, 'snapshot_cursor')
    const snapshotExpiresAt = readNullableDateTime(root, 'snapshot_expires_at')
    if (
      total === null ||
      !nextOffset.valid ||
      !responseCursor.valid ||
      !snapshotExpiresAt.valid ||
      normalizedRequests.length > credentialInFlightPageSize ||
      (responseCursor.value === null) !== (snapshotExpiresAt.value === null)
    ) {
      invalidCredentialInFlightContract()
    }
    const expectedCount = Math.min(credentialInFlightPageSize, Math.max(0, total - offset))
    const consumed = offset + normalizedRequests.length
    if (offset > total || normalizedRequests.length !== expectedCount) {
      invalidCredentialInFlightContract()
    }
    if (consumed < total) {
      if (nextOffset.value !== consumed || responseCursor.value === null) {
        invalidCredentialInFlightContract()
      }
    } else if (nextOffset.value !== null) {
      invalidCredentialInFlightContract()
    }
    if (snapshotCursor !== null && responseCursor.value !== snapshotCursor) {
      invalidCredentialInFlightContract()
    }
    if (expectedTotal !== null && total !== expectedTotal) {
      invalidCredentialInFlightContract()
    }
    if (
      expectedSnapshotExpiresAt !== null &&
      snapshotExpiresAt.value !== expectedSnapshotExpiresAt
    ) {
      invalidCredentialInFlightContract()
    }
    if (snapshotCursor === null && nextOffset.value === null && responseCursor.value !== null) {
      invalidCredentialInFlightContract()
    }
    return {
      ...metadata,
      requests: normalizedRequests,
      total,
      nextOffset: nextOffset.value,
      snapshotCursor: responseCursor.value,
      snapshotExpiresAt: snapshotExpiresAt.value,
      paginationLimited: false,
    }
  }

  if (normalizedRequests.length > credentialInFlightPageSize + 1) {
    invalidCredentialInFlightContract()
  }
  const paginationLimited = normalizedRequests.length > credentialInFlightPageSize
  return {
    ...metadata,
    requests: normalizedRequests.slice(0, credentialInFlightPageSize),
    total: null,
    nextOffset: null,
    snapshotCursor: null,
    snapshotExpiresAt: null,
    paginationLimited,
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
    backendCode: apiError.backendCode,
    retryable: apiError.retryable,
    fieldErrors: apiError.fieldErrors,
  })
}
