import type { ModelPrice } from '../api/management/billing-types'
import type {
  ModelPriceImportMatchOverride,
  ModelPriceImportOverwriteMode,
  ModelPriceImportPolicy,
  ModelPriceImportPreview,
  ModelPriceImportPreviewRow,
  ModelPriceImportSummary,
  ModelPriceImportTarget,
} from './model-price-import-types'
import type { ModelsDevCatalog } from './models-dev-catalog'
import {
  buildImportNote,
  buildModelPriceImportRows,
  getModelPriceImportRowAction,
} from './models-dev-match'

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

function toExistingRule(price: ModelPrice) {
  return {
    id: price.id,
    provider: price.provider,
    model: price.model,
    serviceTier: price.serviceTier,
    minInputTokens: price.minInputTokens,
    source: price.source,
    enabled: price.enabled,
    inputPricePerMillion: price.inputPricePerMillion,
    outputPricePerMillion: price.outputPricePerMillion,
    cacheReadPricePerMillion: price.cacheReadPricePerMillion,
    cacheWritePricePerMillion: price.cacheWritePricePerMillion,
    cacheWritePriceConfigured: price.cacheWritePriceConfigured,
    requestPrice: price.requestPrice,
    note: price.note,
    updatedAt: price.updatedAt || null,
    revision: null,
  }
}

export function createCompatibilityModelPriceImportPreview(input: {
  catalog: ModelsDevCatalog
  targets: ModelPriceImportTarget[]
  existingPrices: ModelPrice[]
  policy: ModelPriceImportPolicy
  overwriteMode: ModelPriceImportOverwriteMode
  matchOverrides: ModelPriceImportMatchOverride[]
  generatedAt?: string
}): ModelPriceImportPreview {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const rows = buildModelPriceImportRows({
    catalog: input.catalog,
    policy: input.policy,
    matchOverrides: input.matchOverrides,
    candidates: input.targets,
    existingRules: input.existingPrices.map(toExistingRule),
  }).map<ModelPriceImportPreviewRow>((row) => {
    const action = getModelPriceImportRowAction(row, input.overwriteMode)
    const applicable = action === 'create' || action === 'update_sync' || action === 'overwrite'
    return {
      key: row.key,
      provider: row.homeProvider,
      model: row.homeModel,
      serviceTier: '*',
      minInputTokens: 0,
      label: row.homeLabel,
      status: row.status,
      action,
      applicable,
      selectedByDefault: action === 'create' || action === 'update_sync',
      matchedProvider: row.matchedProviderId,
      matchedModel: row.matchedModelId,
      matchedName: row.matchedName,
      official: row.official,
      multiplier: row.multiplier,
      final: row.final,
      writeRule: row.final
        ? {
            serviceTier: '*',
            minInputTokens: 0,
            cacheWritePriceConfigured: row.final.cacheWriteConfigured,
            source: 'sync',
            enabled: row.existing?.enabled ?? true,
            note: buildImportNote(row, input.catalog.fetchedAt),
          }
        : null,
      existing: row.existing
        ? {
            ...row.existing,
            source:
              row.existing.source === 'sync' || row.existing.source === 'default'
                ? row.existing.source
                : 'manual',
            updatedAt: row.existing.updatedAt,
            revision: null,
          }
        : null,
      reasons:
        row.reasons[0] === 'multiple_matches'
          ? [
              {
                code: 'multiple_matches',
                message: null,
                candidates: row.reasons.filter((reason) => reason.includes('/')),
              },
            ]
          : row.reasons.map((reason) => ({ code: reason, message: null, candidates: [] })),
    }
  })

  return {
    id: `compatibility:${generatedAt}`,
    revision: generatedAt,
    generatedAt,
    expiresAt: null,
    atomic: false,
    source: 'models.dev',
    sourceUrl: input.catalog.sourceUrl,
    sourceFetchedAt: input.catalog.fetchedAt,
    sourceVersion: null,
    sourceModelCount: input.catalog.models.length,
    rows,
    summary: summarizeRows(rows),
    issues: [],
    mode: 'compatibility',
    raw: null,
  }
}
