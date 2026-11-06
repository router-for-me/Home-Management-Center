import { type ReactNode, useMemo, useRef, useState } from 'react'

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Database,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Waves,
  Wrench,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { AdvancedFiltersToggle } from '@/components/shared/advanced-filters-toggle'
import { DateTimeRangePicker } from '@/components/shared/date-time-range-picker'
import { DebouncedFilterInput } from '@/components/shared/debounced-filter-input'
import { DiagnosticDetailField, TechnicalTextViewer } from '@/components/shared/diagnostic-detail'
import { TableEmptyState } from '@/components/shared/empty-state'
import { CallerUser, EmptyValue, emptyValueText } from '@/components/shared/empty-value'
import {
  filterActionsClassName,
  filterGridClassName,
  filterGridWithActionsClassName,
} from '@/components/shared/form-layout'
import { PageHeader } from '@/components/shared/page-header'
import { RowActions } from '@/components/shared/row-actions'
import { SelectInputGroup } from '@/components/shared/select-input-group'
import type { SelectInputGroupOption } from '@/components/shared/select-input-group'
import { useSecondaryColumns } from '@/components/shared/table-columns'
import {
  ContainedTable,
  TablePaginationStatus,
  TableSurface,
  TableSurfaceHeader,
  stickyTableHeaderClassName,
} from '@/components/shared/table-surface'
import { TableSpacerRow, useVirtualTableRows } from '@/components/shared/virtual-table-rows'
import { Badge } from '@/components/ui/badge'
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
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  RequestTokenBreakdown,
  downloadBlob,
  formatDateTime,
  getObservabilityVerdictBadgeClassName,
} from '@/features/observability/observability-components'
import { useRequestEventsWorkbench } from '@/features/request-events/use-request-events-workbench'
import type { UsageWorkspaceView } from '@/features/usage-observability/usage-route'
import { UsageWorkspaceShell } from '@/features/usage-observability/usage-workspace-shell'
import { useLocalStoragePreference } from '@/hooks/use-local-storage-preference'
import { usePersistentColumnVisibility } from '@/hooks/use-persistent-column-visibility'
import type {
  RequestEvent,
  RequestEventBilling,
  RequestEventDetail,
  RequestEventFilterOptions,
  RequestEventFilters,
  RequestEventToolUsage,
  RequestEventsPage as RequestEventsPageData,
} from '@/lib/api/management/request-events'
import {
  defaultRequestEventFilters,
  isRequestEventLatencyRangeValid,
} from '@/lib/api/management/request-events'
import type { CapabilityMap, RuntimeMode } from '@/lib/api/management/types'
import { formatUsageAmount } from '@/lib/billing/amount-format'
import { formatCompactNumber, formatNumber } from '@/lib/number-format'
import { type PreferenceNormalizer, uiPreferenceKeys } from '@/lib/ui-preferences'
import { cn } from '@/lib/utils'

type RequestEventsVerdict = 'ready' | 'empty' | 'partial' | 'unsupported'
// One control, because every one of these is the same act: type a value and let
// the backend match it. There is deliberately no auth-index entry — the
// credential filter matches the auth index on top of the credential uuid and
// id, so a separate option would be a strict subset and one more decision.
type RequestEventSearchField = 'search' | 'requestId' | 'user' | 'clientKey' | 'credentialId'
type RequestEventColumnKey =
  | 'time'
  | 'event'
  | 'status'
  | 'model'
  | 'runtime'
  | 'client'
  | 'userAgent'
  | 'credential'
  | 'tokens'
  | 'latency'
  | 'cost'
  | 'request'
  | 'error'

type RequestEventColumn = {
  key: RequestEventColumnKey
  width: number
  minWidth: number
  maxWidth: number
  align?: 'right'
  required?: boolean
  /*
   * Survives below 40rem. Independent of `required`, which is about what a user may
   * hide; this is about what still fits.
   */
  compact?: boolean
}

const requestEventColumns: RequestEventColumn[] = [
  { key: 'time', width: 112, minWidth: 96, maxWidth: 220, required: true, compact: true },
  { key: 'status', width: 76, minWidth: 68, maxWidth: 180, compact: true },
  { key: 'event', width: 195, minWidth: 140, maxWidth: 420 },
  { key: 'model', width: 220, minWidth: 140, maxWidth: 420 },
  { key: 'credential', width: 200, minWidth: 130, maxWidth: 420 },
  { key: 'tokens', width: 210, minWidth: 165, maxWidth: 340, align: 'right' },
  { key: 'latency', width: 145, minWidth: 115, maxWidth: 260, align: 'right' },
  { key: 'cost', width: 120, minWidth: 96, maxWidth: 220, align: 'right' },
  { key: 'client', width: 136, minWidth: 105, maxWidth: 320 },
  { key: 'userAgent', width: 180, minWidth: 120, maxWidth: 380 },
  { key: 'runtime', width: 170, minWidth: 125, maxWidth: 320 },
  { key: 'request', width: 210, minWidth: 140, maxWidth: 420 },
  { key: 'error', width: 220, minWidth: 140, maxWidth: 480 },
]

type RequestEventColumnWidthOverrides = Partial<Record<RequestEventColumnKey, number>>

const normalizeColumnWidthOverrides: PreferenceNormalizer<RequestEventColumnWidthOverrides> = (
  value,
) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const out: RequestEventColumnWidthOverrides = {}
  for (const col of requestEventColumns) {
    const w = raw[col.key]
    if (typeof w === 'number' && Number.isFinite(w)) {
      out[col.key] = Math.round(Math.min(col.maxWidth, Math.max(col.minWidth, w)))
    }
  }
  return out
}

const defaultVisibleColumns: RequestEventColumnKey[] = [
  'time',
  'event',
  'status',
  'model',
  'runtime',
  'client',
  'userAgent',
  'credential',
  'tokens',
  'latency',
  'request',
]

const requestEventSearchFields: RequestEventSearchField[] = [
  'requestId',
  'user',
  'clientKey',
  'credentialId',
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

const requestEndpointAliases = new Map<string, string>([
  ['/backend-api/codex/responses', '/v1/responses'],
  ['/backend-api/codex/responses/compact', '/v1/responses/compact'],
  ['/backend-api/codex/alpha/search', '/v1/alpha/search'],
  ['/v1/tts', '/v1/audio/speech'],
  ['/v1/videos', '/v1/videos/generations'],
])

function parseRequestEndpoint(rawEndpoint: string | null): {
  requestType: 'SSE' | 'WS' | null
  method: string | null
  endpoint: string | null
} {
  const raw = String(rawEndpoint ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!raw) return { requestType: null, method: null, endpoint: null }
  const [first, ...rest] = raw.split(' ')
  const upperMethod = first.toUpperCase()
  const hasMethod =
    upperMethod === 'GET' ||
    upperMethod === 'POST' ||
    upperMethod === 'PUT' ||
    upperMethod === 'PATCH' ||
    upperMethod === 'DELETE'
  const requestType = upperMethod === 'POST' ? 'SSE' : upperMethod === 'GET' ? 'WS' : null
  const path = hasMethod ? rest.join(' ').trim() : raw
  const normalizedPath = requestEndpointAliases.get(path) ?? (path || null)
  return {
    requestType,
    method: hasMethod ? upperMethod : null,
    endpoint: normalizedPath,
  }
}

function formatStackedTimestamp(timestamp: string): { time: string; date: string } | null {
  const parsed = new Date(timestamp)
  if (!Number.isNaN(parsed.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`,
      date: `${parsed.getFullYear()}/${pad(parsed.getMonth() + 1)}/${pad(parsed.getDate())}`,
    }
  }
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  return {
    time: `${match[4]}:${match[5]}:${match[6]}`,
    date: `${match[1]}/${match[2]}/${match[3]}`,
  }
}

function getEffectiveTokenCounts(event: RequestEvent) {
  const breakdown = event.tokenBreakdown
  const rawCached =
    event.tokens.cacheReadTokens > 0 ? event.tokens.cacheReadTokens : event.tokens.cachedTokens
  if (breakdown && breakdown.quality === 'complete') {
    const cachedTokens = Math.max(breakdown.input.cacheReadTokens, rawCached)
    const cacheCreationTokens = Math.max(
      breakdown.input.cacheWriteTokens,
      event.tokens.cacheCreationTokens,
    )
    const inputAllTokens = Math.max(
      breakdown.input.totalTokens,
      breakdown.input.uncachedTokens + cachedTokens + cacheCreationTokens,
    )
    return {
      inputTokens: inputAllTokens,
      outputTokens: breakdown.output.totalTokens,
      reasoningTokens: breakdown.output.reasoningTokens,
      cacheReadTokens: cachedTokens,
      cacheCreationTokens,
      totalTokens: breakdown.totalTokens,
    }
  }
  const cacheCreationTokens = event.tokens.cacheCreationTokens
  const inputAllTokens = Math.max(event.tokens.inputTokens, rawCached + cacheCreationTokens)
  return {
    inputTokens: inputAllTokens,
    outputTokens: event.tokens.outputTokens,
    reasoningTokens: event.tokens.reasoningTokens,
    cacheReadTokens: rawCached,
    cacheCreationTokens,
    totalTokens: event.tokens.totalTokens,
  }
}

function formatCacheHitRate(cacheReadTokens: number, inputTokens: number): string | null {
  if (inputTokens <= 0) return null
  const safeCacheRead = Math.max(0, cacheReadTokens)
  const rate = Math.min(100, Math.max(0, (safeCacheRead / inputTokens) * 100))
  return `${rate.toFixed(2)}%`
}

function formatSpeedTps(tps: number | null): string | null {
  if (tps === null || !Number.isFinite(tps) || tps <= 0) return null
  return `${tps.toFixed(1)} t/s`
}

type ToolUsageFieldKey =
  | 'webSearchCalls'
  | 'webSearchQueries'
  | 'xSearchCalls'
  | 'codeExecutionCalls'
  | 'fileSearchCalls'
  | 'documentSearchCalls'
  | 'webFetchCalls'
  | 'mcpCalls'
  | 'googleMapsChunks'
  | 'imageGenerationCalls'

const COST_ITEM_KEY_TO_I18N: Record<string, { i18nKey: string; isUnit?: boolean }> = {
  input: { i18nKey: 'input' },
  'expr:p': { i18nKey: 'input' },
  image_input: { i18nKey: 'imageInput' },
  'expr:pi': { i18nKey: 'imageInput' },
  audio_input: { i18nKey: 'audioInput' },
  'expr:pa': { i18nKey: 'audioInput' },
  video_input: { i18nKey: 'videoInput' },
  'expr:pv': { i18nKey: 'videoInput' },
  file_input: { i18nKey: 'fileInput' },
  'expr:pf': { i18nKey: 'fileInput' },
  cache_read: { i18nKey: 'cacheRead' },
  'expr:cr': { i18nKey: 'cacheRead' },
  cached_text: { i18nKey: 'cachedText' },
  'expr:ct': { i18nKey: 'cachedText' },
  image_cache_read: { i18nKey: 'imageCacheRead' },
  'expr:cri': { i18nKey: 'imageCacheRead' },
  audio_cache_read: { i18nKey: 'audioCacheRead' },
  'expr:cra': { i18nKey: 'audioCacheRead' },
  cache_write: { i18nKey: 'cacheWrite' },
  'expr:cw': { i18nKey: 'cacheWrite' },
  cache_write_30m: { i18nKey: 'cacheWrite30m' },
  'expr:cw30m': { i18nKey: 'cacheWrite30m' },
  cache_write_1h: { i18nKey: 'cacheWrite1h' },
  'expr:cw1h': { i18nKey: 'cacheWrite1h' },
  cache_write_12h: { i18nKey: 'cacheWrite12h' },
  'expr:cw12h': { i18nKey: 'cacheWrite12h' },
  output: { i18nKey: 'output' },
  'expr:c': { i18nKey: 'output' },
  reasoning: { i18nKey: 'reasoning' },
  'expr:r': { i18nKey: 'reasoning' },
  image_output: { i18nKey: 'imageOutput' },
  'expr:ci': { i18nKey: 'imageOutput' },
  audio_output: { i18nKey: 'audioOutput' },
  'expr:ca': { i18nKey: 'audioOutput' },
  video_output: { i18nKey: 'videoOutput' },
  'expr:cv': { i18nKey: 'videoOutput' },
  web_search_calls: { i18nKey: 'webSearch', isUnit: true },
  x_search_calls: { i18nKey: 'xSearch', isUnit: true },
  code_execution_calls: { i18nKey: 'codeExecution', isUnit: true },
  'expr:ws': { i18nKey: 'webSearch', isUnit: true },
  'expr:wsq': { i18nKey: 'webSearchQuery', isUnit: true },
  'expr:wf': { i18nKey: 'webFetch', isUnit: true },
  'expr:xs': { i18nKey: 'xSearch', isUnit: true },
  'expr:ce': { i18nKey: 'codeExecution', isUnit: true },
  'expr:fs': { i18nKey: 'fileSearch', isUnit: true },
  'expr:ds': { i18nKey: 'documentSearch', isUnit: true },
  'expr:mcp': { i18nKey: 'mcp', isUnit: true },
  'expr:maps': { i18nKey: 'googleMaps', isUnit: true },
  'expr:src': { i18nKey: 'sourcesUsed', isUnit: true },
  'expr:st': { i18nKey: 'serverTools', isUnit: true },
  images: { i18nKey: 'images', isUnit: true },
}

const COST_ITEM_ORDER = [
  'input',
  'expr:p',
  'image_input',
  'expr:pi',
  'audio_input',
  'expr:pa',
  'video_input',
  'expr:pv',
  'file_input',
  'expr:pf',
  'cache_read',
  'expr:cr',
  'cached_text',
  'expr:ct',
  'image_cache_read',
  'expr:cri',
  'audio_cache_read',
  'expr:cra',
  'cache_write',
  'expr:cw',
  'cache_write_30m',
  'expr:cw30m',
  'cache_write_1h',
  'expr:cw1h',
  'cache_write_12h',
  'expr:cw12h',
  'output',
  'expr:c',
  'reasoning',
  'expr:r',
  'image_output',
  'expr:ci',
  'audio_output',
  'expr:ca',
  'video_output',
  'expr:cv',
  'web_search_calls',
  'x_search_calls',
  'code_execution_calls',
  'expr:ws',
  'expr:wsq',
  'expr:wf',
  'expr:xs',
  'expr:ce',
  'expr:fs',
  'expr:ds',
  'expr:mcp',
  'expr:maps',
  'expr:src',
  'expr:st',
  'images',
]

function buildCostTooltipRows(
  billing: RequestEventBilling | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): Array<{ label: string; value: string }> {
  if (!billing || billing.amount === null) return []
  const totalFormatted = formatAmount(billing.amount, billing.currency)
  if (!totalFormatted) return []

  const rows: Array<{ label: string; value: string }> = [
    {
      label: t('requestEventsPage.detail.costBreakdown.total'),
      value: totalFormatted,
    },
  ]

  const bd = billing.costBreakdown
  if (bd) {
    const mergedItems: Record<string, { tokens: number; pricePerMillion: number; cost: number }> =
      {}
    for (const [rawKey, item] of Object.entries(bd.items)) {
      const key = rawKey === 'reasoning' ? 'output' : rawKey === 'expr:r' ? 'expr:c' : rawKey
      const prev = mergedItems[key]
      if (prev) {
        mergedItems[key] = {
          tokens: prev.tokens + item.tokens,
          pricePerMillion: prev.pricePerMillion || item.pricePerMillion,
          cost: Number((prev.cost + item.cost).toFixed(8)),
        }
      } else {
        mergedItems[key] = { ...item }
      }
    }

    const entries = Object.entries(mergedItems).filter(([key, item]) => {
      if (key === 'expression') return false
      if (key === 'expr:wsq' && (mergedItems['expr:ws']?.tokens ?? 0) > 0 && item.cost <= 0) {
        return false
      }
      if ((key === 'expr:st' || key === 'expr:src') && item.cost <= 0) return false
      return item.cost > 0 || item.tokens > 0
    })

    entries.sort(([a], [b]) => {
      const idxA = COST_ITEM_ORDER.indexOf(a)
      const idxB = COST_ITEM_ORDER.indexOf(b)
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB)
    })

    for (const [key, item] of entries) {
      const meta = COST_ITEM_KEY_TO_I18N[key]
      const baseLabel = meta
        ? t(`requestEventsPage.detail.costBreakdown.${meta.i18nKey}`)
        : key.replace(/^expr:/, '')
      const countSuffix =
        item.tokens > 0
          ? meta?.isUnit
            ? ` (×${formatNumber(item.tokens)})`
            : ` (${formatNumber(item.tokens)})`
          : ''
      const valueText =
        item.cost > 0
          ? (formatAmount(item.cost, billing.currency) ?? '$0')
          : formatNumber(item.tokens)
      rows.push({
        label: `${baseLabel}${countSuffix}`,
        value: valueText,
      })
    }

    if (bd.request > 0) {
      rows.push({
        label: t('requestEventsPage.detail.costBreakdown.requestFee'),
        value: formatAmount(bd.request, billing.currency) ?? '$0',
      })
    }

    if (
      bd.reasoningEffort &&
      bd.reasoningEffortMultiplier !== null &&
      bd.reasoningEffortMultiplier !== 1
    ) {
      rows.push({
        label: `${t('requestEventsPage.detail.costBreakdown.effortMultiplier')} (${bd.reasoningEffort})`,
        value: `×${bd.reasoningEffortMultiplier}`,
      })
    }

    if (bd.billingMultiplier && bd.billingMultiplier !== 1) {
      rows.push({
        label: t('requestEventsPage.detail.costBreakdown.billingMultiplier'),
        value: `×${bd.billingMultiplier}`,
      })
    }
  }

  return rows
}

function getToolUsageEntries(toolUsage: RequestEventToolUsage | null | undefined): Array<{
  key: ToolUsageFieldKey
  count: number
}> {
  if (!toolUsage) return []
  const keys: ToolUsageFieldKey[] = [
    'webSearchCalls',
    'xSearchCalls',
    'codeExecutionCalls',
    'fileSearchCalls',
    'documentSearchCalls',
    'webFetchCalls',
    'mcpCalls',
    'googleMapsChunks',
    ...(toolUsage.webSearchCalls > 0
      ? ([] as ToolUsageFieldKey[])
      : (['webSearchQueries'] as ToolUsageFieldKey[])),
    'imageGenerationCalls',
  ]
  return keys
    .map((key) => ({
      key,
      count: toolUsage[key] ?? 0,
    }))
    .filter((entry) => entry.count > 0)
}

function UserAgentCopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Ignore clipboard failures in restricted contexts.
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="text"
          size="sm"
          className="w-full min-w-0 justify-start"
          aria-label={label}
          onClick={(event) => {
            event.stopPropagation()
            void handleCopy()
          }}
        >
          <span className="min-w-0 flex-1 truncate font-mono">{value}</span>
          {copied ? (
            <Check className="text-success" aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-[min(28rem,calc(100vw-2rem))] font-mono break-all"
      >
        {value}
      </TooltipContent>
    </Tooltip>
  )
}

function formatDuration(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(2)} s`
}

function formatExecutorName(executorType: string | null | undefined): string | null {
  if (!executorType) return null
  const trimmed = executorType.trim()
  if (!trimmed) return null
  return trimmed.replace(/Executor$/i, '') || trimmed
}

function estimateAutoColumnWidths(rows: RequestEvent[]): Record<RequestEventColumnKey, number> {
  const defaults = Object.fromEntries(
    requestEventColumns.map((col) => [col.key, col.width]),
  ) as Record<RequestEventColumnKey, number>
  if (rows.length === 0) return defaults

  const maxChars: Partial<Record<RequestEventColumnKey, number>> = {}
  const bump = (key: RequestEventColumnKey, len: number) => {
    if (len > (maxChars[key] ?? 0)) maxChars[key] = len
  }

  for (const event of rows) {
    const parsedEndpoint = parseRequestEndpoint(event.endpoint)
    const endpointLen = (parsedEndpoint.endpoint ?? event.eventType ?? '').length + 6
    const execLen =
      (formatExecutorName(event.executorType) ?? event.eventType ?? '').length +
      (event.stream !== null && event.stream !== undefined ? 6 : 0)
    bump('event', Math.max(endpointLen, execLen))

    const modelLine1 =
      (event.model ?? '').length + (event.reasoningEffort ? event.reasoningEffort.length + 3 : 0)
    const modelLine2 =
      (event.modelAlias && event.modelAlias !== event.model ? event.modelAlias.length + 2 : 0) +
      (event.serviceTier ? event.serviceTier.length + 3 : 0)
    bump('model', Math.max(modelLine1, modelLine2))

    const credLabel = event.credential?.label ?? event.source ?? ''
    bump('credential', credLabel.length)

    const userLen = (event.client?.username ?? '').length
    const keyLen = (event.client?.clientKeyLabel ?? event.client?.clientKeyMasked ?? '').length
    bump('client', Math.max(userLen, keyLen))

    const uaLen = Math.min(28, (event.client?.userAgent ?? '').length)
    bump('userAgent', uaLen)

    const homeLen = (getHomeNodeLabel(event) ?? '').length
    const cpaLen = (getRuntimeNodeLabel(event) ?? '').length
    bump('runtime', Math.max(homeLen, cpaLen))

    const reqLen = Math.max((event.requestId ?? '').length, (event.upstreamRequestId ?? '').length)
    bump('request', Math.min(32, reqLen))
  }

  const clamp = (col: RequestEventColumn, estimatedPx: number) =>
    Math.round(Math.min(col.maxWidth, Math.max(col.minWidth, estimatedPx)))

  for (const col of requestEventColumns) {
    const chars = maxChars[col.key]
    if (chars !== undefined && chars > 0) {
      // ~7.4px per character + 26px cell horizontal padding
      defaults[col.key] = clamp(col, chars * 7.4 + 26)
    }
  }

  return defaults
}

function formatAmount(value: number | null, currency?: string | null) {
  if (value === null || !Number.isFinite(value)) return null
  const unit = currency?.trim() || 'credits'
  return `${formatUsageAmount(value)} ${unit}`
}

function formatTableCostAmount(value: number | null, currency?: string | null) {
  if (value === null || !Number.isFinite(value)) return null
  const unit = currency?.trim()
  if (!unit || unit.toLowerCase() === 'credits') {
    return formatUsageAmount(value)
  }
  return `${formatUsageAmount(value)} ${unit}`
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
  return requestEventAdvancedFilterKeys.filter((key) => {
    const value = filters[key]
    const fallback = defaultRequestEventFilters[key]
    if (typeof value === 'string' && typeof fallback === 'string') {
      return value.trim() !== fallback.trim()
    }
    return value !== fallback
  }).length
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

  const latencyRangeInvalid = !isRequestEventLatencyRangeValid(filters)

  const handleSearchFieldChange = (nextField: string, carriedValue: string) => {
    const nextSearchField = nextField as RequestEventSearchField
    setSearchField(nextSearchField)
    onChange(getNextSearchFieldPatch(nextSearchField, carriedValue))
  }

  return (
    // Not a card: it already sits inside the table's surface.
    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
      <div className={filterGridWithActionsClassName}>
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
          onInputCommit={(value) => onChange(getNextSearchFieldPatch(activeSearchField, value))}
        />
        <DateTimeRangePicker
          from={filters.customFrom}
          to={filters.customTo}
          preset={filters.range}
          disabled={disabled}
          presets={(['4h', '12h', '24h', 'today', 'yesterday', '7d', '30d', '90d'] as const).map(
            (value) => ({ value, label: t(`requestEventsPage.filters.ranges.${value}`) }),
          )}
          onPresetChange={(range) => onChange({ range, offset: 0 })}
          onChange={({ from, to }) =>
            onChange({ range: 'custom', customFrom: from, customTo: to, offset: 0 })
          }
        />
        <Select
          value={filters.status}
          disabled={disabled}
          onValueChange={(status) =>
            onChange({ status: status as RequestEventFilters['status'], offset: 0 })
          }
        >
          <SelectTrigger size="md">
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
          <SelectTrigger size="md">
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
          <SelectTrigger size="md">
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
        <div className={filterActionsClassName}>
          <CollapsibleTrigger asChild>
            <AdvancedFiltersToggle
              open={advancedOpen}
              activeCount={activeHiddenFilterCount}
              label={t('requestEventsPage.filters.advanced')}
            />
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className={cn(filterGridClassName, 'mt-3 border-t pt-3')}>
          <Select
            value={filters.eventType}
            disabled={disabled}
            onValueChange={(eventType) => onChange({ eventType, offset: 0 })}
          >
            <SelectTrigger size="md">
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
            <SelectTrigger size="md">
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
            <SelectTrigger size="md">
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
            <SelectTrigger size="md">
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
            <SelectTrigger size="md">
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
    </Collapsible>
  )
}

function RequestEventStatusBadge({
  event,
  onInspect,
}: {
  event: RequestEvent
  onInspect?: () => void
}) {
  const { t } = useTranslation()
  const statusCode = event.statusCode ?? event.error?.statusCode ?? event.upstreamStatusCode
  const success =
    event.status === 'success' ||
    (!event.failed && statusCode !== null && statusCode >= 200 && statusCode < 400)
  const failed = event.status === 'failed' || (statusCode !== null && statusCode >= 400)
  const variant = success ? 'success' : failed ? 'destructive' : 'unknown'
  const fallbackLabel = success
    ? t('requestEventsPage.status.success')
    : failed
      ? t('requestEventsPage.status.failed')
      : t('requestEventsPage.status.unknown')
  const label = statusCode !== null ? String(statusCode) : fallbackLabel

  if (onInspect) {
    return (
      <Badge
        asChild
        variant={variant}
        className="cursor-pointer font-mono tabular-nums hover:opacity-85"
      >
        <button type="button" onClick={onInspect} title={fallbackLabel}>
          {label}
        </button>
      </Badge>
    )
  }

  return (
    <Badge variant={variant} className="font-mono tabular-nums" title={fallbackLabel}>
      {label}
    </Badge>
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
        // The inputs fill the group, so the group carries the md step's height.
        'control-md border-input bg-background focus-within:ring-ring flex min-w-0 items-center gap-0 border px-0 shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]',
        invalid && 'border-destructive focus-within:ring-destructive/20',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      role="group"
      aria-label={label}
      aria-invalid={invalid || undefined}
    >
      <DebouncedFilterInput
        size="md"
        className="h-full min-h-0 rounded-r-none border-0 bg-transparent px-3 text-center shadow-none focus-visible:ring-0 sm:h-full"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={minValue}
        disabled={disabled}
        placeholder={minPlaceholder}
        aria-label={minPlaceholder}
        onCommit={onMinChange}
      />
      <span
        className="text-muted-foreground bg-muted/45 flex h-full min-w-8 shrink-0 items-center justify-center border-x px-2 text-xs"
        aria-hidden="true"
      >
        {separatorLabel}
      </span>
      <DebouncedFilterInput
        size="md"
        className="h-full min-h-0 rounded-l-none border-0 bg-transparent px-3 text-center shadow-none focus-visible:ring-0 sm:h-full"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={maxValue}
        disabled={disabled}
        placeholder={maxPlaceholder}
        aria-label={maxPlaceholder}
        onCommit={onMaxChange}
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
            {event?.timestamp ? (
              (formatDateTime(event.timestamp, i18n) ?? event.timestamp)
            ) : (
              <EmptyValue />
            )}
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
                  {event.eventType ?? <EmptyValue />}
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
                  {event.upstreamRequestId ?? <EmptyValue />}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.model')}>
                  {event.provider || event.model ? (
                    `${event.provider ?? emptyValueText} / ${event.model ?? emptyValueText}`
                  ) : (
                    <EmptyValue />
                  )}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  className="sm:col-span-2"
                  label={t('requestEventsPage.detail.fields.endpoint')}
                  copyValue={event.endpoint}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {event.endpoint ?? <EmptyValue />}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.home')}>
                  {getHomeNodeLabel(event) ?? t('requestEventsPage.status.localHome')}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.cpa')}>
                  {getRuntimeNodeLabel(event) ?? <EmptyValue />}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.user')}>
                  <CallerUser
                    username={event.client?.username ?? null}
                    keyResolved={event.client?.clientKeyId != null}
                  />
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.clientKey')}>
                  {event.client?.clientKeyLabel ?? event.client?.clientKeyMasked ?? <EmptyValue />}
                </DiagnosticDetailField>
                <DiagnosticDetailField
                  className="sm:col-span-2"
                  label={t('requestEventsPage.detail.fields.userAgent')}
                  copyValue={event.client?.userAgent ?? null}
                  copyLabel={copyLabel}
                  copiedLabel={copiedLabel}
                  mono
                >
                  {event.client?.userAgent ?? <EmptyValue />}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.credential')}>
                  {event.credential?.label ?? event.credential?.authIndex ?? <EmptyValue />}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.latency')}>
                  {formatDuration(event.performance.latencyMs) ?? <EmptyValue />}
                </DiagnosticDetailField>
                <DiagnosticDetailField label={t('requestEventsPage.detail.fields.cost')}>
                  {formatAmount(event.billing?.amount ?? null, event.billing?.currency) ?? (
                    <EmptyValue />
                  )}
                </DiagnosticDetailField>
              </div>

              {event.tokenBreakdown ? (
                <RequestTokenBreakdown
                  tokens={event.tokens}
                  tokenBreakdown={event.tokenBreakdown}
                />
              ) : (
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
              )}

              {getToolUsageEntries(event.toolUsage).length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium">{t('requestEventsPage.detail.toolUsage')}</h3>
                  <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                    {getToolUsageEntries(event.toolUsage).map((item) => (
                      <DiagnosticDetailField
                        key={item.key}
                        label={t(`requestEventsPage.detail.toolFields.${item.key}`)}
                      >
                        {formatNumber(item.count)}
                      </DiagnosticDetailField>
                    ))}
                  </div>
                </div>
              ) : null}

              {event.error ? (
                <div>
                  <h3 className="text-sm font-medium">{t('requestEventsPage.detail.error')}</h3>
                  <TechnicalTextViewer
                    content={
                      event.error.bodyPreview ??
                      event.error.message ??
                      event.error.reason ??
                      emptyValueText
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
                      {payloadSummary.method ?? <EmptyValue />}
                    </DiagnosticDetailField>
                    <DiagnosticDetailField
                      label={t('requestEventsPage.detail.payloadFields.stream')}
                    >
                      {payloadSummary.stream === null ? (
                        <EmptyValue />
                      ) : payloadSummary.stream ? (
                        t('requestEventsPage.status.yes')
                      ) : (
                        t('requestEventsPage.status.no')
                      )}
                    </DiagnosticDetailField>
                    <DiagnosticDetailField
                      label={t('requestEventsPage.detail.payloadFields.messages')}
                    >
                      {payloadSummary.messageCount ?? <EmptyValue />}
                    </DiagnosticDetailField>
                    <DiagnosticDetailField
                      label={t('requestEventsPage.detail.payloadFields.tools')}
                    >
                      {payloadSummary.toolCount ?? <EmptyValue />}
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
              size="md"
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
  const { isColumnVisible, setColumnVisible } = usePersistentColumnVisibility({
    storageKey: uiPreferenceKeys.requestEventColumns,
    columns: requestEventColumns,
    defaultVisibleColumns,
  })
  const [columnWidthOverrides, setColumnWidthOverrides] = useLocalStoragePreference(
    uiPreferenceKeys.requestEventColumnWidths,
    {},
    normalizeColumnWidthOverrides,
  )
  const rows = events?.items ?? []
  const autoColumnWidths = useMemo(() => estimateAutoColumnWidths(rows), [rows])
  const getColumnWidth = (column: RequestEventColumn) =>
    columnWidthOverrides[column.key] ?? autoColumnWidths[column.key] ?? column.width

  const headerRefs = useRef<Partial<Record<RequestEventColumnKey, HTMLTableCellElement | null>>>({})

  const handleResizeStart = (
    event: React.MouseEvent<HTMLDivElement>,
    column: RequestEventColumn,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const snapshotWidths: RequestEventColumnWidthOverrides = {}
    for (const col of visibleColumnConfigs) {
      snapshotWidths[col.key] = getColumnWidth(col)
    }
    const startWidth = snapshotWidths[column.key] ?? getColumnWidth(column)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      const nextWidth = Math.round(
        Math.min(column.maxWidth, Math.max(column.minWidth, startWidth + delta)),
      )
      setColumnWidthOverrides({
        ...snapshotWidths,
        [column.key]: nextWidth,
      })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleResizeReset = (
    event: React.MouseEvent<HTMLDivElement>,
    column: RequestEventColumn,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setColumnWidthOverrides((prev) => {
      if (!(column.key in prev)) return prev
      const next = { ...prev }
      delete next[column.key]
      return next
    })
  }
  const total = events?.total ?? 0
  const start = total > 0 ? filters.offset + 1 : 0
  const end = Math.min(filters.offset + rows.length, total)
  const canGoPrevious = filters.offset > 0
  const canGoNext = filters.offset + filters.limit < total
  const activeFilters = hasActiveFilters(filters)
  const showSecondary = useSecondaryColumns()
  const visibleColumnConfigs = requestEventColumns.filter(
    (column) => isColumnVisible(column.key) && (showSecondary || column.compact),
  )
  /*
   * The header and the body have to ask the same question. `isColumnVisible` answers
   * "did the user keep this column", which is what the column menu needs; it is not
   * the same as "is this column rendered right now", because the compact viewport
   * drops columns the user never touched. Asking the wrong one in the body left the
   * header with two columns and the rows with ten.
   */
  const renderedColumnKeys = new Set(visibleColumnConfigs.map((column) => column.key))
  const isColumnRendered = (key: RequestEventColumnKey) => renderedColumnKeys.has(key)
  /*
   * This table sizes its columns in JS because the set is user-configurable, and
   * its own width is the sum of them. The action column is the one part JS should
   * not add up: its width depends on the locale as well as the viewport, so the
   * sum stops at the data columns and defers the last term to CSS.
   */
  const tableWidth = `calc(${
    visibleColumnConfigs.reduce((width, column) => width + getColumnWidth(column), 0) + 16
  }px + var(--table-action-column-1))`
  const tableContainerRef = useRef<HTMLDivElement>(null)
  // Two stacked lines per cell, both truncated, so every row measures the same.
  const virtualRows = useVirtualTableRows({
    rowCount: rows.length,
    scrollRef: tableContainerRef,
    estimatedRowHeight: 71,
    // The query keeps the previous page on screen while the next one loads, so
    // a new filter or offset would otherwise leave the reader parked on a row
    // that is no longer in the result. `filters` keeps its identity through a
    // no-op patch, so this does not fire on every keystroke.
    resetKey: filters,
  })
  // The spacers have to span the row, action column included.
  const tableColumnCount = visibleColumnConfigs.length + 1

  // Export, the column menu and the clear action all act on a result, so they
  // wait for one; an empty result carries its own clear action instead.
  const hasRows = Boolean(events) && rows.length > 0

  return (
    <TooltipProvider delayDuration={120}>
      <TableSurface className="min-w-0">
        {/*
        The collection's tools share the title row rather than a toolbar row of
        their own under the filters, which cost the first screen 53px.
      */}
        <TableSurfaceHeader
          title={t('requestEventsPage.table.title')}
          /*
          Up to five tools share this row. Where they do not fit beside the title
          they wrap under it, right-aligned, instead of folding the title onto two
          lines - Russian at 1024px with the clear action showing.
        */
          titleClassName="md:shrink-0"
          actionsClassName="w-full flex-col sm:w-auto sm:flex-row sm:items-center md:min-w-0 md:shrink md:justify-end"
          actions={
            <>
              <NewItemsNotice
                count={pendingItemCount}
                truncated={pendingItemsTruncated}
                onAccept={onAcceptPendingItems}
              />
              <LiveRefreshControl
                enabled={liveRefresh.enabled}
                disabled={!liveRefresh.available}
                describedBy={!liveRefresh.available ? liveRefreshStatusId : undefined}
                onEnabledChange={liveRefresh.setEnabled}
              />
              {hasRows ? (
                <>
                  {/*
                  Not in the filter row: there it widened the row's own track, and
                  in Russian at 1536px left the search input 50px wide.
                */}
                  {activeFilters ? (
                    <Button
                      type="button"
                      variant="text"
                      size="md"
                      disabled={mutating}
                      onClick={onClearFilters}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      {t('requestEventsPage.table.clearFilters')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={!canExport || !filtersValid || isExporting || mutating}
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
                      <Button type="button" variant="outline" size="md">
                        <Columns3 className="size-4" aria-hidden="true" />
                        {t('actions.customizeColumns')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        {t('requestEventsPage.table.columnsMenu')}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {requestEventColumns.map((column) => (
                        <DropdownMenuCheckboxItem
                          key={column.key}
                          checked={isColumnVisible(column.key)}
                          disabled={column.required}
                          onSelect={(event) => event.preventDefault()}
                          onCheckedChange={(checked) =>
                            setColumnVisible(column.key, Boolean(checked))
                          }
                        >
                          {t(`requestEventsPage.table.columns.${column.key}`)}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : null}
            </>
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

        {events ? (
          rows.length > 0 ? (
            <div className="px-3 py-3">
              <ContainedTable
                containerRef={tableContainerRef}
                containerClassName="max-h-[calc(100vh-250px)] rounded-md border"
                className="w-auto table-fixed"
                style={showSecondary ? { width: tableWidth } : undefined}
                /*
                The rows outside the window are not in the DOM, so the table has
                to state how many there really are; the head counts as row one.
              */
                aria-rowcount={rows.length + 1}
              >
                <colgroup>
                  {visibleColumnConfigs.map((column, index) => (
                    <col
                      key={column.key}
                      style={
                        !showSecondary && index === 0
                          ? undefined
                          : { width: getColumnWidth(column) }
                      }
                    />
                  ))}
                  <col />
                </colgroup>
                <TableHeader className={stickyTableHeaderClassName}>
                  <TableRow variant="static" aria-rowindex={1}>
                    {visibleColumnConfigs.map((column, index) => (
                      <TableHead
                        key={column.key}
                        ref={(el) => {
                          headerRefs.current[column.key] = el
                        }}
                        className={cn(
                          'group/head relative select-none',
                          column.align === 'right' && 'text-right',
                        )}
                        /*
                        Fixed layout takes the sum of the declared widths, so a
                        column set that adds up past the viewport still scrolls.
                        The identity column gives up its width below 40rem and
                        takes the remainder instead.
                      */
                        style={
                          !showSecondary && index === 0
                            ? undefined
                            : { width: getColumnWidth(column) }
                        }
                      >
                        <span className="block truncate">
                          {t(`requestEventsPage.table.columns.${column.key}`)}
                        </span>
                        {showSecondary ? (
                          <div
                            role="separator"
                            aria-orientation="vertical"
                            onMouseDown={(e) => handleResizeStart(e, column)}
                            onDoubleClick={(e) => handleResizeReset(e, column)}
                            className="group/resizer absolute top-0 -right-1 z-10 flex h-full w-2.5 cursor-col-resize items-center justify-center"
                          >
                            <span className="bg-border/80 group-hover/resizer:bg-primary group-active/resizer:bg-primary h-3.5 w-px transition-all group-hover/resizer:h-full group-hover/resizer:w-0.5 group-active/resizer:h-full group-active/resizer:w-0.5" />
                          </div>
                        ) : null}
                      </TableHead>
                    ))}
                    <TableHead className="table-sticky-action-head table-action-column-1 text-right">
                      {t('requestEventsPage.table.columns.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSpacerRow height={virtualRows.paddingTop} colSpan={tableColumnCount} />
                  {virtualRows.items.map(({ index, key }) => {
                    const event = rows[index]
                    const stackedTime = formatStackedTimestamp(event.timestamp)
                    const fullTime = formatDateTime(event.timestamp, i18n) ?? event.timestamp
                    const parsedEndpoint = parseRequestEndpoint(event.endpoint)
                    const tokenCounts = getEffectiveTokenCounts(event)
                    const cacheHitRate = formatCacheHitRate(
                      tokenCounts.cacheReadTokens,
                      tokenCounts.inputTokens,
                    )
                    const speedLabel = formatSpeedTps(event.performance.tps)
                    const tokenTooltipRows = [
                      {
                        label: t('requestEventsPage.detail.tokenFields.totalTokens'),
                        value: formatNumber(tokenCounts.totalTokens),
                      },
                      {
                        label: t('requestEventsPage.detail.tokenFields.inputTokens'),
                        value: formatNumber(tokenCounts.inputTokens),
                      },
                      {
                        label: t('requestEventsPage.detail.tokenFields.cachedTokens'),
                        value: `${formatNumber(tokenCounts.cacheReadTokens)}${cacheHitRate ? ` (${cacheHitRate})` : ''}`,
                      },
                      ...(tokenCounts.cacheCreationTokens > 0
                        ? [
                            {
                              label: t('requestEventsPage.detail.tokenFields.cacheCreationTokens'),
                              value: formatNumber(tokenCounts.cacheCreationTokens),
                            },
                          ]
                        : []),
                      {
                        label: t('requestEventsPage.detail.tokenFields.outputTokens'),
                        value: formatNumber(tokenCounts.outputTokens),
                      },
                      {
                        label: t('requestEventsPage.detail.tokenFields.reasoningTokens'),
                        value: formatNumber(tokenCounts.reasoningTokens),
                      },
                      ...getToolUsageEntries(event.toolUsage).map((item) => ({
                        label: t(`requestEventsPage.detail.toolFields.${item.key}`),
                        value: formatNumber(item.count),
                      })),
                    ]
                    const toolUsageEntries = getToolUsageEntries(event.toolUsage)
                    const totalToolCalls = toolUsageEntries.reduce(
                      (sum, item) => sum + item.count,
                      0,
                    )

                    return (
                      <TableRow
                        key={key}
                        variant="resource"
                        data-index={index}
                        aria-rowindex={index + 2}
                        ref={virtualRows.measureRow}
                      >
                        {isColumnRendered('time') ? (
                          <TableCell className="tabular-nums" title={fullTime}>
                            {stackedTime ? (
                              <>
                                <p className="truncate font-medium">{stackedTime.time}</p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {stackedTime.date}
                                </p>
                              </>
                            ) : (
                              <p className="text-muted-foreground truncate">{fullTime}</p>
                            )}
                          </TableCell>
                        ) : null}
                        {isColumnRendered('status') ? (
                          <TableCell>
                            <RequestEventStatusBadge
                              event={event}
                              onInspect={() => onInspect(event)}
                            />
                            {event.failed && (event.error?.message ?? event.error?.reason) ? (
                              <p
                                className="text-destructive/80 mt-1 truncate text-xs"
                                title={event.error?.message ?? event.error?.reason ?? undefined}
                              >
                                {event.error?.message ?? event.error?.reason}
                              </p>
                            ) : null}
                          </TableCell>
                        ) : null}
                        {isColumnRendered('event') ? (
                          <TableCell className="min-w-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  tabIndex={0}
                                  className="focus-visible:ring-ring/50 min-w-0 rounded-sm outline-none focus-visible:ring-3"
                                >
                                  <div className="flex items-center gap-1.5 truncate font-medium">
                                    {parsedEndpoint.requestType ? (
                                      <span className="bg-muted text-foreground inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                                        {parsedEndpoint.requestType}
                                        <Waves className="size-3 opacity-70" aria-hidden="true" />
                                      </span>
                                    ) : null}
                                    <span className="truncate font-mono text-xs">
                                      {parsedEndpoint.endpoint ?? event.eventType ?? <EmptyValue />}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                    {formatExecutorName(event.executorType) ?? event.eventType ?? (
                                      <EmptyValue />
                                    )}
                                    {event.stream !== null && event.stream !== undefined
                                      ? ` · ${event.stream ? t('requestEventsPage.status.streaming') : t('requestEventsPage.status.nonStreaming')}`
                                      : ''}
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="start"
                                className="max-w-[calc(100vw-2rem)] min-w-48 px-3 py-2 whitespace-normal"
                              >
                                <div className="grid gap-1 text-xs">
                                  {event.endpoint ? (
                                    <div className="flex items-start justify-between gap-4">
                                      <span className="opacity-80">Endpoint</span>
                                      <span className="font-mono font-medium">
                                        {event.endpoint}
                                      </span>
                                    </div>
                                  ) : null}
                                  {event.stream !== null && event.stream !== undefined ? (
                                    <div className="flex items-start justify-between gap-4">
                                      <span className="opacity-80">
                                        {t('requestEventsPage.detail.payloadFields.stream')}
                                      </span>
                                      <span className="font-medium">
                                        {event.stream
                                          ? t('requestEventsPage.status.yes')
                                          : t('requestEventsPage.status.no')}
                                      </span>
                                    </div>
                                  ) : null}
                                  {event.eventType ? (
                                    <div className="flex items-start justify-between gap-4">
                                      <span className="opacity-80">
                                        {t('requestEventsPage.detail.fields.eventType')}
                                      </span>
                                      <span className="font-mono font-medium">
                                        {event.eventType}
                                      </span>
                                    </div>
                                  ) : null}
                                  {event.executorType ? (
                                    <div className="flex items-start justify-between gap-4">
                                      <span className="opacity-80">Executor</span>
                                      <span className="font-mono font-medium">
                                        {event.executorType}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        ) : null}
                        {isColumnRendered('model') ? (
                          <TableCell
                            className="min-w-0"
                            title={
                              [
                                event.model ? `Model: ${event.model}` : null,
                                event.modelAlias ? `Alias: ${event.modelAlias}` : null,
                                event.provider ? `Provider: ${event.provider}` : null,
                                event.reasoningEffort ? `Effort: ${event.reasoningEffort}` : null,
                                event.serviceTier ? `Tier: ${event.serviceTier}` : null,
                              ]
                                .filter(Boolean)
                                .join('\n') || undefined
                            }
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate font-medium">
                                {event.model ?? <EmptyValue />}
                              </span>
                              {event.reasoningEffort ? (
                                <span className="border-border bg-muted/60 text-muted-foreground py-0.2 shrink-0 rounded border px-1 text-[10px] font-medium uppercase">
                                  {event.reasoningEffort}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground truncate text-xs">
                              {[
                                event.modelAlias && event.modelAlias !== event.model
                                  ? `↳ ${event.modelAlias}`
                                  : null,
                                event.serviceTier ?? null,
                              ]
                                .filter(Boolean)
                                .join(' · ') || <EmptyValue />}
                            </p>
                          </TableCell>
                        ) : null}
                        {isColumnRendered('credential') ? (
                          <TableCell
                            className="min-w-0"
                            title={event.credential?.label ?? event.source ?? undefined}
                          >
                            <p className="truncate font-medium">
                              {event.credential?.label ?? event.source ?? <EmptyValue />}
                            </p>
                          </TableCell>
                        ) : null}
                        {isColumnRendered('tokens') ? (
                          <TableCell className="min-w-0 overflow-hidden text-right tabular-nums">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  tabIndex={0}
                                  className="focus-visible:ring-ring/50 grid min-w-0 gap-0.5 rounded-sm outline-none focus-visible:ring-3"
                                >
                                  <div className="flex min-w-0 items-center justify-end gap-1.5">
                                    <span className="min-w-0 truncate font-semibold">
                                      {formatCompactNumber(tokenCounts.totalTokens)}
                                    </span>
                                    {totalToolCalls > 0 ? (
                                      <span
                                        className="border-primary/30 bg-primary/10 text-primary inline-flex shrink-0 items-center gap-0.5 rounded border px-1 py-0 text-[10px] font-medium"
                                        title={t('requestEventsPage.detail.toolUsage')}
                                      >
                                        <Wrench className="size-2.5 shrink-0" aria-hidden="true" />
                                        <span>{formatCompactNumber(totalToolCalls)}</span>
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="text-muted-foreground flex min-w-0 items-center justify-end gap-2 overflow-hidden text-xs">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="inline-flex items-center gap-0.5">
                                        <ArrowUpFromLine
                                          className="text-info size-3 shrink-0"
                                          aria-hidden="true"
                                        />
                                        <span>{formatCompactNumber(tokenCounts.inputTokens)}</span>
                                      </span>
                                      {cacheHitRate ? (
                                        <span
                                          className={cn(
                                            'inline-flex items-center gap-0.5 rounded border px-1 py-0 text-[10px] font-medium',
                                            tokenCounts.cacheReadTokens > 0
                                              ? 'border-info/30 bg-info/10 text-info'
                                              : 'border-border bg-muted/60 text-muted-foreground',
                                          )}
                                        >
                                          <Database
                                            className="size-2.5 shrink-0"
                                            aria-hidden="true"
                                          />
                                          {cacheHitRate}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5">
                                      <ArrowDownToLine
                                        className="text-success size-3 shrink-0"
                                        aria-hidden="true"
                                      />
                                      <span>{formatCompactNumber(tokenCounts.outputTokens)}</span>
                                    </span>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="end"
                                className="max-w-[calc(100vw-2rem)] min-w-48 px-3 py-2 whitespace-normal"
                              >
                                <div className="grid gap-1 tabular-nums">
                                  <div className="border-background/20 mb-0.5 flex items-center justify-between gap-4 border-b pb-1 font-semibold">
                                    <span>{tokenTooltipRows[0]?.label}</span>
                                    <span>{tokenTooltipRows[0]?.value}</span>
                                  </div>
                                  {tokenTooltipRows.slice(1).map((row) => (
                                    <div
                                      key={row.label}
                                      className="text-meta flex items-start justify-between gap-4"
                                    >
                                      <span className="min-w-0 opacity-80">{row.label}</span>
                                      <span className="shrink-0 font-medium">{row.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        ) : null}
                        {isColumnRendered('latency') ? (
                          <TableCell className="text-right tabular-nums">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-medium">
                                {formatDuration(event.performance.latencyMs) ?? <EmptyValue />}
                              </span>
                              {speedLabel ? (
                                <span className="text-muted-foreground text-[11px]">
                                  ({speedLabel})
                                </span>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground text-xs">
                              {t('requestEventsPage.table.ttft', {
                                value: formatDuration(event.performance.ttftMs) ?? emptyValueText,
                              })}
                            </p>
                          </TableCell>
                        ) : null}
                        {isColumnRendered('cost') ? (
                          <TableCell className="min-w-0 overflow-hidden text-right tabular-nums">
                            {(() => {
                              const costTooltipRows = buildCostTooltipRows(event.billing, t)
                              const cellContent = (
                                <div
                                  tabIndex={costTooltipRows.length > 0 ? 0 : undefined}
                                  className="outline-hidden"
                                >
                                  <p className="font-medium">
                                    {formatTableCostAmount(
                                      event.billing?.amount ?? null,
                                      event.billing?.currency,
                                    ) ?? <EmptyValue />}
                                  </p>
                                </div>
                              )
                              if (costTooltipRows.length === 0) return cellContent
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    align="end"
                                    className="min-w-56 px-3 py-2"
                                  >
                                    <div className="grid gap-1 tabular-nums">
                                      <div className="border-background/20 mb-0.5 flex items-center justify-between gap-4 border-b pb-1 font-semibold">
                                        <span>{costTooltipRows[0]?.label}</span>
                                        <span>{costTooltipRows[0]?.value}</span>
                                      </div>
                                      {costTooltipRows.slice(1).map((row) => (
                                        <div
                                          key={row.label}
                                          className="flex items-center justify-between gap-4 text-[11px]"
                                        >
                                          <span className="opacity-80">{row.label}</span>
                                          <span className="font-mono font-medium">{row.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )
                            })()}
                          </TableCell>
                        ) : null}
                        {isColumnRendered('client') ? (
                          <TableCell className="min-w-0">
                            <p className="truncate">
                              <CallerUser
                                username={event.client?.username ?? null}
                                keyResolved={event.client?.clientKeyId != null}
                              />
                            </p>
                            <p className="text-muted-foreground truncate font-mono text-xs">
                              {event.client?.clientKeyLabel ?? event.client?.clientKeyMasked ?? (
                                <EmptyValue />
                              )}
                            </p>
                          </TableCell>
                        ) : null}
                        {isColumnRendered('userAgent') ? (
                          <TableCell className="min-w-0">
                            {event.client?.userAgent ? (
                              <UserAgentCopyButton
                                value={event.client.userAgent}
                                label={`${t('requestEventsPage.detail.actions.copy')}: ${t('requestEventsPage.detail.fields.userAgent')}`}
                              />
                            ) : (
                              <EmptyValue />
                            )}
                          </TableCell>
                        ) : null}
                        {isColumnRendered('runtime') ? (
                          <TableCell className="min-w-0">
                            <p className="truncate">
                              {getHomeNodeLabel(event) ?? t('requestEventsPage.status.localHome')}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {getRuntimeNodeLabel(event) ?? <EmptyValue />}
                            </p>
                          </TableCell>
                        ) : null}
                        {isColumnRendered('request') ? (
                          <TableCell className="min-w-0">
                            <p className="truncate font-mono text-xs">
                              {event.requestId ?? t('requestEventsPage.status.unknownRequest')}
                            </p>
                            <p className="text-muted-foreground truncate font-mono text-xs">
                              {event.upstreamRequestId ?? <EmptyValue />}
                            </p>
                          </TableCell>
                        ) : null}
                        {isColumnRendered('error') ? (
                          <TableCell className="min-w-0">
                            <p className="truncate text-xs">
                              {event.error?.message ?? event.error?.reason ?? <EmptyValue />}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {event.error?.bodyPreview ?? <EmptyValue />}
                            </p>
                          </TableCell>
                        ) : null}
                        <TableCell className="table-sticky-action-cell table-action-column-1 text-right transition-colors">
                          <RowActions
                            menuLabel={fullTime}
                            actions={[
                              {
                                id: 'inspect',
                                label: t('requestEventsPage.actions.viewDetail'),
                                icon: Eye,
                                onSelect: () => onInspect(event),
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableSpacerRow height={virtualRows.paddingBottom} colSpan={tableColumnCount} />
                </TableBody>
              </ContainedTable>
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
                    size="md"
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
        ) : !filtersValid ? (
          <TableEmptyState
            kind="filtered-empty"
            title={t('requestEventsPage.table.emptyTitle')}
            description={t('requestEventsPage.filters.dateRangeInvalid')}
            action={
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={mutating}
                onClick={onClearFilters}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('requestEventsPage.table.clearFilters')}
              </Button>
            }
          />
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
                    className={cn('w-24')}
                    size="md"
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
                  size="md"
                  disabled={!canGoPrevious || mutating}
                  onClick={() => onOffsetChange(Math.max(0, filters.offset - filters.limit))}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  {t('requestEventsPage.table.previous')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
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
    </TooltipProvider>
  )
}

export function RequestEventsPage({
  view,
  onViewChange,
}: {
  view: UsageWorkspaceView
  onViewChange: (view: UsageWorkspaceView) => void
}) {
  const { t } = useTranslation()
  const workbench = useRequestEventsWorkbench()
  const renderState = (content: ReactNode) => (
    <UsageWorkspaceShell view={view} onViewChange={onViewChange}>
      {content}
    </UsageWorkspaceShell>
  )

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return renderState(<ObservabilityLoadingState />)
  }
  if (!workbench.connected) {
    return renderState(<ObservabilityDisconnectedState copyKey="requestEventsPage" />)
  }
  if (workbench.isPending && workbench.capabilities.requestEvents) {
    return renderState(<ObservabilityLoadingState />)
  }
  if (
    workbench.isError &&
    !workbench.events &&
    !hasActiveFilters(workbench.filters) &&
    workbench.filtersValid
  ) {
    return renderState(
      <ObservabilityErrorState
        copyKey="requestEventsPage"
        errorMessage={workbench.errorMessage}
        onRetry={workbench.refetch}
      />,
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
    <UsageWorkspaceShell
      view={view}
      onViewChange={onViewChange}
      header={
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
      }
    >
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
    </UsageWorkspaceShell>
  )
}
