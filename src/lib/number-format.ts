const COMPACT_THRESHOLD = 10_000

// Mirrors the document language kept in sync by src/lib/i18n/i18n.ts so
// formatting follows the console UI language instead of the browser locale.
export function getNumberLocale() {
  if (typeof document === 'undefined') return undefined
  const language = document.documentElement.lang?.trim()
  return language || undefined
}

export function formatNumber(value: number, locale = getNumberLocale()) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

// Large magnitudes (tokens, requests) always use the international K/M/B/T
// suffixes rather than locale-specific unit words such as 万/亿 or тыс./млн;
// only grouping of full-precision numbers stays locale-aware.
export function formatCompactNumber(value: number, locale = getNumberLocale()) {
  if (Math.abs(value) >= COMPACT_THRESHOLD) {
    return new Intl.NumberFormat('en', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value)
}
