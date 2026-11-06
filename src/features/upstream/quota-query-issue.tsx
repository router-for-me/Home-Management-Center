import { CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getUpstreamQuotaErrorSummary } from '@/features/upstream/quota-format'
import {
  type UpstreamQuotaEntry,
  resolveQuotaSnapshotDisplay,
} from '@/features/upstream/upstream-quota-model'
import { cn } from '@/lib/utils'

import { QuotaTooltip } from './quota-tooltip'

export function QuotaQueryIssue({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const partial = entry.collectionStatus === 'partial'
  const summary =
    !partial || entry.lastError
      ? getUpstreamQuotaErrorSummary(entry, t)
      : {
          title: t('upstreamPage.quota.summary.partial'),
          description: t('upstreamPage.quota.summary.partialDescription'),
        }
  return (
    <Popover>
      <QuotaTooltip
        content={
          <div className="grid gap-1">
            <p className="font-medium">{summary.title}</p>
            <p>{summary.description}</p>
            <p>{t('upstreamPage.quota.summary.queryScope')}</p>
          </div>
        }
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className={cn(
              'max-w-full min-w-0 shadow-none',
              partial
                ? 'border-warning/40 text-warning-foreground dark:text-warning'
                : 'border-destructive/35 text-destructive',
            )}
            aria-label={t('upstreamPage.quota.summary.queryIssueLabel', {
              reason: t(
                partial
                  ? 'upstreamPage.quota.summary.partial'
                  : 'upstreamPage.quota.summary.queryFailed',
              ),
            })}
          >
            <span className="min-w-0 truncate">
              {t(
                partial
                  ? 'upstreamPage.quota.summary.partial'
                  : 'upstreamPage.quota.summary.queryFailed',
              )}
            </span>
            <CircleHelp className="opacity-70" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
      </QuotaTooltip>
      <PopoverContent
        align="start"
        className="grid max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] gap-3 overflow-y-auto"
        aria-label={t('upstreamPage.quota.summary.queryIssueHint')}
      >
        <div className="grid min-w-0 gap-1.5">
          <h3 className="text-sm font-semibold">{summary.title}</h3>
          <p className="text-muted-foreground text-sm leading-6 text-pretty wrap-anywhere">
            {summary.description}
          </p>
          {resolveQuotaSnapshotDisplay(entry).historical ? (
            <p className="text-muted-foreground text-meta text-pretty">
              {t('upstreamPage.quota.summary.historicalHint')}
            </p>
          ) : null}
        </div>
        <p className="text-meta border-t pt-3">{t('upstreamPage.quota.summary.queryScope')}</p>
      </PopoverContent>
    </Popover>
  )
}
