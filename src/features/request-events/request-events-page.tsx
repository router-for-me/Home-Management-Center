import { useState } from 'react'

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CircleHelp,
  Columns3,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DiagnosticDetailField, TechnicalTextViewer } from '@/components/shared/diagnostic-detail'
import { TableEmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { SelectInputGroup } from '@/components/shared/select-input-group'
import type { SelectInputGroupOption } from '@/components/shared/select-input-group'
import {
  TablePaginationStatus,
  TableSurface,
  TableSurfaceHeader,
  containedTableContainerClassName,
  stickyTableHeaderClassName,
} from '@/components/shared/table-surface'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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
import type { LiveRefreshPauseReason } from '@/features/observability/live-refresh'
import {
  LiveRefreshControl,
  LiveRefreshStatusNotice,
  NewItemsNotice,
} from '@/features/observability/live-refresh-control'
import {
  CapabilityStrip,
  type CapabilityStripItem,
  IssueList,
  ObservabilityDisconnectedState,
  ObservabilityErrorState,
  ObservabilityLoadingState,
  downloadBlob,
  formatDateTime,
  getObservabilityVerdictBadgeClassName,
} from '@/features/observability/observability-components'
import { useRequestEventsWorkbench } from '@/features/request-events/use-request-events-workbench'
import type {
  RequestEvent,
  RequestEventDetail,
  RequestEventFilterOptions,
  RequestEventFilters,
  RequestEventsPage as RequestEventsPageData,
} from '@/lib/api/management/request-events'
import {
  defaultRequestEventFilters,
  isRequestEventLatencyRangeValid,
} from '@/lib/api/management/request-events'
import type { CapabilityMap, RuntimeMode } from '@/lib/api/management/types'
import { cn } from '@/lib/utils'

type RequestEventsVerdict = 'ready' | 'empty' | 'partial' | 'unsupported'
type RequestEventSearchField =
  | 'search'
  | 'requestId'
  | 'user'
  | 'clientKey'
  | 'credentialId'
  | 'authIndex'
type RequestEventColumnKey =
  | 'time'
  | 'event'
  | 'status'
  | 'model'
  | 'runtime'
  | 'client'
  | 'credential'
  | 'tokens'
  | 'latency'
  | 'cost'
  | 'request'
  | 'error'

type RequestEventColumn = {
  key: RequestEventColumnKey
  width: number
  align?: 'right'
  required?: boolean
}

const requestEventColumns: RequestEventColumn[] = [
  { key: 'time', width: 180, required: true },
  { key: 'event', width: 150 },
  { key: 'status', width: 130 },
  { key: 'model', width: 240 },
  { key: 'runtime', width: 210 },
  { key: 'client', width: 220 },
  { key: 'credential', width: 230 },
  { key: 'tokens', width: 150, align: 'right' },
  { key: 'latency', width: 140, align: 'right' },
  { key: 'cost', width: 130, align: 'right' },
  { key: 'request', width: 260 },
  { key: 'error', width: 260 },
]

const defaultVisibleColumns: RequestEventColumnKey[] = [
  'time',
  'event',
  'status',
  'model',
  'runtime',
  'client',
  'credential',
  'tokens',
  'latency',
  'request',
]

const actionColumnWidth = 112
const touchControlClassName = 'min-h-10 sm:min-h-8'
const touchButtonClassName = 'min-h-10 sm:min-h-8'
const touchInputClassName = 'min-h-10 sm:h-8 sm:min-h-8'
const requestEventFilterGridClassName = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
const requestEventSearchFields: RequestEventSearchField[] = [
  'requestId',
  'user',
  'clientKey',
  'credentialId',
  'authIndex',
  'search',
]
const requestEventSortKeys = [
  'timestamp_desc',
  'timestamp_asc',
  'latency_desc',
  'latency_asc',
  'tokens_desc',
  'tokens_asc',
  'cost_desc',
  'cost_asc',
  'failed_first',
] as const
const requestEventAdvancedFilterKeys: Array<keyof RequestEventFilters> = [
  'eventType',
  'homeIp',
  'cpaNode',
  'statusCode',
  'minLatencyMs',
  'maxLatencyMs',
  'sort',
]

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatDuration(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(2)} s`
}

function formatAmount(value: number | null, currency?: string | null) {
  if (value === null || !Number.isFinite(value)) return null
  const unit = currency?.trim() || 'credits'
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value)} ${unit}`
}

function getRuntimeNodeLabel(event: RequestEvent) {
  const cpa = event.runtime.cpaLabel ?? event.runtime.cpaNodeId ?? event.runtime.cpaIp
  if (cpa) return cpa
  if (event.runtime.cpaIp && event.runtime.cpaPort) {
    return `${event.runtime.cpaIp}:${event.runtime.cpaPort}`
  }
  return null
}

function getHomeNodeLabel(event: RequestEvent) {
  if (event.runtime.homeId) return event.runtime.homeId
  if (event.runtime.homeIp && event.runtime.homePort) {
    return `${event.runtime.homeIp}:${event.runtime.homePort}`
  }
  return event.runtime.homeIp
}

function hasActiveFilters(filters: RequestEventFilters) {
  return (
    filters.range !== '24h' ||
    filters.search.trim() !== '' ||
    filters.requestId.trim() !== '' ||
    filters.eventType !== 'all' ||
    filters.status !== 'all' ||
    filters.statusCode !== 'all' ||
    filters.provider !== 'all' ||
    filters.model !== 'all' ||
    filters.homeIp !== 'all' ||
    filters.cpaNode !== 'all' ||
    filters.credentialId.trim() !== '' ||
    filters.authIndex.trim() !== '' ||
    filters.user.trim() !== '' ||
    filters.clientKey.trim() !== '' ||
    filters.minLatencyMs.trim() !== '' ||
    filters.maxLatencyMs.trim() !== '' ||
    filters.sort !== 'timestamp_desc'
  )
}

function getActiveAdvancedFilterCount(filters: RequestEventFilters) {
  return requestEventAdvancedFilterKeys.filter(
    (key) => filters[key] !== defaultRequestEventFilters[key],
  ).length
}

function getActiveTextFilterCount(filters: RequestEventFilters) {
  return requestEventSearchFields.filter((key) => filters[key].trim() !== '').length
}

function getSearchFieldValue(filters: RequestEventFilters, field: RequestEventSearchField) {
  return filters[field]
}

function getNextSearchFieldPatch(
  field: RequestEventSearchField,
  value: string,
): Partial<RequestEventFilters> {
  const nextFilters = requestEventSearchFields.reduce<Partial<RequestEventFilters>>(
    (patch, searchField) => ({
      ...patch,
      [searchField]: searchField === field ? value : '',
    }),
    {},
  )

  return { ...nextFilters, offset: 0 }
}

function getRequestEventsVerdict({
  capabilities,
  page,
  errorMessage,
}: {
  capabilities: CapabilityMap
  page: RequestEventsPageData | null
  errorMessage: string | null
}): RequestEventsVerdict {
  if (!capabilities.requestEvents) return 'unsupported'
  if (errorMessage) return 'partial'
  if ((page?.total ?? 0) > 0) return 'ready'
  return 'empty'
}

function RequestEventsCapabilityStrip({ capabilities }: { capabilities: CapabilityMap }) {
  const { t } = useTranslation()
  const capabilityItems = [
    {
      available: capabilities.requestEvents,
      label: t('requestEventsPage.capabilities.events'),
      unavailableTone: 'warning',
    },
    {
      available: capabilities.requestEventDetails,
      label: t('requestEventsPage.capabilities.details'),
      unavailableTone: 'info',
    },
    {
      available: capabilities.requestEventExport,
      label: t('requestEventsPage.capabilities.export'),
      unavailableTone: 'info',
    },
  ] satisfies CapabilityStripItem[]

  return <CapabilityStrip items={capabilityItems} />
}

function RequestEventsHeader({
  canRefresh,
  capabilities,
  errorMessage,
  isFetching,
  updatedAt,
  onRefresh,
  page,
  runtimeMode,
}: {
  canRefresh: boolean
  capabilities: CapabilityMap
  errorMessage: string | null
  isFetching: boolean
  updatedAt: string | null
  onRefresh: () => void
  page: RequestEventsPageData | null
  runtimeMode: RuntimeMode
}) {
  const { t, i18n } = useTranslation()
  const verdict = getRequestEventsVerdict({ capabilities, page, errorMessage })

  return (
    <PageHeader
      title={t(`requestEventsPage.verdict.${verdict}.title`)}
      titleMeta={
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
            getObservabilityVerdictBadgeClassName(verdict),
          )}
        >
          {t(`requestEventsPage.verdict.${verdict}.badge`)}
        </span>
      }
      description={t(`requestEventsPage.verdict.${verdict}.description`, {
        mode: t(`runtimeMode.${runtimeMode}`),
      })}
      meta={
        <>
          <span>
            {t('usageLogsPage.header.runtime', { mode: t(`runtimeMode.${runtimeMode}`) })}
          </span>
          {updatedAt ? (
            <span>
              {t('usageLogsPage.header.updatedAt', {
                time: formatDateTime(updatedAt, i18n) ?? updatedAt,
              })}
            </span>
          ) : null}
        </>
      }
      tags={<RequestEventsCapabilityStrip capabilities={capabilities} />}
      actions={
        <Button variant="outline" disabled={!canRefresh || isFetching} onClick={onRefresh}>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {isFetching
            ? t('requestEventsPage.actions.syncing')
            : t('requestEventsPage.actions.refresh')}
        </Button>
      }
    />
  )
}

function appendSelectedOption(options: string[], value: string) {
  if (!value || value === 'all' || options.includes(value)) return options
  return [...options, value].sort()
}

function RequestEventsFiltersToolbar({
  disabled,
  filters,
  options,
  onChange,
}: {
  disabled: boolean
  filters: RequestEventFilters
  options: RequestEventFilterOptions | null
  onChange: (nextFilters: Partial<RequestEventFilters>) => void
}) {
  const { t } = useTranslation()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [searchField, setSearchField] = useState<RequestEventSearchField>('requestId')
  const eventTypes = appendSelectedOption(options?.eventTypes ?? [], filters.eventType)
  const providers = appendSelectedOption(options?.providers ?? [], filters.provider)
  const models = appendSelectedOption(options?.models ?? [], filters.model)
  const homeIps = appendSelectedOption(options?.homeIps ?? [], filters.homeIp)
  const cpaNodes = appendSelectedOption(options?.cpaNodes ?? [], filters.cpaNode)
  const statusCodes = appendSelectedOption(options?.statusCodes ?? [], filters.statusCode)
  const latencyRangeInvalid = !isRequestEventLatencyRangeValid(filters)
  const activeAdvancedFilterCount = getActiveAdvancedFilterCount(filters)
  const activeSearchField =
    requestEventSearchFields.find((field) => filters[field].trim()) ?? searchField
  const searchValue = getSearchFieldValue(filters, activeSearchField)
  const activeHiddenFilterCount =
    activeAdvancedFilterCount +
    Math.max(0, getActiveTextFilterCount(filters) - (searchValue.trim() ? 1 : 0))
  const searchOptions = requestEventSearchFields.map(
    (field) =>
      ({
        value: field,
        label: t(`requestEventsPage.filters.searchFields.${field}`),
      }) satisfies SelectInputGroupOption,
  )

  const handleSearchFieldChange = (nextField: string) => {
    const nextSearchField = nextField as RequestEventSearchField
    const currentValue = getSearchFieldValue(filters, activeSearchField)
    setSearchField(nextSearchField)
    onChange(getNextSearchFieldPatch(nextSearchField, currentValue))
  }

  return (
    <Collapsible
      open={advancedOpen}
      onOpenChange={setAdvancedOpen}
      className="bg-card rounded-lg border p-3 shadow-sm"
    >
      <div className={requestEventFilterGridClassName}>
        <SelectInputGroup
          selectValue={activeSearchField}
          inputValue={searchValue}
          options={searchOptions}
          disabled={disabled}
          className="sm:w-full"
          selectAriaLabel={t('requestEventsPage.filters.searchBy')}
          inputAriaLabel={t('requestEventsPage.filters.searchPlaceholder', {
            field: t(`requestEventsPage.filters.searchFields.${activeSearchField}`),
          })}
          inputPlaceholder={t('requestEventsPage.filters.searchPlaceholder', {
            field: t(`requestEventsPage.filters.searchFields.${activeSearchField}`),
          })}
          onSelectValueChange={handleSearchFieldChange}
          onInputValueChange={(value) =>
            onChange(getNextSearchFieldPatch(activeSearchField, value))
          }
        />
        <Select
          value={filters.range}
          disabled={disabled}
          onValueChange={(range) =>
            onChange({ range: range as RequestEventFilters['range'], offset: 0 })
          }
        >
          <SelectTrigger className={touchControlClassName} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              ['4h', '12h', '24h', 'today', 'yesterday', '7d', '30d', '90d', 'custom'] as const
            ).map((range) => (
              <SelectItem key={range} value={range}>
                {t(`requestEventsPage.filters.ranges.${range}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          disabled={disabled}
          onValueChange={(status) =>
            onChange({ status: status as RequestEventFilters['status'], offset: 0 })
          }
        >
          <SelectTrigger className={touchControlClassName} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('requestEventsPage.filters.statuses.all')}</SelectItem>
            <SelectItem value="success">
              {t('requestEventsPage.filters.statuses.success')}
            </SelectItem>
            <SelectItem value="failed">{t('requestEventsPage.filters.statuses.failed')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.provider}
          disabled={disabled}
          onValueChange={(provider) => onChange({ provider, offset: 0 })}
        >
          <SelectTrigger className={touchControlClassName} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('requestEventsPage.filters.anyProvider')}</SelectItem>
            {providers.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.model}
          disabled={disabled}
          onValueChange={(model) => onChange({ model, offset: 0 })}
        >
          <SelectTrigger className={touchControlClassName} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('requestEventsPage.filters.anyModel')}</SelectItem>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filters.range === 'custom' ? (
        <div className={cn(requestEventFilterGridClassName, 'mt-3 border-t pt-3')}>
          <Input
            className={touchInputClassName}
            type="datetime-local"
            value={filters.customFrom}
            disabled={disabled}
            aria-label={t('requestEventsPage.filters.customFrom')}
            onChange={(event) => onChange({ customFrom: event.target.value, offset: 0 })}
          />
          <Input
            className={touchInputClassName}
            type="datetime-local"
            value={filters.customTo}
            disabled={disabled}
            aria-label={t('requestEventsPage.filters.customTo')}
            onChange={(event) => onChange({ customTo: event.target.value, offset: 0 })}
          />
        </div>
      ) : null}
      <CollapsibleContent>
        <div className={cn(requestEventFilterGridClassName, 'mt-3 border-t pt-3')}>
          <Select
            value={filters.eventType}
            disabled={disabled}
            onValueChange={(eventType) => onChange({ eventType, offset: 0 })}
          >
            <SelectTrigger className={touchControlClassName} size="sm">
              <SelectValue placeholder={t('requestEventsPage.filters.eventType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('requestEventsPage.filters.anyEventType')}</SelectItem>
              {eventTypes.map((eventType) => (
                <SelectItem key={eventType} value={eventType}>
                  {eventType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.homeIp}
            disabled={disabled}
            onValueChange={(homeIp) => onChange({ homeIp, offset: 0 })}
          >
            <SelectTrigger className={touchControlClassName} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('requestEventsPage.filters.anyHome')}</SelectItem>
              {homeIps.map((homeIp) => (
                <SelectItem key={homeIp} value={homeIp}>
                  {homeIp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.cpaNode}
            disabled={disabled}
            onValueChange={(cpaNode) => onChange({ cpaNode, offset: 0 })}
          >
            <SelectTrigger className={touchControlClassName} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('requestEventsPage.filters.anyCpa')}</SelectItem>
              {cpaNodes.map((cpaNode) => (
                <SelectItem key={cpaNode} value={cpaNode}>
                  {cpaNode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.statusCode}
            disabled={disabled}
            onValueChange={(statusCode) => onChange({ statusCode, offset: 0 })}
          >
            <SelectTrigger className={touchControlClassName} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('requestEventsPage.filters.anyStatusCode')}</SelectItem>
              {statusCodes.map((statusCode) => (
                <SelectItem key={statusCode} value={statusCode}>
                  {statusCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.sort}
            disabled={disabled}
            onValueChange={(sort) =>
              onChange({ sort: sort as RequestEventFilters['sort'], offset: 0 })
            }
          >
            <SelectTrigger className={touchControlClassName} size="sm">
              <SelectValue placeholder={t('requestEventsPage.filters.sort')} />
            </SelectTrigger>
            <SelectContent>
              {requestEventSortKeys.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {t(`requestEventsPage.filters.sorts.${sort}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NumberRangeInputGroup
            minValue={filters.minLatencyMs}
            maxValue={filters.maxLatencyMs}
            label={t('requestEventsPage.filters.latencyRange')}
            minPlaceholder={t('requestEventsPage.filters.minLatencyPlaceholder')}
            maxPlaceholder={t('requestEventsPage.filters.maxLatencyPlaceholder')}
            separatorLabel={t('requestEventsPage.filters.rangeSeparator')}
            disabled={disabled}
            invalid={Boolean(latencyRangeInvalid)}
            className="sm:col-span-2"
            onMinChange={(value) => onChange({ minLatencyMs: value, offset: 0 })}
            onMaxChange={(value) => onChange({ maxLatencyMs: value, offset: 0 })}
          />
        </div>
      </CollapsibleContent>
      {latencyRangeInvalid ? (
        <p className="text-destructive mt-2 text-xs">
          {t('requestEventsPage.filters.rangeInvalid')}
        </p>
      ) : null}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="border-border/80 bg-muted/20 text-muted-foreground hover:border-primary/35 hover:bg-primary/5 hover:text-foreground focus-visible:ring-ring mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:h-9 sm:min-h-9"
          aria-label={
            advancedOpen
              ? t('requestEventsPage.filters.hideAdvanced')
              : t('requestEventsPage.filters.advanced')
          }
        >
          <span>
            {advancedOpen
              ? t('requestEventsPage.filters.hideAdvanced')
              : t('requestEventsPage.filters.advanced')}
          </span>
          {activeHiddenFilterCount > 0 ? (
            <span className="border-border bg-background text-foreground rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-none">
              {activeHiddenFilterCount}
            </span>
          ) : null}
          {advancedOpen ? (
            <ChevronsUp className="text-primary size-5 stroke-[2.4]" aria-hidden="true" />
          ) : (
            <ChevronsDown className="text-primary size-5 stroke-[2.4]" aria-hidden="true" />
          )}
        </button>
      </CollapsibleTrigger>
    </Collapsible>
  )
}

function RequestEventStatusBadge({ event }: { event: RequestEvent }) {
  const { t } = useTranslation()
  const success = event.status === 'success'
  const failed = event.status === 'failed'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium',
        success
          ? 'border-success/30 bg-success/10 text-success'
          : failed
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : 'border-muted-foreground/25 bg-muted text-muted-foreground',
      )}
    >
      {success ? (
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
      ) : failed ? (
        <XCircle className="size-3.5" aria-hidden="true" />
      ) : (
        <CircleHelp className="size-3.5" aria-hidden="true" />
      )}
      {success
        ? t('requestEventsPage.status.success')
        : failed
          ? t('requestEventsPage.status.failed')
          : t('requestEventsPage.status.unknown')}
    </span>
  )
}

function NumberRangeInputGroup({
  className,
  disabled,
  invalid,
  label,
  maxPlaceholder,
  maxValue,
  minPlaceholder,
  minValue,
  onMaxChange,
  onMinChange,
  separatorLabel,
}: {
  className?: string
  disabled: boolean
  invalid: boolean
  label: string
  maxPlaceholder: string
  maxValue: string
  minPlaceholder: string
  minValue: string
  onMaxChange: (value: string) => void
  onMinChange: (value: string) => void
  separatorLabel: string
}) {
  return (
    <div
      className={cn(
        'border-input bg-background focus-within:ring-ring flex min-h-10 min-w-0 items-center rounded-md border shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] sm:h-8 sm:min-h-8',
        invalid && 'border-destructive focus-within:ring-destructive/20',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      role="group"
      aria-label={label}
      aria-invalid={invalid || undefined}
    >
      <Input
        className="h-full min-h-0 rounded-r-none border-0 bg-transparent px-3 text-center shadow-none focus-visible:ring-0 sm:h-full"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={minValue}
        disabled={disabled}
        placeholder={minPlaceholder}
        aria-label={minPlaceholder}
        onChange={(event) => onMinChange(event.target.value)}
      />
      <span
        className="text-muted-foreground bg-muted/45 flex h-full min-w-8 shrink-0 items-center justify-center border-x px-2 text-xs"
        aria-hidden="true"
      >
        {separatorLabel}
      </span>
      <Input
        className="h-full min-h-0 rounded-l-none border-0 bg-transparent px-3 text-center shadow-none focus-visible:ring-0 sm:h-full"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={maxValue}
        disabled={disabled}
        placeholder={maxPlaceholder}
        aria-label={maxPlaceholder}
        onChange={(event) => onMaxChange(event.target.value)}
      />
    </div>
  )
}

function RequestEventDetailSheet({
  detail,
  downloadingRequestLogId,
  error,
  isDownloadingRequestLog,
  mutating,
  onDownloadRequestLog,
  onOpenChange,
  pending,
}: {
  detail: RequestEventDetail | null
  downloadingRequestLogId: string | null
  error: Error | null
  isDownloadingRequestLog: boolean
  mutating: boolean
  onDownloadRequestLog: (
    requestId: string,
    homeIp?: string | null,
    homePort?: number | null,
  ) => void
  onOpenChange: (open: boolean) => void
  pending: boolean
}) {
  const { t, i18n } = useTranslation()
  const event = detail?.event ?? null
  const payloadSummary = detail?.payloadSummary ?? null
  const logExcerpt = detail?.logExcerpt ?? []
  const requestLog = event?.related?.requestLog ?? null
  const requestLogAvailable = requestLog?.available === true
  const copyLabel = t('requestEventsPage.detail.actions.copy')
  const copiedLabel = t('requestEventsPage.detail.actions.copied')
  const wrapLinesLabel = t('requestEventsPage.detail.actions.wrapLines')
  const preserveLinesLabel = t('requestEventsPage.detail.actions.preserveLines')
  const downloading =
    Boolean(requestLog?.requestId) &&
    isDownloadingRequestLog &&
    downloadingRequestLogId === requestLog?.requestId

  return (
    <Sheet open={Boolean(event) || pending || Boolean(error)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden p-0 focus:outline-hidden sm:max-w-3xl">
        <SheetHeader className="min-w-0 border-b p-4">
          <SheetTitle>{t('requestEventsPage.detail.title')}</SheetTitle>
          <SheetDescription className="[overflow-wrap:anywhere] break-words">
            {event?.timestamp
              ? (formatDateTime(event.timestamp, i18n) ?? event.timestamp)
              : t('requestEventsPage.status.notAvailable')}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
          {pending ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('requestEventsPage.detail.loading')}
            </div>
          ) : error ? (
            <TableEmptyState
              kind="error"
              title={t('requestEventsPage.detail.errorTitle')}
              description={error.message}
            />
          ) : event ? (
            <div className="grid min-w-0 grid-cols-1 gap-4">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.eventType')}>
                  {event.eventType ?? t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.status')}>
                  <RequestEventStatusBadge event={event} />
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  label={t('requestEventsPage.detail.fields.requestId')}
                  copyValue={event.requestId}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {event.requestId ?? t('requestEventsPage.status.unknownRequest')}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  label={t('requestEventsPage.detail.fields.upstreamRequestId')}
                  copyValue={event.upstreamRequestId}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {event.upstreamRequestId ?? t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.model')}>
                  {event.provider ?? t('requestEventsPage.status.notAvailable')} /{' '}
                  {event.model ?? t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  className="sm:col-span-2"
                  label={t('requestEventsPage.detail.fields.endpoint')}
                  copyValue={event.endpoint}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {event.endpoint ?? t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.home')}>
                  {getHomeNodeLabel(event) ?? t('requestEventsPage.status.localHome')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.cpa')}>
                  {getRuntimeNodeLabel(event) ?? t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.client')}>
                  {event.client?.username ??
                    event.client?.clientKeyLabel ??
                    event.client?.clientKeyMasked ??
                    t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.credential')}>
                  {event.credential?.label ??
                    event.credential?.authIndex ??
                    t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.latency')}>
                  {formatDuration(event.performance.latencyMs) ??
                    t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.cost')}>
                  {formatAmount(event.billing?.amount ?? null, event.billing?.currency) ??
                    t('requestEventsPage.status.notAvailable')}
                </DiagnosticDetailField>
              </div>

              <div>
                <h3 className="text-sm font-medium">{t('requestEventsPage.detail.tokens')}</h3>
                <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      'inputTokens',
                      'outputTokens',
                      'reasoningTokens',
                      'cachedTokens',
                      'cacheReadTokens',
                      'cacheCreationTokens',
                      'totalTokens',
                    ] as const
                  ).map((key) => (
                    <DiagnosticDetailField
                      key={key}
                      label={t(`requestEventsPage.detail.tokenFields.${key}`)}
                    >
                      {formatNumber(event.tokens[key])}
                    </DiagnosticDetailField>
                  ))}
                </div>
              </div>

              {event.error ? (
                <div>
                  <h3 className="text-sm font-medium">{t('requestEventsPage.detail.error')}</h3>
                  <TechnicalTextViewer
                    content={
                      event.error.bodyPreview ??
                      event.error.message ??
                      event.error.reason ??
                      t('requestEventsPage.status.notAvailable')
                    }
                    copyLabel={copyLabel}
                    copiedLabel={copiedLabel}
                    wrapLinesLabel={wrapLinesLabel}
                    preserveLinesLabel={preserveLinesLabel}
                    maxHeightClassName="max-h-52"
                    minHeightClassName="min-h-24"
                  />
                </div>
              ) : null}

              {payloadSummary ? (
                <div>
                  <h3 className="text-sm font-medium">{t('requestEventsPage.detail.payload')}</h3>
                  <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    <DiagnosticDetailField
                      label={t('requestEventsPage.detail.payloadFields.method')}
                    >
                      {payloadSummary.method ?? t('requestEventsPage.status.notAvailable')}
                    </DiagnosticDetailField>
                    <DiagnosticDetailField
                      label={t('requestEventsPage.detail.payloadFields.stream')}
                    >
                      {payloadSummary.stream === null
                        ? t('requestEventsPage.status.notAvailable')
                        : payloadSummary.stream
                          ? t('requestEventsPage.status.yes')
                          : t('requestEventsPage.status.no')}
                    </DiagnosticDetailField>
                    <DiagnosticDetailField
                      label={t('requestEventsPage.detail.payloadFields.messages')}
                    >
                      {payloadSummary.messageCount ?? t('requestEventsPage.status.notAvailable')}
                    </DiagnosticDetailField>
                    <DiagnosticDetailField
                      label={t('requestEventsPage.detail.payloadFields.tools')}
                    >
                      {payloadSummary.toolCount ?? t('requestEventsPage.status.notAvailable')}
                    </DiagnosticDetailField>
                  </div>
                </div>
              ) : null}

              {logExcerpt.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium">
                    {t('requestEventsPage.detail.logExcerpt')}
                  </h3>
                  <TechnicalTextViewer
                    content={logExcerpt.join('\n')}
                    copyLabel={copyLabel}
                    copiedLabel={copiedLabel}
                    wrapLinesLabel={wrapLinesLabel}
                    preserveLinesLabel={preserveLinesLabel}
                    maxHeightClassName="max-h-64"
                    minHeightClassName="min-h-28"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {event ? (
          <div className="bg-popover border-t p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!requestLogAvailable || !requestLog?.requestId || mutating}
              onClick={() =>
                requestLog?.requestId &&
                onDownloadRequestLog(requestLog.requestId, requestLog.homeIp, requestLog.homePort)
              }
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {t('requestEventsPage.actions.downloadRequestLog')}
            </Button>
            {!requestLogAvailable ? (
              <p className="text-muted-foreground mt-2 text-xs">
                {t('requestEventsPage.detail.requestLogUnavailable')}
              </p>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function RequestEventsTable({
  canExport,
  errorMessage,
  events,
  filters,
  filterOptions,
  filtersValid,
  isExporting,
  fetching,
  mutating,
  liveRefresh,
  liveRefreshIntervalMs,
  liveRefreshError,
  liveRefreshLastSuccessAt,
  pendingItemCount,
  pendingItemsTruncated,
  onAcceptPendingItems,
  onClearFilters,
  onExport,
  onFilterChange,
  onInspect,
  onLimitChange,
  onOffsetChange,
  pageSizeOptions,
}: {
  canExport: boolean
  errorMessage: string | null
  events: RequestEventsPageData | null
  filters: RequestEventFilters
  filterOptions: RequestEventFilterOptions | null
  filtersValid: boolean
  isExporting: boolean
  fetching: boolean
  mutating: boolean
  liveRefresh: {
    enabled: boolean
    active: boolean
    pauseReason: LiveRefreshPauseReason | null
    available: boolean
    setEnabled: (enabled: boolean) => void
  }
  liveRefreshIntervalMs: number
  liveRefreshError: boolean
  liveRefreshLastSuccessAt: number | null
  pendingItemCount: number
  pendingItemsTruncated: boolean
  onAcceptPendingItems: () => void
  onClearFilters: () => void
  onExport: () => void
  onFilterChange: (nextFilters: Partial<RequestEventFilters>) => void
  onInspect: (event: RequestEvent) => void
  onLimitChange: (limit: number) => void
  onOffsetChange: (offset: number) => void
  pageSizeOptions: number[]
}) {
  const liveRefreshStatusId = 'request-events-live-refresh-status'
  const { t, i18n } = useTranslation()
  const [visibleColumns, setVisibleColumns] =
    useState<RequestEventColumnKey[]>(defaultVisibleColumns)
  const rows = events?.items ?? []
  const total = events?.total ?? 0
  const start = total > 0 ? filters.offset + 1 : 0
  const end = Math.min(filters.offset + rows.length, total)
  const canGoPrevious = filters.offset > 0
  const canGoNext = filters.offset + filters.limit < total
  const activeFilters = hasActiveFilters(filters)
  const visibleColumnConfigs = requestEventColumns.filter((column) =>
    visibleColumns.includes(column.key),
  )
  const tableWidth =
    visibleColumnConfigs.reduce((width, column) => width + column.width, actionColumnWidth) + 16

  const toggleColumn = (columnKey: RequestEventColumnKey, checked: boolean) => {
    const column = requestEventColumns.find((item) => item.key === columnKey)
    if (column?.required && !checked) return

    setVisibleColumns((currentColumns) => {
      if (checked) {
        return currentColumns.includes(columnKey) ? currentColumns : [...currentColumns, columnKey]
      }
      return currentColumns.filter((item) => item !== columnKey)
    })
  }

  const isColumnVisible = (column: RequestEventColumnKey) => visibleColumns.includes(column)

  return (
    <TableSurface className="min-w-0">
      <TableSurfaceHeader
        title={t('requestEventsPage.table.title')}
        actions={
          <LiveRefreshControl
            enabled={liveRefresh.enabled}
            disabled={!liveRefresh.available}
            describedBy={!liveRefresh.available ? liveRefreshStatusId : undefined}
            onEnabledChange={liveRefresh.setEnabled}
          />
        }
      />

      <LiveRefreshStatusNotice
        id={liveRefreshStatusId}
        enabled={liveRefresh.enabled}
        active={liveRefresh.active}
        pauseReason={liveRefresh.pauseReason}
        intervalMs={liveRefreshIntervalMs}
        hasError={liveRefreshError}
        lastSuccessAt={liveRefreshLastSuccessAt}
        className="mx-3 mt-3"
      />

      <div className="border-b px-3 py-3">
        <RequestEventsFiltersToolbar
          disabled={mutating}
          filters={filters}
          options={filterOptions}
          onChange={onFilterChange}
        />
      </div>

      {events && rows.length > 0 ? (
        <div className="border-border/80 bg-muted/20 flex flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {activeFilters ? (
              <Button
                type="button"
                variant="text"
                size="sm"
                className={touchButtonClassName}
                disabled={mutating}
                onClick={onClearFilters}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('requestEventsPage.table.clearFilters')}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={touchButtonClassName}
              disabled={!canExport || !filtersValid || rows.length === 0 || isExporting || mutating}
              onClick={onExport}
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {canExport
                ? t('requestEventsPage.actions.export')
                : t('requestEventsPage.actions.exportUnsupported')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className={touchButtonClassName}>
                  <Columns3 className="size-4" aria-hidden="true" />
                  {t('requestEventsPage.table.columnsButton')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('requestEventsPage.table.columnsMenu')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {requestEventColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={isColumnVisible(column.key)}
                    disabled={column.required}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => toggleColumn(column.key, Boolean(checked))}
                  >
                    {t(`requestEventsPage.table.columns.${column.key}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : null}

      <NewItemsNotice
        count={pendingItemCount}
        truncated={pendingItemsTruncated}
        className="mx-3 mt-3"
        onAccept={onAcceptPendingItems}
      />

      {events ? (
        rows.length > 0 ? (
          <div className="px-3 py-3">
            <Table
              containerClassName={cn(
                containedTableContainerClassName,
                'max-h-[min(680px,calc(100vh-250px))] rounded-md border',
              )}
              className="table-fixed"
              style={{ minWidth: tableWidth }}
            >
              <TableHeader className={stickyTableHeaderClassName}>
                <TableRow variant="static">
                  {visibleColumnConfigs.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(column.align === 'right' && 'text-right')}
                      style={{ width: column.width }}
                    >
                      {t(`requestEventsPage.table.columns.${column.key}`)}
                    </TableHead>
                  ))}
                  <TableHead
                    className="table-sticky-action-head text-right"
                    style={{ width: actionColumnWidth }}
                  >
                    {t('requestEventsPage.table.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((event) => (
                  <TableRow key={event.id} variant="resource">
                    {isColumnVisible('time') ? (
                      <TableCell className="text-muted-foreground truncate">
                        {formatDateTime(event.timestamp, i18n) ?? event.timestamp}
                      </TableCell>
                    ) : null}
                    {isColumnVisible('event') ? (
                      <TableCell className="min-w-0">
                        <p className="truncate font-medium">
                          {event.eventType ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {event.executorType ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('status') ? (
                      <TableCell>
                        <RequestEventStatusBadge event={event} />
                        <p className="text-muted-foreground mt-1 text-xs">
                          {event.statusCode ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('model') ? (
                      <TableCell className="min-w-0">
                        <p className="truncate font-medium">
                          {event.model ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {event.provider ?? t('requestEventsPage.status.notAvailable')}
                          {event.modelAlias ? ` / ${event.modelAlias}` : ''}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('runtime') ? (
                      <TableCell className="min-w-0">
                        <p className="truncate">
                          {getHomeNodeLabel(event) ?? t('requestEventsPage.status.localHome')}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {getRuntimeNodeLabel(event) ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('client') ? (
                      <TableCell className="min-w-0">
                        <p className="truncate">
                          {event.client?.username ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {event.client?.clientKeyLabel ??
                            event.client?.clientKeyMasked ??
                            t('requestEventsPage.status.notAvailable')}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('credential') ? (
                      <TableCell className="min-w-0">
                        <p className="truncate">
                          {event.credential?.label ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {event.credential?.authIndex ??
                            t('requestEventsPage.status.notAvailable')}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('tokens') ? (
                      <TableCell className="text-right">
                        <p className="font-medium">
                          {formatCompactNumber(event.tokens.totalTokens)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatCompactNumber(event.tokens.inputTokens)} /{' '}
                          {formatCompactNumber(event.tokens.outputTokens)}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('latency') ? (
                      <TableCell className="text-right">
                        <p className="font-medium">
                          {formatDuration(event.performance.latencyMs) ??
                            t('requestEventsPage.status.notAvailable')}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t('requestEventsPage.table.ttft', {
                            value:
                              formatDuration(event.performance.ttftMs) ??
                              t('requestEventsPage.status.notAvailable'),
                          })}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('cost') ? (
                      <TableCell className="text-right">
                        {formatAmount(event.billing?.amount ?? null, event.billing?.currency) ??
                          t('requestEventsPage.status.notAvailable')}
                      </TableCell>
                    ) : null}
                    {isColumnVisible('request') ? (
                      <TableCell className="min-w-0">
                        <p className="truncate font-mono text-xs">
                          {event.requestId ?? t('requestEventsPage.status.unknownRequest')}
                        </p>
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {event.upstreamRequestId ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                      </TableCell>
                    ) : null}
                    {isColumnVisible('error') ? (
                      <TableCell className="min-w-0">
                        <p className="truncate text-xs">
                          {event.error?.message ??
                            event.error?.reason ??
                            t('requestEventsPage.status.notAvailable')}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {event.error?.bodyPreview ?? t('requestEventsPage.status.notAvailable')}
                        </p>
                      </TableCell>
                    ) : null}
                    <TableCell
                      className="table-sticky-action-cell text-right transition-colors"
                      style={{ width: actionColumnWidth }}
                    >
                      <div className="table-action-cell-content">
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          className={touchButtonClassName}
                          onClick={() => onInspect(event)}
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          {t('requestEventsPage.actions.viewDetail')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <TableEmptyState
            kind={activeFilters ? 'filtered-empty' : 'empty'}
            title={t('requestEventsPage.table.emptyTitle')}
            description={t('requestEventsPage.table.emptyDescription')}
            action={
              activeFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={touchButtonClassName}
                  disabled={mutating}
                  onClick={onClearFilters}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t('requestEventsPage.table.clearFilters')}
                </Button>
              ) : null
            }
          />
        )
      ) : errorMessage ? (
        <TableEmptyState
          kind="error"
          title={t('requestEventsPage.table.errorTitle')}
          description={errorMessage}
        />
      ) : (
        <TableEmptyState
          kind="unsupported"
          title={t('requestEventsPage.table.unsupportedTitle')}
          description={t('requestEventsPage.table.unsupportedDescription')}
        />
      )}

      {events && total > 0 ? (
        <div className="border-border/80 bg-muted/20 flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <TablePaginationStatus
            text={t('requestEventsPage.table.range', {
              start: formatNumber(start),
              end: formatNumber(end),
              total: formatNumber(total),
            })}
            announcementKey={JSON.stringify(filters)}
            busy={fetching || mutating}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {t('requestEventsPage.table.pageSize')}
              </span>
              <Select
                value={String(filters.limit)}
                disabled={mutating}
                onValueChange={(nextValue) => onLimitChange(Number(nextValue))}
              >
                <SelectTrigger
                  className={cn(touchControlClassName, 'w-24')}
                  size="sm"
                  aria-label={t('requestEventsPage.table.pageSize')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {formatNumber(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={touchButtonClassName}
                disabled={!canGoPrevious || mutating}
                onClick={() => onOffsetChange(Math.max(0, filters.offset - filters.limit))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('requestEventsPage.table.previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={touchButtonClassName}
                disabled={!canGoNext || mutating}
                onClick={() => onOffsetChange(filters.offset + filters.limit)}
              >
                {t('requestEventsPage.table.next')}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </TableSurface>
  )
}

export function RequestEventsPage() {
  const { t } = useTranslation()
  const workbench = useRequestEventsWorkbench()

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return <ObservabilityLoadingState />
  }
  if (!workbench.connected) return <ObservabilityDisconnectedState copyKey="requestEventsPage" />
  if (workbench.isPending && workbench.capabilities.requestEvents) {
    return <ObservabilityLoadingState />
  }
  if (workbench.isError && !workbench.events) {
    return (
      <ObservabilityErrorState
        copyKey="requestEventsPage"
        errorMessage={workbench.errorMessage}
        onRetry={workbench.refetch}
      />
    )
  }

  const handleExport = async () => {
    try {
      const result = await workbench.exportRequestEvents('csv')
      downloadBlob(result.blob, result.fileName)
      toast.success(t('requestEventsPage.toast.exportDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDownloadRequestLog = async (
    requestId: string,
    homeIp?: string | null,
    homePort?: number | null,
  ) => {
    try {
      const result = await workbench.downloadRequestLogById({ requestId, homeIp, homePort })
      downloadBlob(result.blob, result.fileName)
      toast.success(t('requestEventsPage.toast.logDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="grid w-full gap-4">
      <RequestEventsHeader
        canRefresh={workbench.canRefresh}
        capabilities={workbench.capabilities}
        errorMessage={workbench.errorMessage}
        isFetching={workbench.isFetching}
        updatedAt={workbench.eventsUpdatedAt}
        onRefresh={workbench.refetch}
        page={workbench.events}
        runtimeMode={workbench.runtimeMode}
      />

      <IssueList
        issues={[
          ...(workbench.errorMessage
            ? [{ scope: 'requestEvents' as const, message: workbench.errorMessage }]
            : []),
          ...(workbench.filterOptionsErrorMessage
            ? [
                {
                  scope: 'requestEvents' as const,
                  message: workbench.filterOptionsErrorMessage,
                },
              ]
            : []),
        ]}
      />

      <RequestEventsTable
        canExport={workbench.capabilities.requestEventExport}
        errorMessage={workbench.capabilities.requestEvents ? workbench.errorMessage : null}
        events={workbench.events}
        filters={workbench.filters}
        filterOptions={workbench.filterOptions}
        filtersValid={workbench.filtersValid}
        isExporting={workbench.isExporting}
        fetching={workbench.isFetching}
        mutating={workbench.mutating}
        liveRefresh={workbench.liveRefresh}
        liveRefreshIntervalMs={workbench.liveRefreshIntervalMs}
        liveRefreshError={workbench.liveRefreshError}
        liveRefreshLastSuccessAt={workbench.liveRefreshLastSuccessAt}
        pendingItemCount={workbench.pendingEventCount}
        pendingItemsTruncated={workbench.pendingEventsTruncated}
        onAcceptPendingItems={workbench.acceptPendingEvents}
        pageSizeOptions={workbench.pageSizeOptions}
        onClearFilters={workbench.clearFilters}
        onExport={() => void handleExport()}
        onFilterChange={workbench.updateFilters}
        onInspect={workbench.selectEvent}
        onLimitChange={workbench.setLimit}
        onOffsetChange={workbench.setOffset}
      />

      <RequestEventDetailSheet
        detail={workbench.selectedEventDetail}
        pending={workbench.isDetailPending && Boolean(workbench.selectedEventId)}
        error={workbench.detailError instanceof Error ? workbench.detailError : null}
        mutating={workbench.mutating}
        downloadingRequestLogId={workbench.downloadingRequestLogId}
        isDownloadingRequestLog={workbench.isDownloadingRequestLog}
        onDownloadRequestLog={(requestId, homeIp, homePort) =>
          void handleDownloadRequestLog(requestId, homeIp, homePort)
        }
        onOpenChange={(open) => {
          if (!open) workbench.clearSelectedEvent()
        }}
      />
    </section>
  )
}
