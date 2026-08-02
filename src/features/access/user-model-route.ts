import type { UserModelSort } from './user-model-format'

/**
 * The catalog's filter and sort state lives in the URL rather than in component
 * state, so a filtered view survives a reload, a back button, and being pasted
 * into a chat message. Every value is optional: an unfiltered catalog carries no
 * query string at all.
 */
export type UserModelRouteSearch = {
  q?: string
  provider?: string
  modality?: string
  caps?: string
  mine?: true
  sort?: Exclude<UserModelSort, 'name'>
}

export type UserModelCapabilityFilter = 'tools' | 'structuredOutput' | 'reasoning'

// Canonical order, so two URLs that select the same capabilities are the same
// string and the toolbar never reorders itself as a buyer toggles chips.
const capabilityFilterOrder: UserModelCapabilityFilter[] = [
  'tools',
  'structuredOutput',
  'reasoning',
]

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Reads capability filters from either a comma-joined query value or an array,
 * dropping anything this page cannot actually filter on. An unrecognised value
 * is discarded rather than passed through: a filter the catalog cannot apply
 * would silently show an unfiltered list while the URL claimed otherwise.
 */
export function normalizeCapabilityFilters(value: unknown): UserModelCapabilityFilter[] {
  const raw = Array.isArray(value) ? value : readString(value).split(',')
  const requested = new Set(raw.map((entry) => readString(entry)))

  return capabilityFilterOrder.filter((filter) => requested.has(filter))
}

/** The query-string spelling of a capability selection, or nothing when empty. */
export function capabilityFiltersToParam(value: unknown): string | undefined {
  const filters = normalizeCapabilityFilters(value)
  return filters.length > 0 ? filters.join(',') : undefined
}

export function normalizeUserModelRouteSearch(
  search: Record<string, unknown>,
): UserModelRouteSearch {
  const normalized: UserModelRouteSearch = {}

  const query = readString(search.q)
  if (query) normalized.q = query

  const provider = readString(search.provider)
  if (provider) normalized.provider = provider

  // Modalities are lower-cased by the server before they reach the client, so a
  // hand-typed `?modality=Image` still matches the catalog.
  const modality = readString(search.modality).toLowerCase()
  if (modality) normalized.modality = modality

  const caps = capabilityFiltersToParam(search.caps)
  if (caps) normalized.caps = caps

  if (search.mine === true || readString(search.mine).toLowerCase() === 'true') {
    normalized.mine = true
  }

  // `name` is the default order and is deliberately absent from the URL, so the
  // unsorted and the explicitly-name-sorted catalog share one address.
  const sort = readString(search.sort).toLowerCase()
  if (sort === 'price-asc' || sort === 'price-desc') normalized.sort = sort

  return normalized
}
