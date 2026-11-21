import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useAntigravityPauseStatus } from '@/features/config/use-config-workbench'
import { cn } from '@/lib/utils'

export function AntigravityPauseStatus() {
  const { t, i18n } = useTranslation()
  const { enabled, query, accessStatus } = useAntigravityPauseStatus()
  if (!enabled) return null

  const resumeAt = query.data?.resumeAt
  const unavailable = query.isError || query.isPaused
  const checking =
    query.isPending || !query.isFetchedAfterMount || (query.data != null && query.isStale)
  const showResumeTime = !unavailable && !checking && resumeAt != null
  let message
  if (accessStatus === 401) message = t('configPage.antigravityPauseStatus.unauthorized')
  else if (accessStatus === 403) message = t('configPage.antigravityPauseStatus.forbidden')
  else if (unavailable) message = t('configPage.antigravityPauseStatus.failed')
  else if (checking) message = t('configPage.antigravityPauseStatus.loading')
  else if (query.data === null) message = t('configPage.antigravityPauseStatus.unsupported')
  else if (showResumeTime) {
    const time = new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }).format(resumeAt)
    message = t('configPage.antigravityPauseStatus.paused', { time })
  } else message = t('configPage.antigravityPauseStatus.idle')

  return (
    <div className="@container/pause mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <p
        role="status"
        className={cn(
          'text-muted-foreground text-xs leading-5',
          showResumeTime && 'font-medium text-amber-700 dark:text-amber-300',
        )}
      >
        {message}
      </p>
      <Button
        type="button"
        variant="text"
        size="sm"
        className="aria-disabled:opacity-50"
        title={t('configPage.antigravityPauseStatus.refresh')}
        aria-disabled={query.isFetching || undefined}
        onClick={() => {
          if (!query.isFetching) void query.refetch({ cancelRefetch: false })
        }}
      >
        <RefreshCw aria-hidden="true" />
        <span className="@max-[10rem]/pause:sr-only">
          {t('configPage.antigravityPauseStatus.refresh')}
        </span>
      </Button>
    </div>
  )
}
