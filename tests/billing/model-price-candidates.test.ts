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
