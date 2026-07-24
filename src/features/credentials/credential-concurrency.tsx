import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'

import type { TFunction } from 'i18next'
import { AlertTriangle, Copy, Loader2, Plus, RefreshCw, TimerReset, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  CredentialConcurrencyPolicy,
  CredentialInFlightDetail,
  CredentialInFlightObservationMetadata,
  CredentialInFlightSummary,
  CredentialResource,
} from '@/lib/api/management/credentials'
import { getCredentialBindingAuthId } from '@/lib/api/management/credentials'
import { cn } from '@/lib/utils'

export type CredentialMetadataForm = {
  prefix: string
  proxyUrl: string
  priority: string
  note: string
  websockets: boolean
  maxInFlight: string
  maxInFlightByModel: Array<{ model: string; limit: string }>
}

export function applyCredentialConcurrencyPolicyToForm(
  form: CredentialMetadataForm,
  policy: CredentialConcurrencyPolicy | null,
): CredentialMetadataForm {
  if (!policy) return form
  return {
    ...form,
    maxInFlight: policy.maxInFlight ? String(policy.maxInFlight) : '',
    maxInFlightByModel: Object.entries(policy.maxInFlightByModel)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([model, limit]) => ({ model, limit: String(limit) })),
  }
}

export function getCredentialInFlightId(resource: CredentialResource) {
  return getCredentialBindingAuthId(resource)
}

export function parseConcurrencyLimit(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return undefined
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

export function canonicalConcurrencyModelKey(value: string) {
  const trimAsciiWhitespace = (input: string) =>
    input.replace(/^[ \t\r\n\v\f]+|[ \t\r\n\v\f]+$/g, '')
  const trimmed = trimAsciiWhitespace(value).toLowerCase()
  const lastOpen = trimmed.lastIndexOf('(')
  if (lastOpen < 0 || !trimmed.endsWith(')')) return trimmed
  const suffix = trimmed.slice(lastOpen + 1, -1)
  const recognizedSuffix =
    suffix === '-1' ||
    ['none', 'auto', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(suffix) ||
    (/^\d{1,10}$/.test(suffix) && Number(suffix) <= 2_147_483_647)
  if (!recognizedSuffix) return trimmed
  const baseModel = trimAsciiWhitespace(trimmed.slice(0, lastOpen))
  return baseModel || trimmed
}

export function isValidConcurrencyModelKey(value: string) {
  const model = canonicalConcurrencyModelKey(value)
  return Boolean(model) && new TextEncoder().encode(model).byteLength <= 256
}

function formatRequestAge(startedAt: string, now: number, t: TFunction) {
  const started = new Date(startedAt).getTime()
  if (!Number.isFinite(started) || started <= 0 || now <= started) {
    return t('credentialsPage.concurrency.ageSeconds', { count: 0 })
  }
  const totalSeconds = Math.floor((now - started) / 1000)
  if (totalSeconds < 60) {
    return t('credentialsPage.concurrency.ageSeconds', { count: totalSeconds })
  }
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) {
    return t('credentialsPage.concurrency.ageMinutesSeconds', {
      minutes,
      seconds: totalSeconds % 60,
    })
  }
  const hours = Math.floor(minutes / 60)
  return t('credentialsPage.concurrency.ageHoursMinutes', {
    hours,
    minutes: minutes % 60,
  })
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return null
  return new Intl.DateTimeFormat(locale || undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.append(textArea)
  textArea.select()
  document.execCommand('copy')
  textArea.remove()
}

export type CredentialInFlightCellStatus = {
  observation: CredentialInFlightObservationMetadata | null
  observationStale: boolean
  observationErrorMessage: string | null
  limiterStale: boolean
  limiterErrorMessage: string | null
}

export function CredentialInFlightCell({
  summary,
  status,
}: {
  summary: CredentialInFlightSummary | null
  status?: CredentialInFlightCellStatus
}) {
  const { t } = useTranslation()
  const hasLimiter = summary?.admittedInFlight !== null && summary?.admittedInFlight !== undefined
  const displayValue = hasLimiter
    ? `${summary.admittedInFlight} / ${summary.maxInFlight ?? '∞'}`
    : summary?.observedInFlight !== null && summary?.observedInFlight !== undefined
      ? t('credentialsPage.concurrency.observedCompact', { count: summary.observedInFlight })
      : null
  const statusWarnings = [
    ...(status?.observationErrorMessage
      ? [
          t('credentialsPage.concurrency.observationLoadFailed', {
            message: status.observationErrorMessage,
          }),
        ]
      : []),
    ...(status?.limiterErrorMessage
      ? [
          t('credentialsPage.concurrency.limiterLoadFailed', {
            message: status.limiterErrorMessage,
          }),
        ]
      : []),
    ...(status?.observationStale || status?.limiterStale || status?.observation?.stale
      ? [t('credentialsPage.concurrency.stale')]
      : []),
    ...(status?.observation &&
    (!status.observation.coverageComplete ||
      !status.observation.aggregatesComplete ||
      !status.observation.protocolCoverageComplete)
      ? [t('credentialsPage.concurrency.observationIncomplete')]
      : []),
  ]
  const saturationWarning = summary?.totalSaturated
    ? t('credentialsPage.concurrency.totalSaturated')
    : summary && summary.saturatedModelCount > 0
      ? t('credentialsPage.concurrency.modelsSaturated', {
          count: summary.saturatedModelCount,
        })
      : null
  const warningMessages = [
    ...new Set([...statusWarnings, ...(saturationWarning ? [saturationWarning] : [])]),
  ]

  if (displayValue === null && warningMessages.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
      <span
        className={cn(
          summary?.totalSaturated ? 'text-warning-foreground dark:text-warning font-medium' : null,
        )}
      >
        {displayValue ?? '—'}
      </span>
      {warningMessages.length > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-warning-foreground dark:text-warning focus-visible:ring-ring inline-flex size-6 cursor-help items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
              aria-label={warningMessages.join(' ')}
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-80 space-y-1 text-left leading-5">
            {warningMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

export function CredentialConcurrencyDetail({
  summary,
  observation,
  observationAvailable,
  detail,
  pending,
  fetching,
  stale,
  errorMessage,
  hasNextPage,
  fetchingNextPage,
  onLoadMore,
  onRefresh,
}: {
  summary: CredentialInFlightSummary | null
  observation: CredentialInFlightObservationMetadata | null
  observationAvailable: boolean
  detail: CredentialInFlightDetail | null
  pending: boolean
  fetching: boolean
  stale: boolean
  errorMessage: string | null
  hasNextPage: boolean
  fetchingNextPage: boolean
  onLoadMore: () => void
  onRefresh: () => void
}) {
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const requests = detail?.requests ?? []
  const metadata = detail ?? observation
  const snapshotExpiresAt = detail?.snapshotExpiresAt
    ? Date.parse(detail.snapshotExpiresAt)
    : Number.NaN
  const snapshotExpired = Boolean(
    detail?.snapshotCursor && Number.isFinite(snapshotExpiresAt) && now >= snapshotExpiresAt,
  )
  const requestDetailUnavailable =
    observationAvailable && detail === null && (pending || Boolean(errorMessage))
  const warningMessages = [
    ...new Set([
      ...(errorMessage
        ? [t('credentialsPage.concurrency.summaryLoadFailed', { message: errorMessage })]
        : []),
      ...(stale || metadata?.stale ? [t('credentialsPage.concurrency.stale')] : []),
      ...(metadata &&
      (!metadata.coverageComplete ||
        !metadata.aggregatesComplete ||
        !metadata.protocolCoverageComplete)
        ? [t('credentialsPage.concurrency.observationIncomplete')]
        : []),
      ...(metadata?.detailsTruncated ? [t('credentialsPage.concurrency.detailsTruncated')] : []),
      ...(detail?.paginationLimited
        ? [
            t('credentialsPage.concurrency.paginationLimited', {
              count: detail.requests.length,
            }),
          ]
        : []),
      ...(snapshotExpired
        ? [t('credentialsPage.concurrency.paginationExpired')]
        : detail?.snapshotCursor
          ? [t('credentialsPage.concurrency.paginationPinned')]
          : []),
      ...(observationAvailable && summary?.fullyEnforced === 'false'
        ? [t('credentialsPage.concurrency.notFullyEnforced')]
        : observationAvailable &&
            summary?.policyVersion !== null &&
            summary?.fullyEnforced === 'unknown'
          ? [t('credentialsPage.concurrency.enforcementUnknown')]
          : []),
    ]),
  ]
  const hasLimiter = summary?.admittedInFlight !== null && summary?.admittedInFlight !== undefined

  useEffect(() => {
    if (requests.length === 0 && !detail?.snapshotExpiresAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 5_000)
    return () => window.clearInterval(timer)
  }, [detail?.snapshotExpiresAt, requests.length])

  if (pending && !summary && !detail) {
    return <Skeleton className="h-48 w-full" />
  }

  return (
    <div className="space-y-5">
      {warningMessages.length > 0 ? (
        <div className="border-warning/35 bg-warning/10 space-y-1 rounded-md border px-3 py-2 text-sm">
          {warningMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}
      {summary ? (
        <>
          <div className="grid overflow-hidden rounded-md border sm:grid-cols-4">
            {[
              [
                t('credentialsPage.concurrency.observed'),
                summary.observedInFlight === null ? '—' : String(summary.observedInFlight),
              ],
              [
                t('credentialsPage.concurrency.admitted'),
                summary.admittedInFlight === null ? '—' : String(summary.admittedInFlight),
              ],
              [
                t('credentialsPage.concurrency.limit'),
                hasLimiter
                  ? summary.maxInFlight === null
                    ? t('credentialsPage.concurrency.unlimited')
                    : String(summary.maxInFlight)
                  : '—',
              ],
              [
                t('credentialsPage.concurrency.remaining'),
                hasLimiter
                  ? summary.remaining === null
                    ? t('credentialsPage.concurrency.unlimited')
                    : String(summary.remaining)
                  : '—',
              ],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={cn('px-4 py-3', index > 0 ? 'border-t sm:border-t-0 sm:border-l' : null)}
              >
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="mt-1 font-mono text-sm font-medium tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">
                  {t('credentialsPage.concurrency.modelsTitle')}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('credentialsPage.concurrency.modelsDescription')}
                </p>
              </div>
              {fetching ? (
                <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden="true" />
              ) : null}
            </div>
            <Table
              containerClassName="mt-3 rounded-md border"
              className="min-w-[620px] table-fixed"
            >
              <colgroup>
                <col />
                <col className="w-[92px]" />
                <col className="w-[92px]" />
                <col className="w-[92px]" />
                <col className="w-[104px]" />
              </colgroup>
              <TableHeader>
                <TableRow variant="static">
                  <TableHead>{t('credentialsPage.concurrency.model')}</TableHead>
                  <TableHead>{t('credentialsPage.concurrency.observed')}</TableHead>
                  <TableHead>{t('credentialsPage.concurrency.admitted')}</TableHead>
                  <TableHead>{t('credentialsPage.concurrency.limit')}</TableHead>
                  <TableHead>{t('credentialsPage.concurrency.remaining')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.models.length > 0 ? (
                  summary.models.map((model) => (
                    <TableRow key={model.model} variant="static">
                      <TableCell className="truncate font-mono text-xs">{model.model}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {model.observedInFlight ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {model.admittedInFlight ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {model.admittedInFlight === null ? '—' : (model.maxInFlight ?? '—')}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        <span
                          className={cn(
                            model.saturated
                              ? 'text-warning-foreground dark:text-warning font-medium'
                              : null,
                          )}
                        >
                          {model.admittedInFlight === null ? '—' : (model.remaining ?? '—')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow variant="static">
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground py-8 text-center text-sm"
                    >
                      {t('credentialsPage.concurrency.noModels')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        </>
      ) : (
        <div className="text-muted-foreground rounded-md border px-4 py-8 text-center text-sm">
          {t('credentialsPage.concurrency.unavailable')}
        </div>
      )}

      <section>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">
              {t('credentialsPage.concurrency.requestsTitle')}
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('credentialsPage.concurrency.requestsDescription')}
            </p>
          </div>
          {observationAvailable ? (
            <Button type="button" variant="text" size="sm" disabled={fetching} onClick={onRefresh}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {t('credentialsPage.concurrency.refreshSnapshot')}
            </Button>
          ) : null}
        </div>
        {!observationAvailable ? (
          <div className="text-muted-foreground mt-3 rounded-md border px-4 py-6 text-center text-sm">
            {t('credentialsPage.concurrency.observationUnsupported')}
          </div>
        ) : (
          <Table containerClassName="mt-3 rounded-md border" className="min-w-[760px] table-fixed">
            <colgroup>
              <col className="w-[190px]" />
              <col className="w-[210px]" />
              <col className="w-[110px]" />
              <col className="w-[150px]" />
              <col className="w-[80px]" />
            </colgroup>
            <TableHeader>
              <TableRow variant="static">
                <TableHead>{t('credentialsPage.concurrency.requestId')}</TableHead>
                <TableHead>{t('credentialsPage.concurrency.model')}</TableHead>
                <TableHead>{t('credentialsPage.concurrency.requestKind')}</TableHead>
                <TableHead>{t('credentialsPage.concurrency.startedAt')}</TableHead>
                <TableHead>{t('credentialsPage.concurrency.age')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestDetailUnavailable ? (
                <TableRow variant="static">
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                    {pending
                      ? t('credentialsPage.concurrency.requestsLoading')
                      : t('credentialsPage.concurrency.requestsUnavailable')}
                  </TableCell>
                </TableRow>
              ) : requests.length > 0 ? (
                requests.map((request, index) => (
                  <TableRow
                    key={`${request.requestId}\u0000${request.credentialId}\u0000${request.model}\u0000${request.requestKind}\u0000${request.startedAt}\u0000${index}`}
                    variant="static"
                  >
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="truncate font-mono text-xs">{request.requestId}</span>
                        <Button
                          type="button"
                          variant="text"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={t('credentialsPage.concurrency.copyRequestId')}
                          onClick={() => {
                            void copyTextToClipboard(request.requestId)
                              .then(() =>
                                toast.success(t('credentialsPage.concurrency.requestIdCopied')),
                              )
                              .catch(() =>
                                toast.error(t('credentialsPage.concurrency.requestIdCopyFailed')),
                              )
                          }}
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="truncate font-mono text-xs">{request.model}</p>
                    </TableCell>
                    <TableCell className="truncate font-mono text-xs">
                      {request.requestKind}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTime(request.startedAt, i18n.resolvedLanguage ?? i18n.language) ??
                        '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {formatRequestAge(request.startedAt, now, t)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow variant="static">
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                    {t('credentialsPage.concurrency.noRequests')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {observationAvailable && hasNextPage && !snapshotExpired ? (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={fetchingNextPage}
              onClick={onLoadMore}
            >
              {fetchingNextPage ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('credentialsPage.concurrency.loadMore')}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export function CredentialConcurrencyEditor({
  form,
  summary,
  mutating,
  onChange,
}: {
  form: CredentialMetadataForm
  summary: CredentialInFlightSummary | null
  mutating: boolean
  onChange: Dispatch<SetStateAction<CredentialMetadataForm>>
}) {
  const { t } = useTranslation()
  const proposedTotal = parseConcurrencyLimit(form.maxInFlight)
  const currentTotal = Math.max(summary?.observedInFlight ?? 0, summary?.admittedInFlight ?? 0)
  const totalWarning =
    proposedTotal !== undefined && proposedTotal !== null && proposedTotal > 0 && summary
      ? proposedTotal < currentTotal
      : false
  const modelWarning = form.maxInFlightByModel.some((row) => {
    const limit = parseConcurrencyLimit(row.limit)
    const modelKey = canonicalConcurrencyModelKey(row.model)
    const currentModel = summary?.models.find((model) => model.model === modelKey)
    const current = Math.max(
      currentModel?.observedInFlight ?? 0,
      currentModel?.admittedInFlight ?? 0,
    )
    return limit !== undefined && limit !== null && limit > 0 && limit < current
  })

  return (
    <section className="border-t pt-5">
      <div className="flex items-start gap-3">
        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
          <TimerReset className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-medium">{t('credentialsPage.concurrency.editTitle')}</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {t('credentialsPage.concurrency.editDescription')}
          </p>
        </div>
      </div>
      <label className="mt-4 grid gap-2 text-sm font-medium">
        <span>{t('credentialsPage.concurrency.totalLimit')}</span>
        <Input
          value={form.maxInFlight}
          inputMode="numeric"
          placeholder={t('credentialsPage.concurrency.unlimited')}
          disabled={mutating}
          onChange={(event) =>
            onChange((current) => ({ ...current, maxInFlight: event.target.value }))
          }
        />
      </label>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {t('credentialsPage.concurrency.modelLimits')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutating}
            onClick={() =>
              onChange((current) => ({
                ...current,
                maxInFlightByModel: [...current.maxInFlightByModel, { model: '', limit: '' }],
              }))
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('credentialsPage.concurrency.addModel')}
          </Button>
        </div>
        {form.maxInFlightByModel.map((row, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_112px_36px] gap-2">
            <Input
              value={row.model}
              placeholder={t('credentialsPage.concurrency.modelPlaceholder')}
              aria-label={t('credentialsPage.concurrency.modelInputLabel', {
                index: index + 1,
              })}
              disabled={mutating}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  maxInFlightByModel: current.maxInFlightByModel.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, model: event.target.value } : item,
                  ),
                }))
              }
            />
            <Input
              value={row.limit}
              inputMode="numeric"
              placeholder="∞"
              aria-label={t('credentialsPage.concurrency.modelLimitInputLabel', {
                index: index + 1,
              })}
              disabled={mutating}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  maxInFlightByModel: current.maxInFlightByModel.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, limit: event.target.value } : item,
                  ),
                }))
              }
            />
            <Button
              type="button"
              variant="text"
              size="icon"
              disabled={mutating}
              aria-label={t('credentialsPage.concurrency.removeModelAtIndex', {
                index: index + 1,
              })}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  maxInFlightByModel: current.maxInFlightByModel.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                }))
              }
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        {form.maxInFlightByModel.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-xs">
            {t('credentialsPage.concurrency.noModelLimits')}
          </p>
        ) : null}
      </div>
      {totalWarning || modelWarning ? (
        <div className="border-warning/35 bg-warning/10 mt-4 rounded-md border px-3 py-2 text-sm leading-5">
          {t('credentialsPage.concurrency.lowerLimitWarning')}
        </div>
      ) : null}
    </section>
  )
}
