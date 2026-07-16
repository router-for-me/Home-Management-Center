import { useEffect, useMemo, useState } from 'react'

import { CircleGauge, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TableEmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { TableSurface, TableSurfaceHeader } from '@/components/shared/table-surface'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  QuotaDetailSheet,
  QuotaFilterBar,
  QuotaPaginationBar,
  QuotaTable,
  formatQuotaDateTime,
} from '@/features/quota/quota-components'
import {
  type QuotaVerdict,
  defaultQuotaFilters,
  defaultQuotaPagination,
  getQuotaVerdict,
} from '@/features/quota/quota-model'
import { useQuotaCredentialDetail, useQuotaWorkbench } from '@/features/quota/use-quota-workbench'
import type { ManagementApiError } from '@/lib/api/management/types'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

const quotaVerdictClassNames: Record<QuotaVerdict, string> = {
  healthy: 'border-success/30 bg-success/10 text-success',
  attention: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  partial: 'border-destructive/30 bg-destructive/10 text-destructive',
}

function QuotaDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <PageHeader
        title={t('quotaPage.disconnected.title')}
        description={t('quotaPage.disconnected.description')}
        icon={
          <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-md">
            <CircleGauge className="size-5" aria-hidden="true" />
          </div>
        }
        actions={
          <Button onClick={openConnectionDialog}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t('quotaPage.disconnected.action')}
          </Button>
        }
      />
    </section>
  )
}

function QuotaLoadingState() {
  return (
    <section className="grid w-full gap-4">
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg" />
    </section>
  )
}

function QuotaUnsupportedState({ runtimeMode }: { runtimeMode: string }) {
  const { t } = useTranslation()
  return (
    <section className="grid w-full gap-4">
      <PageHeader
        title={t('quotaPage.header.title')}
        titleMeta={
          <span className="bg-muted/50 text-muted-foreground rounded-md border px-2 py-1 text-xs font-medium">
            {t('quotaPage.header.unsupportedBadge')}
          </span>
        }
        description={t('quotaPage.header.description')}
        meta={<span>{t('quotaPage.header.runtime', { mode: runtimeMode })}</span>}
      />
      <TableSurface>
        <TableSurfaceHeader
          title={t('quotaPage.snapshot.title')}
          description={t('quotaPage.snapshot.description')}
        />
        <TableEmptyState
          kind="unsupported"
          title={t('quotaPage.snapshot.unsupportedTitle')}
          description={t('quotaPage.snapshot.unsupportedDescription')}
          icon={CircleGauge}
        />
      </TableSurface>
    </section>
  )
}

function QuotaErrorState({
  error,
  onRetry,
}: {
  error: ManagementApiError | null
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <PageHeader
      title={t('quotaPage.error.title')}
      description={error?.message ?? t('quotaPage.error.description')}
      meta={
        error?.backendCode || error?.requestId ? (
          <span className="font-mono text-xs break-all">
            {[error.backendCode, error.requestId].filter(Boolean).join(' · ')}
          </span>
        ) : undefined
      }
      actions={
        <Button onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t('quotaPage.error.retry')}
        </Button>
      }
    />
  )
}

export function QuotaWorkbenchPage({
  initialSearch = '',
  onSearchChange,
}: {
  initialSearch?: string
  onSearchChange?: (search: string) => void
}) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState({ ...defaultQuotaFilters, search: initialSearch })
  const [pagination, setPagination] = useState(defaultQuotaPagination)
  const workbench = useQuotaWorkbench(filters, pagination)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detail = useQuotaCredentialDetail(selectedId)

  useEffect(() => {
    setFilters((current) =>
      current.search === initialSearch ? current : { ...current, search: initialSearch },
    )
    setPagination((current) => (current.offset === 0 ? current : { ...current, offset: 0 }))
  }, [initialSearch])

  const items = workbench.snapshot?.items ?? []
  const providers = workbench.snapshot?.facets.providers.map((option) => option.value) ?? []
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  )
  const detailItem = detail.item ?? selectedItem

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return <QuotaLoadingState />
  }
  if (!workbench.connected) return <QuotaDisconnectedState />
  if (!workbench.available) {
    return <QuotaUnsupportedState runtimeMode={t(`runtimeMode.${workbench.runtimeMode}`)} />
  }
  if (workbench.isPending && !workbench.snapshot) return <QuotaLoadingState />
  if (workbench.isError || !workbench.snapshot) {
    return <QuotaErrorState error={workbench.error} onRetry={() => void workbench.refetch()} />
  }

  const snapshot = workbench.snapshot
  const verdict = getQuotaVerdict(snapshot.globalSummary)
  const attentionCount = snapshot.globalSummary.needsAttention

  return (
    <section className="grid w-full gap-4">
      <PageHeader
        title={t('quotaPage.header.title')}
        titleMeta={
          <>
            <span
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-medium',
                quotaVerdictClassNames[verdict],
              )}
            >
              {t(`quotaPage.header.verdict.${verdict}.badge`, { count: attentionCount })}
            </span>
          </>
        }
        description={t(`quotaPage.header.verdict.${verdict}.description`, {
          count: attentionCount,
        })}
        meta={
          <>
            <span>
              {t('quotaPage.header.runtime', {
                mode: t(`runtimeMode.${workbench.runtimeMode}`),
              })}
            </span>
            <span>
              {t('quotaPage.header.syncedAt', {
                time: formatQuotaDateTime(snapshot.fetchedAt) ?? t('quotaPage.common.notAvailable'),
              })}
            </span>
            <span>
              {t('quotaPage.header.summary', {
                healthy: snapshot.globalSummary.healthy,
                total: snapshot.globalSummary.total,
              })}
            </span>
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-0"
            disabled={workbench.isFetching}
            onClick={() => void workbench.refetch()}
          >
            {workbench.isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {workbench.isFetching ? t('quotaPage.actions.syncing') : t('quotaPage.actions.refresh')}
          </Button>
        }
      />

      <TableSurface>
        <TableSurfaceHeader
          title={t('quotaPage.snapshot.title')}
          actions={
            <QuotaFilterBar
              filters={filters}
              providers={providers}
              onChange={(nextFilters) => {
                if (nextFilters.search !== filters.search) onSearchChange?.(nextFilters.search)
                setFilters(nextFilters)
                setPagination((current) => ({ ...current, offset: 0 }))
              }}
            />
          }
          className="md:flex-col md:items-stretch xl:flex-row xl:items-start"
          actionsClassName="w-full xl:w-auto"
        />
        <div className="p-4">
          <div className="overflow-hidden rounded-md border">
            <QuotaTable
              items={items}
              hasAnyItems={snapshot.globalSummary.total > 0}
              onView={(item) => setSelectedId(item.id)}
            />
            <QuotaPaginationBar
              pagination={pagination}
              total={snapshot.total}
              disabled={workbench.isFetching}
              onChange={setPagination}
            />
          </div>
        </div>
      </TableSurface>

      <QuotaDetailSheet
        item={detailItem}
        open={selectedId !== null}
        fullDetailsLoaded={detail.item !== null}
        pending={detail.isPending && detail.item === null}
        unsupported={selectedId !== null && !detail.available}
        error={detail.error}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
    </section>
  )
}
