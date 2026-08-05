import axios, { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  baseRung,
  collectProviders,
  formatPercent,
  preferredTier,
  pricingEntryPoint,
} from '@/features/access/user-model-format'
import {
  type UserModel,
  fetchPublicUserModels,
  isUserModelCatalogUnsupportedError,
  normalizeUserModel,
  normalizeUserModelCatalog,
} from '@/lib/api/user/models'

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

describe('user model normalization', () => {
  test('keeps "not supported" and "not reported" apart', () => {
    const model = normalizeUserModel({
      id: 'gpt-5',
      capabilities: {
        tool_calling: { status: 'supported' },
        structured_output: { status: 'unsupported' },
        // The server said nothing about reasoning. That has to survive as
        // `unknown`, never as a denial the cluster never issued.
      },
    })

    expect(model?.capabilities.toolCalling).toBe('supported')
    expect(model?.capabilities.structuredOutput).toBe('unsupported')
    expect(model?.capabilities.reasoning.status).toBe('unknown')
  })

  test('reads an unrecognized capability status as not reported', () => {
    const model = normalizeUserModel({
      id: 'gpt-5',
      capabilities: { tool_calling: { status: 'maybe' } },
    })

    expect(model?.capabilities.toolCalling).toBe('unknown')
  })

  test('reports unknown modalities as unknown rather than text-only', () => {
    const model = normalizeUserModel({ id: 'gpt-5', modalities: { status: 'unknown' } })

    expect(model?.modalities).toEqual({ status: 'unknown', input: [], output: [] })
  })

  test('withholds every derived availability number on an undersampled window', () => {
    // A server that leaks derived fields alongside `insufficient_data` must not
    // be able to put a rate on screen: three successes out of three is not full
    // availability, and the client refuses to render it as one.
    const model = normalizeUserModel({
      id: 'gpt-5',
      availability: {
        status: 'insufficient_data',
        sample_count: 3,
        success_count: 3,
        availability_rate: 1,
        avg_latency_ms: 120,
        window: { hours: 24, min_samples: 20 },
      },
    })

    expect(model?.availability?.status).toBe('insufficient_data')
    expect(model?.availability?.sampleCount).toBe(3)
    expect(model?.availability?.successCount).toBeNull()
    expect(model?.availability?.availabilityRate).toBeNull()
    expect(model?.availability?.avgLatencyMs).toBeNull()
    expect(model?.availability?.window.minSamples).toBe(20)
  })

  test('keeps a zero price component distinct from a missing one', () => {
    const model = normalizeUserModel({
      id: 'gpt-5',
      pricing: {
        status: 'published',
        providers: [
          {
            provider: 'openai',
            tiers: [
              {
                service_tier: '*',
                is_default: true,
                rungs: [{ min_input_tokens: 0, input_price_per_million: 1.25 }],
              },
            ],
          },
        ],
      },
    })

    const rung = model?.pricing?.providers[0]?.tiers[0]?.rungs[0]
    expect(rung?.inputPricePerMillion).toBe(1.25)
    // Never 0: the server did not say cache reads are free, it said nothing.
    expect(rung?.cacheReadPricePerMillion).toBeNull()
    expect(rung?.requestPrice).toBeNull()
  })

  test('drops the provider ladder when pricing is unpublished', () => {
    const model = normalizeUserModel({ id: 'gpt-5', pricing: { status: 'unpublished' } })

    expect(model?.pricing).toEqual({ status: 'unpublished', providers: [] })
  })

  test('skips catalog entries with no model ID', () => {
    const catalog = normalizeUserModelCatalog(
      { models: [{ id: 'gpt-5' }, { display_name: 'nameless' }], total: 2 },
      'public',
    )

    expect(catalog.models.map((model) => model.id)).toEqual(['gpt-5'])
    expect(catalog.total).toBe(2)
    expect(catalog.scope).toBe('public')
  })

  test('turns a missing catalog route into an unsupported-server error, not a failure', async () => {
    axios.defaults.adapter = async (config) => {
      throw axiosResponseError(config, 404, { error: 'not_found' })
    }

    const error = await fetchPublicUserModels().catch((reason: unknown) => reason)
    expect(isUserModelCatalogUnsupportedError(error)).toBe(true)

    axios.defaults.adapter = async (config) => {
      throw axiosResponseError(config, 500, { error: 'internal' })
    }

    const failure = await fetchPublicUserModels().catch((reason: unknown) => reason)
    expect(isUserModelCatalogUnsupportedError(failure)).toBe(false)
  })
})

describe('price ladder presentation', () => {
  test('reports a multi-rung ladder as tiered and counts its steps', () => {
    const entry = pricingEntryPoint({
      status: 'published',
      providers: [
        {
          provider: 'google',
          tiers: [
            {
              serviceTier: '*',
              isDefault: true,
              rungs: [
                rung({ minInputTokens: 200_000, inputPricePerMillion: 2.5 }),
                rung({ minInputTokens: 0, inputPricePerMillion: 1.25, outputPricePerMillion: 10 }),
              ],
            },
          ],
        },
      ],
    })

    // The entry point is the rung a request starts on, not the cheapest rung
    // anywhere in the ladder, and it is flagged so the card can label it "from".
    expect(entry?.input).toBe(1.25)
    expect(entry?.output).toBe(10)
    expect(entry?.tiered).toBe(true)
    expect(entry?.maxRungCount).toBe(2)
  })

  test('takes the cheapest entry rung across providers', () => {
    const entry = pricingEntryPoint({
      status: 'published',
      providers: [
        {
          provider: 'vertex',
          tiers: [
            {
              serviceTier: '*',
              isDefault: true,
              rungs: [rung({ inputPricePerMillion: 3, outputPricePerMillion: 15 })],
            },
          ],
        },
        {
          provider: 'gemini',
          tiers: [
            {
              serviceTier: '*',
              isDefault: true,
              rungs: [rung({ inputPricePerMillion: 1.25, outputPricePerMillion: 20 })],
            },
          ],
        },
      ],
    })

    expect(entry?.input).toBe(1.25)
    expect(entry?.output).toBe(15)
    expect(entry?.tiered).toBe(false)
    expect(entry?.providerCount).toBe(2)
  })

  test('has no entry point at all when nothing was published', () => {
    expect(pricingEntryPoint(null)).toBeNull()
    expect(pricingEntryPoint({ status: 'unpublished', providers: [] })).toBeNull()
    expect(pricingEntryPoint({ status: 'published', providers: [] })).toBeNull()
  })

  test('prefers the default service tier over the order the server listed', () => {
    const tiers = [
      { serviceTier: 'batch', isDefault: false, rungs: [] },
      { serviceTier: '*', isDefault: true, rungs: [] },
    ]

    expect(preferredTier(tiers)?.serviceTier).toBe('*')
    expect(preferredTier([tiers[0]])?.serviceTier).toBe('batch')
    expect(preferredTier([])).toBeNull()
  })

  test('reads the base rung as the lowest input threshold', () => {
    const rungs = [rung({ minInputTokens: 200_000 }), rung({ minInputTokens: 0 })]

    expect(baseRung(rungs)?.minInputTokens).toBe(0)
    expect(baseRung([])).toBeNull()
  })
})

describe('catalog presentation helpers', () => {
  test('renders an availability fraction as a percentage', () => {
    // The server sends 0..1; showing 0.9812 verbatim would read as 1% uptime.
    expect(formatPercent(0.9812, 'en')).toBe('98.12%')
    expect(formatPercent(1, 'en')).toBe('100.00%')
    expect(formatPercent(null, 'en')).toBeNull()
  })

  test('collects providers across the catalog without duplicates', () => {
    const models = [
      { providers: ['gemini', 'vertex'] },
      { providers: ['gemini'] },
      { providers: [] },
    ] as UserModel[]

    expect(collectProviders(models)).toEqual(['gemini', 'vertex'])
  })
})

function rung(overrides: Partial<Parameters<typeof baseRung>[0][number]> = {}) {
  return {
    minInputTokens: 0,
    inputPricePerMillion: null,
    outputPricePerMillion: null,
    cacheReadPricePerMillion: null,
    cacheWritePricePerMillion: null,
    requestPrice: null,
    ...overrides,
  }
}

function axiosResponseError(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return Object.assign(new Error(`request failed with status ${status}`), {
    isAxiosError: true,
    config,
    response: {
      data,
      status,
      statusText: String(status),
      headers: {},
      config,
    },
  })
}
