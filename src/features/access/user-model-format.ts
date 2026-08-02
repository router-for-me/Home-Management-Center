import type {
  UserModel,
  UserModelCapabilityStatus,
  UserModelPriceRung,
  UserModelPriceTier,
  UserModelPricing,
} from '@/lib/api/user/models'

/**
 * The label a buyer reads. Falls back to the literal ID rather than to any
 * prettified guess: an ID the cluster never gave a name to is still the exact
 * string that has to go into a request body.
 */
export function modelDisplayName(model: UserModel) {
  return model.displayName ?? model.id
}

/** Badge variants carry the three states verbatim; nothing is collapsed here. */
export function capabilityBadgeVariant(status: UserModelCapabilityStatus) {
  return status
}

export function formatCompactTokens(value: number | null, locale?: string) {
  if (value === null) return null

  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatExactNumber(value: number | null, locale?: string) {
  if (value === null) return null
  return new Intl.NumberFormat(locale).format(value)
}

export function formatPercent(value: number | null, locale?: string) {
  if (value === null) return null

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatMilliseconds(value: number | null, locale?: string) {
  if (value === null) return null

  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

export function formatThroughput(value: number | null, locale?: string) {
  if (value === null) return null

  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

export function formatTimestamp(value: string | null, locale?: string) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/**
 * The tier a request lands on when it names none, falling back to the first
 * tier the server listed. Never a synthesised "average" tier.
 */
export function preferredTier(tiers: UserModelPriceTier[]): UserModelPriceTier | null {
  if (tiers.length === 0) return null
  return tiers.find((tier) => tier.isDefault) ?? tiers[0]
}

/** The rung a request starts on: the one with the lowest input threshold. */
export function baseRung(rungs: UserModelPriceRung[]): UserModelPriceRung | null {
  if (rungs.length === 0) return null

  return rungs.reduce(
    (lowest, rung) => (rung.minInputTokens < lowest.minInputTokens ? rung : lowest),
    rungs[0],
  )
}

/**
 * The card-level read of a price ladder.
 *
 * `input` / `output` are the cheapest published entry rung across providers, so
 * they are an opening price and must be labelled as one. `tiered` says whether
 * that number is the whole story or only the first step of a ladder — a buyer
 * who is shown one number for a laddered price has been misinformed.
 */
export type PriceEntryPoint = {
  input: number | null
  output: number | null
  tiered: boolean
  maxRungCount: number
  providerCount: number
  serviceTiers: string[]
}

function lowest(current: number | null, candidate: number | null) {
  if (candidate === null) return current
  if (current === null) return candidate
  return Math.min(current, candidate)
}

export function pricingEntryPoint(pricing: UserModelPricing | null): PriceEntryPoint | null {
  if (!pricing || pricing.status !== 'published' || pricing.providers.length === 0) return null

  let input: number | null = null
  let output: number | null = null
  let maxRungCount = 0
  const serviceTiers = new Set<string>()

  for (const provider of pricing.providers) {
    for (const tier of provider.tiers) {
      serviceTiers.add(tier.serviceTier)
      maxRungCount = Math.max(maxRungCount, tier.rungs.length)
    }

    const tier = preferredTier(provider.tiers)
    const rung = tier ? baseRung(tier.rungs) : null
    if (!rung) continue

    input = lowest(input, rung.inputPricePerMillion)
    output = lowest(output, rung.outputPricePerMillion)
  }

  if (input === null && output === null && maxRungCount === 0) return null

  return {
    input,
    output,
    tiered: maxRungCount > 1,
    maxRungCount,
    providerCount: pricing.providers.length,
    serviceTiers: [...serviceTiers],
  }
}

/** Every provider ID mentioned by a catalog, de-duplicated and sorted. */
export function collectProviders(models: UserModel[]) {
  const providers = new Set<string>()
  for (const model of models) {
    for (const provider of model.providers) providers.add(provider)
  }
  return [...providers].sort((left, right) => left.localeCompare(right))
}
