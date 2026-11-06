import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { getUpstreamQuotaErrorSummary } from '@/features/upstream/quota-format'
import {
  type UpstreamQuotaEntry,
  resolveQuotaSnapshotDisplay,
} from '@/features/upstream/upstream-quota-model'

export function QuotaCollectionNotice({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t, i18n } = useTranslation()
  const { historical, hasWindows } = resolveQuotaSnapshotDisplay(entry)
  const failed = Boolean(entry.lastError) || entry.collectionStatus === 'failed'
  const partial = entry.collectionStatus === 'partial'
  if (!failed && !partial && !historical) return null
  const summary = failed ? getUpstreamQuotaErrorSummary(entry, t) : null
  const error = entry.lastError
  const fields = [
    [t('upstreamPage.quota.summary.errorCode'), error?.code],
    [t('upstreamPage.quota.summary.httpStatus'), error?.upstreamStatusCode?.toString()],
    [t('upstreamPage.quota.summary.requestId'), error?.requestId],
    [
      t('upstreamPage.quota.summary.errorTime'),
      error?.occurredAt && Number.isFinite(Date.parse(error.occurredAt))
        ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
            dateStyle: 'short',
            timeStyle: 'medium',
          }).format(new Date(error.occurredAt))
        : null,
    ],
  ].filter((field): field is [string, string] => Boolean(field[1]))

  return (
    <section className="border-warning/30 bg-warning/10 grid min-w-0 gap-2 rounded-md border p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="text-warning-foreground dark:text-warning mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <div className="grid min-w-0 gap-1">
          <h3 className="text-sm font-semibold">
            {summary?.title ??
              t(
                partial
                  ? 'upstreamPage.quota.summary.partial'
                  : 'upstreamPage.quota.summary.historical',
              )}
          </h3>
          <p className="text-muted-foreground text-sm leading-6">
            {summary?.description ??
              t(
                partial
                  ? 'upstreamPage.quota.summary.partialDescription'
                  : 'upstreamPage.quota.summary.historicalDescription',
              )}
          </p>
          {failed || partial ? (
            <p className="text-meta">{t('upstreamPage.quota.summary.queryScope')}</p>
          ) : null}
          {failed && hasWindows ? (
            <p className="text-muted-foreground text-meta">
              {t(
                partial && !historical
                  ? 'upstreamPage.quota.summary.partialDescription'
                  : 'upstreamPage.quota.summary.retainedDescription',
              )}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <Collapsible className="min-w-0">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="text" size="sm" className="group max-w-full min-w-0">
              <span className="min-w-0 truncate">
                {t('upstreamPage.quota.summary.technicalDetails')}
              </span>
              <ChevronDown
                className="transition-transform group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid min-w-0 gap-3 pt-2">
            <dl className="grid min-w-0 gap-2">
              {fields.map(([label, value]) => (
                <div key={label} className="grid min-w-0 gap-0.5">
                  <dt className="text-muted-foreground text-meta">{label}</dt>
                  <dd className="text-code wrap-anywhere">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="grid min-w-0 gap-1">
              <p className="text-muted-foreground text-meta">
                {t('upstreamPage.quota.summary.originalError')}
              </p>
              <p className="text-code bg-background/60 rounded-md border p-3 wrap-anywhere whitespace-pre-wrap">
                {error.message}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}

export function QuotaCollectionFacts({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t, i18n } = useTranslation()
  const formatTime = (value: string | null) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
          dateStyle: 'short',
          timeStyle: 'medium',
        }).format(new Date(value))
      : t('upstreamPage.quota.common.notAvailable')
  const fields = [
    [t('upstreamPage.quota.summary.quotaStatus'), t(`upstreamPage.quota.status.${entry.status}`)],
    ...(entry.plan?.expiresAt
      ? [[t('upstreamPage.quota.summary.subscriptionExpiry'), formatTime(entry.plan.expiresAt)]]
      : []),
    [
      t('upstreamPage.quota.summary.freshness'),
      t(`upstreamPage.quota.freshness.${entry.freshness}`),
    ],
    [
      t('upstreamPage.quota.detail.collectionStatus'),
      t(`upstreamPage.quota.collection.${entry.collectionStatus}`),
    ],
    [t('upstreamPage.quota.detail.source'), t(`upstreamPage.quota.source.${entry.source}`)],
    [t('upstreamPage.quota.detail.observedAt'), formatTime(entry.observedAt)],
    [t('upstreamPage.quota.summary.validUntilLabel'), formatTime(entry.expiresAt)],
    [t('upstreamPage.quota.detail.lastAttemptAt'), formatTime(entry.lastAttemptAt)],
    [t('upstreamPage.quota.detail.nextProbeAt'), formatTime(entry.nextProbeAt)],
    [t('upstreamPage.quota.detail.consecutiveFailures'), String(entry.consecutiveFailures)],
  ]
  return (
    <section className="min-w-0">
      <h3 className="text-sm font-semibold">{t('upstreamPage.quota.detail.collection')}</h3>
      <dl className="mt-3 divide-y">
        {fields.map(([label, value]) => (
          <div
            key={label}
            className="grid min-w-0 gap-1 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3"
          >
            <dt className="text-muted-foreground text-meta">{label}</dt>
            <dd className="text-sm wrap-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
