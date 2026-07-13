import type { ModelPrice, ModelPriceInput, ModelPriceSource } from '../api/management/billing-types'

export type ModelPriceImportOverwriteMode = 'missing' | 'sync' | 'all'
export type ModelPriceImportTargetFilter = 'all' | 'missing' | 'synced' | 'selected'
export type ModelPriceImportMatchMode = 'prefix' | 'regex'
export type ModelPriceImportMatchStatus =
  | 'matched'
  | 'ambiguous'
  | 'unmatched'
  | 'zero_cost'
  | 'invalid'
  | 'unsupported'
export type ModelPriceImportAction = 'create' | 'update_sync' | 'overwrite' | 'skip' | 'review'

export type ModelPriceImportMultiplierRule = {
  id: string
  label: string
  matchMode: ModelPriceImportMatchMode
  pattern: string
  multiplier: number
}

export type ModelPriceImportAliasRule = {
  id: string
  targetModel: string
  sourceModels: string[]
}

export type ModelPriceImportPolicy = {
  defaultMultiplier: number
  rules: ModelPriceImportMultiplierRule[]
  aliases: ModelPriceImportAliasRule[]
  rowMultipliers: Record<string, number>
  includeCachePrices: boolean
  includeZeroCost: boolean
}

export type ModelPriceImportTarget = {
  provider: string
  model: string
  label?: string
  scopes?: Array<'available' | 'static'>
}

export type ModelPriceImportMatchOverride = {
  targetProvider: string
  targetModel: string
  sourceProvider: string
  sourceModel: string
}

export type ModelPriceImportPreviewInput = {
  targets: ModelPriceImportTarget[]
  overwriteMode: ModelPriceImportOverwriteMode
  policy: ModelPriceImportPolicy
  matchOverrides: ModelPriceImportMatchOverride[]
}

export type ModelPriceImportCost = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  request: number
}

export type ModelPriceImportPreviewStatus =
  | 'matched'
  | 'ambiguous'
  | 'unmatched'
  | 'zero_cost'
  | 'conflict'
  | 'invalid'
  | 'unsupported'

export type ModelPriceImportPreviewAction =
  | 'create'
  | 'update_sync'
  | 'overwrite'
  | 'skip'
  | 'review'

export type ModelPriceImportReason = {
  code: string
  message: string | null
  candidates: string[]
}

export type ModelPriceImportExistingRule = {
  id: string
  provider: string
  model: string
  serviceTier: string
  minInputTokens: number
  source: ModelPriceSource
  enabled: boolean
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheReadPricePerMillion: number
  cacheWritePricePerMillion: number
  requestPrice: number
  note: string | null
  updatedAt: string | null
  revision: string | null
}

export type ModelPriceImportWriteRule = {
  serviceTier: string
  minInputTokens: number
  source: ModelPriceSource
  enabled: boolean
  note: string | null
}

export type ModelPriceImportPreviewRow = {
  key: string
  provider: string
  model: string
  serviceTier: string
  minInputTokens: number
  label: string
  status: ModelPriceImportPreviewStatus
  action: ModelPriceImportPreviewAction
  applicable: boolean
  selectedByDefault: boolean
  matchedProvider: string | null
  matchedModel: string | null
  matchedName: string | null
  official: ModelPriceImportCost | null
  multiplier: number
  final: ModelPriceImportCost | null
  writeRule: ModelPriceImportWriteRule | null
  existing: ModelPriceImportExistingRule | null
  reasons: ModelPriceImportReason[]
}

export type ModelPriceImportSummary = {
  total: number
  creates: number
  updatesSync: number
  overwrites: number
  skips: number
  reviews: number
  conflicts: number
  failed: number
}

export type ModelPriceImportPreview = {
  id: string
  revision: string
  generatedAt: string
  expiresAt: string | null
  atomic: boolean
  source: 'models.dev'
  sourceUrl: string
  sourceFetchedAt: string
  sourceVersion: string | null
  sourceModelCount: number
  rows: ModelPriceImportPreviewRow[]
  summary: ModelPriceImportSummary
  issues: ModelPriceImportReason[]
  mode: 'server' | 'compatibility'
  raw: unknown
}

export type ModelPriceImportApplyInput = {
  previewId: string
  previewRevision: string
  selectedKeys: string[]
  confirmOverwrite: boolean
  idempotencyKey: string
  expectedAtomic: boolean
  expectedRows: Array<{
    key: string
    provider: string
    model: string
    action: Extract<ModelPriceImportPreviewAction, 'create' | 'update_sync' | 'overwrite'>
  }>
}

export type ModelPriceImportPendingApply = {
  version: 1
  createdAt: string
  input: ModelPriceImportApplyInput
}

export type ModelPriceImportApplyRowStatus =
  | 'created'
  | 'updated'
  | 'overwritten'
  | 'skipped'
  | 'failed'
  | 'conflict'

export type ModelPriceImportApplyRowResult = {
  key: string
  provider: string
  model: string
  action: ModelPriceImportPreviewAction
  status: ModelPriceImportApplyRowStatus
  resourceId: string | null
  errorCode: string | null
  errorMessage: string | null
}

export type ModelPriceImportApplyStatus = 'applied' | 'partial' | 'failed' | 'conflict' | 'expired'

export type ModelPriceImportApplyResult = {
  operationId: string
  previewId: string
  status: ModelPriceImportApplyStatus
  atomic: boolean
  appliedAt: string | null
  summary: ModelPriceImportSummary
  rows: ModelPriceImportApplyRowResult[]
  raw: unknown
}

export type ModelPriceImportApplyItem = {
  key: string
  action: Extract<ModelPriceImportPreviewAction, 'create' | 'update_sync' | 'overwrite'>
  mode: 'create' | 'update'
  resource?: ModelPrice
  input: ModelPriceInput
}

export type ModelPriceImportProgress = {
  completed: number
  total: number
  currentModel: string | null
}
