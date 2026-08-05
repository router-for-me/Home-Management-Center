import { describe, expect, test } from 'bun:test'

import { compareUserModels, modelPriceSortKey } from '@/features/access/user-model-format'
import {
  capabilityFiltersToParam,
  normalizeCapabilityFilters,
  normalizeUserModelRouteSearch,
} from '@/features/access/user-model-route'
import { type UserModel, normalizeUserModel } from '@/lib/api/user/models'

function model(id: string, openingInputPrice: number | null, displayName?: string) {
  const built = normalizeUserModel({
    id,
    display_name: displayName,
    pricing:
      openingInputPrice === null
        ? { status: 'unpublished' }
        : {
            status: 'published',
            providers: [
              {
                provider: 'openai',
                tiers: [
                  {
                    service_tier: 'default',
                    is_default: true,
                    rungs: [
                      {
                        min_input_tokens: 0,
                        input_price_per_million: openingInputPrice,
                        output_price_per_million: openingInputPrice * 3,
                      },
                    ],
                  },
                ],
              },
            ],
          },
  })

  if (!built) throw new Error(`fixture ${id} failed to normalize`)
  return built
}

function order(models: UserModel[], sort: Parameters<typeof compareUserModels>[0]) {
  return [...models].sort(compareUserModels(sort, 'en')).map((entry) => entry.id)
}

describe('catalog URL state', () => {
  test('drops filter values the catalog cannot apply', () => {
    // A URL that claims a filter the page cannot honour would show an
    // unfiltered list while the address bar insisted otherwise.
    expect(normalizeUserModelRouteSearch({ caps: 'tools,telepathy', sort: 'cheapest' })).toEqual({
      caps: 'tools',
    })
  })

  test('keeps capabilities in one canonical order however they were typed', () => {
    expect(capabilityFiltersToParam('reasoning,tools')).toBe('tools,reasoning')
    expect(capabilityFiltersToParam(['reasoning', 'tools'])).toBe('tools,reasoning')
    expect(capabilityFiltersToParam('')).toBeUndefined()
  })

  test('reads capability filters from an array as well as a comma list', () => {
    expect(normalizeCapabilityFilters(['structuredOutput'])).toEqual(['structuredOutput'])
    expect(normalizeCapabilityFilters('structuredOutput')).toEqual(['structuredOutput'])
  })

  test('leaves the default order out of the URL', () => {
    // The unsorted catalog and the explicitly name-sorted catalog are the same
    // view, so they get the same address.
    expect(normalizeUserModelRouteSearch({ sort: 'name' })).toEqual({})
    expect(normalizeUserModelRouteSearch({ sort: 'price-asc' })).toEqual({ sort: 'price-asc' })
  })

  test('carries no query string when nothing is filtered', () => {
    expect(normalizeUserModelRouteSearch({ q: '  ', provider: '', mine: 'false' })).toEqual({})
  })

  test('matches a hand-typed modality regardless of case', () => {
    expect(normalizeUserModelRouteSearch({ modality: 'Image' })).toEqual({ modality: 'image' })
  })

  test('accepts the key-coverage filter as a flag or as a string', () => {
    expect(normalizeUserModelRouteSearch({ mine: true }).mine).toBe(true)
    expect(normalizeUserModelRouteSearch({ mine: 'true' }).mine).toBe(true)
  })
})

describe('catalog price sort', () => {
  test('ranks on the opening input price, not on an invented average', () => {
    expect(modelPriceSortKey(model('a', 2))).toBe(2)
    expect(modelPriceSortKey(model('b', null))).toBeNull()
  })

  test('orders by price in both directions', () => {
    const models = [model('mid', 5), model('cheap', 1), model('dear', 9)]

    expect(order(models, 'price-asc')).toEqual(['cheap', 'mid', 'dear'])
    expect(order(models, 'price-desc')).toEqual(['dear', 'mid', 'cheap'])
  })

  test('sinks an unpriced model to the bottom of both directions', () => {
    // A missing price is not a price of zero and not a price of infinity, so it
    // must never head the cheapest-first list nor the dearest-first one.
    const models = [model('unpriced', null), model('cheap', 1), model('dear', 9)]

    expect(order(models, 'price-asc')).toEqual(['cheap', 'dear', 'unpriced'])
    expect(order(models, 'price-desc')).toEqual(['dear', 'cheap', 'unpriced'])
  })

  test('breaks a price tie by name so the order stays stable', () => {
    const models = [model('z-model', 4, 'Zeta'), model('a-model', 4, 'Alpha')]

    expect(order(models, 'price-asc')).toEqual(['a-model', 'z-model'])
    expect(order(models, 'price-desc')).toEqual(['a-model', 'z-model'])
  })

  test('sorts by name when no price order was chosen', () => {
    const models = [model('b', 1, 'Beta'), model('a', 9, 'Alpha')]

    expect(order(models, 'name')).toEqual(['a', 'b'])
  })
})
