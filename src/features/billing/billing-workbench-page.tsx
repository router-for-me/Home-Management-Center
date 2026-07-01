import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  BarChart3,
  Check,
  Copy,
  Eye,
  Info,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
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
import { PageHeader } from '@/components/shared/page-header'
import { ProviderLogo } from '@/components/shared/provider-logo'
import {
  TableSurface,
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
import { Input } from '@/components/ui/input'
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
import { Textarea } from '@/components/ui/textarea'
import {
  type BillingTab,
  type DateRangePreset,
  billingPageSizes,
  createDatePresetRange,
  createDefaultBillingFilters,
  defaultBillingPagination,
  getNextOffset,
  getPreviousOffset,
} from '@/features/billing/billing-model'
import {
  type BillingModelPriceCandidate,
  useBillingWorkbench,
} from '@/features/billing/use-billing-workbench'
import type {
  BalanceRecord,
  BillingFilters,
  BillingPagination,
  ChargeRecord,
  ModelPrice,
  ModelPriceInput,
} from '@/lib/api/management/billing-types'
import type { UserResource } from '@/lib/api/management/users'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type SheetMode =
  | { type: 'charge-detail'; record: ChargeRecord }
  | { type: 'balance-detail'; record: BalanceRecord }
  | { type: 'model-price-create' }
  | { type: 'model-price-edit'; resource: ModelPrice }

type PendingDelete = { type: 'model-price'; resource: ModelPrice }

const tabs: BillingTab[] = ['overview', 'charges', 'balanceRecords', 'modelPrices']
const modelPriceNumberFields = [
  'inputPricePerMillion',
  'outputPricePerMillion',
  'cacheReadPricePerMillion',
  'cacheWritePricePerMillion',
  'requestPrice',
] as const

type ModelPriceNumberField = (typeof modelPriceNumberFields)[number]
type ModelPriceDraft = Omit<ModelPriceInput, ModelPriceNumberField> & {
  [key in ModelPriceNumberField]: string
}

function toProviderLogoId(provider: string) {
  const normalized = provider.trim().toLowerCase()
  if (normalized === 'openai' || normalized === 'openai-compatibility') {
    return 'openaiCompatibility'
  }
  if (normalized === 'anthropic') return 'claude'
  if (normalized === 'google') return 'gemini'
  return provider
}

function toModelPriceInput(resource: ModelPrice, enabled = resource.enabled): ModelPriceInput {
  return {
    provider: resource.provider,
    model: resource.model,
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

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)
}

function formatSignedAmount(value: number) {
  const absolute = formatMoney(Math.abs(value))
  return value >= 0 ? `+${absolute}` : `-${absolute}`
}

function formatUserIdentity(user: UserResource) {
  return user.numericId !== null ? `${user.username} (#${user.numericId})` : user.username
}

function formatUserReference(
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
      <span className="text-muted-foreground text-sm">
        {t('billingPage.pagination.range', { start, end, total })}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(pagination.limit)}
          onValueChange={(value) => onChange({ limit: Number(value), offset: 0 })}
        >
          <SelectTrigger className="w-28" size="sm">
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
          size="sm"
          disabled={disabled || pagination.offset === 0}
          onClick={() => onChange({ ...pagination, offset: getPreviousOffset(pagination) })}
        >
          {t('billingPage.pagination.previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
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
  const filters = createDefaultBillingFilters()
  return {
    user: filters.user,
    model: filters.model,
    provider: filters.provider,
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
            value: formatMoney(overview.totalChargeAmount),
            detail: t('billingPage.overview.metrics.selectedRange'),
            valueClassName: 'text-destructive',
          },
          {
            label: t('billingPage.overview.metrics.totalRechargeAmount'),
            value: formatMoney(overview.totalRechargeAmount),
            detail: t('billingPage.overview.metrics.selectedRange'),
            valueClassName: 'text-success',
          },
          {
            label: t('billingPage.overview.metrics.totalDeductAmount'),
            value: formatMoney(overview.totalDeductAmount),
            detail: t('billingPage.overview.metrics.selectedRange'),
            valueClassName: 'text-warning-foreground dark:text-warning',
          },
          {
            label: t('billingPage.overview.metrics.totalBalance'),
            value: formatMoney(overview.totalBalance),
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
                    {formatMoney(point.chargeAmount)}
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
                          <ProviderLogo
                            providerId={toProviderLogoId(item.id || item.label)}
                            size="sm"
                          />
                        ) : null}
                        <span className="min-w-0 truncate">{item.label}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatMoney(item.amount)}</span>
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
      <TableSurfaceHeader
        title={t('billingPage.charges.title')}
        description={t('billingPage.charges.description')}
      />
      {workbench.charges.length === 0 ? (
        <TableEmptyState kind="empty" title={t('billingPage.charges.empty')} />
      ) : (
        <Table className="min-w-[1160px]" containerClassName={containedTableContainerClassName}>
          <TableHeader className={stickyTableHeaderClassName}>
            <TableRow variant="static">
              <TableHead>{t('billingPage.charges.columns.time')}</TableHead>
              <TableHead>{t('billingPage.charges.columns.user')}</TableHead>
              <TableHead>{t('billingPage.charges.columns.key')}</TableHead>
              <TableHead>{t('billingPage.charges.columns.provider')}</TableHead>
              <TableHead>{t('billingPage.charges.columns.model')}</TableHead>
              <TableHead>{t('billingPage.charges.columns.request')}</TableHead>
              <TableHead>{t('billingPage.charges.columns.tokens')}</TableHead>
              <TableHead>{t('billingPage.charges.columns.amount')}</TableHead>
              <TableHead>{t('billingPage.charges.columns.balanceAfter')}</TableHead>
              <TableHead className="table-sticky-action-head w-32 text-right">
                {t('billingPage.common.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workbench.charges.map((record) => (
              <TableRow key={record.id} variant="resource">
                <TableCell>
                  {formatDateTime(record.createdAt, t('billingPage.common.na'))}
                </TableCell>
                <TableCell>{record.username || `#${record.userId ?? '-'}`}</TableCell>
                <TableCell className="font-mono text-xs">
                  {record.apiKeyMasked || record.apiKeyLabel || t('billingPage.common.na')}
                </TableCell>
                <TableCell>{record.provider || t('billingPage.common.na')}</TableCell>
                <TableCell className="max-w-[220px] truncate font-mono text-xs">
                  {record.model || t('billingPage.common.na')}
                </TableCell>
                <TableCell className="max-w-[180px] truncate font-mono text-xs">
                  {record.requestId}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t('billingPage.charges.tokenSummary', {
                    input: formatNumber(record.inputTokens),
                    output: formatNumber(record.outputTokens),
                    cache: formatNumber(record.cacheTokens),
                  })}
                </TableCell>
                <TableCell className="text-destructive font-medium tabular-nums">
                  {formatSignedAmount(-Math.abs(record.amount))}
                </TableCell>
                <TableCell className="tabular-nums">{formatMoney(record.balanceAfter)}</TableCell>
                <TableCell className="table-sticky-action-cell w-32 text-right transition-colors">
                  <Button variant="text" size="sm" onClick={() => onView(record)}>
                    <Eye className="size-4" aria-hidden="true" />
                    {t('billingPage.common.view')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
      <TableSurfaceHeader
        title={t('billingPage.balance.title')}
        description={t('billingPage.balance.description')}
      />
      {workbench.balanceRecords.length === 0 ? (
        <TableEmptyState kind="empty" title={t('billingPage.balance.empty')} />
      ) : (
        <Table className="min-w-[1120px]" containerClassName={containedTableContainerClassName}>
          <TableHeader className={stickyTableHeaderClassName}>
            <TableRow variant="static">
              <TableHead>{t('billingPage.balance.columns.time')}</TableHead>
              <TableHead>{t('billingPage.balance.columns.user')}</TableHead>
              <TableHead>{t('billingPage.balance.columns.type')}</TableHead>
              <TableHead>{t('billingPage.balance.columns.amount')}</TableHead>
              <TableHead>{t('billingPage.balance.columns.before')}</TableHead>
              <TableHead>{t('billingPage.balance.columns.after')}</TableHead>
              <TableHead>{t('billingPage.balance.columns.operator')}</TableHead>
              <TableHead>{t('billingPage.balance.columns.note')}</TableHead>
              <TableHead className="table-sticky-action-head w-32 text-right">
                {t('billingPage.common.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workbench.balanceRecords.map((record: BalanceRecord) => (
              <TableRow key={record.id} variant="resource">
                <TableCell>
                  {formatDateTime(record.createdAt, t('billingPage.common.na'))}
                </TableCell>
                <TableCell>
                  {formatUserReference(
                    record.username,
                    record.userId,
                    workbench.users,
                    t('billingPage.common.na'),
                  )}
                </TableCell>
                <TableCell>
                  {record.type === 'recharge'
                    ? t('billingPage.balance.types.recharge')
                    : t('billingPage.balance.types.deduct')}
                </TableCell>
                <TableCell
                  className={cn(
                    'font-medium tabular-nums',
                    record.type === 'deduct'
                      ? 'text-warning-foreground dark:text-warning'
                      : 'text-success',
                  )}
                >
                  {formatSignedAmount(
                    record.type === 'deduct' ? -Math.abs(record.amount) : Math.abs(record.amount),
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatMoney(record.balanceBefore)}</TableCell>
                <TableCell className="tabular-nums">{formatMoney(record.balanceAfter)}</TableCell>
                <TableCell>{record.operator || t('billingPage.common.na')}</TableCell>
                <TableCell className="max-w-[260px] truncate">
                  {record.note || t('billingPage.common.na')}
                </TableCell>
                <TableCell className="table-sticky-action-cell w-32 text-right transition-colors">
                  <div className="table-action-cell-content">
                    <Button
                      variant="text"
                      size="sm"
                      className="px-2"
                      onClick={() => onView(record)}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                      {t('billingPage.common.view')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableSurface>
  )
}

function ModelPricesTab({
  workbench,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
}: {
  workbench: ReturnType<typeof useBillingWorkbench>
  onCreate: () => void
  onEdit: (resource: ModelPrice) => void
  onToggle: (resource: ModelPrice) => void
  onDelete: (resource: ModelPrice) => void
}) {
  const { t } = useTranslation()
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
    <TableSurface>
      <TableSurfaceHeader
        title={t('billingPage.prices.title')}
        description={t('billingPage.prices.description')}
        actions={
          <Button onClick={onCreate}>
            <Plus className="size-4" aria-hidden="true" />
            {t('billingPage.prices.actions.create')}
          </Button>
        }
      />
      {workbench.modelPrices.length === 0 ? (
        <TableEmptyState kind="empty" title={t('billingPage.prices.empty')} />
      ) : (
        <Table className="min-w-[1180px]" containerClassName={containedTableContainerClassName}>
          <TableHeader className={stickyTableHeaderClassName}>
            <TableRow variant="static">
              <TableHead>{t('billingPage.prices.columns.provider')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.model')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.input')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.output')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.cacheRead')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.cacheWrite')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.request')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.source')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.state')}</TableHead>
              <TableHead>{t('billingPage.prices.columns.updatedAt')}</TableHead>
              <TableHead className="table-sticky-action-head w-[184px] text-right">
                {t('billingPage.common.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workbench.modelPrices.map((resource) => (
              <TableRow key={resource.id} variant="resource">
                <TableCell>{resource.provider}</TableCell>
                <TableCell className="max-w-[220px]">
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
                <TableCell className="tabular-nums">
                  {formatMoney(resource.inputPricePerMillion)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(resource.outputPricePerMillion)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(resource.cacheReadPricePerMillion)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(resource.cacheWritePricePerMillion)}
                </TableCell>
                <TableCell className="tabular-nums">{formatMoney(resource.requestPrice)}</TableCell>
                <TableCell>{t(`billingPage.prices.sources.${resource.source}`)}</TableCell>
                <TableCell>
                  <StateToggle
                    enabled={resource.enabled}
                    disabled={workbench.mutating}
                    label={t('billingPage.prices.actions.toggleState', {
                      model: resource.model || resource.provider,
                    })}
                    onToggle={() => onToggle(resource)}
                  />
                </TableCell>
                <TableCell>
                  {formatDateTime(resource.updatedAt, t('billingPage.common.na'))}
                </TableCell>
                <TableCell className="table-sticky-action-cell w-[184px] text-right transition-colors">
                  <div className="table-action-cell-content">
                    <Button
                      variant="text"
                      size="sm"
                      className="px-2"
                      onClick={() => onEdit(resource)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      {t('billingPage.common.edit')}
                    </Button>
                    <Button
                      variant="destructiveText"
                      size="sm"
                      className="px-2"
                      onClick={() => onDelete(resource)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t('billingPage.common.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableSurface>
  )
}

function ChargeDetailSheet({ record }: { record: ChargeRecord }) {
  const { t } = useTranslation()
  const copy = (value: string) => {
    void copyText(value).then(() => toast.success(t('billingPage.toast.copied')))
  }
  const rows = [
    [t('billingPage.chargeDetail.requestId'), record.requestId, true],
    [t('billingPage.chargeDetail.user'), record.username || `#${record.userId ?? '-'}`, false],
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
    [t('billingPage.chargeDetail.amount'), formatSignedAmount(-Math.abs(record.amount)), false],
    [t('billingPage.chargeDetail.balanceBefore'), formatMoney(record.balanceBefore), false],
    [t('billingPage.chargeDetail.balanceAfter'), formatMoney(record.balanceAfter), false],
    [
      t('billingPage.chargeDetail.createdAt'),
      formatDateTime(record.createdAt, t('billingPage.common.na')),
      false,
    ],
  ] as const

  return (
    <DrawerScaffoldBody className="grid gap-5">
      <div className="grid gap-2">
        {rows.map(([label, value, copyable]) => (
          <div key={label} className="grid gap-1 rounded-md border px-3 py-2">
            <span className="text-muted-foreground text-xs">{label}</span>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm">
                {value || t('billingPage.common.na')}
              </span>
              {copyable && value ? (
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
              {formatMoney(record.priceSnapshot.inputPricePerMillion)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t('billingPage.prices.columns.output')}</span>
            <span className="tabular-nums">
              {formatMoney(record.priceSnapshot.outputPricePerMillion)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t('billingPage.prices.columns.cacheRead')}
            </span>
            <span className="tabular-nums">
              {formatMoney(record.priceSnapshot.cacheReadPricePerMillion)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t('billingPage.prices.columns.cacheWrite')}
            </span>
            <span className="tabular-nums">
              {formatMoney(record.priceSnapshot.cacheWritePricePerMillion)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t('billingPage.prices.columns.request')}</span>
            <span className="tabular-nums">{formatMoney(record.priceSnapshot.requestPrice)}</span>
          </div>
        </div>
      </div>
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
  const rows = [
    [
      t('billingPage.balanceDetail.createdAt'),
      formatDateTime(record.createdAt, t('billingPage.common.na')),
    ],
    [
      t('billingPage.balanceDetail.user'),
      formatUserReference(record.username, record.userId, users, t('billingPage.common.na')),
    ],
    [
      t('billingPage.balanceDetail.type'),
      record.type === 'recharge'
        ? t('billingPage.balance.types.recharge')
        : t('billingPage.balance.types.deduct'),
    ],
    [t('billingPage.balanceDetail.amount'), formatSignedAmount(amount)],
    [t('billingPage.balanceDetail.balanceBefore'), formatMoney(record.balanceBefore)],
    [t('billingPage.balanceDetail.balanceAfter'), formatMoney(record.balanceAfter)],
    [t('billingPage.balanceDetail.operator'), record.operator || t('billingPage.common.na')],
    [t('billingPage.balanceDetail.note'), record.note || t('billingPage.common.na')],
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
  return JSON.stringify([provider, model])
}

function createCurrentModelPriceCandidate(
  input: Pick<ModelPriceInput, 'provider' | 'model'>,
): BillingModelPriceCandidate | null {
  const provider = input.provider.trim()
  const model = input.model.trim()
  if (!provider || !model) return null

  return {
    id: `${provider}:${model}`,
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
  mutating: boolean
  onCancel: () => void
  onRetryCandidates: () => void
  onSubmit: (inputs: ModelPriceInput[]) => Promise<void>
  onSubmitted?: () => void
}) {
  const { t } = useTranslation()
  const resource = mode.type === 'edit' ? mode.resource : null
  const [input, setInput] = useState<ModelPriceDraft>(() => createModelPriceDraft(resource))
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
      if (value === null) {
        nextFieldErrors[key] = t('billingPage.prices.validation.priceInvalid')
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
      const baseInput = {
        ...parsedPrices,
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
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
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
                          <ProviderLogo
                            providerId={toProviderLogoId(candidate.provider)}
                            size="sm"
                          />
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
                size="sm"
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
                <ProviderLogo
                  providerId={toProviderLogoId(representativeCandidate.provider)}
                  size="sm"
                />
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
                        <ProviderLogo providerId={toProviderLogoId(candidate.provider)} size="xs" />
                        <span className="min-w-0 truncate">{candidate.model}</span>
                      </span>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
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
        <section className="grid gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('billingPage.prices.form.pricing')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('billingPage.prices.form.pricingHint')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
  const [chargePagination, setChargePagination] =
    useState<BillingPagination>(defaultBillingPagination)
  const [balancePagination, setBalancePagination] =
    useState<BillingPagination>(defaultBillingPagination)
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const workbench = useBillingWorkbench(activeTab, filters, chargePagination, balancePagination)
  const activeFetching =
    activeTab === 'overview'
      ? workbench.overviewFetching
      : activeTab === 'charges'
        ? workbench.chargesFetching
        : activeTab === 'balanceRecords'
          ? workbench.balanceRecordsFetching
          : workbench.modelPricesFetching

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
      setChargePagination(defaultBillingPagination)
      setBalancePagination(defaultBillingPagination)
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
    setChargePagination(defaultBillingPagination)
    setBalancePagination(defaultBillingPagination)
  }

  const handlePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      updateFilters(createDatePresetRange(preset))
    }
  }

  const closeSheet = () => setSheetMode(null)
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
          <Button
            variant="outline"
            disabled={activeFetching}
            onClick={() => {
              if (activeTab === 'overview') void workbench.refreshOverview()
              if (activeTab === 'charges') void workbench.refreshCharges()
              if (activeTab === 'balanceRecords') void workbench.refreshBalanceRecords()
              if (activeTab === 'modelPrices') void workbench.refreshModelPrices()
            }}
          >
            <RefreshCw
              className={activeFetching ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden="true"
            />
            {t('billingPage.actions.refresh')}
          </Button>
        }
      />

      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[160px_180px_180px_minmax(140px,1fr)_minmax(140px,1fr)_minmax(180px,1fr)]">
          <Select
            value={datePreset}
            onValueChange={(value) => handlePresetChange(value as DateRangePreset)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t('billingPage.filters.today')}</SelectItem>
              <SelectItem value="7d">{t('billingPage.filters.last7d')}</SelectItem>
              <SelectItem value="30d">{t('billingPage.filters.last30d')}</SelectItem>
              <SelectItem value="custom">{t('billingPage.filters.custom')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filters.from}
            onChange={(event) => {
              setDatePreset('custom')
              updateFilters({ from: event.target.value })
            }}
          />
          <Input
            type="date"
            value={filters.to}
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
      </div>

      <div
        className="bg-card grid grid-cols-2 gap-2 rounded-lg border p-1 shadow-sm sm:flex sm:w-fit sm:max-w-full sm:overflow-x-auto"
        role="tablist"
        aria-label={t('billingPage.tabs.label')}
      >
        {tabs.map((tab) => (
          <Button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            variant={activeTab === tab ? 'default' : 'ghost'}
            className="min-h-10 w-full justify-center sm:w-auto sm:min-w-32"
            onClick={() => setActiveTab(tab)}
          >
            {t(`billingPage.tabs.${tab}`)}
          </Button>
        ))}
      </div>

      {activeTab === 'overview' ? <OverviewTab workbench={workbench} /> : null}
      {activeTab === 'charges' ? (
        <ChargeRecordsTab
          workbench={workbench}
          pagination={chargePagination}
          onPaginationChange={setChargePagination}
          onView={(record) => setSheetMode({ type: 'charge-detail', record })}
        />
      ) : null}
      {activeTab === 'balanceRecords' ? (
        <BalanceRecordsTab
          workbench={workbench}
          pagination={balancePagination}
          onPaginationChange={setBalancePagination}
          onView={(record) => setSheetMode({ type: 'balance-detail', record })}
        />
      ) : null}
      {activeTab === 'modelPrices' ? (
        <ModelPricesTab
          workbench={workbench}
          onCreate={() => setSheetMode({ type: 'model-price-create' })}
          onEdit={(resource) => setSheetMode({ type: 'model-price-edit', resource })}
          onToggle={(resource) => {
            void workbench
              .updateModelPrice({
                resource,
                input: toModelPriceInput(resource, !resource.enabled),
              })
              .then(() => toast.success(t('billingPage.toast.priceUpdated')))
              .catch(showMutationError)
          }}
          onDelete={(resource) => setPendingDelete({ type: 'model-price', resource })}
        />
      ) : null}

      <Sheet open={Boolean(sheetMode)} onOpenChange={(open) => !open && closeSheet()}>
        <DrawerScaffoldContent className="sm:max-w-2xl">
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
                        : t('billingPage.prices.sheet.editTitle')}
                </SheetTitle>
                {sheetMode.type === 'model-price-create' ||
                sheetMode.type === 'model-price-edit' ? null : (
                  <SheetDescription>
                    {sheetMode.type === 'charge-detail'
                      ? t('billingPage.chargeDetail.description')
                      : t('billingPage.balanceDetail.description')}
                  </SheetDescription>
                )}
              </DrawerScaffoldHeader>
              {sheetMode.type === 'charge-detail' ? (
                <ChargeDetailSheet record={sheetMode.record} />
              ) : null}
              {sheetMode.type === 'balance-detail' ? (
                <BalanceDetailSheet record={sheetMode.record} users={workbench.users} />
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
                  candidatesIssue={workbench.modelPriceCandidatesIssue}
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
                model: pendingDelete?.resource.model ?? '',
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
