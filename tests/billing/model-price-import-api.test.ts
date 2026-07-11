import { describe, expect, test } from 'bun:test'

import {
  classifyModelPriceImportErrorStatus,
  normalizeModelPriceImportApplyResult,
  normalizeModelPriceImportOperationProgress,
  normalizeModelPriceImportPreview,
  toModelPriceImportPreviewPayload,
} from '../../src/lib/api/management/billing-model-price-import'
import { createCompatibilityModelPriceImportPreview } from '../../src/lib/billing/model-price-import-preview'
import type {
  ModelPriceImportApplyInput,
  ModelPriceImportPreviewInput,
} from '../../src/lib/billing/model-price-import-types'
import { parseModelsDevCatalog } from '../../src/lib/billing/models-dev-catalog'
import { createDefaultImportPolicy } from '../../src/lib/billing/models-dev-match'

const BASE_KEY = 'openai::gpt-5.5'
const LARGE_CONTEXT_KEY = 'openai::gpt-5.5::*::272001'
const SELECTED_KEYS = [BASE_KEY, LARGE_CONTEXT_KEY]

function createPreviewInput(
  overrides: Partial<ModelPriceImportPreviewInput> = {},
): ModelPriceImportPreviewInput {
  return {
    targets: [
      {
        provider: 'openai',
        model: 'gpt-5.5',
        label: 'GPT-5.5',
        scopes: ['available'],
      },
    ],
    overwriteMode: 'missing',
    policy: createDefaultImportPolicy(),
    matchOverrides: [],
    ...overrides,
  }
}

function createPreviewRow(key: string, minInputTokens: number, input: number, output: number) {
  const cost = {
    input,
    output,
    cache_read: input / 10,
    cache_write: 0,
    cache_write_configured: false,
    request: 0,
  }
  return {
    row_key: key,
    provider: 'openai',
    model: 'gpt-5.5',
    service_tier: '*',
    min_input_tokens: minInputTokens,
    label: 'GPT-5.5',
    status: 'matched',
    action: 'create',
    applicable: true,
    selected_by_default: true,
    matched_provider: 'openai',
    matched_model: 'gpt-5.5',
    matched_name: 'GPT-5.5',
    official: { ...cost },
    multiplier: 1,
    final: { ...cost },
    write_rule: {
      service_tier: '*',
      min_input_tokens: minInputTokens,
      cache_write_price_configured: false,
      source: 'sync',
      enabled: true,
      note: 'Synced from models.dev (openai/gpt-5.5).',
    },
    reasons: [{ code: 'matched', message: 'Exact models.dev scope match.' }],
  }
}

function createPreviewResponse() {
  return {
    preview: {
      preview_id: 'preview-1',
      preview_revision: 'preview-revision-1',
      generated_at: '2026-07-10T00:00:00Z',
      expires_at: '2026-07-10T00:15:00Z',
      atomic: true,
      source: 'models.dev',
      source_url: 'https://models.dev/api.json',
      source_fetched_at: '2026-07-09T23:58:00Z',
      source_version: 'catalog-version-1',
      source_model_count: 1,
      rows: [
        createPreviewRow(BASE_KEY, 0, 2, 8),
        createPreviewRow(LARGE_CONTEXT_KEY, 272001, 4, 16),
      ],
      summary: {
        total: 2,
        creates: 2,
        updates_sync: 0,
        overwrites: 0,
        skips: 0,
        reviews: 0,
        conflicts: 0,
        failed: 0,
      },
      issues: [],
    },
  }
}

function createExistingRule() {
  return {
    id: 'price-1',
    provider: 'openai',
    model: 'gpt-5.5',
    service_tier: '*',
    min_input_tokens: 0,
    source: 'manual',
    enabled: true,
    input_price_per_million: 1,
    output_price_per_million: 4,
    cache_read_price_per_million: 0.1,
    cache_write_price_per_million: 0,
    cache_write_price_configured: false,
    request_price: 0,
    note: 'Operator-maintained rule',
    updated_at: '2026-07-09T00:00:00Z',
    revision: 'rule-revision-1',
  }
}

function createApplyInput(): ModelPriceImportApplyInput {
  return {
    previewId: 'preview-1',
    previewRevision: 'preview-revision-1',
    selectedKeys: SELECTED_KEYS,
    confirmOverwrite: false,
    idempotencyKey: 'idempotency-key-1',
    expectedAtomic: true,
    expectedRows: SELECTED_KEYS.map((key) => ({
      key,
      provider: 'openai',
      model: 'gpt-5.5',
      action: 'create',
    })),
  }
}

function createApplyResponse() {
  return {
    operation_id: 'operation-1',
    preview_id: 'preview-1',
    status: 'applied',
    atomic: true,
    applied_at: '2026-07-10T00:01:00Z',
    summary: {
      total: 2,
      creates: 2,
      updates_sync: 0,
      overwrites: 0,
      skips: 0,
      reviews: 0,
      conflicts: 0,
      failed: 0,
    },
    rows: SELECTED_KEYS.map((key, index) => ({
      key,
      provider: 'openai',
      model: 'gpt-5.5',
      action: 'create',
      status: 'created',
      resource_id: `price-${index + 1}`,
    })),
  }
}

describe('model price import Management API contract', () => {
  test('serializes wildcard base scopes and policy controls', () => {
    const input = createPreviewInput()
    input.policy.rowMultipliers[BASE_KEY] = 1.25
    input.matchOverrides.push({
      targetProvider: 'openai',
      targetModel: 'gpt-5.5',
      sourceProvider: 'openai',
      sourceModel: 'gpt-5.5',
    })

    const payload = toModelPriceImportPreviewPayload(input)

    expect(payload.targets[0]).toMatchObject({ service_tier: '*', min_input_tokens: 0 })
    expect(payload.policy.row_multipliers[BASE_KEY]).toBe(1.25)
    expect(payload.policy.aliases.length).toBeGreaterThan(0)
    expect(payload.match_overrides[0]).toEqual({
      target_provider: 'openai',
      target_model: 'gpt-5.5',
      source_provider: 'openai',
      source_model: 'gpt-5.5',
    })
  })

  test('accepts multiple context-band rows for one target', () => {
    const preview = normalizeModelPriceImportPreview(createPreviewResponse(), createPreviewInput())

    expect(preview.mode).toBe('server')
    expect(preview.summary).toMatchObject({ total: 2, creates: 2 })
    expect(preview.rows.map((row) => row.key)).toEqual(SELECTED_KEYS)
    expect(preview.rows.map((row) => row.minInputTokens)).toEqual([0, 272001])
    expect(preview.rows[1].writeRule).toMatchObject({
      serviceTier: '*',
      minInputTokens: 272001,
    })
  })

  test('rejects duplicate scopes and duplicate row keys', () => {
    const duplicateScope = createPreviewResponse()
    duplicateScope.preview.rows[1].min_input_tokens = 0
    duplicateScope.preview.rows[1].write_rule.min_input_tokens = 0
    expect(() => normalizeModelPriceImportPreview(duplicateScope, createPreviewInput())).toThrow(
      'duplicate rule scope',
    )

    const duplicateKey = createPreviewResponse()
    duplicateKey.preview.rows[1].row_key = BASE_KEY
    expect(() => normalizeModelPriceImportPreview(duplicateKey, createPreviewInput())).toThrow(
      'duplicate row key',
    )
  })

  test('rejects write and existing-rule scope corruption', () => {
    const wrongWriteScope = createPreviewResponse()
    wrongWriteScope.preview.rows[0].write_rule.min_input_tokens = 1
    expect(() => normalizeModelPriceImportPreview(wrongWriteScope, createPreviewInput())).toThrow(
      'write rule identity',
    )

    const overwriteResponse = createPreviewResponse()
    overwriteResponse.preview.rows[0].action = 'overwrite'
    overwriteResponse.preview.rows[0].existing_rule = createExistingRule()
    overwriteResponse.preview.summary.creates = 1
    overwriteResponse.preview.summary.overwrites = 1
    const overwriteInput = createPreviewInput({ overwriteMode: 'all' })
    expect(normalizeModelPriceImportPreview(overwriteResponse, overwriteInput).rows[0].action).toBe(
      'overwrite',
    )

    overwriteResponse.preview.rows[0].existing_rule.min_input_tokens = 1
    expect(() => normalizeModelPriceImportPreview(overwriteResponse, overwriteInput)).toThrow(
      'existing rule identity',
    )
  })

  test('rejects corrupted prices and provenance evidence', () => {
    const wrongPrice = createPreviewResponse()
    wrongPrice.preview.rows[0].final.input = 2.1
    expect(() => normalizeModelPriceImportPreview(wrongPrice, createPreviewInput())).toThrow(
      'final input does not match official price and multiplier',
    )

    const wrongSource = createPreviewResponse()
    wrongSource.preview.rows[0].write_rule.source = 'manual'
    expect(() => normalizeModelPriceImportPreview(wrongSource, createPreviewInput())).toThrow(
      'write source is not sync',
    )

    const wrongNote = createPreviewResponse()
    wrongNote.preview.rows[0].write_rule.note = 'Imported catalog price.'
    expect(() => normalizeModelPriceImportPreview(wrongNote, createPreviewInput())).toThrow(
      'provenance note does not identify the models.dev source',
    )
  })

  test('normalizes apply results for all selected context bands', () => {
    const result = normalizeModelPriceImportApplyResult(createApplyResponse(), createApplyInput())

    expect(result.status).toBe('applied')
    expect(result.summary).toMatchObject({ total: 2, creates: 2, failed: 0 })
    expect(result.rows.map((row) => row.key)).toEqual(SELECTED_KEYS)

    const wrongIdentity = createApplyResponse()
    wrongIdentity.rows[1].model = 'gpt-5.5-large'
    expect(() => normalizeModelPriceImportApplyResult(wrongIdentity, createApplyInput())).toThrow(
      'identity mismatch',
    )
  })

  test('validates operation polling identity and monotonic progress', () => {
    const progress = {
      operation_id: 'operation-1',
      preview_id: 'preview-1',
      status: 'running',
      atomic: true,
      progress: { completed: 1, total: 2, current_model: 'gpt-5.5' },
      poll_after_ms: 20,
    }

    expect(normalizeModelPriceImportOperationProgress(progress, createApplyInput())).toEqual({
      operationId: 'operation-1',
      progress: { completed: 1, total: 2, currentModel: 'gpt-5.5' },
      pollAfterMs: 20,
    })
    expect(() =>
      normalizeModelPriceImportOperationProgress(progress, createApplyInput(), 'operation-2'),
    ).toThrow('operation identity changed')
    expect(() =>
      normalizeModelPriceImportOperationProgress(progress, createApplyInput(), 'operation-1', 2),
    ).toThrow('completed count moved backwards')
  })

  test('keeps unsupported endpoint detection separate after an operation is accepted', () => {
    expect(classifyModelPriceImportErrorStatus(404, false)).toBe('unsupported')
    expect(classifyModelPriceImportErrorStatus(405, false)).toBe('unsupported')
    expect(classifyModelPriceImportErrorStatus(404, true)).toBe('server')
    expect(classifyModelPriceImportErrorStatus(405, true)).toBe('server')
  })
})

describe('model price import compatibility preview', () => {
  test('builds a complete wildcard base rule from a catalog response', () => {
    const catalog = parseModelsDevCatalog({
      openai: {
        models: {
          'gpt-5.5': {
            id: 'gpt-5.5',
            name: 'GPT-5.5',
            cost: { input: 2, output: 8, cache_read: 0.2 },
          },
        },
      },
    })
    const preview = createCompatibilityModelPriceImportPreview({
      catalog,
      targets: createPreviewInput().targets,
      existingPrices: [],
      policy: createDefaultImportPolicy(),
      overwriteMode: 'missing',
      matchOverrides: [],
      generatedAt: '2026-07-10T00:00:00Z',
    })

    expect(preview.mode).toBe('compatibility')
    expect(preview.atomic).toBe(false)
    expect(preview.summary).toMatchObject({ total: 1, creates: 1 })
    expect(preview.rows[0]).toMatchObject({
      key: BASE_KEY,
      serviceTier: '*',
      minInputTokens: 0,
      final: { input: 2, output: 8, cacheRead: 0.2 },
    })
  })
})
