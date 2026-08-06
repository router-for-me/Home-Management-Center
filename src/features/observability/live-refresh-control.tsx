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
        'flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-sm font-medium whitespace-nowrap',
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

export function NewItemsNotice({
  count,
  truncated,
  className,
  onAccept,
}: {
  count: number
  truncated: boolean
  className?: string
  onAccept: () => void
}) {
  const { t } = useTranslation()
  if (count <= 0) return null

  return (
    <div
      className={cn(
        'border-primary/25 bg-primary/5 flex flex-col gap-2 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <RadioTower className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-sm font-medium" role="status" aria-live="polite" aria-atomic="true">
          {t(truncated ? 'observabilityRefresh.newItemsAtLeast' : 'observabilityRefresh.newItems', {
            count,
          })}
        </p>
      </div>
      <Button type="button" variant="outline" size="md" onClick={onAccept}>
        {t('observabilityRefresh.showNew')}
      </Button>
    </div>
  )
}
