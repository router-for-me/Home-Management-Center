import { Link } from '@tanstack/react-router'

import type { TFunction } from 'i18next'
import {
  AlertTriangle,
  CircleGauge,
  Eye,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TableEmptyState } from '@/components/shared/empty-state'
import { ProviderLogo } from '@/components/shared/provider-logo'
import {
  TablePaginationStatus,
  containedTableContainerClassName,
  stickyTableHeaderClassName,
} from '@/components/shared/table-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type QuotaFilters,
  type QuotaPagination,
  quotaPageSizes,
  supportsAccountCredentialRoute,
} from '@/features/quota/quota-model'
import type {
  QuotaCollectionStatus,
  QuotaCredential,
  QuotaStatus,
  QuotaWindow,
} from '@/lib/api/management/quota'
import type { ManagementApiError } from '@/lib/api/management/types'
import { cn } from '@/lib/utils'

const quotaStatusClassNames: Record<QuotaStatus, string> = {
  healthy: 'border-success/30 bg-success/10 text-success',
  low: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  exhausted: 'border-destructive/30 bg-destructive/10 text-destructive',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  unknown: 'border-border bg-muted/50 text-muted-foreground',
  unsupported: 'border-info/25 bg-info/10 text-info',
}

const quotaProgressClassNames: Record<QuotaStatus, string> = {
  healthy: 'bg-success',
  low: 'bg-warning',
  exhausted: 'bg-destructive',
  error: 'bg-destructive',
  unknown: 'bg-muted-foreground/40',
  unsupported: 'bg-info/60',
}

function getDateTimeLocale() {
  if (typeof document === 'undefined') return undefined
  return document.documentElement.lang || undefined
}

export function formatQuotaDateTime(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(getDateTimeLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatQuotaNumber(value: number, window: QuotaWindow, t: TFunction) {
  if (window.unit === 'currency') {
    if (!window.currency) {
      const formatted = new Intl.NumberFormat(getDateTimeLocale(), {
        maximumFractionDigits: 2,
      }).format(value)
      return t('quotaPage.window.currencyUnknown', { value: formatted })
    }
    return new Intl.NumberFormat(getDateTimeLocale(), {
      style: 'currency',
      currency: window.currency,
      maximumFractionDigits: 2,
    }).format(value)
  }
  if (window.unit === 'percentage') return `${Math.round(value)}%`

  const formatted = new Intl.NumberFormat(getDateTimeLocale(), {
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)

  if (window.unit === 'requests' || window.unit === 'tokens' || window.unit === 'credits') {
    return t(`quotaPage.window.units.${window.unit}`, { value: formatted })
  }
  return formatted
}

function getWindowValueLabel(window: QuotaWindow, t: TFunction) {
  if (window.isUnlimited) return t('quotaPage.window.unlimited')
  if (window.remaining === null) return t('quotaPage.window.unavailable')

  const remaining = formatQuotaNumber(window.remaining, window, t)
  if (window.limit === null) return t('quotaPage.window.remainingOnly', { remaining })

  return t('quotaPage.window.remaining', {
    remaining,
    limit: formatQuotaNumber(window.limit, window, t),
  })
}

export function getQuotaWindowDisplayLabel(window: QuotaWindow, t: TFunction, locale?: string) {
  if (window.periodUnit === 'unknown' || !window.periodValue || window.periodValue <= 0) {
    return window.label ?? t('quotaPage.window.unknownPeriod')
  }

  if (
    window.periodValue === 1 &&
    (window.periodUnit === 'day' || window.periodUnit === 'week' || window.periodUnit === 'month')
  ) {
    return t(`quotaPage.window.period.${window.periodUnit}`)
  }

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: window.periodUnit,
    unitDisplay: 'long',
    maximumFractionDigits: 2,
  }).format(window.periodValue)
}

function getQuotaWindowScopeLabel(window: QuotaWindow, t: TFunction) {
  const scope = t(`quotaPage.window.scope.${window.scope}`)
  if (!window.scopeId) return window.scope === 'unknown' ? null : scope
  return t('quotaPage.window.scopeValue', { scope, value: window.scopeId })
}

function QuotaStatusBadge({ status }: { status: QuotaStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        quotaStatusClassNames[status],
      )}
    >
      {t(`quotaPage.status.${status}`)}
    </span>
  )
}

function MetadataBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted/50 text-muted-foreground inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium">
      {children}
    </span>
  )
}

function QuotaResetTime({ item }: { item: QuotaCredential }) {
  const { t } = useTranslation()
  const formattedResetAt = formatQuotaDateTime(item.earliestResetAt)

  if (!formattedResetAt) return <>{t('quotaPage.common.notAvailable')}</>

  return (
    <div className="grid gap-0.5">
      <span>{formattedResetAt}</span>
      {item.freshness === 'stale' ? (
        <span className="text-warning-foreground dark:text-warning text-xs">
          {t('quotaPage.table.lastKnownReset')}
        </span>
      ) : null}
    </div>
  )
}

function QuotaWindowProgress({
  window,
  compact = false,
}: {
  window: QuotaWindow
  compact?: boolean
}) {
  const { t, i18n } = useTranslation()
  const percentage = window.remainingRatio === null ? null : Math.round(window.remainingRatio * 100)
  const displayLabel = getQuotaWindowDisplayLabel(window, t, i18n.resolvedLanguage ?? i18n.language)
  const scopeLabel = getQuotaWindowScopeLabel(window, t)

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{displayLabel}</p>
          {scopeLabel ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{scopeLabel}</p>
          ) : null}
        </div>
        <span
          className={cn(
            'shrink-0 text-xs font-semibold tabular-nums',
            window.status === 'healthy' && 'text-success',
            window.status === 'low' && 'text-warning-foreground dark:text-warning',
            (window.status === 'exhausted' || window.status === 'error') && 'text-destructive',
            (window.status === 'unknown' || window.status === 'unsupported') &&
              'text-muted-foreground',
          )}
        >
          {percentage === null ? '—' : `${percentage}%`} · {t(`quotaPage.status.${window.status}`)}
        </span>
      </div>
      {percentage === null ? null : (
        <div
          className={cn('bg-muted mt-2 overflow-hidden rounded-full', compact ? 'h-1.5' : 'h-2')}
          role="progressbar"
          aria-label={t('quotaPage.window.progressLabel', { label: displayLabel })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div
            className={cn('h-full rounded-full', quotaProgressClassNames[window.status])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      <p className="text-muted-foreground mt-1.5 truncate text-xs">
        {getWindowValueLabel(window, t)}
      </p>
    </div>
  )
}

function QuotaSummaryCell({ item }: { item: QuotaCredential }) {
  const { t } = useTranslation()
  if (item.primaryWindows.length === 0) {
    return <span className="text-muted-foreground text-sm">{t('quotaPage.table.noWindows')}</span>
  }

  const additionalWindowCount = Math.max(0, item.windowCount - item.primaryWindows.length)

  return (
    <div className="grid min-w-52 gap-3">
      {item.primaryWindows.map((window) => (
        <QuotaWindowProgress key={window.id} window={window} compact />
      ))}
      {additionalWindowCount > 0 ? (
        <p className="text-muted-foreground text-xs">
          {t('quotaPage.table.additionalWindows', { count: additionalWindowCount })}
        </p>
      ) : null}
    </div>
  )
}

function CollectionStatus({ status }: { status: QuotaCollectionStatus }) {
  const { t } = useTranslation()
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      {status === 'collecting' ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : null}
      {t(`quotaPage.collection.${status}`)}
    </span>
  )
}

export function QuotaFilterBar({
  filters,
  providers,
  onChange,
}: {
  filters: QuotaFilters
  providers: string[]
  onChange: (filters: QuotaFilters) => void
}) {
  const { t } = useTranslation()
  const advancedFilterCount = [
    filters.source,
    filters.credentialStatus,
    filters.collectionStatus,
  ].filter((value) => value !== 'all').length

  return (
    <div className="grid w-full gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:justify-end">
      <div className="relative min-w-0 sm:col-span-2 xl:w-64">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          className="min-h-11 pl-9 sm:min-h-0"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder={t('quotaPage.filters.searchPlaceholder')}
          aria-label={t('quotaPage.filters.searchLabel')}
        />
      </div>

      <Select
        value={filters.provider}
        onValueChange={(provider) => onChange({ ...filters, provider })}
      >
        <SelectTrigger
          className="min-h-11 sm:min-h-0 xl:w-40"
          aria-label={t('quotaPage.filters.provider')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('quotaPage.filters.allProviders')}</SelectItem>
          {providers.map((provider) => (
            <SelectItem key={provider} value={provider}>
              {provider}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(status) =>
          onChange({ ...filters, status: status as QuotaFilters['status'] })
        }
      >
        <SelectTrigger
          className="min-h-11 sm:min-h-0 xl:w-36"
          aria-label={t('quotaPage.filters.status')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('quotaPage.filters.allStatuses')}</SelectItem>
          {(['healthy', 'low', 'exhausted', 'unknown', 'error', 'unsupported'] as const).map(
            (status) => (
              <SelectItem key={status} value={status}>
                {t(`quotaPage.status.${status}`)}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>

      <Select
        value={filters.freshness}
        onValueChange={(freshness) =>
          onChange({ ...filters, freshness: freshness as QuotaFilters['freshness'] })
        }
      >
        <SelectTrigger
          className="min-h-11 sm:min-h-0 xl:w-36"
          aria-label={t('quotaPage.filters.freshness')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('quotaPage.filters.allFreshness')}</SelectItem>
          {(['fresh', 'stale', 'never'] as const).map((freshness) => (
            <SelectItem key={freshness} value={freshness}>
              {t(`quotaPage.freshness.${freshness}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.sort}
        onValueChange={(sort) => onChange({ ...filters, sort: sort as QuotaFilters['sort'] })}
      >
        <SelectTrigger
          className="min-h-11 sm:min-h-0 xl:w-44"
          aria-label={t('quotaPage.filters.sort')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(
            [
              'risk_desc',
              'reset_at_asc',
              'observed_at_desc',
              'observed_at_asc',
              'provider_asc',
              'label_asc',
            ] as const
          ).map((sort) => (
            <SelectItem key={sort} value={sort}>
              {t(`quotaPage.filters.sortOptions.${sort}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-h-11 sm:min-h-0">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {t('quotaPage.filters.advanced')}
            {advancedFilterCount > 0 ? (
              <span className="bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums">
                {advancedFilterCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">{t('quotaPage.filters.source')}</label>
              <Select
                value={filters.source}
                onValueChange={(source) =>
                  onChange({ ...filters, source: source as QuotaFilters['source'] })
                }
              >
                <SelectTrigger aria-label={t('quotaPage.filters.source')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('quotaPage.filters.allSources')}</SelectItem>
                  {(['response_header', 'active_probe', 'mixed', 'none'] as const).map((source) => (
                    <SelectItem key={source} value={source}>
                      {t(`quotaPage.source.${source}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium">
                {t('quotaPage.filters.credentialStatus')}
              </label>
              <Select
                value={filters.credentialStatus}
                onValueChange={(credentialStatus) =>
                  onChange({
                    ...filters,
                    credentialStatus: credentialStatus as QuotaFilters['credentialStatus'],
                  })
                }
              >
                <SelectTrigger aria-label={t('quotaPage.filters.credentialStatus')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('quotaPage.filters.allCredentialStatuses')}
                  </SelectItem>
                  {(['enabled', 'disabled', 'unavailable', 'cooldown', 'unknown'] as const).map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        {t(`quotaPage.credentialStatus.${status}`)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium">
                {t('quotaPage.filters.collectionStatus')}
              </label>
              <Select
                value={filters.collectionStatus}
                onValueChange={(collectionStatus) =>
                  onChange({
                    ...filters,
                    collectionStatus: collectionStatus as QuotaFilters['collectionStatus'],
                  })
                }
              >
                <SelectTrigger aria-label={t('quotaPage.filters.collectionStatus')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('quotaPage.filters.allCollectionStatuses')}
                  </SelectItem>
                  {(
                    ['idle', 'collecting', 'success', 'partial', 'failed', 'unsupported'] as const
                  ).map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`quotaPage.collection.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {advancedFilterCount > 0 ? (
              <Button
                variant="text"
                size="sm"
                className="justify-self-start px-0"
                onClick={() =>
                  onChange({
                    ...filters,
                    source: 'all',
                    credentialStatus: 'all',
                    collectionStatus: 'all',
                  })
                }
              >
                {t('quotaPage.filters.clearAdvanced')}
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function QuotaPaginationBar({
  pagination,
  total,
  disabled,
  onChange,
}: {
  pagination: QuotaPagination
  total: number
  disabled: boolean
  onChange: (pagination: QuotaPagination) => void
}) {
  const { t } = useTranslation()
  if (pagination.offset === 0 && total <= pagination.limit) return null

  const start = total === 0 ? 0 : pagination.offset + 1
  const end = Math.min(total, pagination.offset + pagination.limit)

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
      <TablePaginationStatus
        text={t('quotaPage.pagination.range', { start, end, total })}
        announcementKey={`${pagination.offset}:${pagination.limit}:${total}`}
        busy={disabled}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(pagination.limit)}
          onValueChange={(value) => onChange({ limit: Number(value), offset: 0 })}
        >
          <SelectTrigger
            className="min-h-11 w-32 md:min-h-0"
            size="sm"
            aria-label={t('quotaPage.pagination.pageSize')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {quotaPageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t('quotaPage.pagination.rows', { count: size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 md:min-h-0"
          disabled={disabled || pagination.offset === 0}
          onClick={() =>
            onChange({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })
          }
        >
          {t('quotaPage.pagination.previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 md:min-h-0"
          disabled={disabled || pagination.offset + pagination.limit >= total}
          onClick={() => onChange({ ...pagination, offset: pagination.offset + pagination.limit })}
        >
          {t('quotaPage.pagination.next')}
        </Button>
      </div>
    </div>
  )
}

export function QuotaTable({
  items,
  hasAnyItems,
  onView,
}: {
  items: QuotaCredential[]
  hasAnyItems: boolean
  onView: (item: QuotaCredential) => void
}) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <TableEmptyState
        kind={hasAnyItems ? 'filtered-empty' : 'empty'}
        title={t(hasAnyItems ? 'quotaPage.table.filteredEmptyTitle' : 'quotaPage.table.emptyTitle')}
        description={t(
          hasAnyItems
            ? 'quotaPage.table.filteredEmptyDescription'
            : 'quotaPage.table.emptyDescription',
        )}
      />
    )
  }

  return (
    <Table className="min-w-[980px]" containerClassName={containedTableContainerClassName}>
      <TableHeader className={stickyTableHeaderClassName}>
        <TableRow>
          <TableHead className="w-[260px] pl-4">{t('quotaPage.table.credential')}</TableHead>
          <TableHead className="w-[130px]">{t('quotaPage.table.status')}</TableHead>
          <TableHead className="min-w-[250px]">{t('quotaPage.table.quota')}</TableHead>
          <TableHead className="hidden w-[170px] lg:table-cell">
            {t('quotaPage.table.reset')}
          </TableHead>
          <TableHead className="hidden w-[150px] xl:table-cell">
            {t('quotaPage.table.source')}
          </TableHead>
          <TableHead className="hidden w-[180px] 2xl:table-cell">
            {t('quotaPage.table.observed')}
          </TableHead>
          <TableHead className="w-[128px] pr-4 text-right">
            {t('quotaPage.table.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="pl-4">
              <div className="flex min-w-0 items-start gap-3">
                <ProviderLogo providerId={item.provider} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {item.account ?? item.authIndex ?? t('quotaPage.common.notAvailable')}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">{item.provider}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="grid justify-items-start gap-1.5">
                <QuotaStatusBadge status={item.status} />
                <MetadataBadge>{t(`quotaPage.freshness.${item.freshness}`)}</MetadataBadge>
                <CollectionStatus status={item.collectionStatus} />
              </div>
            </TableCell>
            <TableCell>
              <QuotaSummaryCell item={item} />
            </TableCell>
            <TableCell className="text-muted-foreground hidden lg:table-cell">
              <QuotaResetTime item={item} />
            </TableCell>
            <TableCell className="hidden xl:table-cell">
              <MetadataBadge>{t(`quotaPage.source.${item.source}`)}</MetadataBadge>
            </TableCell>
            <TableCell className="text-muted-foreground hidden 2xl:table-cell">
              {formatQuotaDateTime(item.observedAt) ?? t('quotaPage.common.notAvailable')}
            </TableCell>
            <TableCell className="pr-4 text-right">
              <Button
                variant="text"
                size="sm"
                className="min-h-11 px-2 md:min-h-0"
                onClick={() => onView(item)}
                aria-label={t('quotaPage.table.viewLabel', { name: item.name })}
                title={t('quotaPage.table.view')}
              >
                <Eye className="size-4" aria-hidden="true" />
                {t('quotaPage.table.view')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border px-3 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 min-w-0 truncate text-sm">{children}</dd>
    </div>
  )
}

export function QuotaDetailSheet({
  item,
  open,
  fullDetailsLoaded = false,
  pending = false,
  unsupported = false,
  error = null,
  onOpenChange,
}: {
  item: QuotaCredential | null
  open: boolean
  fullDetailsLoaded?: boolean
  pending?: boolean
  unsupported?: boolean
  error?: ManagementApiError | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const displayWindows = item ? (fullDetailsLoaded ? item.windows : item.primaryWindows) : []
  const canViewAccountCredential = item
    ? supportsAccountCredentialRoute(item.credentialType)
    : false

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5">
          <div className="min-w-0">
            <SheetTitle>{t('quotaPage.detail.title')}</SheetTitle>
            <div className="mt-1 flex min-w-0 items-center gap-3">
              <SheetDescription className="min-w-0 truncate">
                {item?.name ?? t('quotaPage.detail.empty')}
              </SheetDescription>
              {item && canViewAccountCredential ? (
                <Button
                  asChild
                  variant="text"
                  size="sm"
                  className="text-primary hover:text-primary min-h-11 w-fit sm:min-h-0"
                >
                  <Link
                    to="/admin/credentials"
                    search={{ credential: item.id, q: item.authIndex ?? item.name }}
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    {t('quotaPage.detail.viewCredential')}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        {pending ? (
          <div
            className="text-muted-foreground flex items-center gap-2 border-b px-5 py-3 text-sm"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('quotaPage.detail.loading')}
          </div>
        ) : null}

        {unsupported ? (
          <div className="border-info/25 bg-info/10 mx-5 mt-5 rounded-md border p-3 text-sm">
            <p className="font-medium">{t('quotaPage.detail.unsupportedTitle')}</p>
            <p className="text-muted-foreground mt-1 leading-6">
              {t('quotaPage.detail.unsupportedDescription')}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="border-warning/30 bg-warning/10 mx-5 mt-5 rounded-md border p-3 text-sm">
            <p className="font-medium">{t('quotaPage.detail.loadError')}</p>
            <p className="text-muted-foreground mt-1 leading-6 break-words">{error.message}</p>
            {error.backendCode || error.requestId ? (
              <p className="text-muted-foreground mt-2 font-mono text-xs break-all">
                {[error.backendCode, error.requestId].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}

        {item ? (
          <div className="grid gap-6 p-5">
            <section className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ProviderLogo providerId={item.provider} size="lg" />
                <QuotaStatusBadge status={item.status} />
                <MetadataBadge>{t(`quotaPage.freshness.${item.freshness}`)}</MetadataBadge>
                <MetadataBadge>{t(`quotaPage.source.${item.source}`)}</MetadataBadge>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailField label={t('quotaPage.detail.account')}>
                  {item.account ?? t('quotaPage.common.notAvailable')}
                </DetailField>
                <DetailField label={t('quotaPage.detail.provider')}>{item.provider}</DetailField>
                <DetailField label={t('quotaPage.detail.credentialType')}>
                  {t(`quotaPage.credentialType.${item.credentialType}`)}
                </DetailField>
                <DetailField label={t('quotaPage.detail.project')}>
                  {item.project ?? t('quotaPage.common.notAvailable')}
                </DetailField>
                <DetailField label={t('quotaPage.detail.authIndex')}>
                  <span className="font-mono text-xs">
                    {item.authIndex ?? t('quotaPage.common.notAvailable')}
                  </span>
                </DetailField>
                <DetailField label={t('quotaPage.detail.credentialStatus')}>
                  {t(`quotaPage.credentialStatus.${item.credentialStatus}`)}
                </DetailField>
              </dl>
            </section>

            <section>
              <h3 className="text-sm font-semibold">
                {t(
                  fullDetailsLoaded ? 'quotaPage.detail.windows' : 'quotaPage.detail.windowPreview',
                )}
              </h3>
              {!fullDetailsLoaded && item.windowCount > displayWindows.length ? (
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {t('quotaPage.detail.windowPreviewDescription', {
                    shown: displayWindows.length,
                    total: item.windowCount,
                  })}
                </p>
              ) : null}
              {displayWindows.length > 0 ? (
                <div className="mt-3 divide-y rounded-md border">
                  {displayWindows.map((window) => (
                    <div key={window.id} className="grid gap-3 p-4">
                      <QuotaWindowProgress window={window} />
                      <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">
                            {t(
                              item.freshness === 'stale'
                                ? 'quotaPage.window.lastKnownResetAt'
                                : 'quotaPage.window.resetAt',
                            )}
                          </dt>
                          <dd className="mt-0.5">
                            {formatQuotaDateTime(window.resetAt) ??
                              t('quotaPage.common.notAvailable')}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            {t('quotaPage.window.observedAt')}
                          </dt>
                          <dd className="mt-0.5">
                            {formatQuotaDateTime(window.observedAt) ??
                              t('quotaPage.common.notAvailable')}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <TableEmptyState
                  compact
                  className="m-0 mt-3"
                  kind={item.status === 'unsupported' ? 'unsupported' : 'empty'}
                  title={t('quotaPage.detail.noWindowsTitle')}
                  description={t('quotaPage.detail.noWindowsDescription')}
                  icon={CircleGauge}
                />
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold">{t('quotaPage.detail.collection')}</h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailField label={t('quotaPage.detail.collectionStatus')}>
                  <CollectionStatus status={item.collectionStatus} />
                </DetailField>
                <DetailField label={t('quotaPage.detail.source')}>
                  {t(`quotaPage.source.${item.source}`)}
                </DetailField>
                <DetailField label={t('quotaPage.detail.observedAt')}>
                  {formatQuotaDateTime(item.observedAt) ?? t('quotaPage.common.notAvailable')}
                </DetailField>
                <DetailField label={t('quotaPage.detail.expiresAt')}>
                  {formatQuotaDateTime(item.expiresAt) ?? t('quotaPage.common.notAvailable')}
                </DetailField>
                <DetailField
                  label={t(
                    item.freshness === 'stale'
                      ? 'quotaPage.window.lastKnownResetAt'
                      : 'quotaPage.detail.earliestResetAt',
                  )}
                >
                  {formatQuotaDateTime(item.earliestResetAt) ?? t('quotaPage.common.notAvailable')}
                </DetailField>
                <DetailField label={t('quotaPage.detail.lastAttemptAt')}>
                  {formatQuotaDateTime(item.lastAttemptAt) ?? t('quotaPage.common.notAvailable')}
                </DetailField>
                <DetailField label={t('quotaPage.detail.nextProbeAt')}>
                  {formatQuotaDateTime(item.nextProbeAt) ?? t('quotaPage.common.notAvailable')}
                </DetailField>
                <DetailField label={t('quotaPage.detail.lastSuccessAt')}>
                  {formatQuotaDateTime(item.lastSuccessAt) ?? t('quotaPage.common.notAvailable')}
                </DetailField>
                <DetailField label={t('quotaPage.detail.consecutiveFailures')}>
                  {new Intl.NumberFormat(getDateTimeLocale()).format(item.consecutiveFailures)}
                </DetailField>
              </dl>
              {item.lastError ? (
                <div className="border-warning/30 bg-warning/10 mt-3 rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className="text-warning-foreground dark:text-warning mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t('quotaPage.detail.lastError')}</p>
                      <p className="text-muted-foreground mt-1 text-sm leading-6 break-words">
                        {item.lastError.message}
                      </p>
                      {item.lastError.code ? (
                        <p className="text-muted-foreground mt-1 font-mono text-xs">
                          {item.lastError.code}
                        </p>
                      ) : null}
                      <dl className="text-muted-foreground mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt>{t('quotaPage.detail.errorOccurredAt')}</dt>
                          <dd className="text-foreground mt-0.5">
                            {formatQuotaDateTime(item.lastError.occurredAt) ??
                              t('quotaPage.common.notAvailable')}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('quotaPage.detail.errorRetryable')}</dt>
                          <dd className="text-foreground mt-0.5">
                            {t(
                              item.lastError.retryable
                                ? 'quotaPage.common.yes'
                                : 'quotaPage.common.no',
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('quotaPage.detail.upstreamStatusCode')}</dt>
                          <dd className="text-foreground mt-0.5 font-mono">
                            {item.lastError.upstreamStatusCode ??
                              t('quotaPage.common.notAvailable')}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('quotaPage.detail.requestId')}</dt>
                          <dd className="text-foreground mt-0.5 font-mono break-all">
                            {item.lastError.requestId ?? t('quotaPage.common.notAvailable')}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            {item.runtime ? (
              <section>
                <h3 className="text-sm font-semibold">{t('quotaPage.detail.runtime')}</h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <DetailField label={t('quotaPage.detail.homeNode')}>
                    {item.runtime.homeLabel ??
                      item.runtime.homeId ??
                      t('quotaPage.common.notAvailable')}
                  </DetailField>
                  <DetailField label={t('quotaPage.detail.homeId')}>
                    <span className="font-mono text-xs">
                      {item.runtime.homeId ?? t('quotaPage.common.notAvailable')}
                    </span>
                  </DetailField>
                  <DetailField label={t('quotaPage.detail.cpaNode')}>
                    {item.runtime.cpaNodeLabel ??
                      item.runtime.cpaNodeId ??
                      t('quotaPage.common.notAvailable')}
                  </DetailField>
                  <DetailField label={t('quotaPage.detail.cpaNodeId')}>
                    <span className="font-mono text-xs">
                      {item.runtime.cpaNodeId ?? t('quotaPage.common.notAvailable')}
                    </span>
                  </DetailField>
                </dl>
              </section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
