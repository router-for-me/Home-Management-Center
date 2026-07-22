import type { TFunction } from 'i18next'

import type { QuotaWindow } from '@/lib/api/management/quota'

export function getUpstreamQuotaWindowIdentityLabel(window: QuotaWindow) {
  const label = window.label?.trim()
  if (!label) return null
  const scopeId = window.scopeId?.trim().toLowerCase()
  return window.id.startsWith('codex-') || scopeId?.startsWith('codex_') ? label : null
}

export function getUpstreamQuotaWindowDisplayLabel(
  window: QuotaWindow,
  t: TFunction,
  locale?: string,
) {
  if (window.periodUnit === 'unknown' || !window.periodValue || window.periodValue <= 0) {
    return window.label ?? t('upstreamPage.quota.window.unknownPeriod')
  }

  if (
    window.periodValue === 1 &&
    (window.periodUnit === 'day' || window.periodUnit === 'week' || window.periodUnit === 'month')
  ) {
    return t(`upstreamPage.quota.window.period.${window.periodUnit}`)
  }

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: window.periodUnit,
    unitDisplay: 'long',
    maximumFractionDigits: 2,
  }).format(window.periodValue)
}
