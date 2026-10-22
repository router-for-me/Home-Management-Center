import { describe, expect, test } from 'bun:test'

import {
  type ManagementModelScope,
  type ModelResource,
  normalizeModelsSnapshotResponse,
} from '../../src/lib/api/management/models'
import { createModelPriceCandidates } from '../../src/lib/billing/model-price-candidates'

function modelResource(
  id: string,
  scope: ManagementModelScope,
  providers: string[],
  overrides: Partial<ModelResource> = {},
): ModelResource {
  return {
    id,
    displayName: id,
    name: id,
    ownedBy: 'openai',
    type: 'openai',
    providers,
    billingModels: null,
    channel: null,
    scope,
    object: 'model',
    created: null,
    raw: {},
    ...overrides,
  }
}

describe('Billing model provider contract', () => {
  test('parses only explicit providers and reports legacy records', () => {
    const snapshot = normalizeModelsSnapshotResponse(
      {
        models: [
          {
            id: 'gpt-5.5',
            type: 'openai',
            providers: ['Codex', ' codex ', 'OpenRouter', 'openrouter', 42],
          },
          {
            id: 'legacy-model',
            type: 'claude',
            provider: 'claude',
          },
        ],
      },
      'available',
    )

    expect(snapshot.resources[0]?.providers).toEqual(['codex', 'openrouter'])
    expect(snapshot.resources[1]?.providers).toEqual([])
    expect(snapshot.missingProviderMetadataCount).toBe(1)
  })

  test('expands exact provider-model pairs without inferring from type or channel', () => {
    const available = [
      modelResource('gpt-5.5', 'available', ['codex']),
      modelResource('shared-model', 'available', ['openrouter', 'azure-prod']),
      modelResource('legacy-openai', 'available', [], { channel: 'codex-pro' }),
    ]
    const staticModels = [modelResource('gpt-5.5', 'static', ['codex'], { channel: 'codex-pro' })]

    const candidates = createModelPriceCandidates(available, staticModels)

    expect(candidates.map(({ provider, model }) => [provider, model])).toEqual([
      ['azure-prod', 'shared-model'],
      ['codex', 'gpt-5.5'],
      ['openrouter', 'shared-model'],
    ])
    expect(candidates.find((candidate) => candidate.model === 'gpt-5.5')?.scopes).toEqual([
      'static',
      'available',
    ])
    expect(candidates.some((candidate) => candidate.provider === 'openai')).toBe(false)
    expect(candidates.some((candidate) => candidate.model === 'legacy-openai')).toBe(false)
  })
})

describe('Billing alias execution identities', () => {
  test('prices each upstream target and keeps aliases searchable after deduplication', () => {
    const snapshot = normalizeModelsSnapshotResponse(
      {
        models: [
          {
            id: 'team/MY-MODEL',
            name: 'merged-name-is-not-authoritative',
            providers: ['z-ai', 'another-provider'],
            billing_models: [
              { provider: ' Z-AI ', model: 'glm-5.3-flash' },
              { provider: 'z-ai', model: 'glm-next' },
              { provider: 'another-provider', model: 'other-upstream' },
              { provider: 'z-ai', model: 'glm-5.3-flash' },
            ],
          },
        ],
      },
      'available',
    )
    const candidates = createModelPriceCandidates(snapshot.resources, [
      modelResource('glm-5.3-flash', 'static', ['z-ai']),
    ])
    expect(candidates.map(({ provider, model }) => [provider, model])).toEqual([
      ['another-provider', 'other-upstream'],
      ['z-ai', 'glm-5.3-flash'],
      ['z-ai', 'glm-next'],
    ])
    expect(candidates.every(({ description }) => description.includes('team/MY-MODEL'))).toBe(true)
    expect(candidates.find(({ model }) => model === 'glm-5.3-flash')?.scopes).toEqual([
      'static',
      'available',
    ])
    expect(snapshot.missingProviderMetadataCount).toBe(0)
  })

  test('does not invent alias prices when billing targets are empty or malformed', () => {
    const snapshot = normalizeModelsSnapshotResponse(
      {
        models: [
          { id: 'empty', providers: ['z-ai'], billing_models: [] },
          { id: 'invalid', providers: ['z-ai'], billing_models: null },
          {
            id: 'malformed',
            providers: ['z-ai'],
            billing_models: [
              null,
              {},
              { provider: '', model: 'glm' },
              { provider: 'z-ai', model: 1 },
            ],
          },
        ],
      },
      'available',
    )
    expect(createModelPriceCandidates(snapshot.resources, [])).toEqual([])
    expect(snapshot.missingProviderMetadataCount).toBe(3)
  })
})
