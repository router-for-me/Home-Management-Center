import { useEffect, useState } from 'react'

import { AlertCircle, ClockAlert, Pause, RadioTower } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { LiveRefreshPauseReason } from '@/features/observability/live-refresh'
import { cn } from '@/lib/utils'

export function LiveRefreshControl({
  mode = 'live',
  enabled,
  disabled = false,
  describedBy,
  onEnabledChange,
}: {
  mode?: 'live' | 'auto'
  enabled: boolean
  disabled?: boolean
  describedBy?: string
  onEnabledChange: (enabled: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <label
      className={cn(
        // The md step, so it lines up with the md buttons it sits beside and takes
        // their 40px touch floor on a phone.
        'control-md flex shrink-0 items-center border font-medium whitespace-nowrap',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:bg-muted/50 cursor-pointer transition-colors',
      )}
    >
      <RadioTower
        className={cn('size-4', enabled ? 'text-primary' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <span>{t(`observabilityRefresh.mode.${mode}`)}</span>
      <Switch
        checked={enabled}
        disabled={disabled}
        aria-label={t(`observabilityRefresh.mode.${mode}`)}
        aria-describedby={describedBy}
        onCheckedChange={onEnabledChange}
      />
    </label>
  )
}

export function LiveRefreshStatusNotice({
  mode = 'live',
  enabled,
  active,
  pauseReason,
  intervalMs,
  hasError,
  lastSuccessAt,
  showLastSuccess = true,
  id,
  className,
}: {
  mode?: 'live' | 'auto'
  enabled: boolean
  active: boolean
  pauseReason: LiveRefreshPauseReason | null
  intervalMs: number
  hasError: boolean
  lastSuccessAt: number | null
  showLastSuccess?: boolean
  id?: string
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const effectiveError = active && hasError
  const ageMs = lastSuccessAt ? Math.max(0, now - lastSuccessAt) : 0
  const stale = enabled && active && lastSuccessAt !== null && ageMs > intervalMs * 2
  const paused = !active && pauseReason !== null && pauseReason !== 'disabled'

  useEffect(() => {
    if (!enabled || !active || lastSuccessAt === null) return
    const timer = window.setInterval(() => setNow(Date.now()), Math.min(intervalMs, 5_000))
    return () => window.clearInterval(timer)
  }, [active, enabled, intervalMs, lastSuccessAt])

  if (!effectiveError && !stale && !paused) return null

  const ageSeconds = Math.max(1, Math.round(ageMs / 1000))
  const unavailable = pauseReason === 'unavailable'
  const statusLabel = effectiveError
    ? t('observabilityRefresh.status.retrying')
    : stale
      ? t('observabilityRefresh.status.delayed', { seconds: ageSeconds })
      : unavailable
        ? t(`observabilityRefresh.status.unavailable.${mode}`)
        : t(`observabilityRefresh.status.paused.${mode}`)
  const reasonLabel = paused ? t(`observabilityRefresh.status.reason.${pauseReason}`) : null
  const lastSuccessTime = lastSuccessAt
    ? new Intl.DateTimeFormat(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(lastSuccessAt))
    : null

  return (
    <div
      id={id}
      className={cn(
        'flex min-w-0 items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm',
        effectiveError
          ? 'border-destructive/30 bg-destructive/5'
          : stale
            ? 'border-warning/30 bg-warning/8'
            : 'border-border bg-muted/30',
        className,
      )}
    >
      {effectiveError ? (
        <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : stale ? (
        <ClockAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Pause className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p role="status" aria-live="polite" aria-atomic="true">
          <span className="font-medium">
            {reasonLabel
              ? t('observabilityRefresh.status.withReason', {
                  status: statusLabel,
                  reason: reasonLabel,
                })
              : statusLabel}
          </span>
        </p>
        {showLastSuccess && lastSuccessTime ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t('observabilityRefresh.status.lastSuccess', { time: lastSuccessTime })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/*
 * Sits beside the LiveRefreshControl that produced it, in the same header row.
 * As a banner above the table it pushed the rows 66px down whenever it appeared,
 * which on a 1080p first screen cost one of the four rows there was room for,
 * and pulled them back up once accepted.
 *
 * The live region outlives the button so that a count arriving is announced:
 * a region inserted together with its text is not reliably read.
 */
export function NewItemsNotice({
  count,
  truncated,
  onAccept,
}: {
  count: number
  truncated: boolean
  onAccept: () => void
}) {
  const { t } = useTranslation()
  const pending = count > 0

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {pending
          ? t(
              truncated ? 'observabilityRefresh.newItemsAtLeast' : 'observabilityRefresh.newItems',
              {
                count,
              },
            )
          : null}
      </span>
      {pending ? (
        <Button type="button" variant="outline" size="md" onClick={onAccept}>
          <RadioTower className="text-primary" aria-hidden="true" />
          {t('observabilityRefresh.showNew')}
          <span className="bg-primary text-primary-foreground rounded-md px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums">
            {truncated ? `${count}+` : count}
          </span>
        </Button>
      ) : null}
    </>
  )
}
