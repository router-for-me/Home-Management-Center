import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Download,
  Eye,
  Info,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DrawerScaffoldBody,
  DrawerScaffoldContent,
  DrawerScaffoldFooter,
  DrawerScaffoldHeader,
} from '@/components/shared/drawer-scaffold'
import { TableEmptyState } from '@/components/shared/empty-state'
import { CallerUser, EmptyValue, emptyValueText } from '@/components/shared/empty-value'
import { formGridClassName } from '@/components/shared/form-layout'
import { PageHeader } from '@/components/shared/page-header'
import { ProviderLogo } from '@/components/shared/provider-logo'
import { RowActions } from '@/components/shared/row-actions'
import { useSecondaryColumns } from '@/components/shared/table-columns'
import {
  TablePaginationStatus,
  TableSurface,
  TableSurfaceContent,
  TableSurfaceHeader,
  containedTableContainerClassName,
  stickyTableHeaderClassName,
} from '@/components/shared/table-surface'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type BillingTab,
  type DateRangePreset,
  alignBillingFiltersToReportTimezone,
  billingPageSizes,
  createDatePresetRange,
  createDefaultBillingFilters,
  defaultBillingPagination,
  getNextOffset,
  getPreviousOffset,
} from '@/features/billing/billing-model'
import { ModelPriceImportSheet } from '@/features/billing/model-price-import-sheet'
import {
  type BillingModelPriceCandidate,
  useBillingWorkbench,
} from '@/features/billing/use-billing-workbench'
import { usePersistentPagination } from '@/hooks/use-persistent-pagination'
import type {
  BalanceRecord,
  BillingFilters,
  BillingPagination,
  BillingServiceTierSource,
  ChargeRecord,
  ModelPrice,
  ModelPriceInput,
  ModelPriceSource,
} from '@/lib/api/management/billing-types'
import type { UserResource } from '@/lib/api/management/users'
import {
  formatCreditAmount,
  formatDetailedCreditAmount,
  formatModelPrice,
  formatSignedCreditAmount,
  formatSignedDetailedCreditAmount,
} from '@/lib/billing/amount-format'
import { hasSeparateCacheWriteRate } from '@/lib/billing/cache-write-pricing'
import { createBillingModelPriceCandidateId } from '@/lib/billing/model-price-candidates'
import type {
  ModelPriceImportApplyItem,
  ModelPriceImportApplyResult,
  ModelPriceImportOverwriteMode,
  ModelPriceImportProgress,
  ModelPriceImportTargetFilter,
} from '@/lib/billing/model-price-import-types'
import { uiPreferenceKeys } from '@/lib/ui-preferences'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type SheetMode =
  | { type: 'charge-detail'; record: ChargeRecord }
  | { type: 'balance-detail'; record: BalanceRecord }
  | { type: 'model-price-create' }
  | { type: 'model-price-edit'; resource: ModelPrice }
  | {
      type: 'model-price-import'
      intent: 'import' | 'refresh-synced'
      initialOverwriteMode?: ModelPriceImportOverwriteMode
      initialTargetFilter?: ModelPriceImportTargetFilter
    }

type PendingDelete = { type: 'model-price'; resource: ModelPrice }

const tabs: BillingTab[] = ['overview', 'charges', 'balanceRecords', 'modelPrices']
const modelPriceNumberFields = [
  'minInputTokens',
  'inputPricePerMillion',
  'outputPricePerMillion',
  'cacheReadPricePerMillion',
  'cacheWritePricePerMillion',
  'requestPrice',
] as const

type ModelPriceNumberField = (typeof modelPriceNumberFields)[number]
type ModelPriceDraft = Omit<ModelPriceInput, ModelPriceNumberField | 'serviceTier'> & {
  [key in ModelPriceNumberField]: string
} & {
  serviceTier: string
}

function isUnpricedCharge(record: ChargeRecord) {
  return record.matchedPriceRule?.trim().toLowerCase() === 'default:zero'
}

function formatUnpricedChargeMessage(
  record: Pick<ChargeRecord, 'provider' | 'model'>,
  t: ReturnType<typeof useTranslation>['t'],
) {
  return t('billingPage.chargeDetail.unpricedDescription', {
    provider: record.provider || emptyValueText,
    model: record.model || emptyValueText,
  })
}

export function formatChargeTokenSummary(
  record: Pick<
    ChargeRecord,
    'inputTokens' | 'outputTokens' | 'cacheTokens' | 'cacheReadTokens' | 'cacheWriteTokens'
  >,
  t: ReturnType<typeof useTranslation>['t'],
) {
  const input = formatNumber(record.inputTokens)
  const output = formatNumber(record.outputTokens)
  // The split is null without complete v2 token accounting on the linked usage
  // row; keep the combined cache counter instead of showing a fabricated split.
  if (record.cacheReadTokens == null || record.cacheWriteTokens == null) {
    return t('billingPage.charges.tokenSummary', {
      input,
      output,
      cache: formatNumber(record.cacheTokens),
    })
  }
  return t('billingPage.charges.tokenSummaryCacheSplit', {
    input,
    output,
    cacheRead: formatNumber(record.cacheReadTokens),
    cacheWrite: formatNumber(record.cacheWriteTokens),
  })
}

function toModelPriceInput(
  resource: ModelPrice,
  enabled = resource.enabled,
  includeRuleScope = true,
): ModelPriceInput {
  return {
    provider: resource.provider,
    model: resource.model,
    ...(includeRuleScope
      ? {
          serviceTier: resource.serviceTier,
          minInputTokens: resource.minInputTokens,
        }
      : {}),
    inputPricePerMillion: resource.inputPricePerMillion,
    outputPricePerMillion: resource.outputPricePerMillion,
    cacheReadPricePerMillion: resource.cacheReadPricePerMillion,
    cacheWritePricePerMillion: resource.cacheWritePricePerMillion,
    requestPrice: resource.requestPrice,
    enabled,
    note: resource.note ?? undefined,
  }
}

function createModelPriceDraft(resource: ModelPrice | null): ModelPriceDraft {
  return {
    provider: resource?.provider ?? '',
    model: resource?.model ?? '',
    serviceTier: resource?.serviceTier ?? '*',
    minInputTokens: String(resource?.minInputTokens ?? 0),
    inputPricePerMillion: String(resource?.inputPricePerMillion ?? 0),
    outputPricePerMillion: String(resource?.outputPricePerMillion ?? 0),
    cacheReadPricePerMillion: String(resource?.cacheReadPricePerMillion ?? 0),
    cacheWritePricePerMillion: String(resource?.cacheWritePricePerMillion ?? 0),
    requestPrice: String(resource?.requestPrice ?? 0),
    enabled: resource?.enabled ?? true,
    note: resource?.note ?? '',
  }
}

function parsePriceValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function formatContextBand(value: number, t: ReturnType<typeof useTranslation>['t']) {
  if (value === 0) return t('billingPage.prices.scope.baseContext')
  if (value === 272001) return t('billingPage.prices.scope.over272K')
  return t('billingPage.prices.scope.fromTokens', { count: formatNumber(value) })
}

function formatServiceTier(value: string, t: ReturnType<typeof useTranslation>['t']) {
  if (value === '*') return t('billingPage.prices.tiers.wildcard')
  if (value === 'standard' || value === 'flex' || value === 'priority') {
    return t(`billingPage.prices.tiers.${value}`)
  }
  return value
}

function formatModelPriceIdentity(resource: ModelPrice, t: ReturnType<typeof useTranslation>['t']) {
  return `${resource.model} · ${formatServiceTier(resource.serviceTier, t)} · ${formatContextBand(resource.minInputTokens, t)}`
}

function formatDateTime(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function CacheWritePriceValue({
  value,
  t,
  className,
}: {
  value: number
  t: ReturnType<typeof useTranslation>['t']
  className?: string
}) {
  if (hasSeparateCacheWriteRate(value)) {
    return <span className={cn('tabular-nums', className)}>{formatModelPrice(value)}</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex text-left text-xs leading-4 underline decoration-dotted underline-offset-2 transition-colors focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none',
            className,
          )}
        >
          {t('billingPage.prices.cacheWritePricing.noSeparateRate')}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80">
        {t('billingPage.prices.cacheWritePricing.noSeparateRateHint')}
      </TooltipContent>
    </Tooltip>
  )
}

function formatUserIdentity(user: UserResource) {
  return user.numericId !== null ? `${user.username} (#${user.numericId})` : user.username
}

// Charges and balance records carry a user id and no name: `billing_charge` has
// no username column and the API never sends one, so the name has to come from
// the users snapshot this page already loads. The record's own username is still
// preferred in case the API starts sending it.
export function formatUserReference(
  username: string,
  userId: number | null,
  users: UserResource[],
  fallback: string,
) {
  const matchedUser = userId !== null ? users.find((user) => user.numericId === userId) : undefined

  if (matchedUser) return formatUserIdentity(matchedUser)
  if (username && userId !== null) return `${username} (#${userId})`
  if (username) return username
  if (userId !== null) return `#${userId}`
  return fallback
}

// A charge stores a user id and no name, and a null id is not missing data: the
// key that paid simply belongs to no Home account. `api_key_label` is only set
// when the key row resolved, which is what tells those two cases apart.
function renderChargeUser(record: ChargeRecord, users: UserResource[]) {
  const resolved = formatUserReference(record.username, record.userId, users, '')
  if (resolved) return resolved
  return <CallerUser username={null} keyResolved={Boolean(record.apiKeyLabel.trim())} />
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
  }
}

function BillingDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <WalletCards className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('billingPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('billingPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <WalletCards className="size-4" aria-hidden="true" />
            {t('billingPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function ErrorNotice({ message, fallback }: { message: string | null; fallback: string }) {
  const showDetail = Boolean(message && message !== fallback)

  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
      <div>{fallback}</div>
      {showDetail ? <div className="mt-1 font-mono text-xs opacity-80">{message}</div> : null}
    </div>
  )
}

function CompactDrawerFormBody({ className, children }: ComponentProps<'div'>) {
  return (
    <DrawerScaffoldBody className="p-4 sm:p-5">
      <div className={cn('grid w-full gap-4', className)}>{children}</div>
    </DrawerScaffoldBody>
  )
}

function CompactField({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error ? (
        <p className="text-destructive text-xs leading-5 font-normal" aria-live="polite">
          {error}
        </p>
      ) : null}
      {hint ? <p className="text-muted-foreground text-xs leading-5 font-normal">{hint}</p> : null}
    </div>
  )
}

function StateBadge({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        enabled
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning',
      )}
    >
      {enabled ? t('billingPage.common.enabled') : t('billingPage.common.disabled')}
    </span>
  )
}

function StateToggle({
  enabled,
  disabled,
  label,
  onToggle,
}: {
  enabled: boolean
  disabled: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <StateBadge enabled={enabled} />
      <Switch
        checked={enabled}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onToggle}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}

function PaginationBar({
  pagination,
  total,
  disabled,
  onChange,
}: {
  pagination: BillingPagination
  total: number
  disabled: boolean
  onChange: (pagination: BillingPagination) => void
}) {
  const { t } = useTranslation()
  const start = total === 0 ? 0 : pagination.offset + 1
  const end = Math.min(total, pagination.offset + pagination.limit)

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
      <TablePaginationStatus
        text={t('billingPage.pagination.range', { start, end, total })}
        announcementKey={`${pagination.offset}:${pagination.limit}`}
        busy={disabled}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(pagination.limit)}
          onValueChange={(value) => onChange({ limit: Number(value), offset: 0 })}
        >
          <SelectTrigger
            className="w-28"
            size="md"
            aria-label={t('billingPage.pagination.pageSize')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {billingPageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t('billingPage.pagination.rows', { count: size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="md"
          disabled={disabled || pagination.offset === 0}
          onClick={() => onChange({ ...pagination, offset: getPreviousOffset(pagination) })}
        >
          {t('billingPage.pagination.previous')}
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={disabled || pagination.offset + pagination.limit >= total}
          onClick={() => onChange({ ...pagination, offset: getNextOffset(pagination, total) })}
        >
          {t('billingPage.pagination.next')}
        </Button>
      </div>
    </div>
  )
}

function MetricStrip({
  title,
  items,
  columnsClassName,
}: {
  title: string
  items: Array<{ label: string; value: string; detail?: string; valueClassName?: string }>
  columnsClassName?: string
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className={cn('mt-4 grid gap-4', columnsClassName)}>
        {items.map((item) => (
          <div
            key={item.label}
            className="min-w-0 border-t pt-3 first:border-t-0 first:pt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4 lg:first:border-l-0 lg:first:pl-0"
          >
            <p className="text-muted-foreground truncate text-xs">{item.label}</p>
            <p
              className={cn(
                'mt-2 truncate text-lg font-semibold tabular-nums',
                item.valueClassName,
              )}
            >
              {item.value}
            </p>
            {item.detail ? (
              <p className="text-muted-foreground mt-1 truncate text-xs">{item.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function createDefaultBillingTextFilters() {
  return {
    user: '',
    model: '',
    provider: '',
  }
}

function BillingOverviewLoadingState() {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4" aria-busy="true">
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('billingPage.loading.overviewTitle')}</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('billingPage.loading.overviewDescription')}
            </p>
          </div>
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-md border p-3">
              <Skeleton className="h-3 w-24 rounded-sm" />
              <Skeleton className="mt-3 h-6 w-32 rounded-sm" />
              <Skeleton className="mt-2 h-3 w-20 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <Skeleton className="h-4 w-32 rounded-sm" />
          <Skeleton className="mt-4 h-48 rounded-md" />
        </div>
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <Skeleton className="h-4 w-28 rounded-sm" />
          <div className="mt-4 grid gap-3">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ workbench }: { workbench: ReturnType<typeof useBillingWorkbench> }) {
  const { t } = useTranslation()
  const overview = workbench.overview

  if (workbench.overviewLoading) {
    return <BillingOverviewLoadingState />
  }

  if (workbench.overviewError) {
    return (
      <ErrorNotice
        message={workbench.overviewError}
        fallback={t('billingPage.error.description')}
      />
    )
  }

  if (!overview) {
    return (
      <TableEmptyState
        kind="empty"
        className="m-0 border-0"
        title={t('billingPage.overview.empty')}
      />
    )
  }

  return (
    <div className="grid gap-4">
      <MetricStrip
        title={t('billingPage.overview.metrics.financeSummary')}
        columnsClassName="lg:grid-cols-4"
        items={[
          {
            label: t('billingPage.overview.metrics.totalChargeAmount'),
            value: formatCreditAmount(overview.totalChargeAmount),
            detail: t('billingPage.overview.metrics.selectedRange'),
            valueClassName: 'text-destructive',
          },
          {
            label: t('billingPage.overview.metrics.totalRechargeAmount'),
            value: formatCreditAmount(overview.totalRechargeAmount),
            detail: t('billingPage.overview.metrics.selectedRange'),
            valueClassName: 'text-success',
          },
          {
            label: t('billingPage.overview.metrics.totalDeductAmount'),
            value: formatCreditAmount(overview.totalDeductAmount),
            detail: t('billingPage.overview.metrics.selectedRange'),
            valueClassName: 'text-warning-foreground dark:text-warning',
          },
          {
            label: t('billingPage.overview.metrics.totalBalance'),
            value: formatCreditAmount(overview.totalBalance),
            detail: t('billingPage.overview.metrics.currentSnapshot'),
          },
        ]}
      />
      <MetricStrip
        title={t('billingPage.overview.metrics.usageSummary')}
        columnsClassName="lg:grid-cols-5"
        items={[
          {
            label: t('billingPage.overview.metrics.requests'),
            value: formatNumber(overview.requestCount),
          },
          {
            label: t('billingPage.overview.metrics.inputTokens'),
            value: formatNumber(overview.inputTokens),
          },
          {
            label: t('billingPage.overview.metrics.outputTokens'),
            value: formatNumber(overview.outputTokens),
          },
          {
            label: t('billingPage.overview.metrics.cacheTokens'),
            value: formatNumber(overview.cacheTokens),
          },
          {
            label: t('billingPage.overview.metrics.activeUsers'),
            value: formatNumber(overview.activeUserCount),
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t('billingPage.overview.trend.title')}</h2>
            <BarChart3 className="text-muted-foreground size-4" aria-hidden="true" />
          </div>
          {overview.dailyTrend.length === 0 ? (
            <TableEmptyState
              compact
              kind="empty"
              className="m-0 mt-4 min-h-28"
              title={t('billingPage.overview.trend.empty')}
            />
          ) : (
            <div className="mt-4 grid gap-2">
              {overview.dailyTrend.map((point) => (
                <div
                  key={point.date}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="truncate">{point.date}</span>
                  <span className="font-medium tabular-nums">
                    {formatCreditAmount(point.chargeAmount)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {t('billingPage.overview.trend.requests', {
                      count: formatNumber(point.requestCount),
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-4">
          {[
            ['topUsers', overview.topUsers],
            ['topModels', overview.topModels],
            ['topProviders', overview.topProviders],
          ].map(([key, items]) => (
            <div key={key as string} className="bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold">
                {t(`billingPage.overview.rank.${key as string}`)}
              </h2>
              {(items as typeof overview.topUsers).length === 0 ? (
                <TableEmptyState
                  compact
                  kind="empty"
                  className="m-0 mt-3 min-h-24"
                  title={t('billingPage.overview.rank.empty')}
                />
              ) : (
                <div className="mt-3 grid gap-2">
                  {(items as typeof overview.topUsers).slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {key === 'topProviders' ? (
                          <ProviderLogo providerId={item.id || item.label} size="sm" />
                        ) : null}
                        <span className="min-w-0 truncate">{item.label}</span>
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCreditAmount(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChargeRecordsTab({
  workbench,
  pagination,
  onPaginationChange,
  onView,
}: {
  workbench: ReturnType<typeof useBillingWorkbench>
  pagination: BillingPagination
  onPaginationChange: (pagination: BillingPagination) => void
  onView: (record: ChargeRecord) => void
}) {
  const { t } = useTranslation()
  /*
   * A ledger row is a time and an amount; every attribution column beside them
   * is in the record detail. So a phone keeps those two and drops the rest.
   */
  const showSecondary = useSecondaryColumns()

  if (workbench.chargesLoading) return <Skeleton className="h-[420px] rounded-lg" />
  if (workbench.chargesError) {
    return (
      <ErrorNotice message={workbench.chargesError} fallback={t('billingPage.error.description')} />
    )
  }

  return (
    <TableSurface
      pagination={
        workbench.chargesTotal > 0 ? (
          <PaginationBar
            pagination={pagination}
            total={workbench.chargesTotal}
            disabled={workbench.chargesFetching}
            onChange={onPaginationChange}
          />
        ) : null
      }
    >
      <TableSurfaceHeader title={t('billingPage.charges.title')} />
      {workbench.charges.length === 0 ? (
        <TableEmptyState kind="empty" title={t('billingPage.charges.empty')} />
      ) : (
        <TableSurfaceContent>
          <Table
            className={cn(!showSecondary && 'table-fixed', 'sm:min-w-[1160px]')}
            containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
          >
            <TableHeader className={stickyTableHeaderClassName}>
              <TableRow variant="static">
                <TableHead>{t('billingPage.charges.columns.time')}</TableHead>
                {showSecondary ? (
                  <>
                    <TableHead>{t('billingPage.charges.columns.user')}</TableHead>
                    <TableHead>{t('billingPage.charges.columns.key')}</TableHead>
                    <TableHead>{t('billingPage.charges.columns.provider')}</TableHead>
                    <TableHead>{t('billingPage.charges.columns.model')}</TableHead>
                    <TableHead>{t('billingPage.charges.columns.request')}</TableHead>
                    <TableHead>{t('billingPage.charges.columns.tokens')}</TableHead>
                  </>
                ) : null}
                <TableHead className={showSecondary ? undefined : 'w-28'}>
                  {t('billingPage.charges.columns.amount')}
                </TableHead>
                {showSecondary ? (
                  <TableHead>{t('billingPage.charges.columns.balanceAfter')}</TableHead>
                ) : null}
                <TableHead className="table-sticky-action-head table-action-column-1 text-right">
                  {t('billingPage.common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workbench.charges.map((record) => {
                const unpriced = isUnpricedCharge(record)
                const unpricedMessage = unpriced ? formatUnpricedChargeMessage(record, t) : null
                return (
                  <TableRow key={record.id} variant="resource">
                    <TableCell>{formatDateTime(record.createdAt, emptyValueText)}</TableCell>
                    {showSecondary ? (
                      <>
                        <TableCell>{renderChargeUser(record, workbench.users)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {record.apiKeyMasked || record.apiKeyLabel || <EmptyValue />}
                        </TableCell>
                        <TableCell>{record.provider || <EmptyValue />}</TableCell>
                        <TableCell className="max-w-[220px] truncate font-mono text-xs">
                          {record.model || <EmptyValue />}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-xs">
                          {record.requestId}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatChargeTokenSummary(record, t)}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell
                      className={cn(
                        'font-medium tabular-nums',
                        unpriced ? 'text-warning-foreground dark:text-warning' : 'text-destructive',
                      )}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>{formatSignedDetailedCreditAmount(-Math.abs(record.amount))}</span>
                        {unpricedMessage ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="text"
                                size="icon-xs"
                                // 20px because it sits inside a table cell beside the amount, below the 24px
                                // floor.
                                // eslint-disable-next-line home-ui/no-control-size-override
                                className="text-warning-foreground hover:bg-warning/12 hover:text-warning-foreground focus-visible:ring-warning/30 dark:text-warning dark:hover:text-warning size-5"
                                aria-label={unpricedMessage}
                              >
                                <AlertTriangle className="size-3.5" aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-80 text-left leading-5 text-wrap break-words"
                            >
                              {unpricedMessage}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </TableCell>
                    {showSecondary ? (
                      <TableCell className="tabular-nums">
                        {formatCreditAmount(record.balanceAfter)}
                      </TableCell>
                    ) : null}
                    <TableCell className="table-sticky-action-cell table-action-column-1 text-right transition-colors">
                      <RowActions
                        menuLabel={formatDateTime(record.createdAt, emptyValueText)}
                        actions={[
                          {
                            id: 'view',
                            label: t('billingPage.common.view'),
                            icon: Eye,
                            onSelect: () => onView(record),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableSurfaceContent>
      )}
    </TableSurface>
  )
}

function BalanceRecordsTab({
  workbench,
  pagination,
  onPaginationChange,
  onView,
}: {
  workbench: ReturnType<typeof useBillingWorkbench>
  pagination: BillingPagination
  onPaginationChange: (pagination: BillingPagination) => void
  onView: (record: BalanceRecord) => void
}) {
  const { t } = useTranslation()
  /*
   * A ledger row is a time and an amount; every attribution column beside them
   * is in the record detail. So a phone keeps those two and drops the rest.
   */
  const showSecondary = useSecondaryColumns()

  if (workbench.balanceRecordsLoading) return <Skeleton className="h-[420px] rounded-lg" />
  if (workbench.balanceRecordsError) {
    return (
      <ErrorNotice
        message={workbench.balanceRecordsError}
        fallback={t('billingPage.error.description')}
      />
    )
  }

  return (
    <TableSurface
      pagination={
        workbench.balanceRecordsTotal > 0 ? (
          <PaginationBar
            pagination={pagination}
            total={workbench.balanceRecordsTotal}
            disabled={workbench.balanceRecordsFetching}
            onChange={onPaginationChange}
          />
        ) : null
      }
    >
      <TableSurfaceHeader title={t('billingPage.balance.title')} />
      {workbench.balanceRecords.length === 0 ? (
        <TableEmptyState kind="empty" title={t('billingPage.balance.empty')} />
      ) : (
        <TableSurfaceContent>
          <Table
            className={cn(!showSecondary && 'table-fixed', 'sm:min-w-[1120px]')}
            containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
          >
            <TableHeader className={stickyTableHeaderClassName}>
              <TableRow variant="static">
                <TableHead>{t('billingPage.balance.columns.time')}</TableHead>
                {showSecondary ? (
                  <>
                    <TableHead>{t('billingPage.balance.columns.user')}</TableHead>
                    <TableHead>{t('billingPage.balance.columns.type')}</TableHead>
                  </>
                ) : null}
                <TableHead className={showSecondary ? undefined : 'w-28'}>
                  {t('billingPage.balance.columns.amount')}
                </TableHead>
                {showSecondary ? (
                  <>
                    <TableHead>{t('billingPage.balance.columns.before')}</TableHead>
                    <TableHead>{t('billingPage.balance.columns.after')}</TableHead>
                    <TableHead>{t('billingPage.balance.columns.operator')}</TableHead>
                    <TableHead>{t('billingPage.balance.columns.note')}</TableHead>
                  </>
                ) : null}
                <TableHead className="table-sticky-action-head table-action-column-1 text-right">
                  {t('billingPage.common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workbench.balanceRecords.map((record: BalanceRecord) => (
                <TableRow key={record.id} variant="resource">
                  <TableCell>{formatDateTime(record.createdAt, emptyValueText)}</TableCell>
                  {showSecondary ? (
                    <>
                      <TableCell>
                        {formatUserReference(
                          record.username,
                          record.userId,
                          workbench.users,
                          emptyValueText,
                        )}
                      </TableCell>
                      <TableCell>
                        {record.type === 'recharge'
                          ? t('billingPage.balance.types.recharge')
                          : t('billingPage.balance.types.deduct')}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell
                    className={cn(
                      'font-medium tabular-nums',
                      record.type === 'deduct'
                        ? 'text-warning-foreground dark:text-warning'
                        : 'text-success',
                    )}
                  >
                    {formatSignedCreditAmount(
                      record.type === 'deduct' ? -Math.abs(record.amount) : Math.abs(record.amount),
                    )}
                  </TableCell>
                  {showSecondary ? (
                    <>
                      <TableCell className="tabular-nums">
                        {formatCreditAmount(record.balanceBefore)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCreditAmount(record.balanceAfter)}
                      </TableCell>
                    </>
                  ) : null}
                  {showSecondary ? (
                    <>
                      <TableCell>{record.operator || <EmptyValue />}</TableCell>
                      <TableCell className="max-w-[260px] truncate">
                        {record.note || <EmptyValue />}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell className="table-sticky-action-cell table-action-column-1 text-right transition-colors">
                    <RowActions
                      menuLabel={formatDateTime(record.createdAt, emptyValueText)}
                      actions={[
                        {
                          id: 'view',
                          label: t('billingPage.common.view'),
                          icon: Eye,
                          onSelect: () => onView(record),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableSurfaceContent>
      )}
    </TableSurface>
  )
}

function ModelPricesTab({
  workbench,
  onCreate,
  onImport,
  onRefreshSynced,
  onEdit,
  onToggle,
  onDelete,
}: {
  workbench: ReturnType<typeof useBillingWorkbench>
  onCreate: () => void
  onImport: () => void
  onRefreshSynced: () => void
  onEdit: (resource: ModelPrice) => void
  onToggle: (resource: ModelPrice) => void
  onDelete: (resource: ModelPrice) => void
}) {
  const { t } = useTranslation()
  /*
   * Nine of the twelve columns are the price breakdown, and every one of them is
   * in the edit sheet. The model and whether the rule is live are what a phone
   * needs to find the row worth opening.
   */
  const showSecondary = useSecondaryColumns()
  const supportsRuleScopes = (workbench.modelPriceSchemaVersion ?? 0) >= 2
  const [tierSourceDraft, setTierSourceDraft] = useState<'request' | 'response'>('request')
  const [tierPolicyDialogOpen, setTierPolicyDialogOpen] = useState(false)
  const [confirmTierSourceChange, setConfirmTierSourceChange] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [priceSearch, setPriceSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<'all' | '*' | 'standard' | 'flex' | 'priority'>(
    'all',
  )
  const [sourceFilter, setSourceFilter] = useState<'all' | ModelPriceSource>('all')
  const [stateFilter, setStateFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const savedTierSource = workbench.billingSettings?.serviceTierSource ?? 'request'
  const tierSourceDirty = tierSourceDraft !== savedTierSource
  const responseTierDiagnosticsUnavailable =
    Boolean(workbench.billingTierDiagnosticsError) ||
    workbench.billingTierDiagnostics?.supported === false ||
    (!workbench.billingTierDiagnosticsFetching && !workbench.billingTierDiagnostics)
  const hasPriceFilters =
    Boolean(priceSearch.trim()) ||
    tierFilter !== 'all' ||
    sourceFilter !== 'all' ||
    stateFilter !== 'all'
  const visibleModelPrices = useMemo(
    () =>
      workbench.modelPrices
        .filter((resource) => {
          const search = priceSearch.trim().toLowerCase()
          if (search && !`${resource.provider} ${resource.model}`.toLowerCase().includes(search)) {
            return false
          }
          if (tierFilter !== 'all' && resource.serviceTier !== tierFilter) return false
          if (sourceFilter !== 'all' && resource.source !== sourceFilter) return false
          if (stateFilter === 'enabled' && !resource.enabled) return false
          if (stateFilter === 'disabled' && resource.enabled) return false
          return true
        })
        .sort(
          (left, right) =>
            left.provider.localeCompare(right.provider) ||
            left.model.localeCompare(right.model) ||
            left.serviceTier.localeCompare(right.serviceTier) ||
            left.minInputTokens - right.minInputTokens,
        ),
    [priceSearch, sourceFilter, stateFilter, tierFilter, workbench.modelPrices],
  )

  useEffect(() => {
    setTierSourceDraft(savedTierSource)
    setSettingsError(null)
  }, [savedTierSource])

  const saveTierSource = async () => {
    setSettingsError(null)
    try {
      await workbench.updateBillingSettings({ serviceTierSource: tierSourceDraft })
      toast.success(t('billingPage.settings.saved'))
      setTierPolicyDialogOpen(false)
      setConfirmTierSourceChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('billingPage.toast.actionFailed')
      setSettingsError(message)
      toast.error(message)
    }
  }

  const requestTierSourceSave = () => {
    if (
      tierSourceDraft === 'response' &&
      (responseTierDiagnosticsUnavailable ||
        (workbench.billingTierDiagnostics?.supported &&
          workbench.billingTierDiagnostics.fallbackRequests > 0))
    ) {
      setConfirmTierSourceChange(true)
      return
    }
    void saveTierSource()
  }

  const cancelTierSourceEdit = () => {
    setTierSourceDraft(savedTierSource)
    setSettingsError(null)
    setTierPolicyDialogOpen(false)
  }

  const clearPriceFilters = () => {
    setPriceSearch('')
    setTierFilter('all')
    setSourceFilter('all')
    setStateFilter('all')
  }

  const copy = (value: string) => {
    void copyText(value).then(() => toast.success(t('billingPage.toast.copied')))
  }

  if (workbench.modelPricesLoading) return <Skeleton className="h-[420px] rounded-lg" />
  if (workbench.modelPricesError) {
    return (
      <ErrorNotice
        message={workbench.modelPricesError}
        fallback={t('billingPage.error.description')}
      />
    )
  }

  return (
    <>
      <section
        className="border-info/30 bg-info/5 overflow-hidden border-y sm:rounded-md sm:border"
        aria-labelledby="tier-policy-title"
      >
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="border-info/30 bg-info/10 text-info flex size-9 shrink-0 items-center justify-center rounded-md border">
              <Route className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="tier-policy-title" className="text-sm font-semibold">
                  {t('billingPage.settings.runtimeContextTitle')}
                </h2>
                <span className="bg-info/10 text-info rounded-md px-2 py-0.5 text-[11px] font-medium">
                  {t('billingPage.settings.globalBadge')}
                </span>
                {supportsRuleScopes ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="border-info/25 bg-background text-info hover:bg-info/10 focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
                        aria-label={t('billingPage.settings.capabilityDetails')}
                      >
                        {t('billingPage.settings.scopedPricingSupported')}
                        <Info className="size-3" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72">
                      {t('billingPage.settings.schemaVersionTechnical', {
                        version:
                          workbench.modelPriceSchemaVersion ?? t('billingPage.common.legacy'),
                      })}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <p className="text-foreground mt-1 text-sm font-medium">
                {t('billingPage.settings.currentRuntimeSource', {
                  source: t(`billingPage.settings.${savedTierSource}`),
                })}
              </p>
              <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-5">
                {supportsRuleScopes
                  ? t('billingPage.settings.runtimeContextDescription')
                  : t('billingPage.settings.legacyModeHint')}
              </p>
            </div>
          </div>
          {supportsRuleScopes && workbench.billingSettings?.supported ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={workbench.billingSettingsLoading || Boolean(workbench.billingSettingsError)}
              onClick={() => {
                setTierSourceDraft(savedTierSource)
                setSettingsError(null)
                setTierPolicyDialogOpen(true)
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
              {t('billingPage.settings.configure')}
            </Button>
          ) : workbench.billingSettingsLoading ? (
            <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
          ) : null}
        </div>
        {supportsRuleScopes && workbench.billingSettings?.supported === false ? (
          <p className="border-warning/30 bg-warning/10 text-warning mx-4 mb-4 rounded-md border px-3 py-2 text-xs sm:mx-5">
            {t('billingPage.settings.unsupported')}
          </p>
        ) : null}
        {supportsRuleScopes && workbench.billingSettingsError ? (
          <p className="text-destructive mx-4 mb-4 text-xs sm:mx-5" role="alert">
            {workbench.billingSettingsError}
          </p>
        ) : null}
      </section>

      <TableSurface>
        <TableSurfaceHeader
          title={t('billingPage.prices.title')}
          description={t('billingPage.prices.description')}
          actions={
            <div className="flex flex-wrap gap-2">
              {supportsRuleScopes ? (
                <>
                  <Button variant="outline" onClick={onRefreshSynced}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {t('billingPage.prices.actions.refreshSynced')}
                  </Button>
                  <Button variant="outline" onClick={onImport}>
                    <Download className="size-4" aria-hidden="true" />
                    {t('billingPage.prices.actions.import')}
                  </Button>
                </>
              ) : null}
              <Button onClick={onCreate}>
                <Plus className="size-4" aria-hidden="true" />
                {t('billingPage.prices.actions.create')}
              </Button>
            </div>
          }
        />
        <TableSurfaceContent>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-72 sm:shrink-0">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                size="md"
                className={cn('pl-9')}
                type="search"
                value={priceSearch}
                placeholder={t('billingPage.prices.filters.search')}
                onChange={(event) => setPriceSearch(event.target.value)}
              />
            </div>
            <Select
              value={tierFilter}
              onValueChange={(value) => setTierFilter(value as typeof tierFilter)}
            >
              <SelectTrigger
                className={cn('w-full sm:w-40')}
                size="md"
                aria-label={t('billingPage.prices.filters.tier')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('billingPage.prices.filters.allTiers')}</SelectItem>
                <SelectItem value="*">{t('billingPage.prices.tiers.wildcard')}</SelectItem>
                <SelectItem value="standard">{t('billingPage.prices.tiers.standard')}</SelectItem>
                <SelectItem value="flex">{t('billingPage.prices.tiers.flex')}</SelectItem>
                <SelectItem value="priority">{t('billingPage.prices.tiers.priority')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sourceFilter}
              onValueChange={(value) => setSourceFilter(value as typeof sourceFilter)}
            >
              <SelectTrigger
                className={cn('w-full sm:w-40')}
                size="md"
                aria-label={t('billingPage.prices.filters.source')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('billingPage.prices.filters.allSources')}</SelectItem>
                <SelectItem value="manual">{t('billingPage.prices.sources.manual')}</SelectItem>
                <SelectItem value="sync">{t('billingPage.prices.sources.sync')}</SelectItem>
                <SelectItem value="default">{t('billingPage.prices.sources.default')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={stateFilter}
              onValueChange={(value) => setStateFilter(value as typeof stateFilter)}
            >
              <SelectTrigger
                className={cn('w-full sm:w-40')}
                size="md"
                aria-label={t('billingPage.prices.filters.state')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('billingPage.prices.filters.allStates')}</SelectItem>
                <SelectItem value="enabled">{t('billingPage.common.enabled')}</SelectItem>
                <SelectItem value="disabled">{t('billingPage.common.disabled')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="md"
              className={cn('justify-center sm:ml-auto')}
              disabled={!hasPriceFilters}
              onClick={clearPriceFilters}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {t('billingPage.prices.filters.clear')}
            </Button>
          </div>
          {workbench.modelPrices.length === 0 ? (
            <TableEmptyState className="m-0" kind="empty" title={t('billingPage.prices.empty')} />
          ) : visibleModelPrices.length === 0 ? (
            <TableEmptyState
              className="m-0"
              kind="filtered-empty"
              title={t('billingPage.prices.filters.empty')}
              action={
                <Button type="button" variant="outline" size="md" onClick={clearPriceFilters}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t('billingPage.prices.filters.clear')}
                </Button>
              }
            />
          ) : (
            <Table
              className="min-w-[1260px]"
              containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
            >
              <TableHeader className={stickyTableHeaderClassName}>
                <TableRow variant="static">
                  {showSecondary ? (
                    <TableHead className="min-w-[190px]">
                      {t('billingPage.prices.columns.provider')}
                    </TableHead>
                  ) : null}
                  <TableHead className={showSecondary ? 'min-w-[220px]' : undefined}>
                    {t('billingPage.prices.columns.model')}
                  </TableHead>
                  {showSecondary ? (
                    <>
                      <TableHead>{t('billingPage.prices.columns.scope')}</TableHead>
                      <TableHead>{t('billingPage.prices.columns.input')}</TableHead>
                      <TableHead>{t('billingPage.prices.columns.output')}</TableHead>
                      <TableHead>{t('billingPage.prices.columns.cacheRead')}</TableHead>
                      <TableHead>{t('billingPage.prices.columns.cacheWrite')}</TableHead>
                      <TableHead>{t('billingPage.prices.columns.request')}</TableHead>
                      <TableHead>{t('billingPage.prices.columns.source')}</TableHead>
                    </>
                  ) : null}
                  <TableHead className={showSecondary ? undefined : 'w-24'}>
                    {t('billingPage.prices.columns.state')}
                  </TableHead>
                  {showSecondary ? (
                    <TableHead>{t('billingPage.prices.columns.updatedAt')}</TableHead>
                  ) : null}
                  <TableHead className="table-sticky-action-head table-action-column-2 text-right">
                    {t('billingPage.common.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleModelPrices.map((resource) => (
                  <TableRow key={resource.id} variant="resource">
                    {showSecondary ? (
                      <TableCell className="min-w-[190px]">{resource.provider}</TableCell>
                    ) : null}
                    <TableCell
                      className={showSecondary ? 'max-w-[220px] min-w-[220px]' : 'max-w-0'}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 truncate font-mono text-xs">{resource.model}</span>
                        {resource.model ? (
                          <Button
                            type="button"
                            variant="text"
                            size="icon-xs"
                            onClick={() => copy(resource.model)}
                          >
                            <Copy className="size-3" aria-hidden="true" />
                            <span className="sr-only">{t('billingPage.common.copy')}</span>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                    {showSecondary ? (
                      <>
                        <TableCell className="min-w-[170px]">
                          {supportsRuleScopes ? (
                            <div className="grid gap-1 text-xs">
                              <span className="bg-muted w-fit rounded-md px-2 py-1 font-medium">
                                {formatServiceTier(resource.serviceTier, t)}
                              </span>
                              <span className="text-muted-foreground">
                                {formatContextBand(resource.minInputTokens, t)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {t('billingPage.prices.scope.flatPrice')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatModelPrice(resource.inputPricePerMillion)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatModelPrice(resource.outputPricePerMillion)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatModelPrice(resource.cacheReadPricePerMillion)}
                        </TableCell>
                        <TableCell>
                          <CacheWritePriceValue
                            value={resource.cacheWritePricePerMillion}
                            t={t}
                            className="whitespace-nowrap"
                          />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatModelPrice(resource.requestPrice)}
                        </TableCell>
                        <TableCell>{t(`billingPage.prices.sources.${resource.source}`)}</TableCell>
                      </>
                    ) : null}
                    <TableCell>
                      <StateToggle
                        enabled={resource.enabled}
                        disabled={workbench.mutating}
                        label={t('billingPage.prices.actions.toggleState', {
                          model: formatModelPriceIdentity(resource, t),
                        })}
                        onToggle={() => onToggle(resource)}
                      />
                    </TableCell>
                    {showSecondary ? (
                      <TableCell>{formatDateTime(resource.updatedAt, emptyValueText)}</TableCell>
                    ) : null}
                    <TableCell className="table-sticky-action-cell table-action-column-2 text-right transition-colors">
                      <RowActions
                        menuLabel={formatModelPriceIdentity(resource, t)}
                        actions={[
                          {
                            id: 'edit',
                            label: t('billingPage.common.edit'),
                            ariaLabel: t('billingPage.prices.actions.editExact', {
                              rule: formatModelPriceIdentity(resource, t),
                            }),
                            icon: Pencil,
                            onSelect: () => onEdit(resource),
                          },
                          {
                            id: 'delete',
                            label: t('billingPage.common.delete'),
                            ariaLabel: t('billingPage.prices.actions.deleteExact', {
                              rule: formatModelPriceIdentity(resource, t),
                            }),
                            icon: Trash2,
                            tone: 'destructive',
                            onSelect: () => onDelete(resource),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableSurfaceContent>
      </TableSurface>

      <Dialog
        open={tierPolicyDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setTierPolicyDialogOpen(true)
            return
          }
          if (!workbench.mutating) cancelTierSourceEdit()
        }}
      >
        <DialogContent
          className="max-w-xl"
          closeLabel={t('close')}
          showCloseButton={!workbench.mutating}
        >
          <DialogHeader>
            <DialogTitle>{t('billingPage.settings.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('billingPage.settings.dialogDescription')}</DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={tierSourceDraft}
            disabled={workbench.mutating || workbench.billingSettingsLoading}
            aria-label={t('billingPage.settings.serviceTierSource')}
            onValueChange={(value) => {
              if (value === 'request' || value === 'response') setTierSourceDraft(value)
            }}
          >
            {(['request', 'response'] as const).map((source) => (
              <label
                key={source}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 transition-colors',
                  tierSourceDraft === source
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:bg-muted/40',
                  workbench.mutating && 'cursor-not-allowed opacity-60',
                )}
              >
                <RadioGroupItem value={source} className="mt-0.5" />
                <span className="grid min-w-0 gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {t(`billingPage.settings.${source}`)}
                    {source === 'request' ? (
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-medium">
                        {t('billingPage.settings.defaultBadge')}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs leading-5">
                    {source === 'request'
                      ? t('billingPage.settings.requestOptionDescription')
                      : t('billingPage.settings.responseOptionDescription')}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {tierSourceDirty ? (
            <p className="bg-muted/40 rounded-md px-3 py-2 text-xs leading-5">
              <span className="text-muted-foreground">
                {t('billingPage.settings.proposedValue')}{' '}
              </span>
              <span className="font-medium">{t(`billingPage.settings.${tierSourceDraft}`)}</span>
            </p>
          ) : null}

          {tierSourceDirty &&
          tierSourceDraft === 'response' &&
          workbench.billingTierDiagnosticsFetching ? (
            <p className="text-muted-foreground text-xs leading-5" role="status">
              {t('billingPage.settings.diagnosticsLoading')}
            </p>
          ) : null}
          {tierSourceDirty &&
          tierSourceDraft === 'response' &&
          !workbench.billingTierDiagnosticsFetching &&
          !workbench.billingTierDiagnosticsError &&
          workbench.billingTierDiagnostics?.supported ? (
            <div
              role={workbench.billingTierDiagnostics.fallbackRequests > 0 ? 'alert' : 'status'}
              className={cn(
                'rounded-md border px-3 py-2 text-xs leading-5',
                workbench.billingTierDiagnostics.fallbackRequests > 0
                  ? 'border-warning/30 bg-warning/10 text-warning'
                  : 'border-border bg-muted/30 text-muted-foreground',
              )}
            >
              {workbench.billingTierDiagnostics.responseTierRequests === 0 &&
              workbench.billingTierDiagnostics.eligibleRequests > 0
                ? t('billingPage.settings.noResponseTierWarningProposed', {
                    count: workbench.billingTierDiagnostics.eligibleRequests,
                  })
                : t('billingPage.settings.fallbackSummaryProposed', {
                    fallback: workbench.billingTierDiagnostics.fallbackRequests,
                    total: workbench.billingTierDiagnostics.eligibleRequests,
                  })}
            </div>
          ) : null}
          {tierSourceDirty &&
          tierSourceDraft === 'response' &&
          !workbench.billingTierDiagnosticsFetching &&
          responseTierDiagnosticsUnavailable ? (
            <p className="text-warning text-xs leading-5">
              {t('billingPage.settings.diagnosticsUnavailable')}
            </p>
          ) : null}
          {settingsError || workbench.billingSettingsError ? (
            <p className="text-destructive text-xs" role="alert">
              {settingsError || workbench.billingSettingsError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={workbench.mutating}
              onClick={cancelTierSourceEdit}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                workbench.mutating ||
                !tierSourceDirty ||
                (tierSourceDraft === 'response' && workbench.billingTierDiagnosticsFetching)
              }
              onClick={requestTierSourceSave}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              {t('billingPage.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmTierSourceChange} onOpenChange={setConfirmTierSourceChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billingPage.settings.confirmResponseTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {responseTierDiagnosticsUnavailable
                ? t('billingPage.settings.confirmResponseUnknownDescription')
                : t('billingPage.settings.confirmResponseDescription', {
                    fallback: workbench.billingTierDiagnostics?.fallbackRequests ?? 0,
                    total: workbench.billingTierDiagnostics?.eligibleRequests ?? 0,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void saveTierSource()}>
              {t('billingPage.settings.confirmResponseAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ChargeDetailSheet({ record, users }: { record: ChargeRecord; users: UserResource[] }) {
  const { t } = useTranslation()
  const unpriced = isUnpricedCharge(record)
  const unpricedMessage = unpriced ? formatUnpricedChargeMessage(record, t) : null
  const copy = (value: string) => {
    void copyText(value).then(() => toast.success(t('billingPage.toast.copied')))
  }
  // Typed rather than inferred: one row now renders a component, and without
  // the annotation the tuple widens enough to let a React element reach copy().
  const rows: Array<[string, ReactNode, boolean]> = [
    [t('billingPage.chargeDetail.requestId'), record.requestId, true],
    [t('billingPage.chargeDetail.user'), renderChargeUser(record, users), false],
    [t('billingPage.chargeDetail.key'), record.apiKeyMasked || record.apiKeyLabel, true],
    [t('billingPage.chargeDetail.provider'), record.provider, false],
    [t('billingPage.chargeDetail.model'), record.model, true],
    [t('billingPage.chargeDetail.originalModel'), record.originalModel, true],
    [t('billingPage.chargeDetail.actualModel'), record.actualModel, true],
    [t('billingPage.chargeDetail.endpoint'), record.endpoint, true],
    [t('billingPage.chargeDetail.inputTokens'), formatNumber(record.inputTokens), false],
    [t('billingPage.chargeDetail.outputTokens'), formatNumber(record.outputTokens), false],
    [t('billingPage.chargeDetail.cacheTokens'), formatNumber(record.cacheTokens), false],
    [t('billingPage.chargeDetail.matchedPriceRule'), record.matchedPriceRule, true],
    [t('billingPage.chargeDetail.selectedTier'), record.priceSnapshot.serviceTier, false],
    [
      t('billingPage.chargeDetail.selectedBand'),
      record.priceSnapshot.schemaVersion == null
        ? null
        : formatContextBand(record.priceSnapshot.minInputTokens, t),
      false,
    ],
    [t('billingPage.chargeDetail.requestedTier'), record.priceSnapshot.requestedServiceTier, false],
    [t('billingPage.chargeDetail.responseTier'), record.priceSnapshot.responseServiceTier, false],
    [t('billingPage.chargeDetail.tierSource'), record.priceSnapshot.serviceTierSource, false],
    [t('billingPage.chargeDetail.effectiveTier'), record.priceSnapshot.effectiveServiceTier, false],
    [
      t('billingPage.chargeDetail.responseTierFallback'),
      record.priceSnapshot.responseServiceTierFallback == null
        ? null
        : record.priceSnapshot.responseServiceTierFallback
          ? t('billingPage.common.yes')
          : t('billingPage.common.no'),
      false,
    ],
    [
      t('billingPage.chargeDetail.amount'),
      formatSignedDetailedCreditAmount(-Math.abs(record.amount)),
      false,
    ],
    [
      t('billingPage.chargeDetail.balanceBefore'),
      formatDetailedCreditAmount(record.balanceBefore),
      false,
    ],
    [
      t('billingPage.chargeDetail.balanceAfter'),
      formatDetailedCreditAmount(record.balanceAfter),
      false,
    ],
    [
      t('billingPage.chargeDetail.createdAt'),
      formatDateTime(record.createdAt, emptyValueText),
      false,
    ],
  ] as const

  return (
    <DrawerScaffoldBody className="grid gap-5">
      {unpricedMessage ? (
        <div
          className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 text-xs leading-5 break-words">{unpricedMessage}</p>
        </div>
      ) : null}
      <div className="grid gap-2">
        {rows.map(([label, value, copyable]) => (
          <div key={label} className="grid gap-1 rounded-md border px-3 py-2">
            <span className="text-muted-foreground text-xs">{label}</span>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm">{value || <EmptyValue />}</span>
              {copyable && typeof value === 'string' && value ? (
                <Button type="button" variant="text" size="icon-xs" onClick={() => copy(value)}>
                  <Copy className="size-3" aria-hidden="true" />
                  <span className="sr-only">{t('billingPage.common.copy')}</span>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-md border p-3">
        <h3 className="text-sm font-semibold">{t('billingPage.chargeDetail.priceSnapshot')}</h3>
        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t('billingPage.prices.columns.input')}</span>
            <span className="tabular-nums">
              {formatModelPrice(record.priceSnapshot.inputPricePerMillion)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t('billingPage.prices.columns.output')}</span>
            <span className="tabular-nums">
              {formatModelPrice(record.priceSnapshot.outputPricePerMillion)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t('billingPage.prices.columns.cacheRead')}
            </span>
            <span className="tabular-nums">
              {formatModelPrice(record.priceSnapshot.cacheReadPricePerMillion)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t('billingPage.prices.columns.cacheWrite')}
            </span>
            <CacheWritePriceValue
              value={record.priceSnapshot.cacheWritePricePerMillion}
              t={t}
              className="max-w-[60%] justify-end text-right"
            />
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t('billingPage.prices.columns.request')}</span>
            <span className="tabular-nums">
              {formatModelPrice(record.priceSnapshot.requestPrice)}
            </span>
          </div>
        </div>
      </div>
      {record.priceSnapshot.tokenBuckets ? (
        <div className="rounded-md border p-3">
          <h3 className="text-sm font-semibold">{t('billingPage.chargeDetail.tokenBuckets')}</h3>
          <div className="mt-3 grid gap-2 text-sm">
            {(
              [
                ['uncachedInput', 'uncachedInput'],
                ['cacheRead', 'cacheRead'],
                ['cacheWrite', 'cacheWrite'],
                ['output', 'output'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {t(`billingPage.chargeDetail.buckets.${label}`)}
                </span>
                <span className="tabular-nums">
                  {formatNumber(record.priceSnapshot.tokenBuckets?.[key] ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {record.requestSummary ? (
        <div className="rounded-md border p-3">
          <h3 className="text-sm font-semibold">{t('billingPage.chargeDetail.requestSummary')}</h3>
          <p className="text-muted-foreground mt-2 text-sm leading-6">{record.requestSummary}</p>
        </div>
      ) : null}
    </DrawerScaffoldBody>
  )
}

function BalanceDetailSheet({ record, users }: { record: BalanceRecord; users: UserResource[] }) {
  const { t } = useTranslation()
  const amount = record.type === 'deduct' ? -Math.abs(record.amount) : Math.abs(record.amount)
  const rows: Array<[string, ReactNode]> = [
    [t('billingPage.balanceDetail.createdAt'), formatDateTime(record.createdAt, emptyValueText)],
    [
      t('billingPage.balanceDetail.user'),
      formatUserReference(record.username, record.userId, users, emptyValueText),
    ],
    [
      t('billingPage.balanceDetail.type'),
      record.type === 'recharge'
        ? t('billingPage.balance.types.recharge')
        : t('billingPage.balance.types.deduct'),
    ],
    [t('billingPage.balanceDetail.amount'), formatSignedDetailedCreditAmount(amount)],
    [
      t('billingPage.balanceDetail.balanceBefore'),
      formatDetailedCreditAmount(record.balanceBefore),
    ],
    [t('billingPage.balanceDetail.balanceAfter'), formatDetailedCreditAmount(record.balanceAfter)],
    [t('billingPage.balanceDetail.operator'), record.operator || <EmptyValue />],
    [t('billingPage.balanceDetail.note'), record.note || <EmptyValue />],
  ]

  return (
    <DrawerScaffoldBody className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 rounded-md border px-3 py-2">
          <span className="text-muted-foreground text-xs">{label}</span>
          <span className="min-w-0 text-sm break-words">{value}</span>
        </div>
      ))}
    </DrawerScaffoldBody>
  )
}

function createModelPriceCandidateValue(provider: string, model: string) {
  return createBillingModelPriceCandidateId(provider, model)
}

function createCurrentModelPriceCandidate(
  input: Pick<ModelPriceInput, 'provider' | 'model'>,
): BillingModelPriceCandidate | null {
  const provider = input.provider.trim()
  const model = input.model.trim()
  if (!provider || !model) return null

  return {
    id: createBillingModelPriceCandidateId(provider, model),
    provider,
    model,
    label: model,
    description: model,
    ownedBy: null,
    type: null,
    scopes: [],
  }
}

function ModelPriceSheet({
  mode,
  candidates,
  candidatesLoading,
  candidatesFetching,
  candidatesError,
  candidatesIssue,
  schemaVersion,
  tierSource,
  mutating,
  onCancel,
  onRetryCandidates,
  onSubmit,
  onSubmitted,
}: {
  mode: { type: 'create' } | { type: 'edit'; resource: ModelPrice }
  candidates: BillingModelPriceCandidate[]
  candidatesLoading: boolean
  candidatesFetching: boolean
  candidatesError: string | null
  candidatesIssue: string | null
  schemaVersion: number | null
  tierSource: BillingServiceTierSource | null
  mutating: boolean
  onCancel: () => void
  onRetryCandidates: () => void
  onSubmit: (inputs: ModelPriceInput[]) => Promise<void>
  onSubmitted?: () => void
}) {
  const { t } = useTranslation()
  const resource = mode.type === 'edit' ? mode.resource : null
  const supportsRuleScopes = (schemaVersion ?? 0) >= 2
  const [input, setInput] = useState<ModelPriceDraft>(() => createModelPriceDraft(resource))
  const [contextPreset, setContextPreset] = useState<'base' | 'over272K' | 'custom'>(() =>
    resource?.minInputTokens === 272001
      ? 'over272K'
      : (resource?.minInputTokens ?? 0) === 0
        ? 'base'
        : 'custom',
  )
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<Set<string>>(
    () =>
      new Set(resource ? [createModelPriceCandidateValue(resource.provider, resource.model)] : []),
  )
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ModelPriceInput | 'provider' | 'model', string>>
  >({})
  const [modelSearch, setModelSearch] = useState('')
  const currentCandidate = useMemo(() => createCurrentModelPriceCandidate(input), [input])
  const candidateOptions = useMemo(() => {
    const options = [...candidates]
    if (
      currentCandidate &&
      !options.some(
        (candidate) =>
          candidate.provider === currentCandidate.provider &&
          candidate.model === currentCandidate.model,
      )
    ) {
      options.unshift(currentCandidate)
    }

    return options
  }, [candidates, currentCandidate])
  const selectedCandidate =
    candidateOptions.find(
      (candidate) =>
        candidate.provider === input.provider.trim() && candidate.model === input.model.trim(),
    ) ?? currentCandidate
  const selectedCandidates = useMemo(() => {
    if (mode.type === 'edit') return selectedCandidate ? [selectedCandidate] : []

    return candidateOptions.filter((candidate) =>
      selectedCandidateKeys.has(
        createModelPriceCandidateValue(candidate.provider, candidate.model),
      ),
    )
  }, [candidateOptions, mode.type, selectedCandidate, selectedCandidateKeys])
  const hasSelectedTargets =
    mode.type === 'create' ? selectedCandidates.length > 0 : Boolean(selectedCandidate)
  const representativeCandidate =
    mode.type === 'create' ? (selectedCandidates[0] ?? null) : selectedCandidate
  const filteredCandidates = useMemo(() => {
    const normalizedSearch = modelSearch.trim().toLowerCase()
    if (!normalizedSearch) return candidateOptions

    return candidateOptions.filter((candidate) =>
      [
        candidate.provider,
        candidate.model,
        candidate.label,
        candidate.description,
        candidate.ownedBy ?? '',
        candidate.type ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [candidateOptions, modelSearch])

  useEffect(() => {
    setInput(createModelPriceDraft(resource))
    setContextPreset(
      resource?.minInputTokens === 272001
        ? 'over272K'
        : (resource?.minInputTokens ?? 0) === 0
          ? 'base'
          : 'custom',
    )
    setSelectedCandidateKeys(
      new Set(resource ? [createModelPriceCandidateValue(resource.provider, resource.model)] : []),
    )
    setError(null)
    setFieldErrors({})
    setModelSearch('')
  }, [resource])

  const setNumber = (key: ModelPriceNumberField, value: string) => {
    setInput((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextFieldErrors: typeof fieldErrors = {}

    if (
      mode.type === 'create'
        ? selectedCandidates.length === 0
        : !input.provider.trim() || !input.model.trim()
    ) {
      nextFieldErrors.model = t('billingPage.prices.validation.modelRequired')
    }
    const parsedPrices = {} as Record<ModelPriceNumberField, number>
    modelPriceNumberFields.forEach((key) => {
      const value = parsePriceValue(input[key])
      if (value === null || (key === 'minInputTokens' && !Number.isSafeInteger(value))) {
        nextFieldErrors[key] =
          key === 'minInputTokens'
            ? t('billingPage.prices.validation.minInputTokensInvalid')
            : t('billingPage.prices.validation.priceInvalid')
      } else {
        parsedPrices[key] = value
      }
    })

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setError(null)
      return
    }

    setFieldErrors({})
    setError(null)
    try {
      const { minInputTokens, ...priceValues } = parsedPrices
      const baseInput = {
        ...priceValues,
        ...(supportsRuleScopes
          ? {
              serviceTier: input.serviceTier.trim() || '*',
              minInputTokens,
            }
          : {}),
        enabled: input.enabled,
        note: input.note?.trim() || undefined,
      }
      const inputs =
        mode.type === 'create'
          ? selectedCandidates.map((candidate) => ({
              ...baseInput,
              provider: candidate.provider,
              model: candidate.model,
            }))
          : [
              {
                ...baseInput,
                provider: input.provider.trim(),
                model: input.model.trim(),
              },
            ]

      await onSubmit(inputs)

      if (mode.type === 'create') {
        setSelectedCandidateKeys(new Set())
        setModelSearch('')
      }
      onSubmitted?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : t('billingPage.toast.actionFailed'))
    }
  }

  const priceFields = [
    ['inputPricePerMillion', 'input'],
    ['outputPricePerMillion', 'output'],
    ['cacheReadPricePerMillion', 'cacheRead'],
    ['cacheWritePricePerMillion', 'cacheWrite'],
    ['requestPrice', 'request'],
  ] as const

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <CompactDrawerFormBody>
        {mode.type === 'create' ? (
          <div className="border-info/30 bg-info/10 text-info rounded-md border px-3 py-2 text-xs leading-5">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 text-pretty">{t('billingPage.prices.form.batchHint')}</span>
            </div>
          </div>
        ) : null}
        <section className="grid gap-2">
          <CompactField label={t('billingPage.prices.form.modelSelect')} error={fieldErrors.model}>
            <div className="grid gap-2">
              <div className="relative">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  value={modelSearch}
                  className="pl-9"
                  placeholder={t('billingPage.prices.form.modelSearchPlaceholder')}
                  disabled={mutating || (candidatesLoading && candidateOptions.length === 0)}
                  onChange={(event) => setModelSearch(event.target.value)}
                />
              </div>
              <div className="bg-muted/20 rounded-md border p-1.5">
                <div
                  className="grid max-h-72 gap-1 overflow-y-auto pr-1"
                  role="listbox"
                  aria-label={t('billingPage.prices.form.modelSelect')}
                >
                  {filteredCandidates.length > 0 ? (
                    filteredCandidates.map((candidate) => {
                      const candidateKey = createModelPriceCandidateValue(
                        candidate.provider,
                        candidate.model,
                      )
                      const selected =
                        mode.type === 'create'
                          ? selectedCandidateKeys.has(candidateKey)
                          : candidate.provider === input.provider.trim() &&
                            candidate.model === input.model.trim()

                      return (
                        <button
                          key={candidateKey}
                          type="button"
                          role="option"
                          aria-label={`${candidate.label}, ${candidate.model}, ${candidate.provider}`}
                          aria-selected={selected}
                          disabled={mutating}
                          className={cn(
                            'hover:bg-accent focus-visible:ring-ring/50 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                            selected
                              ? 'border-primary/45 bg-primary/10'
                              : 'bg-card border-transparent',
                          )}
                          onClick={() => {
                            if (mode.type === 'create') {
                              setSelectedCandidateKeys((current) => {
                                const next = new Set(current)
                                if (next.has(candidateKey)) {
                                  next.delete(candidateKey)
                                } else {
                                  next.add(candidateKey)
                                }
                                return next
                              })
                            } else {
                              setInput((current) => ({
                                ...current,
                                provider: candidate.provider,
                                model: candidate.model,
                              }))
                              setSelectedCandidateKeys(new Set([candidateKey]))
                            }
                            setFieldErrors((current) => ({
                              ...current,
                              provider: undefined,
                              model: undefined,
                            }))
                          }}
                        >
                          <ProviderLogo providerId={candidate.provider} size="sm" />
                          <span className="grid min-w-0 gap-0.5">
                            <span className="min-w-0 truncate font-medium">{candidate.label}</span>
                            <span className="text-muted-foreground grid min-w-0 gap-1 text-xs leading-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <span className="min-w-0 truncate">{candidate.model}</span>
                              <span className="min-w-0 truncate sm:text-right">
                                {candidate.provider}
                              </span>
                            </span>
                          </span>
                          {selected ? (
                            <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
                              <Check className="size-3.5" aria-hidden="true" />
                            </span>
                          ) : (
                            <span
                              className="border-muted-foreground/30 size-5 shrink-0 rounded-full border"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      )
                    })
                  ) : (
                    <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                      {modelSearch.trim()
                        ? t('billingPage.prices.form.modelSearchEmpty')
                        : t('billingPage.prices.form.modelCandidateEmpty')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CompactField>
          {candidatesLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-9 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </div>
          ) : null}
          {candidatesError ? (
            <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-3">
              <p className="text-destructive text-sm">{candidatesError}</p>
              <Button
                type="button"
                variant="outline"
                size="md"
                className="mt-3"
                disabled={mutating || candidatesFetching}
                onClick={onRetryCandidates}
              >
                {candidatesFetching ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                {t('billingPage.prices.form.reloadModels')}
              </Button>
            </div>
          ) : candidatesIssue ? (
            <div className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-3 py-2 text-xs leading-5">
              {candidatesIssue}
            </div>
          ) : null}
        </section>
        <section
          aria-live="polite"
          className={cn(
            'grid gap-3 rounded-md border px-3 py-3 text-sm',
            hasSelectedTargets ? 'border-primary/30 bg-primary/10' : 'bg-muted/25 border-dashed',
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border',
                hasSelectedTargets
                  ? 'border-primary/30 bg-primary/12 text-primary'
                  : 'bg-background text-muted-foreground',
              )}
            >
              {representativeCandidate ? (
                <ProviderLogo providerId={representativeCandidate.provider} size="sm" />
              ) : (
                <PackageCheck className="size-4" aria-hidden="true" />
              )}
            </div>
            <div className="grid min-w-0 gap-1">
              <span className="text-muted-foreground text-xs font-medium">
                {t('billingPage.prices.form.pricingTarget')}
              </span>
              {mode.type === 'create' && selectedCandidates.length > 0 ? (
                <>
                  <span className="font-semibold">
                    {t('billingPage.prices.form.selectedModelsCount', {
                      count: selectedCandidates.length,
                    })}
                  </span>
                  <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
                    {selectedCandidates.map((candidate) => (
                      <span
                        key={createModelPriceCandidateValue(candidate.provider, candidate.model)}
                        className="bg-background text-muted-foreground inline-flex max-w-full items-center gap-1 rounded border px-2 py-1 text-xs"
                      >
                        <ProviderLogo providerId={candidate.provider} size="xs" />
                        <span className="min-w-0 truncate">{candidate.model}</span>
                      </span>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="text"
                    size="md"
                    className="w-fit px-0"
                    disabled={mutating}
                    onClick={() => setSelectedCandidateKeys(new Set())}
                  >
                    {t('billingPage.prices.form.clearSelection')}
                  </Button>
                </>
              ) : selectedCandidate ? (
                <>
                  <span className="min-w-0 truncate font-semibold">{selectedCandidate.label}</span>
                  <div className="text-muted-foreground flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs leading-5">
                    <span className="min-w-0 truncate">
                      {t('billingPage.prices.form.provider')} {selectedCandidate.provider}
                    </span>
                    <span className="min-w-0 truncate">
                      {t('billingPage.prices.form.model')} {selectedCandidate.model}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {t('billingPage.prices.form.selectedModelPlaceholder')}
                </span>
              )}
            </div>
          </div>
        </section>
        {supportsRuleScopes ? (
          <section className="grid gap-3 rounded-md border px-3 py-3">
            <div>
              <h3 className="text-sm font-semibold">{t('billingPage.prices.form.ruleScope')}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {t('billingPage.prices.form.ruleScopeHint')}
              </p>
            </div>
            <div className="bg-muted/30 grid gap-1 rounded-md px-3 py-2 text-xs leading-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t('billingPage.prices.form.globalTierPolicy')}
                </span>
                <span className="font-medium">
                  {t(`billingPage.settings.${tierSource ?? 'request'}`)}
                </span>
              </div>
              <p className="text-muted-foreground">
                {t('billingPage.prices.form.matchingChain', {
                  source: t(`billingPage.settings.${tierSource ?? 'request'}`),
                })}
              </p>
            </div>
            <div className={formGridClassName}>
              <CompactField
                label={t('billingPage.prices.form.serviceTier')}
                error={fieldErrors.serviceTier}
              >
                <Select
                  value={input.serviceTier || '*'}
                  onValueChange={(value) =>
                    setInput((current) => ({ ...current, serviceTier: value }))
                  }
                  disabled={mutating}
                >
                  <SelectTrigger aria-label={t('billingPage.prices.form.serviceTier')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="*">{t('billingPage.prices.tiers.wildcard')}</SelectItem>
                    <SelectItem value="standard">
                      {t('billingPage.prices.tiers.standard')}
                    </SelectItem>
                    <SelectItem value="flex">{t('billingPage.prices.tiers.flex')}</SelectItem>
                    <SelectItem value="priority">
                      {t('billingPage.prices.tiers.priority')}
                    </SelectItem>
                    {!['*', 'standard', 'flex', 'priority'].includes(input.serviceTier) ? (
                      <SelectItem value={input.serviceTier}>{input.serviceTier}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </CompactField>
              <CompactField label={t('billingPage.prices.form.contextPreset')}>
                <Select
                  value={contextPreset}
                  disabled={mutating}
                  onValueChange={(value) => {
                    const preset = value as 'base' | 'over272K' | 'custom'
                    setContextPreset(preset)
                    if (preset === 'base') setNumber('minInputTokens', '0')
                    if (preset === 'over272K') setNumber('minInputTokens', '272001')
                  }}
                >
                  <SelectTrigger aria-label={t('billingPage.prices.form.contextPreset')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">
                      {t('billingPage.prices.scope.baseContext')}
                    </SelectItem>
                    <SelectItem value="over272K">
                      {t('billingPage.prices.scope.over272K')}
                    </SelectItem>
                    <SelectItem value="custom">{t('billingPage.prices.scope.custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </CompactField>
            </div>
            {contextPreset === 'custom' ? (
              <CompactField
                label={t('billingPage.prices.form.minInputTokens')}
                error={fieldErrors.minInputTokens}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={input.minInputTokens}
                  aria-label={t('billingPage.prices.form.minInputTokens')}
                  aria-invalid={Boolean(fieldErrors.minInputTokens)}
                  disabled={mutating}
                  onChange={(event) => setNumber('minInputTokens', event.target.value)}
                />
              </CompactField>
            ) : null}
            <p className="text-muted-foreground text-xs leading-5">
              {t('billingPage.prices.form.scopeSummary', {
                tier: formatServiceTier(input.serviceTier, t),
                band: formatContextBand(Number(input.minInputTokens) || 0, t),
              })}
            </p>
          </section>
        ) : (
          <div className="border-warning/30 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs leading-5">
            {t('billingPage.prices.form.legacyScopeHint')}
          </div>
        )}
        <section className="grid gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('billingPage.prices.form.pricing')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('billingPage.prices.form.pricingHint')}
            </p>
          </div>
          <div className={formGridClassName}>
            {priceFields.map(([key, label]) => (
              <CompactField
                key={key}
                label={t(`billingPage.prices.form.${label}`)}
                error={fieldErrors[key]}
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.000001"
                  value={input[key]}
                  aria-label={t(`billingPage.prices.form.${label}`)}
                  aria-invalid={Boolean(fieldErrors[key])}
                  disabled={mutating}
                  onChange={(event) => setNumber(key, event.target.value)}
                />
              </CompactField>
            ))}
          </div>
        </section>
        <section className="grid gap-3 rounded-md border px-3 py-3">
          <div>
            <h3 className="text-sm font-semibold">{t('billingPage.prices.form.state')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('billingPage.prices.form.stateHint')}
            </p>
          </div>
          <CompactField label={t('billingPage.prices.form.enabled')}>
            <Select
              value={input.enabled ? 'enabled' : 'disabled'}
              onValueChange={(value) =>
                setInput((current) => ({ ...current, enabled: value === 'enabled' }))
              }
              disabled={mutating}
            >
              <SelectTrigger aria-label={t('billingPage.prices.form.enabled')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">{t('billingPage.common.enabled')}</SelectItem>
                <SelectItem value="disabled">{t('billingPage.common.disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </CompactField>
          <CompactField label={t('billingPage.prices.form.note')}>
            <Textarea
              value={input.note ?? ''}
              className="min-h-20"
              aria-label={t('billingPage.prices.form.note')}
              disabled={mutating}
              onChange={(event) =>
                setInput((current) => ({ ...current, note: event.target.value }))
              }
            />
          </CompactField>
        </section>
        {error ? <ErrorNotice message={error} fallback={error} /> : null}
      </CompactDrawerFormBody>
      <DrawerScaffoldFooter>
        <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={mutating || (mode.type === 'create' && selectedCandidates.length === 0)}
        >
          {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode.type === 'create'
            ? selectedCandidates.length > 0
              ? t('billingPage.prices.actions.createSelected', {
                  count: selectedCandidates.length,
                })
              : t('billingPage.prices.actions.selectModels')
            : t('billingPage.common.save')}
        </Button>
      </DrawerScaffoldFooter>
    </form>
  )
}

export function BillingWorkbenchPage() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<BillingFilters>(() => createDefaultBillingFilters())
  const [textFilters, setTextFilters] = useState(() => createDefaultBillingTextFilters())
  const [datePreset, setDatePreset] = useState<DateRangePreset>('7d')
  const [activeTab, setActiveTab] = useState<BillingTab>('overview')
  const [chargePagination, setChargePagination] = usePersistentPagination(
    uiPreferenceKeys.billingChargePageSize,
    defaultBillingPagination,
    billingPageSizes,
  )
  const [balancePagination, setBalancePagination] = usePersistentPagination(
    uiPreferenceKeys.billingBalancePageSize,
    defaultBillingPagination,
    billingPageSizes,
  )
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null)
  const [modelPriceImportApplying, setModelPriceImportApplying] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const previousReportTimezoneRef = useRef<string | null>(null)
  const workbench = useBillingWorkbench(activeTab, filters, chargePagination, balancePagination)
  const modelPriceCandidateIssues: string[] = []
  if (workbench.modelPriceCandidatesIssue) {
    modelPriceCandidateIssues.push(workbench.modelPriceCandidatesIssue)
  }
  if (workbench.modelPriceCandidatesMissingProviderMetadataCount > 0) {
    modelPriceCandidateIssues.push(
      t('billingPage.prices.form.providerMetadataMissing', {
        count: workbench.modelPriceCandidatesMissingProviderMetadataCount,
      }),
    )
  }
  const modelPriceCandidatesIssue = modelPriceCandidateIssues.join('\n') || null
  const activeFetching =
    workbench.billingSettingsFetching ||
    (activeTab === 'overview'
      ? workbench.overviewFetching
      : activeTab === 'charges'
        ? workbench.chargesFetching
        : activeTab === 'balanceRecords'
          ? workbench.balanceRecordsFetching
          : workbench.modelPricesFetching ||
            workbench.modelPriceCandidatesFetching ||
            workbench.billingTierDiagnosticsFetching)

  useEffect(() => {
    const timezone = workbench.reportTimezone
    if (!timezone) return

    const previousTimezone = previousReportTimezoneRef.current
    previousReportTimezoneRef.current = timezone
    setFilters((current) => alignBillingFiltersToReportTimezone(current, datePreset, timezone))

    if (previousTimezone && previousTimezone !== timezone) {
      toast.info(t('billingPage.filters.reportTimezoneChanged', { timezone }))
    }
    if (previousTimezone !== timezone) {
      setChargePagination((current) => ({ ...current, offset: 0 }))
      setBalancePagination((current) => ({ ...current, offset: 0 }))
    }
  }, [datePreset, t, workbench.reportTimezone])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (
        filters.user === textFilters.user &&
        filters.model === textFilters.model &&
        filters.provider === textFilters.provider
      ) {
        return
      }

      setFilters((current) => ({
        ...current,
        user: textFilters.user,
        model: textFilters.model,
        provider: textFilters.provider,
      }))
      setChargePagination((current) => ({ ...current, offset: 0 }))
      setBalancePagination((current) => ({ ...current, offset: 0 }))
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [
    filters.model,
    filters.provider,
    filters.user,
    textFilters.model,
    textFilters.provider,
    textFilters.user,
  ])

  if (workbench.checking || (workbench.connected && !workbench.ready)) {
    return <BillingOverviewLoadingState />
  }

  if (!workbench.connected) return <BillingDisconnectedState />

  const updateFilters = (patch: Partial<BillingFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setChargePagination((current) => ({ ...current, offset: 0 }))
    setBalancePagination((current) => ({ ...current, offset: 0 }))
  }

  const handlePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      updateFilters(createDatePresetRange(preset, filters.timezone))
    }
  }

  const refreshCurrentView = () => {
    if (activeTab === 'modelPrices') {
      void Promise.all([
        workbench.refreshModelPrices(),
        workbench.refreshBillingSettings(),
        workbench.refreshModelPriceCandidates(),
        workbench.refreshBillingTierDiagnostics(),
      ])
      return
    }

    const previousTimezone = workbench.reportTimezone
    void workbench.refreshBillingSettings().then((result) => {
      if (!previousTimezone || result.isError || result.data?.reportTimezone !== previousTimezone) {
        return
      }

      if (activeTab === 'overview') void workbench.refreshOverview()
      if (activeTab === 'charges') void workbench.refreshCharges()
      if (activeTab === 'balanceRecords') void workbench.refreshBalanceRecords()
    })
  }

  const dateFiltersDisabled =
    workbench.billingSettingsLoading ||
    Boolean(workbench.billingSettingsError) ||
    !workbench.reportTimezone
  const reportTimezoneContext = workbench.reportTimezone
    ? t('billingPage.filters.reportTimezoneMenuNote', {
        timezone: workbench.reportTimezone,
      })
    : null

  const closeSheet = () => {
    if (sheetMode?.type === 'model-price-import' && modelPriceImportApplying) return
    setSheetMode(null)
  }
  const showMutationError = (error: unknown) => {
    toast.error(error instanceof Error ? error.message : t('billingPage.toast.actionFailed'))
  }

  return (
    <section className="grid gap-5">
      <PageHeader
        className="md:p-6"
        title={t('billingPage.header.title')}
        description={t('billingPage.header.description')}
        actions={
          <Button variant="outline" disabled={activeFetching} onClick={refreshCurrentView}>
            <RefreshCw
              className={activeFetching ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden="true"
            />
            {t('billingPage.actions.refresh')}
          </Button>
        }
      />

      <Tabs
        value={activeTab}
        className="grid gap-5"
        onValueChange={(value) => setActiveTab(value as BillingTab)}
      >
        <TabsList aria-label={t('billingPage.tabs.label')}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-w-32">
              {t(`billingPage.tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {activeTab !== 'modelPrices' ? (
          <div className="bg-card rounded-lg border p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[160px_180px_180px_minmax(140px,1fr)_minmax(140px,1fr)_minmax(180px,1fr)]">
              <div className="min-w-0">
                <Select
                  value={datePreset}
                  disabled={dateFiltersDisabled}
                  onValueChange={(value) => handlePresetChange(value as DateRangePreset)}
                >
                  <SelectTrigger
                    aria-describedby={
                      reportTimezoneContext ? 'billing-report-timezone-context' : undefined
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">{t('billingPage.filters.today')}</SelectItem>
                    <SelectItem value="7d">{t('billingPage.filters.last7d')}</SelectItem>
                    <SelectItem value="30d">{t('billingPage.filters.last30d')}</SelectItem>
                    <SelectItem value="custom">{t('billingPage.filters.custom')}</SelectItem>
                    {reportTimezoneContext ? (
                      <div
                        aria-hidden="true"
                        className="text-muted-foreground mt-1 max-w-64 border-t px-2 pt-2 pb-1 text-xs leading-4 whitespace-normal"
                      >
                        {reportTimezoneContext}
                      </div>
                    ) : null}
                  </SelectContent>
                </Select>
                {reportTimezoneContext ? (
                  <span id="billing-report-timezone-context" className="sr-only">
                    {reportTimezoneContext}
                  </span>
                ) : null}
              </div>
              <Input
                type="date"
                value={filters.from}
                disabled={dateFiltersDisabled}
                onChange={(event) => {
                  setDatePreset('custom')
                  updateFilters({ from: event.target.value })
                }}
              />
              <Input
                type="date"
                value={filters.to}
                disabled={dateFiltersDisabled}
                onChange={(event) => {
                  setDatePreset('custom')
                  updateFilters({ to: event.target.value })
                }}
              />
              <Input
                value={textFilters.user}
                placeholder={t('billingPage.filters.user')}
                onChange={(event) =>
                  setTextFilters((current) => ({ ...current, user: event.target.value }))
                }
              />
              <Input
                value={textFilters.model}
                placeholder={t('billingPage.filters.model')}
                onChange={(event) =>
                  setTextFilters((current) => ({ ...current, model: event.target.value }))
                }
              />
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
                <Input
                  className="pl-9"
                  value={textFilters.provider}
                  placeholder={t('billingPage.filters.provider')}
                  onChange={(event) =>
                    setTextFilters((current) => ({ ...current, provider: event.target.value }))
                  }
                />
              </div>
            </div>
            {!workbench.billingSettingsLoading &&
            (workbench.billingSettingsError || !workbench.reportTimezone) ? (
              <div
                className="text-destructive mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
                role="alert"
              >
                <span>{t('billingPage.filters.reportTimezoneLoadError')}</span>
                <Button
                  type="button"
                  variant="text"
                  size="md"
                  className="text-destructive hover:text-destructive h-auto px-1 py-0 text-xs"
                  disabled={workbench.billingSettingsFetching}
                  onClick={() => void workbench.refreshBillingSettings()}
                >
                  <RefreshCw
                    className={
                      workbench.billingSettingsFetching ? 'size-3.5 animate-spin' : 'size-3.5'
                    }
                    aria-hidden="true"
                  />
                  {t('billingPage.filters.reportTimezoneRetry')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <TabsContent value="overview">
          {!workbench.billingSettingsError ? <OverviewTab workbench={workbench} /> : null}
        </TabsContent>
        <TabsContent value="charges">
          {!workbench.billingSettingsError ? (
            <ChargeRecordsTab
              workbench={workbench}
              pagination={chargePagination}
              onPaginationChange={setChargePagination}
              onView={(record) => setSheetMode({ type: 'charge-detail', record })}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="balanceRecords">
          {!workbench.billingSettingsError ? (
            <BalanceRecordsTab
              workbench={workbench}
              pagination={balancePagination}
              onPaginationChange={setBalancePagination}
              onView={(record) => setSheetMode({ type: 'balance-detail', record })}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="modelPrices">
          <ModelPricesTab
            workbench={workbench}
            onCreate={() => setSheetMode({ type: 'model-price-create' })}
            onImport={() => setSheetMode({ type: 'model-price-import', intent: 'import' })}
            onRefreshSynced={() =>
              setSheetMode({
                type: 'model-price-import',
                intent: 'refresh-synced',
                initialOverwriteMode: 'sync',
                initialTargetFilter: 'synced',
              })
            }
            onEdit={(resource) => setSheetMode({ type: 'model-price-edit', resource })}
            onToggle={(resource) => {
              void workbench
                .updateModelPrice({
                  resource,
                  input: toModelPriceInput(
                    resource,
                    !resource.enabled,
                    (workbench.modelPriceSchemaVersion ?? 0) >= 2,
                  ),
                })
                .then(() => toast.success(t('billingPage.toast.priceUpdated')))
                .catch(showMutationError)
            }}
            onDelete={(resource) => setPendingDelete({ type: 'model-price', resource })}
          />
        </TabsContent>
      </Tabs>

      <Sheet
        open={Boolean(sheetMode)}
        onOpenChange={(open) => {
          if (!open) closeSheet()
        }}
      >
        <DrawerScaffoldContent
          className={sheetMode?.type === 'model-price-import' ? 'sm:max-w-5xl' : 'sm:max-w-2xl'}
          showCloseButton={!modelPriceImportApplying}
          aria-busy={sheetMode?.type === 'model-price-import' && modelPriceImportApplying}
          onEscapeKeyDown={(event) => {
            if (modelPriceImportApplying) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (modelPriceImportApplying) event.preventDefault()
          }}
        >
          {sheetMode ? (
            <>
              <DrawerScaffoldHeader>
                <SheetTitle>
                  {sheetMode.type === 'charge-detail'
                    ? t('billingPage.chargeDetail.title')
                    : sheetMode.type === 'balance-detail'
                      ? t('billingPage.balanceDetail.title')
                      : sheetMode.type === 'model-price-create'
                        ? t('billingPage.prices.sheet.createTitle')
                        : sheetMode.type === 'model-price-import'
                          ? t(
                              sheetMode.intent === 'refresh-synced'
                                ? 'billingPage.prices.sheet.refreshSyncedTitle'
                                : 'billingPage.prices.sheet.importTitle',
                            )
                          : t('billingPage.prices.sheet.editTitle')}
                </SheetTitle>
                {sheetMode.type === 'model-price-create' ||
                sheetMode.type === 'model-price-edit' ||
                sheetMode.type === 'model-price-import' ? (
                  <SheetDescription>
                    {sheetMode.type === 'model-price-create'
                      ? t('billingPage.prices.sheet.createDescription')
                      : sheetMode.type === 'model-price-import'
                        ? t(
                            sheetMode.intent === 'refresh-synced'
                              ? 'billingPage.prices.sheet.refreshSyncedDescription'
                              : 'billingPage.prices.sheet.importDescription',
                          )
                        : t('billingPage.prices.sheet.editDescription')}
                  </SheetDescription>
                ) : (
                  <SheetDescription>
                    {sheetMode.type === 'charge-detail'
                      ? t('billingPage.chargeDetail.description')
                      : t('billingPage.balanceDetail.description')}
                  </SheetDescription>
                )}
              </DrawerScaffoldHeader>
              {sheetMode.type === 'charge-detail' ? (
                <ChargeDetailSheet record={sheetMode.record} users={workbench.users} />
              ) : null}
              {sheetMode.type === 'balance-detail' ? (
                <BalanceDetailSheet record={sheetMode.record} users={workbench.users} />
              ) : null}
              {sheetMode.type === 'model-price-import' ? (
                <ModelPriceImportSheet
                  candidates={workbench.modelPriceCandidates}
                  candidatesLoading={workbench.modelPriceCandidatesLoading}
                  candidatesFetching={workbench.modelPriceCandidatesFetching}
                  candidatesError={workbench.modelPriceCandidatesError}
                  candidatesIssue={modelPriceCandidatesIssue}
                  existingPrices={workbench.modelPrices}
                  schemaVersion={workbench.modelPriceSchemaVersion}
                  tierSource={workbench.billingSettings?.serviceTierSource ?? null}
                  entryIntent={sheetMode.intent}
                  serverEnabled={workbench.modelPriceImportServerEnabled}
                  preferenceScope={workbench.modelPriceImportPreferenceScope}
                  initialOverwriteMode={sheetMode.initialOverwriteMode}
                  initialTargetFilter={sheetMode.initialTargetFilter}
                  mutating={workbench.mutating}
                  onCancel={closeSheet}
                  onApplyingChange={setModelPriceImportApplying}
                  onRetryCandidates={() => {
                    void workbench.refreshModelPriceCandidates()
                  }}
                  onPreview={workbench.previewModelPriceImport}
                  onApplyServer={workbench.applyModelPriceImport}
                  onApplyCompatibility={async (
                    items: ModelPriceImportApplyItem[],
                    onProgress: (progress: ModelPriceImportProgress) => void,
                  ) => {
                    const operationId = `compatibility:${Date.now()}`
                    const rows: ModelPriceImportApplyResult['rows'] = []

                    for (const [index, item] of items.entries()) {
                      onProgress({
                        completed: index,
                        total: items.length,
                        currentModel: item.input.model,
                      })
                      try {
                        let resourceId: string | null = item.resource?.id ?? null
                        if (item.mode === 'create') {
                          resourceId = await workbench.createModelPrice(item.input)
                        } else if (item.resource) {
                          resourceId = await workbench.updateModelPrice({
                            resource: item.resource,
                            input: item.input,
                          })
                        } else {
                          throw new Error(
                            t('billingPage.prices.import.validation.existingRuleMissing'),
                          )
                        }

                        rows.push({
                          key: item.key,
                          provider: item.input.provider,
                          model: item.input.model,
                          action: item.action,
                          status:
                            item.action === 'create'
                              ? 'created'
                              : item.action === 'overwrite'
                                ? 'overwritten'
                                : 'updated',
                          resourceId,
                          errorCode: null,
                          errorMessage: null,
                        })
                      } catch (legacyError) {
                        rows.push({
                          key: item.key,
                          provider: item.input.provider,
                          model: item.input.model,
                          action: item.action,
                          status: 'failed',
                          resourceId: item.resource?.id ?? null,
                          errorCode: null,
                          errorMessage:
                            legacyError instanceof Error
                              ? legacyError.message
                              : t('billingPage.toast.actionFailed'),
                        })
                      }
                      onProgress({
                        completed: index + 1,
                        total: items.length,
                        currentModel: item.input.model,
                      })
                    }

                    await workbench.refreshModelPrices().catch(() => undefined)
                    const successful = rows.filter((row) => row.status !== 'failed')
                    const failed = rows.length - successful.length
                    return {
                      operationId,
                      previewId: 'compatibility',
                      status:
                        failed === 0 ? 'applied' : successful.length > 0 ? 'partial' : 'failed',
                      atomic: false,
                      appliedAt: new Date().toISOString(),
                      summary: {
                        total: rows.length,
                        creates: rows.filter((row) => row.status === 'created').length,
                        updatesSync: rows.filter((row) => row.status === 'updated').length,
                        overwrites: rows.filter((row) => row.status === 'overwritten').length,
                        skips: 0,
                        reviews: 0,
                        conflicts: 0,
                        failed,
                      },
                      rows,
                      raw: { mode: 'compatibility' },
                    }
                  }}
                />
              ) : null}
              {sheetMode.type === 'model-price-create' || sheetMode.type === 'model-price-edit' ? (
                <ModelPriceSheet
                  mode={
                    sheetMode.type === 'model-price-create'
                      ? { type: 'create' }
                      : { type: 'edit', resource: sheetMode.resource }
                  }
                  candidates={workbench.modelPriceCandidates}
                  candidatesLoading={workbench.modelPriceCandidatesLoading}
                  candidatesFetching={workbench.modelPriceCandidatesFetching}
                  candidatesError={workbench.modelPriceCandidatesError}
                  candidatesIssue={modelPriceCandidatesIssue}
                  schemaVersion={workbench.modelPriceSchemaVersion}
                  tierSource={workbench.billingSettings?.serviceTierSource ?? null}
                  mutating={workbench.mutating}
                  onCancel={closeSheet}
                  onRetryCandidates={() => {
                    void workbench.refreshModelPriceCandidates()
                  }}
                  onSubmit={async (inputs) => {
                    if (sheetMode.type === 'model-price-create') {
                      await workbench.createModelPrices(inputs)
                      toast.success(t('billingPage.toast.pricesCreated', { count: inputs.length }))
                    } else {
                      const [input] = inputs
                      if (!input) return
                      await workbench.updateModelPrice({ resource: sheetMode.resource, input })
                      toast.success(t('billingPage.toast.priceUpdated'))
                      closeSheet()
                    }
                  }}
                  onSubmitted={sheetMode.type === 'model-price-create' ? closeSheet : undefined}
                />
              ) : null}
            </>
          ) : null}
        </DrawerScaffoldContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billingPage.prices.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('billingPage.prices.delete.description', {
                model: pendingDelete ? formatModelPriceIdentity(pendingDelete.resource, t) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 text-white"
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                if (!pendingDelete) return

                void workbench
                  .deleteModelPrice(pendingDelete.resource)
                  .then(() => {
                    toast.success(t('billingPage.toast.deleted'))
                    setPendingDelete(null)
                  })
                  .catch(showMutationError)
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('billingPage.common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
