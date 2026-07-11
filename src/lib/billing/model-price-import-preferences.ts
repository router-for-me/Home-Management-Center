import { z } from 'zod'

import type {
  ModelPriceImportOverwriteMode,
  ModelPriceImportPolicy,
  ModelPriceImportTargetFilter,
} from './model-price-import-types'
import { createDefaultImportPolicy } from './models-dev-match'

const STORAGE_PREFIX = 'hmc.billing.model-price-import.preferences:'

const ruleSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  matchMode: z.enum(['prefix', 'regex']),
  pattern: z.string(),
  multiplier: z.number().positive(),
})

const aliasSchema = z.object({
  id: z.string().min(1),
  targetModel: z.string(),
  sourceModels: z.array(z.string()),
})

const preferencesSchema = z.object({
  version: z.literal(1),
  policy: z.object({
    defaultMultiplier: z.number().positive(),
    rules: z.array(ruleSchema),
    aliases: z.array(aliasSchema),
    includeCachePrices: z.boolean(),
    includeZeroCost: z.boolean(),
  }),
  overwriteMode: z.enum(['missing', 'sync', 'all']),
  targetFilter: z.enum(['all', 'missing', 'synced', 'selected']),
})

export type ModelPriceImportPreferences = {
  policy: ModelPriceImportPolicy
  overwriteMode: ModelPriceImportOverwriteMode
  targetFilter: ModelPriceImportTargetFilter
}

function storageKey(scope: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(scope)}`
}

export function createDefaultModelPriceImportPreferences(): ModelPriceImportPreferences {
  return {
    policy: createDefaultImportPolicy(),
    overwriteMode: 'missing',
    targetFilter: 'all',
  }
}

export function readModelPriceImportPreferences(scope: string): ModelPriceImportPreferences {
  const fallback = createDefaultModelPriceImportPreferences()
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(storageKey(scope))
    if (!raw) return fallback
    const parsed = preferencesSchema.parse(JSON.parse(raw))
    return {
      overwriteMode: parsed.overwriteMode,
      targetFilter: parsed.targetFilter,
      policy: {
        ...parsed.policy,
        rowMultipliers: {},
      },
    }
  } catch {
    return fallback
  }
}

export function writeModelPriceImportPreferences(
  scope: string,
  preferences: ModelPriceImportPreferences,
) {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(
      storageKey(scope),
      JSON.stringify({
        version: 1,
        overwriteMode: preferences.overwriteMode,
        targetFilter: preferences.targetFilter,
        policy: {
          defaultMultiplier: preferences.policy.defaultMultiplier,
          rules: preferences.policy.rules,
          aliases: preferences.policy.aliases,
          includeCachePrices: preferences.policy.includeCachePrices,
          includeZeroCost: preferences.policy.includeZeroCost,
        },
      }),
    )
    return true
  } catch {
    return false
  }
}
