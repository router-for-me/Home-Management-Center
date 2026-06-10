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
  Copy,
  Eye,
  Loader2,
  Minus,
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
  ProxyPoolInput,
  ProxyPoolItem,
} from '@/lib/api/management/billing-types'
import type { UserResource } from '@/lib/api/management/users'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type SheetMode =
  | { type: 'charge-detail'; record: ChargeRecord }
  | { type: 'balance-detail'; record: BalanceRecord }
  | { type: 'balance'; operation: 'recharge' | 'deduct' }
  | { type: 'model-price-create' }
  | { type: 'model-price-edit'; resource: ModelPrice }
  | { type: 'proxy-create' }
  | { type: 'proxy-edit'; resource: ProxyPoolItem }

type PendingDelete =
  | { type: 'model-price'; resource: ModelPrice }
  | { type: 'proxy'; resource: ProxyPoolItem }

type PendingBalanceOperation = {
  operation: 'recharge' | 'deduct'
  input: {
    userId: number
    amount: number
    note: string
  }
  userLabel: string
  currentBalance: number
  nextBalance: number
}

type BalanceOperationDraft = Omit<PendingBalanceOperation, 'operation'>

const tabs: BillingTab[] = ['overview', 'charges', 'balanceRecords', 'modelPrices', 'proxyPools']

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

function toProxyPoolInput(resource: ProxyPoolItem, enabled = resource.enabled): ProxyPoolInput {
  return {
    name: resource.name,
    proxyUrl: resource.proxyUrl,
    enabled,
    priority: resource.priority,
    note: resource.note ?? undefined,
  }
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

function maskUrl(value: string) {
  if (value.length <= 48) return value
  return `${value.slice(0, 24)}...${value.slice(-16)}`
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

function isValidProxyUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'socks5:', 'socks5h:'].includes(url.protocol)
  } catch {
    return false
  }
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

function EmptyState({ children }: { children: string }) {
  return <div className="text-muted-foreground px-4 py-10 text-center text-sm">{children}</div>
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

function CompactSummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <span className="text-muted-foreground min-w-0 truncate">{label}</span>
      <span className={cn('min-w-0 text-right font-medium tabular-nums', valueClassName)}>
        {value}
      </span>
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

function OverviewTab({ workbench }: { workbench: ReturnType<typeof useBillingWorkbench> }) {
  const { t } = useTranslation()
  const overview = workbench.overview

  if (workbench.overviewLoading) {
    return <Skeleton className="h-[420px] rounded-lg" />
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
    return <EmptyState>{t('billingPage.overview.empty')}</EmptyState>
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
            <EmptyState>{t('billingPage.overview.trend.empty')}</EmptyState>
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
                <p className="text-muted-foreground mt-3 text-sm">
                  {t('billingPage.overview.rank.empty')}
                </p>
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
        <PaginationBar
          pagination={pagination}
          total={workbench.chargesTotal}
          disabled={workbench.chargesFetching}
          onChange={onPaginationChange}
        />
      }
    >
      <TableSurfaceHeader
        title={t('billingPage.charges.title')}
        description={t('billingPage.charges.description')}
      />
      {workbench.charges.length === 0 ? (
        <EmptyState>{t('billingPage.charges.empty')}</EmptyState>
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
  onCreate,
  onView,
}: {
  workbench: ReturnType<typeof useBillingWorkbench>
  pagination: BillingPagination
  onPaginationChange: (pagination: BillingPagination) => void
  onCreate: (operation: 'recharge' | 'deduct') => void
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
        <PaginationBar
          pagination={pagination}
          total={workbench.balanceRecordsTotal}
          disabled={workbench.balanceRecordsFetching}
          onChange={onPaginationChange}
        />
      }
    >
      <TableSurfaceHeader
        title={t('billingPage.balance.title')}
        description={t('billingPage.balance.description')}
        actions={
          <>
            <Button onClick={() => onCreate('recharge')}>
              <Plus className="size-4" aria-hidden="true" />
              {t('billingPage.balance.actions.recharge')}
            </Button>
            <Button variant="warning" onClick={() => onCreate('deduct')}>
              <Minus className="size-4" aria-hidden="true" />
              {t('billingPage.balance.actions.deduct')}
            </Button>
          </>
        }
      />
      {workbench.balanceRecords.length === 0 ? (
        <EmptyState>{t('billingPage.balance.empty')}</EmptyState>
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
        <EmptyState>{t('billingPage.prices.empty')}</EmptyState>
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

function ProxyPoolsTab({
  workbench,
  onCreate,
  onEdit,
  onToggle,
  onTest,
  onDelete,
}: {
  workbench: ReturnType<typeof useBillingWorkbench>
  onCreate: () => void
  onEdit: (resource: ProxyPoolItem) => void
  onToggle: (resource: ProxyPoolItem) => void
  onTest: (resource: ProxyPoolItem) => void
  onDelete: (resource: ProxyPoolItem) => void
}) {
  const { t } = useTranslation()
  const copy = (value: string) => {
    void copyText(value).then(() => toast.success(t('billingPage.toast.copied')))
  }

  if (workbench.proxyPoolsLoading) return <Skeleton className="h-[420px] rounded-lg" />
  if (workbench.proxyPoolsError) {
    return (
      <ErrorNotice
        message={workbench.proxyPoolsError}
        fallback={t('billingPage.error.description')}
      />
    )
  }

  return (
    <TableSurface>
      <TableSurfaceHeader
        title={t('billingPage.proxies.title')}
        description={t('billingPage.proxies.description')}
        actions={
          <Button onClick={onCreate}>
            <Plus className="size-4" aria-hidden="true" />
            {t('billingPage.proxies.actions.create')}
          </Button>
        }
      />
      {workbench.proxyPools.length === 0 ? (
        <EmptyState>{t('billingPage.proxies.empty')}</EmptyState>
      ) : (
        <Table className="min-w-[980px]" containerClassName={containedTableContainerClassName}>
          <TableHeader className={stickyTableHeaderClassName}>
            <TableRow variant="static">
              <TableHead>{t('billingPage.proxies.columns.name')}</TableHead>
              <TableHead>{t('billingPage.proxies.columns.url')}</TableHead>
              <TableHead>{t('billingPage.proxies.columns.state')}</TableHead>
              <TableHead>{t('billingPage.proxies.columns.scope')}</TableHead>
              <TableHead>{t('billingPage.proxies.columns.priority')}</TableHead>
              <TableHead>{t('billingPage.proxies.columns.lastTest')}</TableHead>
              <TableHead>{t('billingPage.proxies.columns.note')}</TableHead>
              <TableHead className="table-sticky-action-head w-[256px] text-right">
                {t('billingPage.common.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workbench.proxyPools.map((resource) => (
              <TableRow key={resource.id} variant="resource">
                <TableCell>{resource.name}</TableCell>
                <TableCell className="max-w-[280px]">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate font-mono text-xs">
                      {maskUrl(resource.proxyUrl)}
                    </span>
                    {resource.proxyUrl ? (
                      <Button
                        type="button"
                        variant="text"
                        size="icon-xs"
                        onClick={() => copy(resource.proxyUrl)}
                      >
                        <Copy className="size-3" aria-hidden="true" />
                        <span className="sr-only">{t('billingPage.common.copy')}</span>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <StateToggle
                    enabled={resource.enabled}
                    disabled={workbench.mutating}
                    label={t('billingPage.proxies.actions.toggleState', {
                      name: resource.name,
                    })}
                    onToggle={() => onToggle(resource)}
                  />
                </TableCell>
                <TableCell>{t('billingPage.proxies.scope.global')}</TableCell>
                <TableCell className="tabular-nums">{resource.priority}</TableCell>
                <TableCell>
                  {formatDateTime(resource.lastTestedAt, t('billingPage.common.na'))}
                </TableCell>
                <TableCell className="max-w-[220px] truncate">
                  {resource.note || t('billingPage.common.na')}
                </TableCell>
                <TableCell className="table-sticky-action-cell w-[256px] text-right transition-colors">
                  <div className="table-action-cell-content">
                    <Button
                      variant="text"
                      size="sm"
                      className="px-2"
                      disabled={workbench.mutating}
                      onClick={() => onTest(resource)}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      {t('billingPage.proxies.actions.test')}
                    </Button>
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

function BalanceOperationSheet({
  operation,
  users,
  mutating,
  onCancel,
  onSubmit,
}: {
  operation: 'recharge' | 'deduct'
  users: UserResource[]
  mutating: boolean
  onCancel: () => void
  onSubmit: (draft: BalanceOperationDraft) => Promise<void>
}) {
  const { t } = useTranslation()
  const firstUser = users.find((user) => user.numericId !== null)
  const [userId, setUserId] = useState(firstUser?.numericId ? String(firstUser.numericId) : '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    userId?: string
    amount?: string
    note?: string
  }>({})
  const selectedUser = users.find(
    (user) => user.numericId !== null && String(user.numericId) === userId,
  )
  const parsedAmount = Number(amount)
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0
  const nextBalance =
    selectedUser && amountIsValid
      ? selectedUser.credits + (operation === 'recharge' ? parsedAmount : -parsedAmount)
      : null

  useEffect(() => {
    setUserId(firstUser?.numericId ? String(firstUser.numericId) : '')
    setAmount('')
    setNote('')
    setError(null)
    setFieldErrors({})
  }, [firstUser?.numericId, operation])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericUserId = Number(userId)
    const numericAmount = Number(amount)
    const nextFieldErrors: typeof fieldErrors = {}

    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      nextFieldErrors.userId = t('billingPage.balance.validation.userRequired')
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      nextFieldErrors.amount = t('billingPage.balance.validation.amountRequired')
    }
    if (operation === 'deduct' && !note.trim()) {
      nextFieldErrors.note = t('billingPage.balance.validation.noteRequired')
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setError(null)
      return
    }

    setFieldErrors({})
    setError(null)
    try {
      await onSubmit({
        input: { userId: numericUserId, amount: numericAmount, note: note.trim() },
        userLabel: selectedUser ? formatUserIdentity(selectedUser) : `#${numericUserId}`,
        currentBalance: selectedUser?.credits ?? 0,
        nextBalance:
          selectedUser?.credits !== undefined
            ? selectedUser.credits + (operation === 'recharge' ? numericAmount : -numericAmount)
            : 0,
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : t('billingPage.toast.actionFailed'))
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
      <CompactDrawerFormBody>
        <CompactField label={t('billingPage.balance.form.user')} error={fieldErrors.userId}>
          <Select
            value={userId}
            onValueChange={(value) => {
              setUserId(value)
              setFieldErrors((current) => ({ ...current, userId: undefined }))
            }}
            disabled={mutating}
          >
            <SelectTrigger
              aria-label={t('billingPage.balance.form.user')}
              aria-invalid={Boolean(fieldErrors.userId)}
            >
              <SelectValue placeholder={t('billingPage.balance.form.userPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter((user) => user.numericId !== null)
                .map((user) => (
                  <SelectItem key={user.id} value={String(user.numericId)}>
                    {formatUserIdentity(user)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CompactField>
        <div className="bg-muted/25 grid gap-2 rounded-md border px-3 py-2.5 text-sm">
          <CompactSummaryRow
            label={t('billingPage.balance.form.current')}
            value={selectedUser ? formatMoney(selectedUser.credits) : t('billingPage.common.na')}
          />
          <CompactSummaryRow
            label={t('billingPage.balance.form.after')}
            value={nextBalance !== null ? formatMoney(nextBalance) : t('billingPage.common.na')}
            valueClassName={cn(
              nextBalance !== null && nextBalance < 0
                ? 'text-warning-foreground dark:text-warning'
                : null,
            )}
          />
        </div>
        {operation === 'deduct' && nextBalance !== null && nextBalance < 0 ? (
          <div className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-3 py-2 text-sm">
            {t('billingPage.balance.form.negativeHint')}
          </div>
        ) : null}
        <CompactField label={t('billingPage.balance.form.amount')} error={fieldErrors.amount}>
          <Input
            type="number"
            min="0"
            step="0.000001"
            value={amount}
            aria-label={t('billingPage.balance.form.amount')}
            aria-invalid={Boolean(fieldErrors.amount)}
            disabled={mutating}
            onChange={(event) => {
              setAmount(event.target.value)
              setFieldErrors((current) => ({ ...current, amount: undefined }))
            }}
          />
        </CompactField>
        <CompactField
          label={
            operation === 'deduct'
              ? t('billingPage.balance.form.noteRequired')
              : t('billingPage.balance.form.note')
          }
          error={fieldErrors.note}
        >
          <Textarea
            value={note}
            className="min-h-20"
            aria-label={
              operation === 'deduct'
                ? t('billingPage.balance.form.noteRequired')
                : t('billingPage.balance.form.note')
            }
            aria-invalid={Boolean(fieldErrors.note)}
            disabled={mutating}
            onChange={(event) => {
              setNote(event.target.value)
              setFieldErrors((current) => ({ ...current, note: undefined }))
            }}
          />
        </CompactField>
        {error ? <ErrorNotice message={error} fallback={error} /> : null}
      </CompactDrawerFormBody>
      <DrawerScaffoldFooter>
        <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant={operation === 'deduct' ? 'warning' : 'default'}
          disabled={mutating}
        >
          {mutating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : operation === 'deduct' ? (
            <Minus className="size-4" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {operation === 'recharge'
            ? t('billingPage.balance.actions.recharge')
            : t('billingPage.balance.actions.deduct')}
        </Button>
      </DrawerScaffoldFooter>
    </form>
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
  onSubmit: (input: ModelPriceInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const resource = mode.type === 'edit' ? mode.resource : null
  const [input, setInput] = useState<ModelPriceInput>({
    provider: resource?.provider ?? '',
    model: resource?.model ?? '',
    inputPricePerMillion: resource?.inputPricePerMillion ?? 0,
    outputPricePerMillion: resource?.outputPricePerMillion ?? 0,
    cacheReadPricePerMillion: resource?.cacheReadPricePerMillion ?? 0,
    cacheWritePricePerMillion: resource?.cacheWritePricePerMillion ?? 0,
    requestPrice: resource?.requestPrice ?? 0,
    enabled: resource?.enabled ?? true,
    note: resource?.note ?? '',
  })
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
    setInput({
      provider: resource?.provider ?? '',
      model: resource?.model ?? '',
      inputPricePerMillion: resource?.inputPricePerMillion ?? 0,
      outputPricePerMillion: resource?.outputPricePerMillion ?? 0,
      cacheReadPricePerMillion: resource?.cacheReadPricePerMillion ?? 0,
      cacheWritePricePerMillion: resource?.cacheWritePricePerMillion ?? 0,
      requestPrice: resource?.requestPrice ?? 0,
      enabled: resource?.enabled ?? true,
      note: resource?.note ?? '',
    })
    setError(null)
    setFieldErrors({})
    setModelSearch('')
  }, [resource])

  const setNumber = (key: keyof ModelPriceInput, value: string) => {
    setInput((current) => ({ ...current, [key]: Number(value) }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextFieldErrors: typeof fieldErrors = {}

    if (!input.provider.trim() || !input.model.trim()) {
      nextFieldErrors.model = t('billingPage.prices.validation.modelRequired')
    }
    const priceFields = [
      'inputPricePerMillion',
      'outputPricePerMillion',
      'cacheReadPricePerMillion',
      'cacheWritePricePerMillion',
      'requestPrice',
    ] as const
    priceFields.forEach((key) => {
      const value = input[key]
      if (!Number.isFinite(value) || value < 0) {
        nextFieldErrors[key] = t('billingPage.prices.validation.priceInvalid')
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
      await onSubmit({
        ...input,
        provider: input.provider.trim(),
        model: input.model.trim(),
        note: input.note?.trim() || undefined,
      })
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
                    filteredCandidates.map((candidate) => (
                      <button
                        key={createModelPriceCandidateValue(candidate.provider, candidate.model)}
                        type="button"
                        role="option"
                        aria-label={`${candidate.label}, ${candidate.model}, ${candidate.provider}`}
                        aria-selected={
                          candidate.provider === input.provider.trim() &&
                          candidate.model === input.model.trim()
                        }
                        disabled={mutating}
                        className={cn(
                          'hover:bg-accent focus-visible:ring-ring/50 grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                          candidate.provider === input.provider.trim() &&
                            candidate.model === input.model.trim()
                            ? 'border-primary/45 bg-primary/10'
                            : 'bg-card border-transparent',
                        )}
                        onClick={() => {
                          setInput((current) => ({
                            ...current,
                            provider: candidate.provider,
                            model: candidate.model,
                          }))
                          setFieldErrors((current) => ({
                            ...current,
                            provider: undefined,
                            model: undefined,
                          }))
                        }}
                      >
                        <ProviderLogo providerId={toProviderLogoId(candidate.provider)} size="sm" />
                        <span className="grid min-w-0 gap-0.5">
                          <span className="min-w-0 truncate font-medium">{candidate.label}</span>
                          <span className="text-muted-foreground grid min-w-0 gap-1 text-xs leading-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <span className="min-w-0 truncate">{candidate.model}</span>
                            <span className="min-w-0 truncate sm:text-right">
                              {candidate.provider}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))
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
            selectedCandidate ? 'border-primary/30 bg-primary/10' : 'bg-muted/25 border-dashed',
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border',
                selectedCandidate
                  ? 'border-primary/30 bg-primary/12 text-primary'
                  : 'bg-background text-muted-foreground',
              )}
            >
              {selectedCandidate ? (
                <ProviderLogo providerId={toProviderLogoId(selectedCandidate.provider)} size="sm" />
              ) : (
                <PackageCheck className="size-4" aria-hidden="true" />
              )}
            </div>
            <div className="grid min-w-0 gap-1">
              <span className="text-muted-foreground text-xs font-medium">
                {t('billingPage.prices.form.pricingTarget')}
              </span>
              {selectedCandidate ? (
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
                  min="0"
                  step="0.000001"
                  value={String(input[key] ?? 0)}
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
        <Button type="submit" disabled={mutating}>
          {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode.type === 'create'
            ? t('billingPage.prices.actions.create')
            : t('billingPage.common.save')}
        </Button>
      </DrawerScaffoldFooter>
    </form>
  )
}

function ProxyPoolSheet({
  mode,
  mutating,
  onCancel,
  onSubmit,
}: {
  mode: { type: 'create' } | { type: 'edit'; resource: ProxyPoolItem }
  mutating: boolean
  onCancel: () => void
  onSubmit: (input: ProxyPoolInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const resource = mode.type === 'edit' ? mode.resource : null
  const [input, setInput] = useState<ProxyPoolInput>({
    name: resource?.name ?? '',
    proxyUrl: resource?.proxyUrl ?? '',
    enabled: resource?.enabled ?? true,
    priority: resource?.priority ?? 0,
    note: resource?.note ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    proxyUrl?: string
    priority?: string
  }>({})

  useEffect(() => {
    setInput({
      name: resource?.name ?? '',
      proxyUrl: resource?.proxyUrl ?? '',
      enabled: resource?.enabled ?? true,
      priority: resource?.priority ?? 0,
      note: resource?.note ?? '',
    })
    setError(null)
    setFieldErrors({})
  }, [resource])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextFieldErrors: typeof fieldErrors = {}

    if (!input.name.trim()) {
      nextFieldErrors.name = t('billingPage.proxies.validation.nameRequired')
    }
    if (!input.proxyUrl.trim()) {
      nextFieldErrors.proxyUrl = t('billingPage.proxies.validation.urlRequired')
    } else if (!isValidProxyUrl(input.proxyUrl.trim())) {
      nextFieldErrors.proxyUrl = t('billingPage.proxies.validation.urlInvalid')
    }
    if (!Number.isInteger(input.priority)) {
      nextFieldErrors.priority = t('billingPage.proxies.validation.priorityInvalid')
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setError(null)
      return
    }

    setFieldErrors({})
    setError(null)
    try {
      await onSubmit({
        ...input,
        name: input.name.trim(),
        proxyUrl: input.proxyUrl.trim(),
        note: input.note?.trim() || undefined,
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : t('billingPage.toast.actionFailed'))
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
      <CompactDrawerFormBody>
        <section className="grid gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('billingPage.proxies.form.identity')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('billingPage.proxies.form.identityHint')}
            </p>
          </div>
          <CompactField label={t('billingPage.proxies.form.name')} error={fieldErrors.name}>
            <Input
              value={input.name}
              aria-label={t('billingPage.proxies.form.name')}
              aria-invalid={Boolean(fieldErrors.name)}
              disabled={mutating}
              onChange={(event) => {
                setInput((current) => ({ ...current, name: event.target.value }))
                setFieldErrors((current) => ({ ...current, name: undefined }))
              }}
            />
          </CompactField>
          <CompactField
            label={t('billingPage.proxies.form.url')}
            hint={t('billingPage.proxies.form.urlHint')}
            error={fieldErrors.proxyUrl}
          >
            <Input
              value={input.proxyUrl}
              aria-label={t('billingPage.proxies.form.url')}
              aria-invalid={Boolean(fieldErrors.proxyUrl)}
              disabled={mutating}
              onChange={(event) => {
                setInput((current) => ({ ...current, proxyUrl: event.target.value }))
                setFieldErrors((current) => ({ ...current, proxyUrl: undefined }))
              }}
            />
          </CompactField>
        </section>
        <section className="grid gap-3 rounded-md border px-3 py-3">
          <div>
            <h3 className="text-sm font-semibold">{t('billingPage.proxies.form.routing')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('billingPage.proxies.form.routingHint')}
            </p>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2">
            <CompactField label={t('billingPage.proxies.form.enabled')}>
              <Select
                value={input.enabled ? 'enabled' : 'disabled'}
                onValueChange={(value) =>
                  setInput((current) => ({ ...current, enabled: value === 'enabled' }))
                }
                disabled={mutating}
              >
                <SelectTrigger aria-label={t('billingPage.proxies.form.enabled')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">{t('billingPage.common.enabled')}</SelectItem>
                  <SelectItem value="disabled">{t('billingPage.common.disabled')}</SelectItem>
                </SelectContent>
              </Select>
            </CompactField>
            <CompactField
              label={t('billingPage.proxies.form.priority')}
              error={fieldErrors.priority}
            >
              <Input
                type="number"
                step="1"
                value={String(input.priority)}
                aria-label={t('billingPage.proxies.form.priority')}
                aria-invalid={Boolean(fieldErrors.priority)}
                disabled={mutating}
                onChange={(event) => {
                  setInput((current) => ({ ...current, priority: Number(event.target.value) }))
                  setFieldErrors((current) => ({ ...current, priority: undefined }))
                }}
              />
            </CompactField>
          </div>
          <p className="text-muted-foreground text-xs leading-5">
            {t('billingPage.proxies.form.priorityHint')}
          </p>
          <div className="bg-muted/25 rounded-md border px-3 py-2 text-sm">
            <CompactSummaryRow
              label={t('billingPage.proxies.form.scope')}
              value={t('billingPage.proxies.scope.global')}
            />
          </div>
        </section>
        <CompactField label={t('billingPage.proxies.form.note')}>
          <Textarea
            value={input.note ?? ''}
            className="min-h-20"
            aria-label={t('billingPage.proxies.form.note')}
            disabled={mutating}
            onChange={(event) => setInput((current) => ({ ...current, note: event.target.value }))}
          />
        </CompactField>
        {error ? <ErrorNotice message={error} fallback={error} /> : null}
      </CompactDrawerFormBody>
      <DrawerScaffoldFooter>
        <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutating}>
          {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode.type === 'create'
            ? t('billingPage.proxies.actions.create')
            : t('billingPage.proxies.actions.save')}
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
  const [pendingBalanceOperation, setPendingBalanceOperation] =
    useState<PendingBalanceOperation | null>(null)
  const workbench = useBillingWorkbench(activeTab, filters, chargePagination, balancePagination)
  const activeFetching =
    activeTab === 'overview'
      ? workbench.overviewFetching
      : activeTab === 'charges'
        ? workbench.chargesFetching
        : activeTab === 'balanceRecords'
          ? workbench.balanceRecordsFetching
          : activeTab === 'modelPrices'
            ? workbench.modelPricesFetching
            : workbench.proxyPoolsFetching

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
              if (activeTab === 'proxyPools') void workbench.refreshProxyPools()
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

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
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
          onCreate={(operation) => setSheetMode({ type: 'balance', operation })}
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
      {activeTab === 'proxyPools' ? (
        <ProxyPoolsTab
          workbench={workbench}
          onCreate={() => setSheetMode({ type: 'proxy-create' })}
          onEdit={(resource) => setSheetMode({ type: 'proxy-edit', resource })}
          onToggle={(resource) => {
            void workbench
              .updateProxyPool({
                resource,
                input: toProxyPoolInput(resource, !resource.enabled),
              })
              .then(() => toast.success(t('billingPage.toast.proxyUpdated')))
              .catch(showMutationError)
          }}
          onTest={(resource) => {
            void workbench
              .testProxyPool(resource)
              .then(() => toast.success(t('billingPage.toast.proxyTested')))
              .catch(showMutationError)
          }}
          onDelete={(resource) => setPendingDelete({ type: 'proxy', resource })}
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
                      : sheetMode.type === 'balance'
                        ? sheetMode.operation === 'recharge'
                          ? t('billingPage.balance.sheet.rechargeTitle')
                          : t('billingPage.balance.sheet.deductTitle')
                        : sheetMode.type === 'model-price-create'
                          ? t('billingPage.prices.sheet.createTitle')
                          : sheetMode.type === 'model-price-edit'
                            ? t('billingPage.prices.sheet.editTitle')
                            : sheetMode.type === 'proxy-create'
                              ? t('billingPage.proxies.sheet.createTitle')
                              : t('billingPage.proxies.sheet.editTitle')}
                </SheetTitle>
                {sheetMode.type === 'model-price-create' ||
                sheetMode.type === 'model-price-edit' ? null : (
                  <SheetDescription>
                    {sheetMode.type === 'charge-detail'
                      ? t('billingPage.chargeDetail.description')
                      : sheetMode.type === 'balance-detail'
                        ? t('billingPage.balanceDetail.description')
                        : sheetMode.type === 'balance'
                          ? t('billingPage.balance.sheet.description')
                          : t('billingPage.proxies.sheet.description')}
                  </SheetDescription>
                )}
              </DrawerScaffoldHeader>
              {sheetMode.type === 'charge-detail' ? (
                <ChargeDetailSheet record={sheetMode.record} />
              ) : null}
              {sheetMode.type === 'balance-detail' ? (
                <BalanceDetailSheet record={sheetMode.record} users={workbench.users} />
              ) : null}
              {sheetMode.type === 'balance' ? (
                <BalanceOperationSheet
                  operation={sheetMode.operation}
                  users={workbench.users}
                  mutating={workbench.mutating || workbench.usersLoading}
                  onCancel={closeSheet}
                  onSubmit={(draft) => {
                    setPendingBalanceOperation({
                      operation: sheetMode.operation,
                      ...draft,
                    })
                    return Promise.resolve()
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
                  candidatesIssue={workbench.modelPriceCandidatesIssue}
                  mutating={workbench.mutating}
                  onCancel={closeSheet}
                  onRetryCandidates={workbench.refreshModelPriceCandidates}
                  onSubmit={async (input) => {
                    if (sheetMode.type === 'model-price-create') {
                      await workbench.createModelPrice(input)
                      toast.success(t('billingPage.toast.priceCreated'))
                    } else {
                      await workbench.updateModelPrice({ resource: sheetMode.resource, input })
                      toast.success(t('billingPage.toast.priceUpdated'))
                    }
                    closeSheet()
                  }}
                />
              ) : null}
              {sheetMode.type === 'proxy-create' || sheetMode.type === 'proxy-edit' ? (
                <ProxyPoolSheet
                  mode={
                    sheetMode.type === 'proxy-create'
                      ? { type: 'create' }
                      : { type: 'edit', resource: sheetMode.resource }
                  }
                  mutating={workbench.mutating}
                  onCancel={closeSheet}
                  onSubmit={async (input) => {
                    if (sheetMode.type === 'proxy-create') {
                      await workbench.createProxyPool(input)
                      toast.success(t('billingPage.toast.proxyCreated'))
                    } else {
                      await workbench.updateProxyPool({ resource: sheetMode.resource, input })
                      toast.success(t('billingPage.toast.proxyUpdated'))
                    }
                    closeSheet()
                  }}
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
            <AlertDialogTitle>
              {pendingDelete?.type === 'model-price'
                ? t('billingPage.prices.delete.title')
                : t('billingPage.proxies.delete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.type === 'model-price'
                ? t('billingPage.prices.delete.description', {
                    model: pendingDelete.resource.model,
                  })
                : t('billingPage.proxies.delete.description', {
                    name: pendingDelete?.resource.name ?? '',
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

                const action =
                  pendingDelete.type === 'model-price'
                    ? workbench.deleteModelPrice(pendingDelete.resource)
                    : workbench.deleteProxyPool(pendingDelete.resource)

                void action
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

      <AlertDialog
        open={Boolean(pendingBalanceOperation)}
        onOpenChange={(open) => !open && setPendingBalanceOperation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingBalanceOperation?.operation === 'deduct'
                ? t('billingPage.balance.confirm.deductTitle')
                : t('billingPage.balance.confirm.rechargeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBalanceOperation?.operation === 'deduct'
                ? t('billingPage.balance.confirm.deductDescription')
                : t('billingPage.balance.confirm.rechargeDescription')}
            </AlertDialogDescription>
            {pendingBalanceOperation ? (
              <div className="bg-muted/25 grid gap-2 rounded-md border px-3 py-2.5 text-sm">
                <CompactSummaryRow
                  label={t('billingPage.balance.confirm.user')}
                  value={pendingBalanceOperation.userLabel}
                />
                <CompactSummaryRow
                  label={t('billingPage.balance.confirm.amount')}
                  value={formatSignedAmount(
                    pendingBalanceOperation.operation === 'deduct'
                      ? -Math.abs(pendingBalanceOperation.input.amount)
                      : Math.abs(pendingBalanceOperation.input.amount),
                  )}
                  valueClassName={
                    pendingBalanceOperation.operation === 'deduct'
                      ? 'text-warning-foreground dark:text-warning'
                      : 'text-success'
                  }
                />
                <CompactSummaryRow
                  label={t('billingPage.balance.confirm.current')}
                  value={formatMoney(pendingBalanceOperation.currentBalance)}
                />
                <CompactSummaryRow
                  label={t('billingPage.balance.confirm.after')}
                  value={formatMoney(pendingBalanceOperation.nextBalance)}
                  valueClassName={
                    pendingBalanceOperation.nextBalance < 0
                      ? 'text-warning-foreground dark:text-warning'
                      : undefined
                  }
                />
                <div className="grid gap-1 border-t pt-2">
                  <span className="text-muted-foreground text-xs">
                    {t('billingPage.balance.confirm.note')}
                  </span>
                  <span className="min-w-0 text-sm break-words">
                    {pendingBalanceOperation.input.note || t('billingPage.common.na')}
                  </span>
                </div>
                {pendingBalanceOperation.nextBalance < 0 ? (
                  <div className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-3 py-2 text-xs leading-5">
                    {t('billingPage.balance.confirm.negativeResult')}
                  </div>
                ) : null}
              </div>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                pendingBalanceOperation?.operation === 'deduct'
                  ? 'bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/20'
                  : undefined
              }
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                if (!pendingBalanceOperation) return

                const action =
                  pendingBalanceOperation.operation === 'recharge'
                    ? workbench.recharge(pendingBalanceOperation.input)
                    : workbench.deduct(pendingBalanceOperation.input)

                void action
                  .then(() => {
                    toast.success(
                      pendingBalanceOperation.operation === 'recharge'
                        ? t('billingPage.toast.recharged')
                        : t('billingPage.toast.deducted'),
                    )
                    setPendingBalanceOperation(null)
                    closeSheet()
                  })
                  .catch(showMutationError)
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('billingPage.balance.confirm.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
