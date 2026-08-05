import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import type { UserCatalogModel } from '@/features/access/use-user-model-catalog'
import { UserModelCard } from '@/features/access/user-model-card'
import { en } from '@/lib/i18n/locales/en'

const testI18n = createInstance()
const copy = en.common.userModels

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    resources: { en },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
})

function createModel(overrides: Partial<UserCatalogModel> = {}): UserCatalogModel {
  return {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    description: 'A long-context model.',
    version: null,
    ownedBy: null,
    type: null,
    providers: ['gemini'],
    contextLength: 1_048_576,
    maxOutputTokens: 65_536,
    modalities: { status: 'unknown', input: [], output: [] },
    capabilities: {
      reasoning: { status: 'unknown', levels: [], budget: null },
      toolCalling: 'unknown',
      structuredOutput: 'unknown',
      parameters: [],
      generationMethods: [],
    },
    pricing: null,
    availability: null,
    accessible: null,
    ...overrides,
  }
}

function renderCard(model: UserCatalogModel, authenticated: boolean) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <UserModelCard model={model} authenticated={authenticated} onOpenDetails={() => undefined} />
    </I18nextProvider>,
  )
}

function badgeVariants(markup: string) {
  return [...markup.matchAll(/data-slot="badge" data-variant="([^"]+)"/g)].map((match) => match[1])
}

describe('user model card', () => {
  test('shows the literal model ID with a copy affordance', () => {
    const markup = renderCard(createModel(), false)

    expect(markup).toContain('gemini-2.5-pro')
    expect(markup).toContain(copy.card.copyId)
    // The display name is a label; the ID is what goes into a request body, so
    // both are on the card and the ID is never translated or prettified.
    expect(markup).toContain('Gemini 2.5 Pro')
  })

  test('tells a signed-out visitor that pricing needs an account', () => {
    const markup = renderCard(createModel(), false)

    expect(markup).toContain(copy.price.signedOut)
    expect(markup).not.toContain(copy.price.from)
    expect(markup).not.toContain(copy.card.access.included)
    expect(markup).not.toContain(copy.card.access.excluded)
  })

  test('labels an unpublished price as unpublished rather than free', () => {
    const markup = renderCard(
      createModel({ accessible: true, pricing: { status: 'unpublished', providers: [] } }),
      true,
    )

    expect(markup).toContain(copy.price.unpublished)
    expect(markup).not.toContain(copy.price.from)
    // A missing price must never reach the screen as a number of any kind.
    expect(markup).not.toContain('$0')
  })

  test('presents a laddered price as an opening price with its step count', () => {
    const markup = renderCard(
      createModel({
        accessible: true,
        pricing: {
          status: 'published',
          providers: [
            {
              provider: 'gemini',
              tiers: [
                {
                  serviceTier: '*',
                  isDefault: true,
                  rungs: [
                    {
                      minInputTokens: 0,
                      inputPricePerMillion: 1.25,
                      outputPricePerMillion: 10,
                      cacheReadPricePerMillion: null,
                      cacheWritePricePerMillion: null,
                      requestPrice: null,
                    },
                    {
                      minInputTokens: 200_000,
                      inputPricePerMillion: 2.5,
                      outputPricePerMillion: 15,
                      cacheReadPricePerMillion: null,
                      cacheWritePricePerMillion: null,
                      requestPrice: null,
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
      true,
    )

    expect(markup).toContain(copy.price.from)
    expect(markup).toContain('1.25')
    expect(markup).toContain('2-step ladder')
    // The higher rung is not the headline number, but the buyer is told the
    // headline is only the first step.
    expect(markup).not.toContain('2.50')
  })

  test('says a model outside the signed-in keys is not covered', () => {
    const markup = renderCard(createModel({ accessible: false }), true)

    expect(markup).toContain(copy.card.access.excluded)
    expect(markup).toContain(copy.price.notCovered)
  })

  test('distinguishes an unreported capability from a denied one', () => {
    const unknown = renderCard(createModel(), false)

    expect(unknown).toContain(copy.capability.tools.unknown)
    expect(unknown).not.toContain(copy.capability.tools.unsupported)
    expect(unknown).toContain(copy.modality.unreported)

    const stated = renderCard(
      createModel({
        capabilities: {
          reasoning: { status: 'supported', levels: ['low', 'high'], budget: null },
          toolCalling: 'unsupported',
          structuredOutput: 'supported',
          parameters: [],
          generationMethods: [],
        },
      }),
      false,
    )

    expect(stated).toContain(copy.capability.tools.unsupported)
    expect(stated).not.toContain(copy.capability.tools.unknown)

    // The label carries the distinction; the variant only reinforces it, so a
    // reader who cannot see the dashed border still gets the answer.
    expect(badgeVariants(unknown)).toEqual(['unknown', 'unknown', 'unknown', 'unknown'])
    expect(badgeVariants(stated)).toEqual(['unknown', 'unsupported', 'supported', 'supported'])
  })

  test('names both modalities when the catalog described them', () => {
    const markup = renderCard(
      createModel({
        modalities: {
          status: 'known',
          input: ['text', 'image'],
          output: ['text'],
        },
      }),
      false,
    )

    expect(markup).toContain('text image')
    expect(markup).toContain(copy.modality.input)
    expect(markup).not.toContain(copy.modality.unreported)
  })

  test('falls back to the model ID and says when specs were not reported', () => {
    const markup = renderCard(
      createModel({
        displayName: null,
        description: null,
        contextLength: null,
        maxOutputTokens: null,
        providers: [],
      }),
      false,
    )

    expect(markup).toContain('gemini-2.5-pro')
    expect(markup).toContain(copy.card.noDescription)
    expect(markup).toContain(copy.value.unreported)
  })
})
