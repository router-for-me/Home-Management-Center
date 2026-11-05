import { useTranslation } from 'react-i18next'

import { OverflowTooltipText } from '@/components/shared/overflow-tooltip-text'
import {
  formatQuotaPeriodCompact,
  getUpstreamQuotaWindowDisplayLabel,
  getUpstreamQuotaWindowIdentityLabel,
} from '@/features/upstream/quota-format'
import type { QuotaStatus } from '@/lib/api/management/quota'
import { cn } from '@/lib/utils'

import type { buildQuotaPreviewGrid } from './quota-preview-model'
import { QuotaTooltip, QuotaWindowTooltip } from './quota-tooltip'

export function QuotaPreviewGrid({
  grid,
  historical,
  progressClassNames,
}: {
  grid: NonNullable<ReturnType<typeof buildQuotaPreviewGrid>>
  historical: boolean
  progressClassNames: Record<QuotaStatus, string>
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const columns =
    grid.periods.length === 2
      ? 'grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]'
      : 'grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]'
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className={`text-muted-foreground text-meta grid min-w-0 items-center gap-2 ${columns}`}>
        <span className="min-w-0 truncate">{t('upstreamPage.quota.summary.scope')}</span>
        {grid.periods.map((period) => (
          <QuotaTooltip
            key={period.id}
            content={getUpstreamQuotaWindowDisplayLabel(period, t, locale)}
          >
            <span className="min-w-0 truncate text-right">
              {formatQuotaPeriodCompact(period, locale)}
            </span>
          </QuotaTooltip>
        ))}
      </div>
      {grid.groups.map((group) => {
        const window = group.representative
        const groupLabel = group.antigravityId
          ? t(
              `upstreamPage.quota.antigravity.${group.antigravityId === 'gemini' ? 'gemini' : 'thirdParty'}`,
            )
          : window.scope === 'model'
            ? (getUpstreamQuotaWindowIdentityLabel(window, t) ??
              window.scopeId ??
              t('upstreamPage.quota.summary.scope'))
            : window.scope === 'account'
              ? t('upstreamPage.quota.summary.account')
              : (window.scopeId ?? t('upstreamPage.quota.summary.scope'))
        return (
          <div key={group.id} className={cn('grid min-w-0 items-center gap-2', columns)}>
            <OverflowTooltipText
              value={groupLabel}
              overflowClassName="cursor-pointer"
              className="text-meta font-medium"
              tooltipClassName="max-w-[min(24rem,calc(100vw-2rem))] whitespace-normal wrap-anywhere"
            />
            {group.values.map((value, index) => {
              const period = getUpstreamQuotaWindowDisplayLabel(grid.periods[index], t, locale)
              if (!value)
                return (
                  <QuotaTooltip
                    key={index}
                    content={t('upstreamPage.quota.summary.periodUnavailable', {
                      group: groupLabel,
                      period,
                    })}
                  >
                    <span className="text-muted-foreground text-right text-xs">—</span>
                  </QuotaTooltip>
                )
              const percentage =
                value.remainingRatio === null ? null : Math.round(value.remainingRatio * 100)
              const remaining = value.isUnlimited
                ? '∞'
                : percentage === null
                  ? '—'
                  : `${percentage}%`
              const label = `${groupLabel}, ${period}: ${t('upstreamPage.quota.remaining')}`
              return (
                <QuotaWindowTooltip
                  key={value.id}
                  window={value}
                  label={`${groupLabel}, ${period}`}
                >
                  <div className="grid min-w-0 gap-0.5">
                    <span
                      className={cn(
                        'min-w-0 text-right text-xs font-medium tabular-nums',
                        value.status === 'low'
                          ? 'text-warning-foreground dark:text-warning'
                          : value.status === 'exhausted'
                            ? 'text-destructive'
                            : undefined,
                      )}
                    >
                      {remaining}
                    </span>
                    <div
                      className="bg-muted h-1 overflow-hidden rounded-full"
                      role="progressbar"
                      aria-label={label}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={value.isUnlimited ? undefined : (percentage ?? undefined)}
                      aria-valuetext={
                        value.isUnlimited
                          ? t('upstreamPage.quota.summary.unlimited')
                          : percentage === null
                            ? t('upstreamPage.quota.common.notAvailable')
                            : undefined
                      }
                      aria-description={
                        historical ? t('upstreamPage.quota.summary.historicalHint') : undefined
                      }
                    >
                      {percentage !== null || value.isUnlimited ? (
                        <div
                          className={cn('h-full rounded-full', progressClassNames[value.status])}
                          style={{ width: `${value.isUnlimited ? 100 : percentage}%` }}
                        />
                      ) : null}
                    </div>
                  </div>
                </QuotaWindowTooltip>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
