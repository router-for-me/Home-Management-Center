import type { QuotaCredential, QuotaWindow } from '@/lib/api/management/quota'

import { groupAntigravityQuotaWindows, resolveQuotaSnapshotDisplay } from './upstream-quota-model'

type PreviewGroup = {
  id: string
  antigravityId?: 'gemini' | 'third-party'
  representative: QuotaWindow
  windows: QuotaWindow[]
}

type PreviewPeriod = Pick<QuotaWindow, 'id' | 'label' | 'periodUnit' | 'periodValue'>

function familyKey(window: QuotaWindow) {
  if (window.scope === 'unknown') return window.id
  return `${window.scope}:${window.scopeId ?? (window.scope === 'model' ? (window.label ?? window.id) : '')}`
}

function normalizedPeriod(window: PreviewPeriod) {
  if (window.periodUnit === 'unknown' || !window.periodValue) return null
  return window.periodUnit === 'minute' && window.periodValue % 60 === 0
    ? { unit: 'hour' as const, value: window.periodValue / 60 }
    : { unit: window.periodUnit, value: window.periodValue }
}

function periodKey(window: PreviewPeriod) {
  const period = normalizedPeriod(window)
  return period ? `${period.unit}:${period.value}` : null
}

function periodOrder(window: PreviewPeriod) {
  const period = normalizedPeriod(window)
  if (period?.unit === 'hour' && period.value === 5) return 0
  if (period?.unit === 'week' && period.value === 1) return 1
  return 2
}

export function buildQuotaPreviewGrid(entry: QuotaCredential) {
  const windows = [
    ...new Map([...entry.primaryWindows, ...entry.windows].map((w) => [w.id, w])).values(),
  ]
  let groups: PreviewGroup[]
  if (entry.provider.trim().toLowerCase() === 'antigravity') {
    groups = groupAntigravityQuotaWindows(windows).map((group) => ({
      id: group.id,
      antigravityId: group.id,
      representative: group.windows[0],
      windows: group.windows,
    }))
  } else {
    if (windows.some((window) => window.scope === 'unknown')) return null
    const representatives = new Map<string, QuotaWindow>()
    for (const window of entry.primaryWindows.length ? entry.primaryWindows : entry.windows) {
      if (!representatives.has(familyKey(window))) representatives.set(familyKey(window), window)
    }
    groups = [...representatives].slice(0, 2).map(([id, representative]) => ({
      id,
      representative,
      windows: windows.filter((window) => familyKey(window) === id),
    }))
  }
  const periods: PreviewPeriod[] = [
    ...new Map(
      groups
        .flatMap((g) => g.windows)
        .filter((w) => periodKey(w))
        .map((w) => [periodKey(w)!, w]),
    ).values(),
  ]
  const selectedPeriods = periods
    .sort((left, right) => periodOrder(left) - periodOrder(right))
    .slice(0, 2)
  if (!groups.length || !periods.length) return null
  return {
    periods: selectedPeriods,
    groups: groups.slice(0, 2).map((group) => ({
      ...group,
      values: selectedPeriods.map(
        (period) => group.windows.find((window) => periodKey(window) === periodKey(period)) ?? null,
      ),
    })),
  }
}

export function needsQuotaPreviewDetail(entry: QuotaCredential) {
  return (
    entry.status !== 'unsupported' &&
    resolveQuotaSnapshotDisplay(entry).hasWindows &&
    entry.windowCount > new Set([...entry.primaryWindows, ...entry.windows].map((w) => w.id)).size
  )
}

export function resolveQuotaPreviewEntry(entry: QuotaCredential, detail: QuotaCredential | null) {
  if (
    !detail ||
    detail.id !== entry.id ||
    detail.provider !== entry.provider ||
    detail.credentialType !== entry.credentialType
  )
    return entry
  for (const field of ['observedAt', 'lastAttemptAt'] as const) {
    if (
      entry[field] &&
      (!detail[field] ||
        !Number.isFinite(Date.parse(detail[field])) ||
        Date.parse(detail[field]) < Date.parse(entry[field]))
    )
      return entry
  }
  if (
    entry.lastAttemptAt === detail.lastAttemptAt &&
    entry.collectionStatus !== 'collecting' &&
    detail.collectionStatus === 'collecting'
  )
    return entry
  if (entry.observedAt === detail.observedAt && entry.lastAttemptAt === detail.lastAttemptAt) {
    const base = entry.collectionStatus === 'collecting' ? detail : entry
    return {
      ...base,
      windows: detail.windows,
      resetCredits: detail.resetCredits,
      freshness:
        entry.freshness === 'stale' || detail.freshness === 'stale' ? 'stale' : base.freshness,
    }
  }
  return detail
}

export function getQuotaNextReset(entry: QuotaCredential) {
  if (entry.earliestResetAt && Number.isFinite(Date.parse(entry.earliestResetAt)))
    return entry.earliestResetAt
  return (
    [...entry.primaryWindows, ...entry.windows]
      .map((window) => window.resetAt)
      .filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)))
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null
  )
}
