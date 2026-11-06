import type { ReactElement, ReactNode } from 'react'

import { useTranslation } from 'react-i18next'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { QuotaWindow } from '@/lib/api/management/quota'

export function QuotaTooltip({
  children,
  content,
}: {
  children: ReactElement
  content: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild className="cursor-pointer">
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={4}
        collisionPadding={12}
        className="max-h-[calc(100dvh-2rem)] max-w-[min(24rem,calc(100vw-2rem))] overflow-y-auto text-left text-pretty wrap-anywhere whitespace-normal"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export function QuotaWindowTooltip({
  window,
  label,
  children,
}: {
  window: QuotaWindow
  label: string
  children: ReactElement
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const formatTime = (value: string | null) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(
          new Date(value),
        )
      : t('upstreamPage.quota.common.notAvailable')
  const remaining = window.isUnlimited
    ? t('upstreamPage.quota.summary.unlimited')
    : window.remainingRatio === null
      ? t('upstreamPage.quota.common.notAvailable')
      : `${Math.round(window.remainingRatio * 100)}%`
  return (
    <QuotaTooltip
      content={
        <div className="grid gap-1.5">
          <p className="font-medium">{label}</p>
          <p>
            {t('upstreamPage.quota.remaining')}: {remaining}
          </p>
          <p>
            {t('upstreamPage.quota.window.resetAt')}: {formatTime(window.resetAt)}
          </p>
          <p>
            {t('upstreamPage.quota.window.observedAt')}: {formatTime(window.observedAt)}
          </p>
        </div>
      }
    >
      {children}
    </QuotaTooltip>
  )
}
