import type { TFunction } from 'i18next'

import type { QuotaCredential, QuotaWindow } from '@/lib/api/management/quota'

export function getUpstreamQuotaWindowIdentityLabel(window: QuotaWindow, t: TFunction) {
  const label = window.label?.trim()
  if (!label) return null
  const scopeId = window.scopeId?.trim().toLowerCase()
  if (window.scope !== 'model' && !window.id.startsWith('codex-') && !scopeId?.startsWith('codex_'))
    return null
  return label.toLowerCase() === 'usage' ? t('upstreamPage.quota.window.labels.usage') : label
}

export function getUpstreamQuotaWindowDisplayLabel(
  window: Pick<QuotaWindow, 'label' | 'periodUnit' | 'periodValue'>,
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

export function formatQuotaPeriodCompact(
  window: Pick<QuotaWindow, 'label' | 'periodUnit' | 'periodValue'>,
  locale?: string,
) {
  if (window.periodUnit === 'unknown' || !window.periodValue) return window.label ?? '—'
  const hours = window.periodUnit === 'minute' && window.periodValue % 60 === 0
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: hours ? 'hour' : window.periodUnit,
    unitDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(hours ? window.periodValue / 60 : window.periodValue)
}

export function getUpstreamQuotaErrorSummary(
  entry: Pick<QuotaCredential, 'lastError'>,
  t: TFunction,
) {
  const error = entry.lastError
  const key =
    error?.code === 'UPSTREAM_AUTH_REJECTED' ||
    error?.upstreamStatusCode === 401 ||
    error?.upstreamStatusCode === 403
      ? 'authorization'
      : error?.code === 'UPSTREAM_RATE_LIMITED' || error?.upstreamStatusCode === 429
        ? 'rateLimited'
        : error?.code === 'UPSTREAM_CLIENT_OUTDATED' || error?.upstreamStatusCode === 426
          ? 'clientOutdated'
          : error?.code === 'UPSTREAM_RESPONSE_INVALID'
            ? 'invalidResponse'
            : error?.code === 'AUTH_TOKEN_UNAVAILABLE'
              ? 'missingToken'
              : error?.code === 'DCA_TOKEN_UNAVAILABLE'
                ? 'missingAuthorization'
                : error?.code === 'UPSTREAM_UNAVAILABLE'
                  ? 'unavailable'
                  : 'unknown'
  return {
    title: t(`upstreamPage.quota.errors.${key}.title`),
    description: t(`upstreamPage.quota.errors.${key}.description`),
  }
}

export function formatUpstreamQuotaRelativeTime(
  timestampMs: number,
  locale?: string,
  nowMs = Date.now(),
) {
  const diffSeconds = Math.round((timestampMs - nowMs) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })

  if (absSeconds < 60) {
    return rtf.format(diffSeconds, 'second')
  }
  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute')
  }
  const diffHours = Math.round(diffSeconds / 3600)
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }
  const diffDays = Math.round(diffSeconds / 86400)
  return rtf.format(diffDays, 'day')
}
