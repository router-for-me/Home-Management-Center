import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'

import type { TFunction } from 'i18next'
import { AlertTriangle, Copy, Loader2, Plus, TimerReset, X } from 'lucide-react'
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
  CredentialInFlightDetail,
  CredentialInFlightSummary,
  CredentialResource,
} from '@/lib/api/management/credentials'
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

export function getCredentialInFlightId(resource: CredentialResource) {
  return resource.authIndex ?? resource.identifier
}

export function parseConcurrencyLimit(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return undefined
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

export function canonicalConcurrencyModelKey(value: string) {
  const trimmed = value.trim()
  const lastOpen = trimmed.lastIndexOf('(')
  if (lastOpen < 0 || !trimmed.endsWith(')')) return trimmed
  const baseModel = trimmed.slice(0, lastOpen).trim()
  return baseModel || trimmed
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

export function CredentialInFlightCell({ summary }: { summary: CredentialInFlightSummary | null }) {
  const { t } = useTranslation()
  if (!summary) {
    return <span className="text-muted-foreground">—</span>
  }
  const warning = summary.totalSaturated || summary.saturatedModelCount > 0
  const warningText = summary.totalSaturated
    ? t('credentialsPage.concurrency.totalSaturated')
    : t('credentialsPage.concurrency.modelsSaturated', {
        count: summary.saturatedModelCount,
      })
  return (
    <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
      <span
        className={cn(
          summary.totalSaturated ? 'text-warning-foreground dark:text-warning font-medium' : null,
        )}
      >
        {summary.inFlight} / {summary.maxInFlight ?? '∞'}
      </span>
      {warning ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-warning-foreground dark:text-warning focus-visible:ring-ring inline-flex size-6 cursor-help items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
              aria-label={warningText}
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 text-left leading-5">{warningText}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

export function CredentialConcurrencyDetail({
  summary,
  detail,
  pending,
  fetching,
  stale,
  errorMessage,
  hasNextPage,
  fetchingNextPage,
  onLoadMore,
}: {
  summary: CredentialInFlightSummary | null
  detail: Pick<CredentialInFlightDetail, 'observedAt' | 'credential' | 'requests'> | null
  pending: boolean
  fetching: boolean
  stale: boolean
  errorMessage: string | null
  hasNextPage: boolean
  fetchingNextPage: boolean
  onLoadMore: () => void
}) {
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const effectiveSummary = detail?.credential ?? summary
  const requests = detail?.requests ?? []
  const requestDetailUnavailable = detail === null && (pending || Boolean(errorMessage))
  const warningMessage = stale
    ? t('credentialsPage.concurrency.stale')
    : errorMessage
      ? t('credentialsPage.concurrency.summaryLoadFailed', { message: errorMessage })
      : null

  useEffect(() => {
    if (requests.length === 0) return
    const timer = window.setInterval(() => setNow(Date.now()), 5_000)
    return () => window.clearInterval(timer)
  }, [requests.length])

  if (pending && !effectiveSummary) {
    return <Skeleton className="h-48 w-full" />
  }
  if (!effectiveSummary) {
    return (
      <div className="text-muted-foreground rounded-md border px-4 py-8 text-center text-sm">
        {warningMessage ?? t('credentialsPage.concurrency.unavailable')}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {warningMessage ? (
        <div className="border-warning/35 bg-warning/10 rounded-md border px-3 py-2 text-sm">
          {warningMessage}
        </div>
      ) : null}
      <div className="grid overflow-hidden rounded-md border sm:grid-cols-3">
        {[
          [t('credentialsPage.concurrency.current'), String(effectiveSummary.inFlight)],
          [
            t('credentialsPage.concurrency.limit'),
            effectiveSummary.maxInFlight === null
              ? t('credentialsPage.concurrency.unlimited')
              : String(effectiveSummary.maxInFlight),
          ],
          [
            t('credentialsPage.concurrency.remaining'),
            effectiveSummary.remaining === null
              ? t('credentialsPage.concurrency.unlimited')
              : String(effectiveSummary.remaining),
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
            <h3 className="text-sm font-medium">{t('credentialsPage.concurrency.modelsTitle')}</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('credentialsPage.concurrency.modelsDescription')}
            </p>
          </div>
          {fetching ? (
            <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden="true" />
          ) : null}
        </div>
        <Table containerClassName="mt-3 rounded-md border" className="min-w-[520px] table-fixed">
          <colgroup>
            <col />
            <col className="w-[96px]" />
            <col className="w-[96px]" />
            <col className="w-[104px]" />
          </colgroup>
          <TableHeader>
            <TableRow variant="static">
              <TableHead>{t('credentialsPage.concurrency.model')}</TableHead>
              <TableHead>{t('credentialsPage.concurrency.current')}</TableHead>
              <TableHead>{t('credentialsPage.concurrency.limit')}</TableHead>
              <TableHead>{t('credentialsPage.concurrency.remaining')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {effectiveSummary.models.length > 0 ? (
              effectiveSummary.models.map((model) => (
                <TableRow key={model.model} variant="static">
                  <TableCell className="truncate font-mono text-xs">{model.model}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">{model.inFlight}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {model.maxInFlight ?? '∞'}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    <span
                      className={cn(
                        model.saturated
                          ? 'text-warning-foreground dark:text-warning font-medium'
                          : null,
                      )}
                    >
                      {model.remaining ?? '∞'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow variant="static">
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                  {t('credentialsPage.concurrency.noModels')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section>
        <div>
          <h3 className="text-sm font-medium">{t('credentialsPage.concurrency.requestsTitle')}</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('credentialsPage.concurrency.requestsDescription')}
          </p>
        </div>
        <Table containerClassName="mt-3 rounded-md border" className="min-w-[760px] table-fixed">
          <colgroup>
            <col className="w-[180px]" />
            <col className="w-[220px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            <col className="w-[70px]" />
          </colgroup>
          <TableHeader>
            <TableRow variant="static">
              <TableHead>{t('credentialsPage.concurrency.requestId')}</TableHead>
              <TableHead>{t('credentialsPage.concurrency.model')}</TableHead>
              <TableHead>{t('credentialsPage.concurrency.cpaNode')}</TableHead>
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
              requests.map((request) => (
                <TableRow key={request.leaseId} variant="static">
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
                    {request.requestedModel && request.requestedModel !== request.model ? (
                      <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
                        {request.requestedModel}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="truncate text-xs">
                    {request.cpaLabel ?? request.cpaNodeId ?? request.cpaIp ?? '—'}
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
        {hasNextPage ? (
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
  const totalWarning =
    proposedTotal !== undefined && proposedTotal !== null && proposedTotal > 0 && summary
      ? proposedTotal < summary.inFlight
      : false
  const modelWarning = form.maxInFlightByModel.some((row) => {
    const limit = parseConcurrencyLimit(row.limit)
    const modelKey = canonicalConcurrencyModelKey(row.model)
    const current = summary?.models.find((model) => model.model === modelKey)?.inFlight ?? 0
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
