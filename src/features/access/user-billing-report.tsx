import { useState } from 'react'

import { BarChart3, RefreshCcw, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TableEmptyState } from '@/components/shared/empty-state'
import { TablePaginationStatus, tableHeaderClassName } from '@/components/shared/table-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePersistentPagination } from '@/hooks/use-persistent-pagination'
import type { UserBillingFilters, UserBillingPagination } from '@/lib/api/user/billing'
import { formatCreditAmount, formatSignedDetailedCreditAmount } from '@/lib/billing/amount-format'
import { createLocalDateRange } from '@/lib/billing/date-range'
import { uiPreferenceKeys } from '@/lib/ui-preferences'

import { useUserBillingReport } from './use-user-billing-report'

const pageSizes = [20, 50, 100] as const
const defaultPagination: UserBillingPagination = { limit: 20, offset: 0 }

type DateRangePreset = 'today' | '7d' | '30d' | 'custom'

function createDateRange(days: number): UserBillingFilters {
  return createLocalDateRange(days)
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-2 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
      {message}
    </div>
  )
}

function PaginationBar({
  pagination,
  total,
  disabled,
  onChange,
}: {
  pagination: UserBillingPagination
  total: number
  disabled: boolean
  onChange: (pagination: UserBillingPagination) => void
}) {
  const { t } = useTranslation()
  const start = total === 0 ? 0 : pagination.offset + 1
  const end = Math.min(total, pagination.offset + pagination.limit)

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
      <TablePaginationStatus
        text={t('userWorkspace.billing.pagination.range', { start, end, total })}
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
            aria-label={t('userWorkspace.billing.pagination.pageSize')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t('userWorkspace.billing.pagination.rows', { count: size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="md"
          disabled={disabled || pagination.offset === 0}
          onClick={() =>
            onChange({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })
          }
        >
          {t('userWorkspace.billing.pagination.previous')}
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={disabled || pagination.offset + pagination.limit >= total}
          onClick={() => onChange({ ...pagination, offset: pagination.offset + pagination.limit })}
        >
          {t('userWorkspace.billing.pagination.next')}
        </Button>
      </div>
    </div>
  )
}

export function UserBillingReport() {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<DateRangePreset>('30d')
  const [filters, setFilters] = useState<UserBillingFilters>(() => createDateRange(29))
  const [pagination, setPagination] = usePersistentPagination(
    uiPreferenceKeys.userBillingPageSize,
    defaultPagination,
    pageSizes,
  )
  const report = useUserBillingReport(filters, pagination)

  const updateFilters = (patch: Partial<UserBillingFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPagination((current) => ({ ...current, offset: 0 }))
  }

  const handlePresetChange = (nextPreset: DateRangePreset) => {
    setPreset(nextPreset)
    if (nextPreset === 'today') updateFilters(createDateRange(0))
    if (nextPreset === '7d') updateFilters(createDateRange(6))
    if (nextPreset === '30d') updateFilters(createDateRange(29))
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
            <WalletCards className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('userWorkspace.billing.title')}</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('userWorkspace.billing.description')}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={report.overviewFetching || report.chargesFetching}
          onClick={() => {
            void report.refreshOverview()
            void report.refreshCharges()
          }}
        >
          <RefreshCcw
            className={
              report.overviewFetching || report.chargesFetching ? 'size-4 animate-spin' : 'size-4'
            }
            aria-hidden="true"
          />
          {t('userWorkspace.billing.actions.refresh')}
        </Button>
      </div>

      <div className="grid gap-3 border-b p-4 md:grid-cols-[150px_1fr_1fr]">
        <Select
          value={preset}
          onValueChange={(value) => handlePresetChange(value as DateRangePreset)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('userWorkspace.billing.filters.today')}</SelectItem>
            <SelectItem value="7d">{t('userWorkspace.billing.filters.last7d')}</SelectItem>
            <SelectItem value="30d">{t('userWorkspace.billing.filters.last30d')}</SelectItem>
            <SelectItem value="custom">{t('userWorkspace.billing.filters.custom')}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filters.from}
          max={filters.to || '9999-12-31'}
          onChange={(event) => {
            const nextFrom = event.target.value
            setPreset('custom')
            updateFilters({
              from: nextFrom,
              ...(nextFrom && filters.to && nextFrom > filters.to ? { to: nextFrom } : {}),
            })
          }}
        />
        <Input
          type="date"
          value={filters.to}
          min={filters.from || '1970-01-01'}
          onChange={(event) => {
            const nextTo = event.target.value
            setPreset('custom')
            updateFilters({
              to: nextTo,
              ...(nextTo && filters.from && nextTo < filters.from ? { from: nextTo } : {}),
            })
          }}
        />
      </div>

      <div className="grid gap-4 p-4">
        {report.overviewLoading ? (
          <Skeleton className="h-24 rounded-md" />
        ) : report.overviewError ? (
          <ErrorNotice message={report.overviewError} />
        ) : report.overview ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile
                label={t('userWorkspace.billing.metrics.currentBalance')}
                value={formatCreditAmount(report.overview.currentBalance)}
              />
              <MetricTile
                label={t('userWorkspace.billing.metrics.todaySpend')}
                value={formatCreditAmount(report.overview.todaySpend)}
              />
              <MetricTile
                label={t('userWorkspace.billing.metrics.monthSpend')}
                value={formatCreditAmount(report.overview.monthSpend)}
              />
            </div>
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {t('userWorkspace.billing.topModels.title')}
                </h3>
                <BarChart3 className="text-muted-foreground size-4" aria-hidden="true" />
              </div>
              {report.overview.topModels.length === 0 ? (
                <TableEmptyState
                  compact
                  kind="empty"
                  className="m-0 mt-3 min-h-24"
                  title={t('userWorkspace.billing.topModels.empty')}
                />
              ) : (
                <div className="mt-3 grid gap-2">
                  {report.overview.topModels.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm"
                    >
                      <span className="truncate font-mono text-xs">{item.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {t('userWorkspace.billing.topModels.requests', {
                          count: formatNumber(item.requestCount),
                        })}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCreditAmount(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <TableEmptyState
            kind="empty"
            className="m-0 border-0"
            title={t('userWorkspace.billing.empty')}
          />
        )}
      </div>

      <div className="border-t">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">{t('userWorkspace.billing.records.title')}</h3>
        </div>
        {report.chargesLoading ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : report.chargesError ? (
          <div className="p-4">
            <ErrorNotice message={report.chargesError} />
          </div>
        ) : report.charges.length === 0 ? (
          <TableEmptyState kind="empty" title={t('userWorkspace.billing.records.empty')} />
        ) : (
          <Table className="min-w-[820px]">
            <TableHeader className={tableHeaderClassName}>
              <TableRow variant="static">
                <TableHead>{t('userWorkspace.billing.records.columns.time')}</TableHead>
                <TableHead>{t('userWorkspace.billing.records.columns.provider')}</TableHead>
                <TableHead>{t('userWorkspace.billing.records.columns.model')}</TableHead>
                <TableHead>{t('userWorkspace.billing.records.columns.input')}</TableHead>
                <TableHead>{t('userWorkspace.billing.records.columns.output')}</TableHead>
                <TableHead>{t('userWorkspace.billing.records.columns.amount')}</TableHead>
                <TableHead>{t('userWorkspace.billing.records.columns.balanceAfter')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.charges.map((record) => (
                <TableRow key={record.id} variant="resource">
                  <TableCell>
                    {formatDateTime(record.createdAt, t('userWorkspace.summary.notAvailable'))}
                  </TableCell>
                  <TableCell>
                    {record.provider || t('userWorkspace.summary.notAvailable')}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs">
                    {record.model || t('userWorkspace.summary.notAvailable')}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatNumber(record.inputTokens)}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatNumber(record.outputTokens)}
                  </TableCell>
                  <TableCell className="text-destructive font-medium tabular-nums">
                    {formatSignedDetailedCreditAmount(-Math.abs(record.amount))}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatCreditAmount(record.balanceAfter)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {report.chargesTotal > 0 ? (
          <PaginationBar
            pagination={pagination}
            total={report.chargesTotal}
            disabled={report.chargesFetching}
            onChange={setPagination}
          />
        ) : null}
      </div>
    </div>
  )
}
