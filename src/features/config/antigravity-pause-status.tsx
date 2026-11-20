import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useAntigravityPauseStatus } from '@/features/config/use-config-workbench'
import { cn } from '@/lib/utils'

export function AntigravityPauseStatus() {
  const { t, i18n } = useTranslation()
  const { enabled, query } = useAntigravityPauseStatus()
  if (!enabled) return null

  const resumeAt = query.data?.resumeAt
  const unavailable = query.isError || query.isPaused
  let message
  if (unavailable) message = t('configPage.antigravityPauseStatus.failed')
  else if (query.isPending) message = t('configPage.antigravityPauseStatus.loading')
  else if (query.data === null) message = t('configPage.antigravityPauseStatus.unsupported')
  else if (resumeAt != null) {
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
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <p
        role="status"
        className={cn(
          'text-muted-foreground text-xs leading-5',
          !unavailable && resumeAt != null && 'font-medium text-amber-700 dark:text-amber-300',
        )}
      >
        {message}
      </p>
      <Button
        type="button"
        variant="text"
        size="sm"
        disabled={query.isFetching}
        onClick={() => {
          void query.refetch({ cancelRefetch: false })
        }}
      >
        <RefreshCw aria-hidden="true" />
        {t('configPage.antigravityPauseStatus.refresh')}
      </Button>
    </div>
  )
}
