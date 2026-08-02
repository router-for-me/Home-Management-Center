import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

type UnknownRecord = Record<string, unknown>

/**
 * Three-state capability reporting, mirrored from the User API.
 *
 * `unsupported` and `unknown` are different answers and must stay different all
 * the way to the screen: the first means the cluster said a model cannot do
 * this, the second means nobody ever said. Collapsing them would present
 * silence as a denial.
 */
export type UserModelCapabilityStatus = 'supported' | 'unsupported' | 'unknown'

export type UserModelModalityStatus = 'known' | 'unknown'

export type UserModelPricingStatus = 'published' | 'unpublished'

export type UserModelAvailabilityStatus = 'observed' | 'insufficient_data'

export type UserModelAccessReason = 'unrestricted' | 'model_groups' | 'no_api_keys'

export type UserModelModalities = {
  status: UserModelModalityStatus
  /** Empty whenever `status` is `unknown`; read the status, not the length. */
  input: string[]
  output: string[]
}

export type UserModelReasoning = {
  status: UserModelCapabilityStatus
  levels: string[]
  budget: {
    min: number | null
    max: number | null
    canDisable: boolean
    dynamic: boolean
  } | null
}

export type UserModelCapabilities = {
  reasoning: UserModelReasoning
  toolCalling: UserModelCapabilityStatus
  structuredOutput: UserModelCapabilityStatus
  parameters: string[]
  generationMethods: string[]
}

/**
 * One rung of a provider's price ladder.
 *
 * Components are nullable rather than zero-filled. The server emits every
 * component precisely because zero is a real price — a provider that does not
 * bill for cache reads has said so — which means a component that is genuinely
 * absent came from a server shape this client does not know, and rendering it
 * as free would be an invention.
 */
export type UserModelPriceRung = {
  minInputTokens: number
  inputPricePerMillion: number | null
  outputPricePerMillion: number | null
  cacheReadPricePerMillion: number | null
  cacheWritePricePerMillion: number | null
  requestPrice: number | null
}

export type UserModelPriceTier = {
  serviceTier: string
  /** True for the wildcard tier a request lands on when it names none. */
  isDefault: boolean
  rungs: UserModelPriceRung[]
}

export type UserModelPriceProvider = {
  provider: string
  tiers: UserModelPriceTier[]
}

export type UserModelPricing = {
  status: UserModelPricingStatus
  providers: UserModelPriceProvider[]
}

export type UserModelAvailabilityWindow = {
  from: string | null
  to: string | null
  hours: number | null
  minSamples: number | null
}

/**
 * Observed reliability over a fixed window.
 *
 * `insufficient_data` carries a sample count and nothing else. Three successes
 * out of three is not full availability, and the server withholds the derived
 * numbers so a client cannot accidentally present it as such.
 */
export type UserModelAvailability = {
  status: UserModelAvailabilityStatus
  window: UserModelAvailabilityWindow
  sampleCount: number
  successCount: number | null
  failedCount: number | null
  availabilityRate: number | null
  firstObservedAt: string | null
  lastObservedAt: string | null
  avgLatencyMs: number | null
  avgTtftMs: number | null
  outputTokensPerSecond: number | null
}

export type UserModel = {
  id: string
  displayName: string | null
  description: string | null
  version: string | null
  ownedBy: string | null
  type: string | null
  providers: string[]
  contextLength: number | null
  maxOutputTokens: number | null
  modalities: UserModelModalities
  capabilities: UserModelCapabilities
  /** `null` on the public catalog, where pricing is withheld by contract. */
  pricing: UserModelPricing | null
  /** `null` on the public catalog, where availability is withheld by contract. */
  availability: UserModelAvailability | null
}

export type UserModelAccess = {
  restricted: boolean
  apiKeyCount: number
  reason: UserModelAccessReason
}

export type UserModelCatalogScope = 'public' | 'accessible'

export type UserModelCatalog = {
  scope: UserModelCatalogScope
  models: UserModel[]
  total: number
  /** `null` on the public catalog, which describes no particular account. */
  access: UserModelAccess | null
  fetchedAt: string
}

/**
 * Raised when the connected Home has no model catalog at all.
 *
 * Distinct from a request failure so the page can say "this server does not
 * publish a catalog" instead of showing a retry affordance for something a
 * retry will never fix.
 */
export class UserModelCatalogUnsupportedError extends Error {
  constructor() {
    super('user model catalog is not supported by the connected server')
    this.name = 'UserModelCatalogUnsupportedError'
  }
}

export function isUserModelCatalogUnsupportedError(
  error: unknown,
): error is UserModelCatalogUnsupportedError {
  return error instanceof UserModelCatalogUnsupportedError
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readBoolean(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return false
}

function readStringArray(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (!Array.isArray(value)) continue

    const items = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)

    if (items.length > 0) return items
  }
  return []
}

function readRecordArray(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

function readCapabilityStatus(value: unknown): UserModelCapabilityStatus {
  const status = readString(toRecord(value), ['status'])
  if (status === 'supported' || status === 'unsupported') return status
  return 'unknown'
}

function normalizeModalities(value: unknown): UserModelModalities {
  const record = toRecord(value)
  const status = readString(record, ['status']) === 'known' ? 'known' : 'unknown'

  if (status === 'unknown') {
    return { status, input: [], output: [] }
  }

  return {
    status,
    input: readStringArray(record, ['input']),
    output: readStringArray(record, ['output']),
  }
}

function normalizeReasoning(value: unknown): UserModelReasoning {
  const record = toRecord(value)
  const budgetRecord = isRecord(record.budget) ? record.budget : null

  return {
    status: readCapabilityStatus(record),
    levels: readStringArray(record, ['levels']),
    budget: budgetRecord
      ? {
          min: readNumber(budgetRecord, ['min']),
          max: readNumber(budgetRecord, ['max']),
          canDisable: readBoolean(budgetRecord, ['can_disable', 'canDisable']),
          dynamic: readBoolean(budgetRecord, ['dynamic']),
        }
      : null,
  }
}

function normalizeCapabilities(value: unknown): UserModelCapabilities {
  const record = toRecord(value)

  return {
    reasoning: normalizeReasoning(record.reasoning),
    toolCalling: readCapabilityStatus(record.tool_calling ?? record.toolCalling),
    structuredOutput: readCapabilityStatus(record.structured_output ?? record.structuredOutput),
    parameters: readStringArray(record, ['parameters']),
    generationMethods: readStringArray(record, ['generation_methods', 'generationMethods']),
  }
}

function normalizePriceRung(value: unknown): UserModelPriceRung {
  const record = toRecord(value)

  return {
    minInputTokens: readNumber(record, ['min_input_tokens', 'minInputTokens']) ?? 0,
    inputPricePerMillion: readNumber(record, ['input_price_per_million', 'inputPricePerMillion']),
    outputPricePerMillion: readNumber(record, [
      'output_price_per_million',
      'outputPricePerMillion',
    ]),
    cacheReadPricePerMillion: readNumber(record, [
      'cache_read_price_per_million',
      'cacheReadPricePerMillion',
    ]),
    cacheWritePricePerMillion: readNumber(record, [
      'cache_write_price_per_million',
      'cacheWritePricePerMillion',
    ]),
    requestPrice: readNumber(record, ['request_price', 'requestPrice']),
  }
}

function normalizePriceTier(value: unknown): UserModelPriceTier {
  const record = toRecord(value)

  return {
    serviceTier: readString(record, ['service_tier', 'serviceTier']) ?? '*',
    isDefault: readBoolean(record, ['is_default', 'isDefault']),
    rungs: readRecordArray(record, ['rungs']).map(normalizePriceRung),
  }
}

function normalizePriceProvider(value: unknown): UserModelPriceProvider {
  const record = toRecord(value)

  return {
    provider: readString(record, ['provider']) ?? '',
    tiers: readRecordArray(record, ['tiers']).map(normalizePriceTier),
  }
}

function normalizePricing(value: unknown): UserModelPricing | null {
  if (!isRecord(value)) return null

  const status = readString(value, ['status']) === 'published' ? 'published' : 'unpublished'
  if (status === 'unpublished') {
    return { status, providers: [] }
  }

  return {
    status,
    providers: readRecordArray(value, ['providers']).map(normalizePriceProvider),
  }
}

function normalizeAvailabilityWindow(value: unknown): UserModelAvailabilityWindow {
  const record = toRecord(value)

  return {
    from: readString(record, ['from']),
    to: readString(record, ['to']),
    hours: readNumber(record, ['hours']),
    minSamples: readNumber(record, ['min_samples', 'minSamples']),
  }
}

function normalizeAvailability(value: unknown): UserModelAvailability | null {
  if (!isRecord(value)) return null

  const observed = readString(value, ['status']) === 'observed'
  const window = normalizeAvailabilityWindow(value.window)
  const sampleCount = readNumber(value, ['sample_count', 'sampleCount']) ?? 0

  // Anything derived from the sample is only read when the server called the
  // sample large enough. Reading it regardless would let a client display a
  // rate the server deliberately withheld.
  if (!observed) {
    return {
      status: 'insufficient_data',
      window,
      sampleCount,
      successCount: null,
      failedCount: null,
      availabilityRate: null,
      firstObservedAt: null,
      lastObservedAt: readString(value, ['last_observed_at', 'lastObservedAt']),
      avgLatencyMs: null,
      avgTtftMs: null,
      outputTokensPerSecond: null,
    }
  }

  return {
    status: 'observed',
    window,
    sampleCount,
    successCount: readNumber(value, ['success_count', 'successCount']),
    failedCount: readNumber(value, ['failed_count', 'failedCount']),
    availabilityRate: readNumber(value, ['availability_rate', 'availabilityRate']),
    firstObservedAt: readString(value, ['first_observed_at', 'firstObservedAt']),
    lastObservedAt: readString(value, ['last_observed_at', 'lastObservedAt']),
    avgLatencyMs: readNumber(value, ['avg_latency_ms', 'avgLatencyMs']),
    avgTtftMs: readNumber(value, ['avg_ttft_ms', 'avgTtftMs']),
    outputTokensPerSecond: readNumber(value, ['output_tokens_per_second', 'outputTokensPerSecond']),
  }
}

export function normalizeUserModel(value: unknown): UserModel | null {
  const record = toRecord(value)
  const id = readString(record, ['id'])
  if (!id) return null

  return {
    id,
    displayName: readString(record, ['display_name', 'displayName']),
    description: readString(record, ['description']),
    version: readString(record, ['version']),
    ownedBy: readString(record, ['owned_by', 'ownedBy']),
    type: readString(record, ['type']),
    providers: readStringArray(record, ['providers']),
    contextLength: readNumber(record, ['context_length', 'contextLength']),
    maxOutputTokens: readNumber(record, ['max_output_tokens', 'maxOutputTokens']),
    modalities: normalizeModalities(record.modalities),
    capabilities: normalizeCapabilities(record.capabilities),
    pricing: normalizePricing(record.pricing),
    availability: normalizeAvailability(record.availability),
  }
}

function normalizeAccess(value: unknown): UserModelAccess | null {
  if (!isRecord(value)) return null

  const reason = readString(value, ['reason'])

  return {
    restricted: readBoolean(value, ['restricted']),
    apiKeyCount: readNumber(value, ['api_key_count', 'apiKeyCount']) ?? 0,
    reason:
      reason === 'unrestricted' || reason === 'model_groups' || reason === 'no_api_keys'
        ? reason
        : 'unrestricted',
  }
}

export function normalizeUserModelCatalog(
  value: unknown,
  scope: UserModelCatalogScope,
): UserModelCatalog {
  const record = toRecord(value)
  const models = readRecordArray(record, ['models'])
    .map(normalizeUserModel)
    .filter((model): model is UserModel => model !== null)

  return {
    scope,
    models,
    total: readNumber(record, ['total']) ?? models.length,
    access: normalizeAccess(record.access),
    fetchedAt: new Date().toISOString(),
  }
}

async function requestUserModelCatalog(
  session: UserSessionInput,
  path: string,
  scope: UserModelCatalogScope,
): Promise<UserModelCatalog> {
  const client = createUserClient(session)

  try {
    const response = await client.get<unknown>(path)
    return normalizeUserModelCatalog(response.data, scope)
  } catch (error) {
    const apiError = toUserApiError(error)
    // A 404 here is the route being absent on an older Home, not the catalog
    // being empty. The two need different words on screen.
    if (apiError.status === 404) throw new UserModelCatalogUnsupportedError()
    throw apiError
  }
}

/**
 * Fetches the public catalog: every model the cluster can serve, described in
 * buyer terms, with no pricing and no availability. Requires no token.
 */
export function fetchPublicUserModels(session: UserSessionInput = {}) {
  return requestUserModelCatalog(session, '/models', 'public')
}

/**
 * Fetches the models the signed-in user's own API keys may call, with the
 * price ladder and observed availability attached.
 */
export function fetchAccessibleUserModels(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
) {
  return requestUserModelCatalog(session, '/models/accessible', 'accessible')
}
