export const uiPreferenceKeys = {
  sidebarOpen: 'hmc:ui:sidebar-open',
  technicalTextWrap: 'hmc:ui:technical-text-wrap',
  requestEventColumns: 'hmc:request-events:columns',
  requestEventPageSize: 'hmc:request-events:page-size',
  usageRankingColumns: 'hmc:usage-observability:ranking-columns',
  usageRecordColumns: 'hmc:usage-observability:record-columns',
  usageRecordPageSize: 'hmc:usage-observability:record-page-size',
  credentialUsageColumns: 'hmc:usage-observability:credential-columns',
  credentialUsagePageSize: 'hmc:usage-observability:credential-page-size',
  usageTrendOverlayMetric: 'hmc:usage-observability:trend-overlay-metric',
  runtimeLogPageSize: 'hmc:logs:runtime-page-size',
  requestLogPageSize: 'hmc:logs:request-page-size',
  billingChargePageSize: 'hmc:billing:charge-page-size',
  billingBalancePageSize: 'hmc:billing:balance-page-size',
  userBillingPageSize: 'hmc:user-billing:page-size',
} as const

const PREFERENCE_VERSION = 1

export type PreferenceNormalizer<T> = (value: unknown) => T | undefined

export type PreferenceStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function normalizeBooleanPreference(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

export function createChoicePreferenceNormalizer<const T extends string | number>(
  choices: readonly T[],
): PreferenceNormalizer<T> {
  return (value) => choices.find((choice) => Object.is(choice, value))
}

export function decodePreference<T>(
  raw: string | null,
  fallback: T,
  normalize: PreferenceNormalizer<T>,
) {
  if (raw === null) return fallback

  try {
    const parsed: unknown = JSON.parse(raw)
    let value = parsed

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'version' in parsed) {
      const envelope = parsed as { version?: unknown; value?: unknown }
      if (envelope.version !== PREFERENCE_VERSION) return fallback
      value = envelope.value
    }

    return normalize(value) ?? fallback
  } catch {
    return fallback
  }
}

export function readPreference<T>(
  storage: PreferenceStorage | null,
  key: string,
  fallback: T,
  normalize: PreferenceNormalizer<T>,
) {
  if (!storage) return fallback

  try {
    return decodePreference(storage.getItem(key), fallback, normalize)
  } catch {
    return fallback
  }
}

export function writePreference<T>(storage: PreferenceStorage | null, key: string, value: T) {
  if (!storage) return false

  try {
    storage.setItem(key, JSON.stringify({ version: PREFERENCE_VERSION, value }))
    return true
  } catch {
    return false
  }
}

export function getBrowserLocalStorage(): PreferenceStorage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}
