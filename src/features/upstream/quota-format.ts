import type { TFunction } from 'i18next'

import type { QuotaWindow } from '@/lib/api/management/quota'

export function getUpstreamQuotaWindowIdentityLabel(window: QuotaWindow, t: TFunction) {
  const label = window.label?.trim()
  if (!label) return null
  const scopeId = window.scopeId?.trim().toLowerCase()
  if (!window.id.startsWith('codex-') && !scopeId?.startsWith('codex_')) return null
  return label.toLowerCase() === 'usage' ? t('upstreamPage.quota.window.labels.usage') : label
}

export function getUpstreamQuotaWindowDisplayLabel(
  window: QuotaWindow,
  t: TFunction,
  locale?: string,
) {
  if (window.periodUnit === 'unknown' || !window.periodValue || window.periodValue <= 0) {
    return window.label ?? t('upstreamPage.quota.window.unknownPeriod')
  }

  const periodUnit =
    window.periodUnit === 'minute' && Number.isInteger(window.periodValue / 60)
      ? 'hour'
      : window.periodUnit
  const periodValue =
    periodUnit === 'hour' && window.periodUnit === 'minute'
      ? window.periodValue / 60
      : window.periodValue

  if (
    periodValue === 1 &&
    (periodUnit === 'day' || periodUnit === 'week' || periodUnit === 'month')
  ) {
    return t(`upstreamPage.quota.window.period.${periodUnit}`)
  }

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: periodUnit,
    unitDisplay: 'long',
    maximumFractionDigits: 2,
  }).format(periodValue)
}
