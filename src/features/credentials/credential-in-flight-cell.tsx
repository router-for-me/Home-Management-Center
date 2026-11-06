import { Activity, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  CredentialInFlightSummary,
  CredentialResource,
} from '@/lib/api/management/credentials'

export type CredentialInFlightAvailability = {
  available: boolean
  pending: boolean
  stale: boolean
  errorMessage: string | null
}

function formatLimit(limit: number | null | undefined) {
  return typeof limit === 'number' && limit > 0 ? String(limit) : '∞'
}

export function CredentialInFlightCell({
  resource,
  summary,
  availability,
  onInspect,
}: {
  resource: CredentialResource
  summary: CredentialInFlightSummary | null
  availability: CredentialInFlightAvailability
  onInspect: () => void
}) {
  const { t } = useTranslation()
  if (!availability.available) {
    return (
      <span
        className="text-muted-foreground text-meta block truncate"
        title={t('credentialsPage.concurrency.cellUnsupported')}
      >
        {t('credentialsPage.concurrency.cellUnsupported')}
      </span>
    )
  }
  if (availability.pending && !summary) {
    return (
      <Skeleton
        className="h-7 w-16"
        role="status"
        aria-label={t('credentialsPage.concurrency.cellLoading')}
      />
    )
  }

  const counts = [summary?.observedInFlight, summary?.admittedInFlight].filter(
    (value): value is number => typeof value === 'number',
  )
  const known = counts.length > 0
  const stale =
    known &&
    (availability.pending ||
      availability.stale ||
      Boolean(availability.errorMessage) ||
      Boolean(
        summary?.observed &&
        (summary.observed.stale ||
          !summary.observed.coverageComplete ||
          !summary.observed.aggregatesComplete),
      ))
  const stateLabel = !known
    ? t(
        availability.errorMessage
          ? 'credentialsPage.concurrency.cellUnavailable'
          : 'credentialsPage.concurrency.cellUnknown',
      )
    : stale
      ? t('credentialsPage.concurrency.cellStale')
      : null
  const totalLabel = known
    ? `${Math.max(...counts)}/${formatLimit(summary?.maxInFlight ?? resource.maxInFlight)}`
    : '—'
  const saturated = summary?.totalSaturated || (summary?.saturatedModelCount ?? 0) > 0
  const StatusIcon =
    stale || availability.errorMessage || saturated ? AlertTriangle : known ? Activity : null
  const activeModels = (summary?.models ?? [])
    .map((item) => ({
      ...item,
      count: Math.max(item.observedInFlight ?? 0, item.admittedInFlight ?? 0),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model))

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="text"
          size="sm"
          className="max-w-full min-w-0 cursor-pointer justify-start tabular-nums"
          aria-label={`${t('credentialsPage.list.inFlight')}: ${stateLabel ?? totalLabel}`}
          onClick={(event) => {
            event.stopPropagation()
            onInspect()
          }}
        >
          <span className="min-w-0 truncate font-mono">{totalLabel}</span>
          {StatusIcon ? (
            <StatusIcon
              className={
                stale || availability.errorMessage || saturated
                  ? 'text-warning-foreground dark:text-warning'
                  : undefined
              }
              aria-hidden="true"
            />
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="grid max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] min-w-48 gap-1 overflow-y-auto px-3 py-2 whitespace-normal"
      >
        <p className="font-semibold">
          {t('credentialsPage.list.inFlight')}: {totalLabel}
        </p>
        {stateLabel ? <p className="text-meta">{stateLabel}</p> : null}
        {activeModels.map((item) => (
          <div
            key={item.model}
            className="text-meta flex min-w-0 items-start justify-between gap-4"
          >
            <span className="min-w-0 font-mono break-all">{item.model}</span>
            <span className="shrink-0 font-mono tabular-nums">
              {item.count}/
              {formatLimit(item.maxInFlight ?? resource.maxInFlightByModel?.[item.model])}
            </span>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}
