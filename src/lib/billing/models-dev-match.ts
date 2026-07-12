import type {
  ModelPriceImportAction,
  ModelPriceImportAliasRule,
  ModelPriceImportExistingRule,
  ModelPriceImportMatchOverride,
  ModelPriceImportMatchStatus,
  ModelPriceImportMultiplierRule,
  ModelPriceImportOverwriteMode,
  ModelPriceImportPolicy,
} from './model-price-import-types'
import {
  type ModelsDevCatalog,
  type ModelsDevCost,
  type ModelsDevModelEntry,
  modelsDevBareModelId,
  modelsDevProviderModelKey,
} from './models-dev-catalog'

export type {
  ModelPriceImportAction,
  ModelPriceImportExistingRule,
  ModelPriceImportMatchStatus,
  ModelPriceImportOverwriteMode,
  ModelPriceImportPolicy,
} from './model-price-import-types'

export type ModelPriceImportCandidate = {
  provider: string
  model: string
  label?: string
}

export type ModelPriceImportRow = {
  key: string
  homeProvider: string
  homeModel: string
  homeLabel: string
  status: ModelPriceImportMatchStatus
  matchedProviderId: string | null
  matchedModelId: string | null
  matchedName: string | null
  official: ModelsDevCost | null
  multiplier: number
  final: ModelsDevCost | null
  existing: ModelPriceImportExistingRule | null
  reasons: string[]
}

const FIRST_PARTY_LABS = ['anthropic', 'google', 'xai', 'openai'] as const
const MARKETPLACE_PROVIDERS = new Set(['openrouter', 'requesty'])

/** Home runtime model aliases -> preferred models.dev bare model ids. */
export const DEFAULT_MODEL_ALIASES: Record<string, string[]> = {
  'gemini-3-flash-agent': ['gemini-3.5-flash', 'gemini-3.5-flash-preview', 'gemini-3-flash'],
  'gemini-pro-agent': ['gemini-3.1-pro-preview', 'gemini-3.1-pro', 'gemini-3-pro-preview'],
  'gemini-3-flash': ['gemini-3-flash', 'gemini-3-flash-preview'],
  'gemini-3.5-flash-low': ['gemini-3.5-flash'],
  'gemini-3.5-flash-extra-low': ['gemini-3.5-flash'],
  'gemini-3.1-pro-low': ['gemini-3.1-pro-preview', 'gemini-3.1-pro'],
  'claude-opus-4-6-thinking': ['claude-opus-4-6', 'claude-opus-4-6-thinking'],
  'claude-sonnet-4-6-thinking': ['claude-sonnet-4-6', 'claude-sonnet-4.6'],
  'claude-sonnet-4-6': ['claude-sonnet-4-6', 'claude-sonnet-4.6'],
}

export function createDefaultImportPolicy(): ModelPriceImportPolicy {
  return {
    defaultMultiplier: 1,
    rules: [
      {
        id: 'claude',
        label: 'Claude',
        matchMode: 'prefix',
        pattern: 'claude',
        multiplier: 1,
      },
      {
        id: 'gemini',
        label: 'Gemini',
        matchMode: 'prefix',
        pattern: 'gemini',
        multiplier: 1,
      },
      {
        id: 'grok',
        label: 'Grok',
        matchMode: 'prefix',
        pattern: 'grok',
        multiplier: 1,
      },
    ],
    aliases: Object.entries(DEFAULT_MODEL_ALIASES).map(([targetModel, sourceModels]) => ({
      id: targetModel,
      targetModel,
      sourceModels,
    })),
    rowMultipliers: {},
    includeCachePrices: true,
    includeZeroCost: false,
  }
}

export function normalizeModelToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^.*\//, '')
    .replace(/[^a-z0-9]+/g, '')
}

function preferredLabsForHomeModel(homeProvider: string, homeModel: string): string[] {
  const provider = homeProvider.trim().toLowerCase()
  const model = homeModel.trim().toLowerCase()
  const preferred = provider ? [provider] : []
  if (model.startsWith('claude')) preferred.unshift('anthropic')
  if (model.startsWith('gemini') || model.startsWith('gemma')) preferred.unshift('google')
  if (model.startsWith('grok')) preferred.unshift('xai')
  if (
    model.startsWith('gpt') ||
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('o4')
  ) {
    preferred.unshift('openai')
  }
  if (model.startsWith('codex')) preferred.unshift('openai')
  return [...new Set([...preferred, ...FIRST_PARTY_LABS])]
}

function aliasCandidates(homeModel: string, aliases: ModelPriceImportAliasRule[]): string[] {
  const bare = modelsDevBareModelId(homeModel)
  const configured = aliases.find(
    (rule) => rule.targetModel.trim().toLowerCase() === bare.toLowerCase(),
  )
  const listed =
    configured?.sourceModels ??
    DEFAULT_MODEL_ALIASES[bare] ??
    DEFAULT_MODEL_ALIASES[homeModel] ??
    []
  const values = [bare, homeModel, ...listed]
  // mild suffix peeling
  for (const suffix of ['-thinking', '-preview', '-latest']) {
    if (bare.endsWith(suffix)) values.push(bare.slice(0, -suffix.length))
  }
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))]
}

function rankEntry(entry: ModelsDevModelEntry, preferredLabs: string[]) {
  const labIndex = preferredLabs.indexOf(entry.providerId.toLowerCase())
  const labScore = labIndex >= 0 ? labIndex : preferredLabs.length + 1
  const firstPartyBoost = FIRST_PARTY_LABS.includes(
    entry.providerId.toLowerCase() as (typeof FIRST_PARTY_LABS)[number],
  )
    ? 0
    : 10
  return labScore + firstPartyBoost
}

function lookupExact(
  catalog: ModelsDevCatalog,
  lab: string,
  modelId: string,
): ModelsDevModelEntry | null {
  return (
    catalog.byProviderModel.get(modelsDevProviderModelKey(lab, modelId)) ??
    catalog.byProviderModel.get(modelsDevProviderModelKey(lab, modelsDevBareModelId(modelId))) ??
    null
  )
}

function collectMatches(
  catalog: ModelsDevCatalog,
  homeProvider: string,
  homeModel: string,
  aliases: ModelPriceImportAliasRule[],
): ModelsDevModelEntry[] {
  const preferredLabs = preferredLabsForHomeModel(homeProvider, homeModel)
  const candidates = aliasCandidates(homeModel, aliases)
  const found = new Map<string, ModelsDevModelEntry>()
  const aliasRank = new Map<string, number>()

  // Prefer the first alias that resolves under preferred labs. Stop there so
  // agent aliases like gemini-3-flash-agent map deterministically to one official model.
  for (const [aliasIndex, alias] of candidates.entries()) {
    const aliasHits: ModelsDevModelEntry[] = []
    for (const lab of preferredLabs) {
      const exact = lookupExact(catalog, lab, alias)
      if (!exact) continue
      if (
        !aliasHits.some(
          (item) => item.providerId === exact.providerId && item.modelId === exact.modelId,
        )
      ) {
        aliasHits.push(exact)
      }
    }
    if (aliasHits.length === 0) continue
    for (const exact of aliasHits) {
      const key = `${exact.providerId}::${exact.modelId}`
      found.set(key, exact)
      aliasRank.set(key, aliasIndex)
    }
    break
  }

  // bare model id index as fallback only when nothing matched preferred exact lookup
  if (found.size === 0) {
    for (const [aliasIndex, alias] of candidates.entries()) {
      const bare = modelsDevBareModelId(alias).toLowerCase()
      const allEntries = catalog.byModelId.get(bare) ?? []
      const directEntries = allEntries.filter(
        (entry) => !MARKETPLACE_PROVIDERS.has(entry.providerId.toLowerCase()),
      )
      const eligibleEntries =
        directEntries.length > 0 ? directEntries : allEntries.length > 1 ? allEntries : []
      for (const entry of eligibleEntries) {
        const key = `${entry.providerId}::${entry.modelId}`
        if (!found.has(key)) {
          found.set(key, entry)
          aliasRank.set(key, aliasIndex + 100)
        }
      }
    }
  }

  // normalized fuzzy over first-party only as last resort
  if (found.size === 0) {
    const wanted = new Set(candidates.map((item) => normalizeModelToken(item)))
    for (const entry of catalog.models) {
      if (
        !FIRST_PARTY_LABS.includes(
          entry.providerId.toLowerCase() as (typeof FIRST_PARTY_LABS)[number],
        )
      ) {
        continue
      }
      const token = normalizeModelToken(entry.modelId)
      if (!wanted.has(token)) continue
      const key = `${entry.providerId}::${entry.modelId}`
      found.set(key, entry)
      aliasRank.set(key, 1000)
    }
  }

  return [...found.values()].sort((left, right) => {
    const leftKey = `${left.providerId}::${left.modelId}`
    const rightKey = `${right.providerId}::${right.modelId}`
    return (
      (aliasRank.get(leftKey) ?? 9999) - (aliasRank.get(rightKey) ?? 9999) ||
      rankEntry(left, preferredLabs) - rankEntry(right, preferredLabs) ||
      left.providerId.localeCompare(right.providerId) ||
      left.modelId.localeCompare(right.modelId)
    )
  })
}

export function resolveImportMultiplier(
  homeModel: string,
  policy: ModelPriceImportPolicy,
  rowKey?: string,
) {
  if (rowKey && Number.isFinite(policy.rowMultipliers[rowKey])) {
    return Math.max(0, policy.rowMultipliers[rowKey])
  }
  const model = homeModel.trim().toLowerCase()
  for (const rule of policy.rules) {
    const pattern =
      rule.pattern?.trim() ??
      (rule as ModelPriceImportMultiplierRule & { modelPrefix?: string }).modelPrefix?.trim() ??
      ''
    if (!pattern) continue
    const matches =
      rule.matchMode === 'regex'
        ? (() => {
            try {
              return new RegExp(pattern, 'i').test(homeModel)
            } catch {
              return false
            }
          })()
        : model.startsWith(pattern.toLowerCase())
    if (matches) return Math.max(0, rule.multiplier)
  }
  return policy.defaultMultiplier
}

export function applyMultiplierToCost(
  cost: ModelsDevCost,
  multiplier: number,
  includeCachePrices: boolean,
): ModelsDevCost {
  const factor = Number.isFinite(multiplier) && multiplier >= 0 ? multiplier : 1
  return {
    input: cost.input * factor,
    output: cost.output * factor,
    cacheRead: includeCachePrices ? cost.cacheRead * factor : 0,
    cacheWrite: includeCachePrices ? cost.cacheWrite * factor : 0,
    cacheWriteConfigured: includeCachePrices && cost.cacheWriteConfigured,
    request: cost.request * factor,
  }
}

function isZeroCost(cost: ModelsDevCost) {
  return (
    cost.input === 0 &&
    cost.output === 0 &&
    cost.cacheRead === 0 &&
    cost.cacheWrite === 0 &&
    cost.request === 0
  )
}

function existingKey(provider: string, model: string) {
  return `${provider.trim().toLowerCase()}::${model.trim().toLowerCase()}`
}

function existingRuleKey(
  provider: string,
  model: string,
  serviceTier: string,
  minInputTokens: number,
) {
  return `${existingKey(provider, model)}::${serviceTier.trim().toLowerCase()}::${minInputTokens}`
}

export function buildModelPriceImportRows(input: {
  candidates: ModelPriceImportCandidate[]
  catalog: ModelsDevCatalog
  policy: ModelPriceImportPolicy
  existingRules?: ModelPriceImportExistingRule[]
  matchOverrides?: ModelPriceImportMatchOverride[]
}): ModelPriceImportRow[] {
  const existingByKey = new Map(
    (input.existingRules ?? []).map(
      (rule) =>
        [
          existingRuleKey(rule.provider, rule.model, rule.serviceTier, rule.minInputTokens),
          rule,
        ] as const,
    ),
  )

  return input.candidates.map((candidate) => {
    const homeProvider = candidate.provider.trim()
    const homeModel = candidate.model.trim()
    const key = existingKey(homeProvider, homeModel)
    const existing = existingByKey.get(existingRuleKey(homeProvider, homeModel, '*', 0)) ?? null
    const override = input.matchOverrides?.find(
      (item) =>
        item.targetProvider.trim().toLowerCase() === homeProvider.toLowerCase() &&
        item.targetModel.trim().toLowerCase() === homeModel.toLowerCase(),
    )
    const overrideMatch = override
      ? lookupExact(input.catalog, override.sourceProvider, override.sourceModel)
      : null
    const matches = overrideMatch
      ? [overrideMatch]
      : collectMatches(input.catalog, homeProvider, homeModel, input.policy.aliases)
    const multiplier = resolveImportMultiplier(homeModel, input.policy, key)
    const base = {
      key,
      homeProvider,
      homeModel,
      homeLabel: candidate.label?.trim() || homeModel,
      multiplier,
      existing,
    }

    if (matches.length === 0) {
      return {
        ...base,
        status: 'unmatched' as const,
        matchedProviderId: null,
        matchedModelId: null,
        matchedName: null,
        official: null,
        final: null,
        reasons: ['no_models_dev_match'],
      }
    }

    if (matches.length > 1) {
      const top = matches[0]
      const second = matches[1]
      const preferredLabs = preferredLabsForHomeModel(homeProvider, homeModel)
      const topPreferred = rankEntry(top, preferredLabs) < preferredLabs.length
      const secondPreferred = rankEntry(second, preferredLabs) < preferredLabs.length
      // Accept the first alias-priority match when it is uniquely preferred over the rest,
      // or when only the top entry is first-party preferred.
      const clearlyPreferred =
        rankEntry(top, preferredLabs) < rankEntry(second, preferredLabs) ||
        (topPreferred && !secondPreferred)

      if (clearlyPreferred && top.cost) {
        if (top.invalidPriceFields.length > 0) {
          return {
            ...base,
            status: 'invalid' as const,
            matchedProviderId: top.providerId,
            matchedModelId: top.modelId,
            matchedName: top.name,
            official: null,
            final: null,
            reasons: ['invalid_price_values'],
          }
        }
        if (top.unsupportedPriceDimensions.length > 0) {
          return {
            ...base,
            status: 'unsupported' as const,
            matchedProviderId: top.providerId,
            matchedModelId: top.modelId,
            matchedName: top.name,
            official: top.cost,
            final: null,
            reasons: ['unsupported_price_dimensions'],
          }
        }
        const final = applyMultiplierToCost(top.cost, multiplier, input.policy.includeCachePrices)
        const zero = isZeroCost(top.cost)
        const finalZero = isZeroCost(final)
        if (finalZero && !input.policy.includeZeroCost) {
          return {
            ...base,
            status: 'zero_cost' as const,
            matchedProviderId: top.providerId,
            matchedModelId: top.modelId,
            matchedName: top.name,
            official: top.cost,
            final: null,
            reasons: [zero ? 'zero_official_cost' : 'zero_final_cost'],
          }
        }
        return {
          ...base,
          status: finalZero ? ('zero_cost' as const) : ('matched' as const),
          matchedProviderId: top.providerId,
          matchedModelId: top.modelId,
          matchedName: top.name,
          official: top.cost,
          final,
          reasons: zero
            ? ['zero_official_cost']
            : finalZero
              ? ['zero_final_cost']
              : ['matched_preferred_alias'],
        }
      }

      return {
        ...base,
        status: 'ambiguous' as const,
        matchedProviderId: top.providerId,
        matchedModelId: top.modelId,
        matchedName: top.name,
        official: top.cost,
        final: null,
        reasons: [
          'multiple_matches',
          ...matches.slice(0, 5).map((item) => `${item.providerId}/${item.modelId}`),
        ],
      }
    }

    const only = matches[0]
    if (only.invalidPriceFields.length > 0) {
      return {
        ...base,
        status: 'invalid' as const,
        matchedProviderId: only.providerId,
        matchedModelId: only.modelId,
        matchedName: only.name,
        official: null,
        final: null,
        reasons: ['invalid_price_values'],
      }
    }
    if (only.unsupportedPriceDimensions.length > 0) {
      return {
        ...base,
        status: 'unsupported' as const,
        matchedProviderId: only.providerId,
        matchedModelId: only.modelId,
        matchedName: only.name,
        official: only.cost,
        final: null,
        reasons: ['unsupported_price_dimensions'],
      }
    }
    if (!only.cost) {
      return {
        ...base,
        status: 'unmatched' as const,
        matchedProviderId: only.providerId,
        matchedModelId: only.modelId,
        matchedName: only.name,
        official: null,
        final: null,
        reasons: ['missing_cost'],
      }
    }

    const final = applyMultiplierToCost(only.cost, multiplier, input.policy.includeCachePrices)
    const zero = isZeroCost(only.cost)
    const finalZero = isZeroCost(final)
    if (finalZero && !input.policy.includeZeroCost) {
      return {
        ...base,
        status: 'zero_cost' as const,
        matchedProviderId: only.providerId,
        matchedModelId: only.modelId,
        matchedName: only.name,
        official: only.cost,
        final: null,
        reasons: [zero ? 'zero_official_cost' : 'zero_final_cost'],
      }
    }

    return {
      ...base,
      status: finalZero ? ('zero_cost' as const) : ('matched' as const),
      matchedProviderId: only.providerId,
      matchedModelId: only.modelId,
      matchedName: only.name,
      official: only.cost,
      final,
      reasons: zero ? ['zero_official_cost'] : finalZero ? ['zero_final_cost'] : ['matched'],
    }
  })
}

export function isImportRowSelectable(row: ModelPriceImportRow) {
  return Boolean(row.final) && (row.status === 'matched' || row.status === 'zero_cost')
}

export function isModelPriceImportRowApplicable(
  row: ModelPriceImportRow,
  overwriteMode: ModelPriceImportOverwriteMode,
) {
  if (!isImportRowSelectable(row) || !row.final) return false
  if (!row.existing) return true
  if (overwriteMode === 'missing') return false
  if (overwriteMode === 'sync') return row.existing.source === 'sync'
  return true
}

export function getModelPriceImportRowAction(
  row: ModelPriceImportRow,
  overwriteMode: ModelPriceImportOverwriteMode,
): ModelPriceImportAction {
  if (!isModelPriceImportRowApplicable(row, overwriteMode)) {
    return row.status === 'ambiguous' ||
      row.status === 'unmatched' ||
      row.status === 'invalid' ||
      row.status === 'unsupported'
      ? 'review'
      : 'skip'
  }
  if (!row.existing) return 'create'
  return row.existing.source === 'sync' ? 'update_sync' : 'overwrite'
}

export function buildImportNote(row: ModelPriceImportRow, fetchedAt: string) {
  const source =
    row.matchedProviderId && row.matchedModelId
      ? `${row.matchedProviderId}/${row.matchedModelId}`
      : 'unknown'
  return `synced from models.dev (${source}) x${row.multiplier} @ ${fetchedAt.slice(0, 10)}; manual confirmation required`
}
