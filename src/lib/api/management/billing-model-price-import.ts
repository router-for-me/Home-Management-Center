import axios from 'axios'
import { z } from 'zod'

import type {
  ModelPriceImportApplyInput,
  ModelPriceImportApplyResult,
  ModelPriceImportPreview,
  ModelPriceImportPreviewInput,
  ModelPriceImportPreviewRow,
  ModelPriceImportProgress,
  ModelPriceImportSummary,
} from '../../billing/model-price-import-types'
import { createManagementClient, toManagementApiError } from './client'
import type { ManagementSessionInput } from './types'

export type ModelPriceImportErrorCode =
  | 'unsupported'
  | 'conflict'
  | 'expired'
  | 'stale'
  | 'invalid'
  | 'server'
  | 'network'

export class ModelPriceImportError extends Error {
  code: ModelPriceImportErrorCode
  status: number | null

  constructor(
    message: string,
    code: ModelPriceImportErrorCode,
    status: number | null,
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'ModelPriceImportError'
    this.code = code
    this.status = status
  }
}

const costSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cache_read: z.number().nonnegative(),
  cache_write: z.number().nonnegative(),
  cache_write_configured: z.boolean().optional(),
  request: z.number().nonnegative(),
})

const reasonSchema = z.object({
  code: z.string().min(1),
  message: z.string().nullable().optional(),
  candidates: z.array(z.string()).optional(),
})

const existingRuleSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  service_tier: z.string().min(1),
  min_input_tokens: z.number().int().nonnegative(),
  source: z.enum(['manual', 'default', 'sync']),
  enabled: z.boolean(),
  input_price_per_million: z.number().nonnegative(),
  output_price_per_million: z.number().nonnegative(),
  cache_read_price_per_million: z.number().nonnegative(),
  cache_write_price_per_million: z.number().nonnegative(),
  cache_write_price_configured: z.boolean(),
  request_price: z.number().nonnegative(),
  note: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  revision: z.string().nullable().optional(),
})

const writeRuleSchema = z.object({
  service_tier: z.string().min(1),
  min_input_tokens: z.number().int().nonnegative(),
  cache_write_price_configured: z.boolean(),
  source: z.enum(['manual', 'default', 'sync']),
  enabled: z.boolean(),
  note: z.string().nullable().optional(),
})

const previewRowSchema = z.object({
  row_key: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  service_tier: z.string().min(1),
  min_input_tokens: z.number().int().nonnegative(),
  label: z.string().optional(),
  status: z.enum([
    'matched',
    'ambiguous',
    'unmatched',
    'zero_cost',
    'conflict',
    'invalid',
    'unsupported',
  ]),
  action: z.enum(['create', 'update_sync', 'overwrite', 'skip', 'review']),
  applicable: z.boolean(),
  selected_by_default: z.boolean().optional(),
  matched_provider: z.string().nullable().optional(),
  matched_model: z.string().nullable().optional(),
  matched_name: z.string().nullable().optional(),
  official: costSchema.nullable().optional(),
  multiplier: z.number().nonnegative(),
  final: costSchema.nullable().optional(),
  write_rule: writeRuleSchema.nullable().optional(),
  existing_rule: existingRuleSchema.nullable().optional(),
  reasons: z.array(reasonSchema).default([]),
})

const summarySchema = z.object({
  total: z.number().int().nonnegative(),
  creates: z.number().int().nonnegative(),
  updates_sync: z.number().int().nonnegative(),
  overwrites: z.number().int().nonnegative(),
  skips: z.number().int().nonnegative(),
  reviews: z.number().int().nonnegative(),
  conflicts: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})

const previewSchema = z.object({
  preview_id: z.string().min(1),
  preview_revision: z.string().min(1),
  generated_at: z.string().min(1),
  expires_at: z.string().nullable().optional(),
  atomic: z.boolean(),
  source: z.literal('models.dev'),
  source_url: z.string().min(1),
  source_fetched_at: z.string().min(1),
  source_version: z.string().nullable().optional(),
  source_model_count: z.number().int().nonnegative(),
  rows: z.array(previewRowSchema),
  summary: summarySchema,
  issues: z.array(reasonSchema).default([]),
})

const applyRowSchema = z.object({
  key: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  action: z.enum(['create', 'update_sync', 'overwrite', 'skip', 'review']),
  status: z.enum(['created', 'updated', 'overwritten', 'skipped', 'failed', 'conflict']),
  resource_id: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
})

const applySchema = z.object({
  operation_id: z.string().min(1),
  preview_id: z.string().min(1),
  status: z.enum(['applied', 'partial', 'failed', 'conflict', 'expired']),
  atomic: z.boolean(),
  applied_at: z.string().nullable().optional(),
  summary: summarySchema,
  rows: z.array(applyRowSchema),
})

const operationProgressSchema = z.object({
  operation_id: z.string().min(1),
  preview_id: z.string().min(1),
  status: z.enum(['pending', 'running']),
  atomic: z.boolean(),
  progress: z.object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    current_model: z.string().nullable().optional(),
  }),
  poll_after_ms: z.number().int().min(10).max(5_000).optional(),
})

function normalizeCost(value: z.infer<typeof costSchema>) {
  return {
    input: value.input,
    output: value.output,
    cacheRead: value.cache_read,
    cacheWrite: value.cache_write,
    cacheWriteConfigured: value.cache_write_configured ?? value.cache_write !== 0,
    request: value.request,
  }
}

function normalizeSummary(value: z.infer<typeof summarySchema>): ModelPriceImportSummary {
  return {
    total: value.total,
    creates: value.creates,
    updatesSync: value.updates_sync,
    overwrites: value.overwrites,
    skips: value.skips,
    reviews: value.reviews,
    conflicts: value.conflicts,
    failed: value.failed,
  }
}

function normalizePreviewRow(value: z.infer<typeof previewRowSchema>): ModelPriceImportPreviewRow {
  return {
    key: value.row_key,
    provider: value.provider,
    model: value.model,
    serviceTier: value.service_tier,
    minInputTokens: value.min_input_tokens,
    label: value.label?.trim() || value.model,
    status: value.status,
    action: value.action,
    applicable: value.applicable,
    selectedByDefault: value.selected_by_default ?? false,
    matchedProvider: value.matched_provider ?? null,
    matchedModel: value.matched_model ?? null,
    matchedName: value.matched_name ?? null,
    official: value.official ? normalizeCost(value.official) : null,
    multiplier: value.multiplier,
    final: value.final ? normalizeCost(value.final) : null,
    writeRule: value.write_rule
      ? {
          serviceTier: value.write_rule.service_tier,
          minInputTokens: value.write_rule.min_input_tokens,
          cacheWritePriceConfigured: value.write_rule.cache_write_price_configured,
          source: value.write_rule.source,
          enabled: value.write_rule.enabled,
          note: value.write_rule.note ?? null,
        }
      : null,
    existing: value.existing_rule
      ? {
          id: value.existing_rule.id,
          provider: value.existing_rule.provider,
          model: value.existing_rule.model,
          serviceTier: value.existing_rule.service_tier,
          minInputTokens: value.existing_rule.min_input_tokens,
          source: value.existing_rule.source,
          enabled: value.existing_rule.enabled,
          inputPricePerMillion: value.existing_rule.input_price_per_million,
          outputPricePerMillion: value.existing_rule.output_price_per_million,
          cacheReadPricePerMillion: value.existing_rule.cache_read_price_per_million,
          cacheWritePricePerMillion: value.existing_rule.cache_write_price_per_million,
          cacheWritePriceConfigured: value.existing_rule.cache_write_price_configured,
          requestPrice: value.existing_rule.request_price,
          note: value.existing_rule.note ?? null,
          updatedAt: value.existing_rule.updated_at ?? null,
          revision: value.existing_rule.revision ?? null,
        }
      : null,
    reasons: value.reasons.map((reason) => ({
      code: reason.code,
      message: reason.message ?? null,
      candidates: reason.candidates ?? [],
    })),
  }
}

function summarizeRows(rows: ModelPriceImportPreviewRow[]): ModelPriceImportSummary {
  return {
    total: rows.length,
    creates: rows.filter((row) => row.action === 'create').length,
    updatesSync: rows.filter((row) => row.action === 'update_sync').length,
    overwrites: rows.filter((row) => row.action === 'overwrite').length,
    skips: rows.filter((row) => row.action === 'skip').length,
    reviews: rows.filter((row) => row.action === 'review').length,
    conflicts: rows.filter((row) => row.status === 'conflict').length,
    failed: 0,
  }
}

function summariesEqual(left: ModelPriceImportSummary, right: ModelPriceImportSummary) {
  return (Object.keys(left) as Array<keyof ModelPriceImportSummary>).every(
    (key) => left[key] === right[key],
  )
}

function targetIdentity(provider: string, model: string) {
  return `${provider.trim().toLowerCase()}::${model.trim().toLowerCase()}`
}

function ruleScopeIdentity(
  provider: string,
  model: string,
  serviceTier: string,
  minInputTokens: number,
) {
  return `${targetIdentity(provider, model)}::${serviceTier.trim().toLowerCase()}::${minInputTokens}`
}

function numbersEqual(left: number, right: number) {
  return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right))
}

function parseResponseTime(value: string, field: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) invalidResponse(`${field} is not a valid timestamp`)
  return timestamp
}

function expectedMultiplierForRow(
  row: ModelPriceImportPreviewRow,
  input: ModelPriceImportPreviewInput,
) {
  const rowMultiplier = input.policy.rowMultipliers[row.key]
  if (Number.isFinite(rowMultiplier)) return rowMultiplier

  const matchingRule = input.policy.rules.find((rule) => {
    if (rule.matchMode === 'prefix') {
      return row.model.toLowerCase().startsWith(rule.pattern.trim().toLowerCase())
    }
    try {
      return new RegExp(rule.pattern, 'i').test(row.model)
    } catch {
      return false
    }
  })
  return matchingRule?.multiplier ?? input.policy.defaultMultiplier
}

function assertPreviewPriceEvidence(
  row: ModelPriceImportPreviewRow,
  input: ModelPriceImportPreviewInput,
) {
  if (!row.official || !row.final || !row.writeRule) return

  const expectedMultiplier = expectedMultiplierForRow(row, input)
  if (!numbersEqual(row.multiplier, expectedMultiplier)) {
    invalidResponse(`row ${row.key} multiplier does not match requested policy`)
  }

  const includeCache = input.policy.includeCachePrices
  const expectedFinal = {
    input: row.official.input * row.multiplier,
    output: row.official.output * row.multiplier,
    cacheRead: includeCache ? row.official.cacheRead * row.multiplier : 0,
    cacheWrite: includeCache ? row.official.cacheWrite * row.multiplier : 0,
    request: row.official.request * row.multiplier,
  }
  for (const field of ['input', 'output', 'cacheRead', 'cacheWrite', 'request'] as const) {
    if (!numbersEqual(row.final[field], expectedFinal[field])) {
      invalidResponse(`row ${row.key} final ${field} does not match official price and multiplier`)
    }
  }

  const cacheWriteConfigured = includeCache && row.official.cacheWriteConfigured
  if (
    row.final.cacheWriteConfigured !== cacheWriteConfigured ||
    row.writeRule.cacheWritePriceConfigured !== cacheWriteConfigured
  ) {
    invalidResponse(`row ${row.key} cache-write configured evidence is inconsistent`)
  }
}

function assertPreviewRowState(row: ModelPriceImportPreviewRow) {
  const mutatingAction = ['create', 'update_sync', 'overwrite'].includes(row.action)
  if (row.applicable !== mutatingAction) {
    invalidResponse(`row ${row.key} action and applicability are inconsistent`)
  }
  if (row.selectedByDefault && !row.applicable) {
    invalidResponse(`row ${row.key} selects a non-applicable action by default`)
  }
  if (mutatingAction && row.status !== 'matched' && row.status !== 'zero_cost') {
    invalidResponse(`row ${row.key} mutates from an invalid match status`)
  }
  if (
    row.action === 'review' &&
    !['ambiguous', 'unmatched', 'conflict', 'invalid', 'unsupported'].includes(row.status)
  ) {
    invalidResponse(`row ${row.key} review action has an invalid status`)
  }
  if (row.action === 'skip' && row.status !== 'matched' && row.status !== 'zero_cost') {
    invalidResponse(`row ${row.key} skip action has an invalid status`)
  }
  if (row.applicable && (!row.matchedProvider || !row.matchedModel || !row.official)) {
    invalidResponse(`applicable row ${row.key} has incomplete match evidence`)
  }
}

function assertProvenance(row: ModelPriceImportPreviewRow) {
  if (!row.writeRule || !row.matchedProvider || !row.matchedModel) return
  if (row.writeRule.source !== 'sync') {
    invalidResponse(`row ${row.key} write source is not sync`)
  }
  const note = row.writeRule.note?.toLowerCase() ?? ''
  const provider = row.matchedProvider.toLowerCase()
  const model = row.matchedModel.toLowerCase()
  if (!note.includes('models.dev') || !note.includes(provider) || !note.includes(model)) {
    invalidResponse(`row ${row.key} provenance note does not identify the models.dev source`)
  }
}

function invalidResponse(message: string, cause?: unknown): never {
  throw new ModelPriceImportError(
    `Invalid model price import response: ${message}`,
    'invalid',
    null,
    cause,
  )
}

export function normalizeModelPriceImportPreview(
  value: unknown,
  input: ModelPriceImportPreviewInput,
): ModelPriceImportPreview {
  const root =
    typeof value === 'object' && value !== null && 'preview' in value ? value.preview : value
  const parsed = previewSchema.safeParse(root)
  if (!parsed.success) invalidResponse('preview schema mismatch', parsed.error)

  const rows = parsed.data.rows.map(normalizePreviewRow)
  const expectedTargets = new Set(
    input.targets.map((target) => targetIdentity(target.provider, target.model)),
  )
  const returnedTargets = new Set<string>()
  const returnedScopes = new Set<string>()
  const returnedKeys = new Set<string>()
  const overrides = new Map(
    input.matchOverrides.map((override) => [
      targetIdentity(override.targetProvider, override.targetModel),
      override,
    ]),
  )

  const generatedAt = parseResponseTime(parsed.data.generated_at, 'generated_at')
  const sourceFetchedAt = parseResponseTime(parsed.data.source_fetched_at, 'source_fetched_at')
  if (sourceFetchedAt > generatedAt) invalidResponse('source_fetched_at is after generated_at')
  if (!parsed.data.expires_at) invalidResponse('preview expiry is missing')
  const expiresAt = parseResponseTime(parsed.data.expires_at, 'expires_at')
  if (expiresAt <= generatedAt) invalidResponse('preview expiry is not after generation time')
  let sourceUrl: URL
  try {
    sourceUrl = new URL(parsed.data.source_url)
  } catch (error) {
    invalidResponse('source_url is not a valid URL', error)
  }
  if (sourceUrl.hostname !== 'models.dev' && !sourceUrl.hostname.endsWith('.models.dev')) {
    invalidResponse('source_url is not a models.dev URL')
  }

  for (const row of rows) {
    const identity = targetIdentity(row.provider, row.model)
    if (!expectedTargets.has(identity)) invalidResponse(`unexpected target ${identity}`)
    const scopeIdentity = ruleScopeIdentity(
      row.provider,
      row.model,
      row.serviceTier,
      row.minInputTokens,
    )
    if (returnedScopes.has(scopeIdentity)) invalidResponse(`duplicate rule scope ${scopeIdentity}`)
    if (returnedKeys.has(row.key)) invalidResponse(`duplicate row key ${row.key}`)
    returnedTargets.add(identity)
    returnedScopes.add(scopeIdentity)
    returnedKeys.add(row.key)
    assertPreviewRowState(row)
    if (row.applicable && (!row.final || !row.writeRule)) {
      invalidResponse(`applicable row ${row.key} has no complete write payload`)
    }
    if (row.serviceTier !== '*') {
      invalidResponse(`row ${row.key} does not target a wildcard Tier rule`)
    }
    if (
      row.writeRule &&
      (row.writeRule.serviceTier !== row.serviceTier ||
        row.writeRule.minInputTokens !== row.minInputTokens)
    ) {
      invalidResponse(`row ${row.key} write rule identity does not match the row scope`)
    }
    if ((row.action === 'update_sync' || row.action === 'overwrite') && !row.existing) {
      invalidResponse(`row ${row.key} plans an update without an existing rule`)
    }
    if (row.action === 'create' && row.existing) {
      invalidResponse(`row ${row.key} plans a create for an existing rule`)
    }
    if (
      row.existing &&
      (targetIdentity(row.existing.provider, row.existing.model) !== identity ||
        row.existing.serviceTier !== row.serviceTier ||
        row.existing.minInputTokens !== row.minInputTokens)
    ) {
      invalidResponse(`row ${row.key} existing rule identity does not match the target scope`)
    }
    if (row.action === 'update_sync' && row.existing?.source !== 'sync') {
      invalidResponse(`row ${row.key} updates a non-sync rule as update_sync`)
    }
    if (row.action === 'overwrite' && row.existing?.source === 'sync') {
      invalidResponse(`row ${row.key} overwrites a sync rule instead of updating it`)
    }
    if (
      (row.action === 'update_sync' || row.action === 'overwrite') &&
      row.writeRule?.enabled !== row.existing?.enabled
    ) {
      invalidResponse(`row ${row.key} does not preserve the existing enabled state`)
    }
    if (row.action === 'overwrite' && input.overwriteMode !== 'all') {
      invalidResponse(`row ${row.key} overwrites outside overwrite-all mode`)
    }
    if (row.action === 'update_sync' && input.overwriteMode === 'missing') {
      invalidResponse(`row ${row.key} updates in create-missing mode`)
    }
    const override = overrides.get(identity)
    if (
      override &&
      (row.matchedProvider?.toLowerCase() !== override.sourceProvider.trim().toLowerCase() ||
        row.matchedModel?.toLowerCase() !== override.sourceModel.trim().toLowerCase())
    ) {
      invalidResponse(`row ${row.key} does not echo the requested match override`)
    }
    assertPreviewPriceEvidence(row, input)
    assertProvenance(row)
  }

  if (returnedTargets.size !== expectedTargets.size)
    invalidResponse('preview omitted requested targets')
  const computedSummary = summarizeRows(rows)
  const declaredSummary = normalizeSummary(parsed.data.summary)
  if (!summariesEqual(computedSummary, declaredSummary)) invalidResponse('preview summary mismatch')

  return {
    id: parsed.data.preview_id,
    revision: parsed.data.preview_revision,
    generatedAt: parsed.data.generated_at,
    expiresAt: parsed.data.expires_at ?? null,
    atomic: parsed.data.atomic,
    source: 'models.dev',
    sourceUrl: parsed.data.source_url,
    sourceFetchedAt: parsed.data.source_fetched_at,
    sourceVersion: parsed.data.source_version ?? null,
    sourceModelCount: parsed.data.source_model_count,
    rows,
    summary: declaredSummary,
    issues: parsed.data.issues.map((reason) => ({
      code: reason.code,
      message: reason.message ?? null,
      candidates: reason.candidates ?? [],
    })),
    mode: 'server',
    raw: value,
  }
}

export function normalizeModelPriceImportApplyResult(
  value: unknown,
  input: ModelPriceImportApplyInput,
  expectedOperationId?: string,
): ModelPriceImportApplyResult {
  const root =
    typeof value === 'object' && value !== null && 'result' in value ? value.result : value
  const parsed = applySchema.safeParse(root)
  if (!parsed.success) invalidResponse('apply schema mismatch', parsed.error)
  if (parsed.data.preview_id !== input.previewId) invalidResponse('apply preview identity mismatch')
  if (parsed.data.atomic !== input.expectedAtomic) invalidResponse('apply atomicity mismatch')
  if (expectedOperationId && parsed.data.operation_id !== expectedOperationId) {
    invalidResponse('operation identity changed at terminal result')
  }

  const expected = new Map(input.expectedRows.map((row) => [row.key, row]))
  const returned = new Set<string>()
  if (parsed.data.status === 'expired' && parsed.data.rows.length > 0) {
    invalidResponse('expired result unexpectedly contains row results')
  }
  for (const row of parsed.data.rows) {
    const expectedRow = expected.get(row.key)
    if (!expectedRow) invalidResponse(`unexpected apply row ${row.key}`)
    if (returned.has(row.key)) invalidResponse(`duplicate apply row ${row.key}`)
    returned.add(row.key)
    if (
      expectedRow.provider !== row.provider ||
      expectedRow.model !== row.model ||
      expectedRow.action !== row.action
    ) {
      invalidResponse(`apply row ${row.key} identity mismatch`)
    }
    const successfulStatus =
      row.action === 'create'
        ? 'created'
        : row.action === 'update_sync'
          ? 'updated'
          : row.action === 'overwrite'
            ? 'overwritten'
            : null
    if (row.status !== successfulStatus && row.status !== 'failed' && row.status !== 'conflict') {
      invalidResponse(`apply row ${row.key} action and status are inconsistent`)
    }
    const successful = row.status === successfulStatus
    if (successful && (!row.resource_id || row.error_code || row.error_message)) {
      invalidResponse(`apply row ${row.key} has inconsistent success evidence`)
    }
    if (!successful && (row.resource_id || !row.error_code || !row.error_message)) {
      invalidResponse(`apply row ${row.key} has incomplete failure evidence`)
    }
  }
  if (parsed.data.status !== 'expired' && returned.size !== input.selectedKeys.length) {
    invalidResponse('apply omitted selected rows')
  }

  const rows = parsed.data.rows.map((row) => ({
    key: row.key,
    provider: row.provider,
    model: row.model,
    action: row.action,
    status: row.status,
    resourceId: row.resource_id ?? null,
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
  }))
  const summary = normalizeSummary(parsed.data.summary)
  const successfulRows = rows.filter((row) =>
    ['created', 'updated', 'overwritten', 'skipped'].includes(row.status),
  )
  const unsuccessfulRows = rows.filter((row) => ['failed', 'conflict'].includes(row.status))
  const computedSummary: ModelPriceImportSummary = {
    total: rows.length,
    creates: rows.filter((row) => row.status === 'created').length,
    updatesSync: rows.filter((row) => row.status === 'updated').length,
    overwrites: rows.filter((row) => row.status === 'overwritten').length,
    skips: rows.filter((row) => row.status === 'skipped').length,
    reviews: 0,
    conflicts: rows.filter((row) => row.status === 'conflict').length,
    failed: rows.filter((row) => row.status === 'failed').length,
  }
  if (!summariesEqual(summary, computedSummary)) {
    invalidResponse('apply summary mismatch')
  }
  if (parsed.data.status === 'applied' && unsuccessfulRows.length > 0)
    invalidResponse('applied result has failed rows')
  if (
    parsed.data.status === 'partial' &&
    (parsed.data.atomic || successfulRows.length === 0 || unsuccessfulRows.length === 0)
  ) {
    invalidResponse('atomic result cannot be partial')
  }
  if (parsed.data.atomic && successfulRows.length > 0 && unsuccessfulRows.length > 0) {
    invalidResponse('atomic result mixes successful and unsuccessful rows')
  }
  if (parsed.data.status === 'failed' && (successfulRows.length > 0 || summary.failed === 0)) {
    invalidResponse('failed result has inconsistent row statuses')
  }
  if (
    parsed.data.status === 'conflict' &&
    (successfulRows.length > 0 || summary.conflicts === 0 || summary.failed > 0)
  ) {
    invalidResponse('conflict result has inconsistent row statuses')
  }
  if (parsed.data.status === 'expired' && summary.total !== 0) {
    invalidResponse('expired result has inconsistent summary')
  }
  if (parsed.data.status === 'applied' || parsed.data.status === 'partial') {
    if (!parsed.data.applied_at) invalidResponse('successful apply result has no applied_at')
    parseResponseTime(parsed.data.applied_at, 'applied_at')
  } else if (parsed.data.applied_at) {
    invalidResponse('unsuccessful apply result unexpectedly has applied_at')
  }

  return {
    operationId: parsed.data.operation_id,
    previewId: parsed.data.preview_id,
    status: parsed.data.status,
    atomic: parsed.data.atomic,
    appliedAt: parsed.data.applied_at ?? null,
    summary,
    rows,
    raw: value,
  }
}

export function normalizeModelPriceImportOperationProgress(
  value: unknown,
  input: ModelPriceImportApplyInput,
  expectedOperationId?: string,
  previousCompleted?: number,
): { operationId: string; progress: ModelPriceImportProgress; pollAfterMs: number } {
  const root =
    typeof value === 'object' && value !== null && 'operation' in value ? value.operation : value
  const parsed = operationProgressSchema.safeParse(root)
  if (!parsed.success) invalidResponse('operation progress schema mismatch', parsed.error)
  if (parsed.data.preview_id !== input.previewId)
    invalidResponse('operation preview identity mismatch')
  if (parsed.data.atomic !== input.expectedAtomic) invalidResponse('operation atomicity mismatch')
  if (expectedOperationId && parsed.data.operation_id !== expectedOperationId) {
    invalidResponse('operation identity changed while polling')
  }
  if (
    parsed.data.progress.total !== input.selectedKeys.length ||
    parsed.data.progress.completed > parsed.data.progress.total
  ) {
    invalidResponse('operation progress total mismatch')
  }
  if (previousCompleted !== undefined && parsed.data.progress.completed < previousCompleted) {
    invalidResponse('operation progress completed count moved backwards')
  }
  if (parsed.data.status === 'pending' && parsed.data.progress.completed !== 0) {
    invalidResponse('pending operation already reports completed rows')
  }
  return {
    operationId: parsed.data.operation_id,
    progress: {
      completed: parsed.data.progress.completed,
      total: parsed.data.progress.total,
      currentModel: parsed.data.progress.current_model ?? null,
    },
    pollAfterMs: parsed.data.poll_after_ms ?? 250,
  }
}

export function classifyModelPriceImportErrorStatus(
  status: number | null,
  operationAccepted = false,
): ModelPriceImportErrorCode {
  if (operationAccepted && (status === 404 || status === 405)) return 'server'
  return status === 404 || status === 405
    ? 'unsupported'
    : status === 409
      ? 'conflict'
      : status === 410
        ? 'expired'
        : status === 412
          ? 'stale'
          : status === 422
            ? 'invalid'
            : status === null
              ? 'network'
              : 'server'
}

function classifyError(error: unknown, operationAccepted = false) {
  if (error instanceof ModelPriceImportError) return error
  const status = axios.isAxiosError(error) ? (error.response?.status ?? null) : null
  const normalized = toManagementApiError(error)
  const code = classifyModelPriceImportErrorStatus(status, operationAccepted)
  return new ModelPriceImportError(normalized.message, code, status, error)
}

export function toModelPriceImportPreviewPayload(input: ModelPriceImportPreviewInput) {
  return {
    source: 'models.dev',
    targets: input.targets.map((target) => ({
      provider: target.provider,
      model: target.model,
      label: target.label,
      scopes: target.scopes,
      service_tier: '*',
      min_input_tokens: 0,
    })),
    policy: {
      overwrite_mode: input.overwriteMode,
      default_multiplier: input.policy.defaultMultiplier,
      multiplier_rules: input.policy.rules.map((rule) => ({
        id: rule.id,
        label: rule.label,
        match_mode: rule.matchMode,
        pattern: rule.pattern,
        multiplier: rule.multiplier,
      })),
      aliases: input.policy.aliases.map((rule) => ({
        target_model: rule.targetModel,
        source_models: rule.sourceModels,
      })),
      row_multipliers: input.policy.rowMultipliers,
      include_cache_prices: input.policy.includeCachePrices,
      include_zero_cost: input.policy.includeZeroCost,
    },
    match_overrides: input.matchOverrides.map((override) => ({
      target_provider: override.targetProvider,
      target_model: override.targetModel,
      source_provider: override.sourceProvider,
      source_model: override.sourceModel,
    })),
  }
}

export async function previewModelPriceImport(
  session: ManagementSessionInput,
  input: ModelPriceImportPreviewInput,
) {
  const client = createManagementClient(session)
  try {
    const response = await client.post<unknown>(
      '/billing/model-prices/import/preview',
      toModelPriceImportPreviewPayload(input),
    )
    return normalizeModelPriceImportPreview(response.data, input)
  } catch (error) {
    throw classifyError(error)
  }
}

export async function applyModelPriceImport(
  session: ManagementSessionInput,
  input: ModelPriceImportApplyInput,
  onProgress?: (progress: ModelPriceImportProgress) => void,
) {
  const client = createManagementClient(session)
  let acceptedOperationId: string | null = null
  try {
    const response = await client.post<unknown>(
      '/billing/model-prices/import/apply',
      {
        preview_id: input.previewId,
        preview_revision: input.previewRevision,
        selected_keys: input.selectedKeys,
        confirm_overwrite: input.confirmOverwrite,
        idempotency_key: input.idempotencyKey,
      },
      { headers: { 'Idempotency-Key': input.idempotencyKey } },
    )
    const initialProgress = operationProgressSchema.safeParse(response.data)
    if (!initialProgress.success) {
      return normalizeModelPriceImportApplyResult(response.data, input)
    }

    let operation = normalizeModelPriceImportOperationProgress(response.data, input)
    acceptedOperationId = operation.operationId
    onProgress?.(operation.progress)
    for (let attempt = 0; attempt < 200; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, operation.pollAfterMs))
      const pollResponse = await client.get<unknown>(
        `/billing/model-prices/import/operations/${encodeURIComponent(operation.operationId)}`,
      )
      const nextProgress = operationProgressSchema.safeParse(pollResponse.data)
      if (!nextProgress.success) {
        return normalizeModelPriceImportApplyResult(pollResponse.data, input, operation.operationId)
      }
      const previousCompleted = operation.progress.completed
      operation = normalizeModelPriceImportOperationProgress(
        pollResponse.data,
        input,
        operation.operationId,
        previousCompleted,
      )
      onProgress?.(operation.progress)
    }

    throw new ModelPriceImportError(
      'Model price import operation did not finish before the polling limit.',
      'server',
      null,
    )
  } catch (error) {
    throw classifyError(error, acceptedOperationId !== null)
  }
}
