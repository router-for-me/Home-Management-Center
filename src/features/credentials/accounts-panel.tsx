import { useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerReset,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TableEmptyState } from '@/components/shared/empty-state'
import { RowActions } from '@/components/shared/row-actions'
import { useSecondaryColumns } from '@/components/shared/table-columns'
import {
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
import { Checkbox } from '@/components/ui/checkbox'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getCredentialInFlightId } from '@/features/credentials/credential-concurrency'
import {
  type CreateCredentialMode,
  CreateCredentialSheet,
  type OAuthSessionMap,
  type OAuthStatusMap,
} from '@/features/credentials/credential-create-sheet'
import {
  CredentialDetailDrawer,
  type CredentialDrawerTab,
} from '@/features/credentials/credential-detail-drawer'
import {
  getCredentialDisplayName,
  getCredentialProviderLabel,
  getCredentialStatusTone,
} from '@/features/credentials/credential-display'
import {
  filterCredentialResources,
  hasCredentialFilters,
} from '@/features/credentials/credential-filters'
import {
  CoolingCell,
  type InlineMetadataSave,
  WebsocketsCell,
} from '@/features/credentials/credential-inline-cells'
import { findCredentialRouteResource } from '@/features/credentials/credential-route'
import { useCredentialWorkbench } from '@/features/credentials/use-credential-workbench'
import { UpstreamQuotaCell } from '@/features/upstream/quota-cells'
import { type UpstreamAccountsStats } from '@/features/upstream/summary-cards'
import {
  type UpstreamQuotaEntry,
  countUpstreamQuotaAttentionResources,
  findUpstreamQuotaEntry,
  getCredentialQuotaId,
  resolveCredentialQuotaAction,
  resolveUpstreamQuotaCellState,
} from '@/features/upstream/upstream-quota-model'
import { upstreamQuotaListLimit } from '@/features/upstream/use-upstream-quota'
import {
  type CredentialInFlightSummary,
  type CredentialMetadataPatch,
  type CredentialOAuthCallbackInput,
  type CredentialOAuthProvider,
  type CredentialResource,
  type CredentialStatusFilter,
  getCredentialCooldownId,
  matchesCredentialBackendError,
  mergeCredentialConcurrencySummary,
} from '@/lib/api/management/credentials'
import { downloadBlob } from '@/lib/download'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

import {
  OAUTH_STATUS_POLL_INTERVAL_MS,
  OAUTH_STATUS_POLL_MAX_ATTEMPTS,
  OAUTH_STATUS_POLL_MAX_CONSECUTIVE_ERRORS,
  isCredentialOAuthFailure,
  isCredentialOAuthSuccess,
  resolveCredentialOAuthCallbackState,
} from './credential-oauth-flow'
import {
  type CredentialUploadItem,
  classifyCredentialUploadError,
  createCredentialUploadItem,
  isCredentialUploadRetryable,
  validateCredentialUploadFile,
} from './credential-upload'

type PendingCredentialConfirmation =
  | { type: 'delete'; resource: CredentialResource }
  | { type: 'bulkDelete'; resources: CredentialResource[] }

const MAX_CONCURRENT_CREDENTIAL_UPLOADS = 3
const EMPTY_QUOTA_COLLECTING_IDS = new Set<string>()
const EMPTY_QUOTA_MAP = new Map<string, UpstreamQuotaEntry>()
const EMPTY_CREDENTIAL_RESOURCES: CredentialResource[] = []

function CredentialDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('credentialsPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('credentialsPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t('credentialsPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function CredentialLoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <Skeleton className="h-[560px] rounded-lg" />
      <Skeleton className="h-[560px] rounded-lg" />
    </div>
  )
}

function CredentialErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-md border">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('credentialsPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('credentialsPage.error.description')}
              </p>
            </div>
          </div>
          <Button variant="outline" className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('credentialsPage.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function AccountsToolbar({
  resources,
  search,
  statusFilter,
  providerFilter,
  quotaAvailable,
  attentionOnly,
  websocketOnly,
  filteredCount,
  onSearchChange,
  onStatusFilterChange,
  onProviderFilterChange,
  onAttentionOnlyChange,
  onWebsocketOnlyChange,
  onClearFilters,
}: {
  resources: CredentialResource[]
  search: string
  statusFilter: CredentialStatusFilter
  providerFilter: string
  quotaAvailable: boolean
  attentionOnly: boolean
  websocketOnly: boolean
  filteredCount: number
  onSearchChange: (search: string) => void
  onStatusFilterChange: (filter: CredentialStatusFilter) => void
  onProviderFilterChange: (provider: string) => void
  onAttentionOnlyChange: (attentionOnly: boolean) => void
  onWebsocketOnlyChange: (websocketOnly: boolean) => void
  onClearFilters: () => void
}) {
  const { i18n, t } = useTranslation()
  const providerCollator = new Intl.Collator(i18n.resolvedLanguage, {
    sensitivity: 'base',
    usage: 'sort',
  })
  const providers = Array.from(new Set(resources.map((resource) => resource.provider)))
    .map((provider) => ({
      id: provider,
      label: getCredentialProviderLabel(t, provider),
    }))
    .sort((left, right) => providerCollator.compare(left.label, right.label))
  const statusFilters: CredentialStatusFilter[] = ['all', 'active', 'disabled', 'unavailable']
  const activeQuickFilters = [
    ...(quotaAvailable && attentionOnly ? ['attention'] : []),
    ...(websocketOnly ? ['ws'] : []),
  ]
  const hasActiveFilters = hasCredentialFilters({
    search,
    statusFilter,
    providerFilter,
    quotaAvailable,
    attentionOnly,
    websocketOnly,
  })

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center">
      <div className="relative w-full min-w-0 lg:max-w-80 lg:flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          size="xl"
          className="pl-9"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('credentialsPage.list.filterPlaceholder')}
          aria-label={t('credentialsPage.list.filterPlaceholder')}
        />
      </div>
      <div className="grid w-full grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center lg:min-w-0 lg:flex-1">
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as CredentialStatusFilter)}
        >
          <SelectTrigger
            size="xl"
            className="w-full sm:w-40"
            aria-label={t('credentialsPage.filters.status')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((filter) => (
              <SelectItem key={filter} value={filter} className="min-h-11 sm:min-h-10">
                {t(`credentialsPage.statusFilters.${filter}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={providerFilter} onValueChange={onProviderFilterChange}>
          <SelectTrigger
            size="xl"
            className="w-full sm:w-52"
            aria-label={t('credentialsPage.filters.provider')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-11 sm:min-h-10">
              {t('credentialsPage.filters.allProviders')}
            </SelectItem>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id} className="min-h-11 sm:min-h-10">
                {provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToggleGroup
          type="multiple"
          value={activeQuickFilters}
          variant="outline"
          size="xl"
          className="col-span-full w-full justify-start border-0 bg-transparent p-0 shadow-none sm:w-auto"
          aria-label={t('credentialsPage.filters.quickFilters')}
          onValueChange={(values) => {
            onAttentionOnlyChange(quotaAvailable && values.includes('attention'))
            onWebsocketOnlyChange(values.includes('ws'))
          }}
        >
          {quotaAvailable ? (
            <ToggleGroupItem
              value="attention"
              className="data-[state=on]:border-warning/45 data-[state=on]:bg-warning/12 data-[state=on]:text-warning-foreground dark:data-[state=on]:text-warning"
            >
              {t('upstreamPage.quotaChips.attention')}
            </ToggleGroupItem>
          ) : null}
          <ToggleGroupItem value="ws">{t('upstreamPage.quotaChips.ws')}</ToggleGroupItem>
        </ToggleGroup>

        <div className="col-span-full flex min-h-10 min-w-0 items-center justify-between gap-2 sm:ml-auto">
          <p
            className="text-muted-foreground min-w-0 text-sm tabular-nums sm:text-xs"
            role="status"
            aria-live="polite"
          >
            {t('credentialsPage.filters.resultCount', {
              visible: filteredCount,
              total: resources.length,
            })}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="xl"
              className="px-2.5"
              onClick={onClearFilters}
            >
              {t('credentialsPage.filters.clear')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/*
 * The action column used to be measured per locale — 224px for Chinese, 260 for
 * English, 284 for Russian — because three labelled buttons only fit if you know
 * how long the labels are. A shared reserved width replaces the table: the labels
 * still differ, but the column no longer has to be tailored to them, and below
 * 40rem there are no labels in it at all.
 */
function CredentialList({
  resources,
  selectedResourceId,
  selectedResourceIds,
  mutating,
  cooldownResetSupported,
  quotaAvailable,
  quotaLoading,
  quotaRecollectAvailable,
  quotaSyncing,
  quotaTruncated,
  quotaMap,
  quotaCollectingIds,
  emptyState,
  onClearFilters,
  onClearCooldown,
  onCollectQuota,
  onDeleteResource,
  onDownloadResource,
  onOpenDrawer,
  onSaveInline,
  onToggleSelection,
  onToggleAll,
  onToggleStatus,
}: {
  resources: CredentialResource[]
  selectedResourceId: string | null
  selectedResourceIds: Set<string>
  mutating: boolean
  cooldownResetSupported: boolean
  quotaAvailable: boolean
  quotaLoading: boolean
  quotaRecollectAvailable: boolean
  quotaSyncing: boolean
  quotaTruncated: boolean
  quotaMap: Map<string, UpstreamQuotaEntry>
  quotaCollectingIds: Set<string>
  emptyState: 'empty' | 'filtered-empty'
  onClearFilters: () => void
  onClearCooldown: (resource: CredentialResource) => void
  onCollectQuota: (resource: CredentialResource) => void
  onDeleteResource: (resource: CredentialResource) => void
  onDownloadResource: (resource: CredentialResource) => void
  onOpenDrawer: (resource: CredentialResource, tab: CredentialDrawerTab) => void
  onSaveInline: InlineMetadataSave
  onToggleSelection: (resource: CredentialResource) => void
  onToggleAll: () => void
  onToggleStatus: (resource: CredentialResource, disabled: boolean) => void
}) {
  const { t } = useTranslation()
  /*
   * Provider, quota, websockets and priority all live in the detail drawer the
   * eye opens. What cannot move there is which credential a row is and whether it
   * is currently serving traffic, so those two are what a phone keeps.
   */
  const showSecondary = useSecondaryColumns()
  const allSelected =
    resources.length > 0 && resources.every((resource) => selectedResourceIds.has(resource.id))
  const partiallySelected =
    !allSelected && resources.some((resource) => selectedResourceIds.has(resource.id))

  if (resources.length === 0) {
    const filtered = emptyState === 'filtered-empty'
    return (
      <TableEmptyState
        kind={emptyState}
        className="m-0"
        title={t(
          filtered ? 'credentialsPage.list.filteredEmptyTitle' : 'credentialsPage.list.emptyTitle',
        )}
        description={t(
          filtered
            ? 'credentialsPage.list.filteredEmptyDescription'
            : 'credentialsPage.list.emptyDescription',
        )}
        action={
          filtered ? (
            <Button type="button" variant="outline" size="xl" onClick={onClearFilters}>
              {t('credentialsPage.filters.clear')}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <Table
      containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
      className="table-fixed sm:min-w-[1350px]"
    >
      {/*
        The identity column is the one given `auto`: in a fixed layout the
        remaining width lands on it, so the table fits any viewport without a
        min-width floor and the cell still truncates. Status keeps a fixed width
        so the two do not split the remainder between them.
      */}
      <colgroup>
        <col className="w-[44px]" />
        <col className={showSecondary ? 'w-[250px]' : undefined} />
        {showSecondary ? (
          <>
            <col className="w-[118px]" />
            <col className="w-[150px]" />
          </>
        ) : (
          /* Status carries a switch as well as a badge, so it cannot go as narrow
             as a label. Below 40rem the two stack instead of sitting side by side,
             which trades a little height for the width the identity column needs. */
          <col className="w-24" />
        )}
        {showSecondary ? (
          <>
            <col className="w-[232px]" />
            <col className="w-[96px]" />
            <col className="w-[120px]" />
            <col className="w-[112px]" />
          </>
        ) : null}
        <col className="table-action-column-3" />
      </colgroup>
      <TableHeader className={stickyTableHeaderClassName}>
        <TableRow variant="static">
          <TableHead>
            <Checkbox
              checked={partiallySelected ? 'indeterminate' : allSelected}
              aria-label={t('credentialsPage.bulk.selectAll')}
              disabled={mutating}
              onCheckedChange={onToggleAll}
            />
          </TableHead>
          <TableHead>{t('credentialsPage.list.credential')}</TableHead>
          {showSecondary ? <TableHead>{t('credentialsPage.list.provider')}</TableHead> : null}
          <TableHead>{t('credentialsPage.list.enabled')}</TableHead>
          {showSecondary ? (
            <>
              <TableHead>{t('credentialsPage.list.quota')}</TableHead>
              <TableHead>{t('credentialsPage.list.ws')}</TableHead>
              <TableHead>{t('credentialsPage.list.cooling')}</TableHead>
              <TableHead>{t('credentialsPage.list.priority')}</TableHead>
            </>
          ) : null}
          <TableHead className="table-sticky-action-head table-action-column-3 text-right">
            {t('credentialsPage.list.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => {
          const statusTone = getCredentialStatusTone(resource)
          const displayName = getCredentialDisplayName(resource)
          const providerLabel = getCredentialProviderLabel(t, resource.provider)
          const quotaAction = resolveCredentialQuotaAction({
            resource,
            entry: findUpstreamQuotaEntry(quotaMap, resource),
            available: quotaAvailable && quotaRecollectAvailable,
            collecting: quotaSyncing || quotaCollectingIds.has(getCredentialQuotaId(resource)),
          })
          const quotaBlocked = ['disabled', 'unsupported', 'unavailable'].includes(quotaAction)

          return (
            <TableRow
              key={resource.id}
              className={cn('group', resource.id === selectedResourceId ? 'bg-primary/8' : null)}
              variant="resource"
            >
              <TableCell>
                <Checkbox
                  checked={selectedResourceIds.has(resource.id)}
                  aria-label={t('credentialsPage.bulk.selectOne', {
                    name: displayName,
                  })}
                  disabled={mutating}
                  onCheckedChange={() => onToggleSelection(resource)}
                  onClick={(event) => event.stopPropagation()}
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                    <FileJson className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{displayName}</p>
                    <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                      {resource.name ?? resource.authIndex ?? resource.identifier}
                    </p>
                    {resource.note ? (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {resource.note}
                      </p>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              {showSecondary ? (
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
                      {providerLabel}
                    </span>
                    {resource.type ? (
                      <span className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs">
                        {resource.type}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
              ) : null}
              <TableCell>
                <div
                  className={cn(
                    'flex min-w-0 gap-2',
                    showSecondary ? 'items-center' : 'flex-col items-start',
                  )}
                >
                  <Switch
                    checked={!resource.disabled}
                    disabled={mutating}
                    aria-label={t('credentialsPage.list.toggleStatus', {
                      name: displayName,
                    })}
                    onCheckedChange={(checked) => onToggleStatus(resource, !checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span
                    className={cn(
                      'inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                      statusTone === 'positive'
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : statusTone === 'warning'
                          ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
                          : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {statusTone === 'warning' ? (
                      <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">
                      {resource.disabled
                        ? t('credentialsPage.status.disabled')
                        : resource.unavailable
                          ? t('credentialsPage.status.unavailable')
                          : t(`credentialsPage.status.${resource.status}`, {
                              defaultValue: resource.status,
                            })}
                    </span>
                  </span>
                </div>
              </TableCell>
              {showSecondary ? (
                <>
                  <TableCell>
                    <UpstreamQuotaCell
                      collecting={quotaAction === 'collecting'}
                      unavailableReason={
                        quotaBlocked ? t(`upstreamPage.quota.actions.${quotaAction}`) : undefined
                      }
                      state={resolveUpstreamQuotaCellState({
                        available: quotaAvailable,
                        loading: quotaLoading,
                        truncated: quotaTruncated,
                        map: quotaMap,
                        resource,
                      })}
                    />
                  </TableCell>
                  <TableCell>
                    <WebsocketsCell resource={resource} mutating={mutating} onSave={onSaveInline} />
                  </TableCell>
                  <TableCell>
                    <CoolingCell resource={resource} mutating={mutating} onSave={onSaveInline} />
                  </TableCell>
                  <TableCell>
                    {resource.priority === null ? (
                      <span className="text-muted-foreground text-xs">
                        {t('credentialsPage.status.notSet')}
                      </span>
                    ) : (
                      <span className="font-mono text-xs font-medium tabular-nums">
                        {resource.priority}
                      </span>
                    )}
                  </TableCell>
                </>
              ) : null}
              <TableCell className="table-sticky-action-cell table-action-column-3 pl-4 text-right transition-colors">
                <RowActions
                  menuLabel={displayName}
                  actions={[
                    {
                      id: 'detail',
                      label: t('credentialsPage.actions.detail'),
                      icon: Eye,
                      onSelect: () => onOpenDrawer(resource, 'overview'),
                    },
                    {
                      id: 'download',
                      label: t('credentialsPage.actions.download'),
                      icon: Download,
                      disabled: mutating,
                      onSelect: () => onDownloadResource(resource),
                    },
                    !quotaBlocked
                      ? {
                          id: 'collect-quota',
                          label: t(`upstreamPage.quota.actions.${quotaAction}`),
                          ariaLabel: `${t(`upstreamPage.quota.actions.${quotaAction}`)}: ${displayName}`,
                          icon: RefreshCw,
                          busy: quotaAction === 'collecting',
                          disabled: mutating,
                          onSelect: () => onCollectQuota(resource),
                        }
                      : null,
                    cooldownResetSupported && getCredentialCooldownId(resource) !== null
                      ? {
                          id: 'clear-cooldown',
                          label: t('credentialsPage.actions.clearCooldown'),
                          ariaLabel: t('credentialsPage.actions.clearCooldownFor', {
                            name: displayName,
                          }),
                          icon: TimerReset,
                          disabled: mutating,
                          onSelect: () => onClearCooldown(resource),
                        }
                      : null,
                    {
                      id: 'delete',
                      label: t('credentialsPage.actions.delete'),
                      icon: Trash2,
                      tone: 'destructive',
                      disabled: mutating,
                      onSelect: () => onDeleteResource(resource),
                    },
                  ]}
                />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function AccountsPanel({
  initialCredentialId,
  initialSearch = '',
  onSearchChange,
  attentionOnly = false,
  websocketOnly = false,
  onAttentionOnlyChange,
  onWebsocketOnlyChange,
  quotaAvailable = false,
  quotaLoading = false,
  quotaTruncated = false,
  quotaMap,
  quotaRecollectAvailable = false,
  quotaSyncing = false,
  quotaCollectingIds = EMPTY_QUOTA_COLLECTING_IDS,
  onCollectQuota,
  onStatsChange,
}: {
  initialCredentialId?: string
  initialSearch?: string
  onSearchChange?: (search: string) => void
  attentionOnly?: boolean
  websocketOnly?: boolean
  onAttentionOnlyChange?: (attentionOnly: boolean) => void
  onWebsocketOnlyChange?: (websocketOnly: boolean) => void
  quotaAvailable?: boolean
  quotaLoading?: boolean
  quotaTruncated?: boolean
  quotaMap?: Map<string, UpstreamQuotaEntry>
  quotaRecollectAvailable?: boolean
  quotaSyncing?: boolean
  quotaCollectingIds?: Set<string>
  onCollectQuota?: (resource: CredentialResource) => Promise<void>
  onStatsChange?: (stats: UpstreamAccountsStats) => void
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const workbench = useCredentialWorkbench()
  const [statusFilter, setStatusFilter] = useState<CredentialStatusFilter>('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [search, setSearch] = useState(initialSearch)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(() => new Set())
  const [drawerTab, setDrawerTab] = useState<CredentialDrawerTab>('overview')
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [oauthSessions, setOAuthSessions] = useState<OAuthSessionMap>({})
  const [oauthStatuses, setOAuthStatuses] = useState<OAuthStatusMap>({})
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateCredentialMode>('oauth')
  const [uploadItems, setUploadItems] = useState<CredentialUploadItem[]>([])
  const [confirmation, setConfirmation] = useState<PendingCredentialConfirmation | null>(null)
  const autoOpenedCredentialRef = useRef<string | null>(null)
  const oauthPollTokenRef = useRef(0)
  const oauthFlowCompletingRef = useRef(false)

  // Bump the poll token so any in-flight OAuth status loop exits.
  const stopOAuthStatusPolling = () => {
    oauthPollTokenRef.current += 1
  }

  useEffect(() => {
    return () => {
      oauthPollTokenRef.current += 1
    }
  }, [])

  const resolvedQuotaMap = quotaMap ?? EMPTY_QUOTA_MAP
  const resources = workbench.snapshot?.resources ?? EMPTY_CREDENTIAL_RESOURCES
  const inFlightByCredentialId = useMemo(() => {
    const observed = new Map(
      (workbench.inFlightSnapshot?.items ?? []).map((item) => [item.credentialId, item]),
    )
    const limiter = new Map(
      (workbench.concurrencySnapshot?.items ?? []).map((item) => [item.credentialId, item]),
    )
    const credentialIds = new Set([...observed.keys(), ...limiter.keys()])
    const merged = new Map<string, CredentialInFlightSummary>()
    for (const credentialId of credentialIds) {
      const summary = mergeCredentialConcurrencySummary(
        observed.get(credentialId) ?? null,
        limiter.get(credentialId) ?? null,
      )
      if (summary) merged.set(credentialId, summary)
    }
    return merged
  }, [workbench.concurrencySnapshot, workbench.inFlightSnapshot])
  const concurrencyErrorMessage = [
    workbench.inFlightErrorMessage,
    workbench.concurrencyErrorMessage,
  ]
    .filter(
      (message, index, messages): message is string =>
        Boolean(message) && messages.indexOf(message) === index,
    )
    .join(' · ')
  const filteredResources = useMemo(() => {
    return filterCredentialResources(resources, resolvedQuotaMap, {
      search,
      statusFilter,
      providerFilter,
      quotaAvailable,
      attentionOnly,
      websocketOnly,
    })
  }, [
    attentionOnly,
    providerFilter,
    quotaAvailable,
    resolvedQuotaMap,
    resources,
    search,
    statusFilter,
    websocketOnly,
  ])
  const hasActiveFilters = hasCredentialFilters({
    search,
    statusFilter,
    providerFilter,
    quotaAvailable,
    attentionOnly,
    websocketOnly,
  })
  const selectedResource =
    filteredResources.find((resource) => resource.id === selectedResourceId) ??
    resources.find((resource) => resource.id === selectedResourceId) ??
    null
  const selectedResources = resources.filter((resource) => selectedResourceIds.has(resource.id))
  const selectedDisabledCount = selectedResources.filter((resource) => resource.disabled).length
  const selectedEnabledCount = selectedResources.length - selectedDisabledCount
  const uploadInProgress = uploadItems.some(
    (item) => item.status === 'queued' || item.status === 'uploading',
  )

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setProviderFilter('all')
    onSearchChange?.('')
    onAttentionOnlyChange?.(false)
    onWebsocketOnlyChange?.(false)
  }

  useEffect(() => {
    setSearch((current) => (current === initialSearch ? current : initialSearch))
  }, [initialSearch])

  useEffect(() => {
    if (
      providerFilter !== 'all' &&
      !resources.some((resource) => resource.provider === providerFilter)
    ) {
      setProviderFilter('all')
    }
  }, [providerFilter, resources])

  useEffect(() => {
    if (
      !initialCredentialId ||
      resources.length === 0 ||
      autoOpenedCredentialRef.current === initialCredentialId
    ) {
      return
    }

    autoOpenedCredentialRef.current = initialCredentialId
    const resource = findCredentialRouteResource(resources, initialCredentialId, initialSearch)
    if (!resource) return

    setSelectedResourceId(resource.id)
    setDrawerTab('overview')
    setDetailSheetOpen(true)
  }, [initialCredentialId, initialSearch, resources])

  useEffect(() => {
    if (selectedResourceId && !resources.some((resource) => resource.id === selectedResourceId)) {
      setSelectedResourceId(null)
      setDrawerTab('overview')
      setDetailSheetOpen(false)
    }
  }, [resources, selectedResourceId])

  useEffect(() => {
    const resourceIds = new Set(resources.map((resource) => resource.id))
    setSelectedResourceIds((current) => {
      const nextSelection = new Set(
        Array.from(current).filter((resourceId) => resourceIds.has(resourceId)),
      )

      return nextSelection.size === current.size ? current : nextSelection
    })
  }, [resources])

  useEffect(() => {
    if (!workbench.snapshot) return
    onStatsChange?.({
      total: resources.length,
      active: resources.filter((resource) => !resource.disabled && !resource.unavailable).length,
      disabled: resources.filter((resource) => resource.disabled).length,
      unavailable: resources.filter((resource) => resource.unavailable).length,
      websockets: resources.filter((resource) => resource.websockets).length,
      attention: countUpstreamQuotaAttentionResources(resources, resolvedQuotaMap),
    })
  }, [onStatsChange, resolvedQuotaMap, resources, workbench.snapshot])

  if (workbench.checking) {
    return <CredentialLoadingState />
  }

  if (!workbench.connected) {
    return <CredentialDisconnectedState />
  }

  if (workbench.isPending) {
    return <CredentialLoadingState />
  }

  if (workbench.isError || !workbench.snapshot) {
    return (
      <CredentialErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
    )
  }

  const updateUploadItem = (itemId: string, patch: Partial<CredentialUploadItem>) => {
    setUploadItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    )
  }

  const runCredentialUploads = async (items: CredentialUploadItem[]) => {
    if (items.length === 0) return

    let nextIndex = 0
    let successfulUploads = 0
    const worker = async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex]
        nextIndex += 1
        updateUploadItem(item.id, {
          status: 'uploading',
          progress: 0,
          resultName: null,
          errorCode: null,
        })

        try {
          const result = await workbench.uploadCredential(item.file, (progress) => {
            updateUploadItem(item.id, { progress })
          })
          successfulUploads += 1
          updateUploadItem(item.id, {
            status: 'success',
            progress: 100,
            resultName: result.files[0] ?? item.file.name,
            errorCode: null,
          })
        } catch (error) {
          updateUploadItem(item.id, {
            status: 'error',
            progress: 0,
            resultName: null,
            errorCode: classifyCredentialUploadError(error),
          })
        }
      }
    }
    const workerCount = Math.min(MAX_CONCURRENT_CREDENTIAL_UPLOADS, items.length)

    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    if (successfulUploads > 0) {
      await workbench.refreshCredentials()
    }
  }

  const handleUpload = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (files.length === 0) return

    const items = files.map(createCredentialUploadItem)
    setUploadItems((current) => [...current, ...items])
    const validationResults = await Promise.all(
      items.map(async (item) => ({
        item,
        errorCode: await validateCredentialUploadFile(item.file),
      })),
    )
    const uploadableItems: CredentialUploadItem[] = []

    validationResults.forEach(({ item, errorCode }) => {
      if (errorCode) {
        updateUploadItem(item.id, { status: 'error', errorCode })
      } else {
        uploadableItems.push(item)
      }
    })

    await runCredentialUploads(uploadableItems)
  }

  const handleRetryUpload = async (item: CredentialUploadItem) => {
    await runCredentialUploads([item])
  }

  const handleRetryFailedUploads = async () => {
    await runCredentialUploads(
      uploadItems.filter(
        (item) => item.status === 'error' && isCredentialUploadRetryable(item.errorCode),
      ),
    )
  }

  const handleCreateSheetOpenChange = (open: boolean) => {
    if (!open && uploadInProgress) return

    setCreateSheetOpen(open)
    if (!open) {
      // Reset the OAuth flow so reopening never shows a stale authorization page.
      stopOAuthStatusPolling()
      setOAuthSessions({})
      setOAuthStatuses({})
      setUploadItems([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (resource = selectedResource) => {
    if (!resource) return

    try {
      const result = await workbench.downloadCredential(resource)
      downloadBlob(result.blob, result.fileName)
      toast.success(t('credentialsPage.toast.downloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleClearCooldown = async (resource: CredentialResource) => {
    try {
      const result = await workbench.clearCooldown(resource)
      toast[result.cleared ? 'success' : 'info'](
        result.cleared
          ? t('credentialsPage.toast.cooldownCleared')
          : t('credentialsPage.toast.cooldownNotActive'),
      )
    } catch (error) {
      if (matchesCredentialBackendError(error, 503, 'cooldown_reset_unavailable')) {
        toast.error(t('credentialsPage.toast.cooldownResetUnavailable'))
        return
      }
      if (matchesCredentialBackendError(error, 404, 'credential_not_found')) {
        toast.error(t('credentialsPage.toast.cooldownCredentialMissing'))
        return
      }
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleSetStatus = async (resource: CredentialResource, disabled: boolean) => {
    try {
      await workbench.updateStatus({
        resource,
        disabled,
      })
      toast.success(t('credentialsPage.toast.statusUpdated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleToggleStatus = async (resource = selectedResource) => {
    if (!resource) return
    await handleSetStatus(resource, !resource.disabled)
  }

  const handleToggleSelection = (resource: CredentialResource) => {
    setSelectedResourceIds((current) => {
      const nextSelection = new Set(current)

      if (nextSelection.has(resource.id)) {
        nextSelection.delete(resource.id)
      } else {
        nextSelection.add(resource.id)
      }

      return nextSelection
    })
  }

  const handleToggleAll = () => {
    setSelectedResourceIds((current) => {
      const everyFilteredResourceSelected = filteredResources.every((resource) =>
        current.has(resource.id),
      )
      const nextSelection = new Set(current)

      for (const resource of filteredResources) {
        if (everyFilteredResourceSelected) {
          nextSelection.delete(resource.id)
        } else {
          nextSelection.add(resource.id)
        }
      }

      return nextSelection
    })
  }

  const handleBulkStatus = async (disabled: boolean) => {
    if (selectedResources.length === 0) return

    try {
      await workbench.bulkUpdateStatus({
        resources: selectedResources,
        disabled,
      })
      toast.success(
        t(disabled ? 'credentialsPage.toast.bulkDisabled' : 'credentialsPage.toast.bulkEnabled', {
          count: selectedResources.length,
        }),
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDelete = (resource = selectedResource) => {
    if (!resource) return
    setConfirmation({ type: 'delete', resource })
  }

  const handleBulkDelete = () => {
    if (selectedResources.length === 0) return
    setConfirmation({ type: 'bulkDelete', resources: selectedResources })
  }

  const handleConfirmAction = async () => {
    const currentConfirmation = confirmation
    if (!currentConfirmation) return

    try {
      if (currentConfirmation.type === 'delete') {
        await workbench.deleteCredential(currentConfirmation.resource)
        toast.success(t('credentialsPage.toast.deleted'))
        setSelectedResourceIds((current) => {
          const nextSelection = new Set(current)
          nextSelection.delete(currentConfirmation.resource.id)
          return nextSelection
        })
        if (selectedResourceId === currentConfirmation.resource.id) {
          setSelectedResourceId(null)
          setDetailSheetOpen(false)
        }
      } else {
        await workbench.bulkDeleteCredentials(currentConfirmation.resources)
        toast.success(
          t('credentialsPage.toast.bulkDeleted', {
            count: currentConfirmation.resources.length,
          }),
        )
        setSelectedResourceIds(new Set())
        if (
          selectedResourceId &&
          currentConfirmation.resources.some((resource) => resource.id === selectedResourceId)
        ) {
          setSelectedResourceId(null)
          setDetailSheetOpen(false)
        }
      }

      setDrawerTab('overview')
      setConfirmation(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleMetadataUpdate = async (input: CredentialMetadataPatch) => {
    if (!selectedResource) return
    await workbench.updateMetadata({
      resource: selectedResource,
      input,
    })
    toast.success(t('credentialsPage.toast.updated'))
  }

  const handleInlineMetadataSave: InlineMetadataSave = async (resource, patch) => {
    await workbench.updateMetadata({
      resource,
      input: patch,
    })
  }

  const handleFetchModels = async () => {
    if (!selectedResource) return

    try {
      await workbench.fetchModels(selectedResource)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleOAuthFlowComplete = async () => {
    // A manual status check can resolve after the polling loop already
    // completed the flow; run the completion only once.
    if (oauthFlowCompletingRef.current) return
    oauthFlowCompletingRef.current = true

    try {
      stopOAuthStatusPolling()
      // The credential file exists once the backend reports ok, so refresh the
      // list, close the sheet, and drop the finished flow instead of leaving it
      // around for the next open.
      await workbench.refreshCredentials()
      toast.success(t('credentialsPage.toast.oauthCompleted'))
      setCreateSheetOpen(false)
      setOAuthSessions({})
      setOAuthStatuses({})
    } finally {
      oauthFlowCompletingRef.current = false
    }
  }

  const pollOAuthStatusUntilSettled = async (provider: CredentialOAuthProvider, state: string) => {
    const token = ++oauthPollTokenRef.current
    let consecutiveErrors = 0

    for (let attempt = 0; attempt < OAUTH_STATUS_POLL_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await workbench.checkOAuthStatus(state)
        if (token !== oauthPollTokenRef.current) return

        consecutiveErrors = 0
        setOAuthStatuses((current) => ({ ...current, [provider]: result }))
        if (isCredentialOAuthSuccess(result.status)) {
          await handleOAuthFlowComplete()
          return
        }
        if (isCredentialOAuthFailure(result.status)) {
          toast.error(result.error ?? result.status)
          return
        }
      } catch (error) {
        if (token !== oauthPollTokenRef.current) return

        // Tolerate transient request failures; only give up after several in a row.
        consecutiveErrors += 1
        if (consecutiveErrors >= OAUTH_STATUS_POLL_MAX_CONSECUTIVE_ERRORS) {
          toast.error(error instanceof Error ? error.message : String(error))
          return
        }
      }

      await new Promise((resolve) => setTimeout(resolve, OAUTH_STATUS_POLL_INTERVAL_MS))
    }

    if (token !== oauthPollTokenRef.current) return
    toast.info(t('credentialsPage.toast.oauthPollingStopped'))
  }

  const handleStartOAuth = async (provider: CredentialOAuthProvider) => {
    stopOAuthStatusPolling()
    try {
      const result = await workbench.startOAuth({
        provider,
      })
      setOAuthSessions((current) => ({ ...current, [provider]: result }))
      setOAuthStatuses((current) => {
        const next = { ...current }
        delete next[provider]
        return next
      })
      toast.success(t('credentialsPage.toast.oauthStarted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleCheckOAuthStatus = async (provider: CredentialOAuthProvider, state: string) => {
    const result = await workbench.checkOAuthStatus(state)
    setOAuthStatuses((current) => ({ ...current, [provider]: result }))
    if (isCredentialOAuthSuccess(result.status)) {
      await handleOAuthFlowComplete()
      return
    }
    toast.success(
      t('credentialsPage.toast.oauthStatusChecked', {
        status: t(`credentialsPage.oauth.statuses.${result.status}`, {
          defaultValue: result.status,
        }),
      }),
    )
  }

  const handleSubmitOAuthCallback = async (input: CredentialOAuthCallbackInput) => {
    await workbench.submitOAuthCallback(input)
    toast.success(t('credentialsPage.toast.oauthCallbackSubmitted'))

    // The backend exchanges the code asynchronously; poll the status instead
    // of making the user click through the manual check.
    const state = resolveCredentialOAuthCallbackState(input)
    if (!state) return
    setOAuthStatuses((current) => ({
      ...current,
      [input.provider]: { status: 'wait', error: null },
    }))
    void pollOAuthStatusUntilSettled(input.provider, state)
  }

  const handleImportVertex = async (input: { file: File; location: string }) => {
    await workbench.importVertexCredential(input)
    toast.success(t('credentialsPage.toast.vertexImported'))
  }

  const confirmationCopy =
    confirmation?.type === 'delete'
      ? {
          title: t('credentialsPage.delete.title'),
          description: t('credentialsPage.delete.confirm', {
            name: getCredentialDisplayName(confirmation.resource),
          }),
          action: t('credentialsPage.actions.delete'),
        }
      : confirmation?.type === 'bulkDelete'
        ? {
            title: t('credentialsPage.bulk.deleteTitle'),
            description: t('credentialsPage.bulk.deleteConfirm', {
              count: confirmation.resources.length,
            }),
            action: t('credentialsPage.bulk.deleteSelected'),
          }
        : null

  return (
    <section className="grid w-full gap-4">
      <TableSurface className="min-w-0">
        <TableSurfaceHeader
          title={t('credentialsPage.list.title')}
          actions={
            <Button
              size="md"
              disabled={workbench.mutating}
              onClick={() => setCreateSheetOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('credentialsPage.actions.addCredential')}
            </Button>
          }
          actionsClassName="w-full md:w-auto"
        />
        <AccountsToolbar
          resources={resources}
          search={search}
          statusFilter={statusFilter}
          providerFilter={providerFilter}
          quotaAvailable={quotaAvailable}
          attentionOnly={attentionOnly}
          websocketOnly={websocketOnly}
          filteredCount={filteredResources.length}
          onSearchChange={(value) => {
            setSearch(value)
            onSearchChange?.(value)
          }}
          onStatusFilterChange={setStatusFilter}
          onProviderFilterChange={setProviderFilter}
          onAttentionOnlyChange={(value) => onAttentionOnlyChange?.(value)}
          onWebsocketOnlyChange={(value) => onWebsocketOnlyChange?.(value)}
          onClearFilters={handleClearFilters}
        />
        <TableSurfaceContent>
          {selectedResourceIds.size > 0 ? (
            <div className="bg-muted/60 mb-3 flex flex-col gap-3 rounded-md border px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t('credentialsPage.bulk.selected', { count: selectedResourceIds.size })}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t('credentialsPage.bulk.selectedSummary', {
                    enabled: selectedEnabledCount,
                    disabled: selectedDisabledCount,
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="text"
                  size="md"
                  disabled={workbench.mutating}
                  onClick={() => setSelectedResourceIds(new Set())}
                >
                  {t('credentialsPage.bulk.clearSelection')}
                </Button>
                <Button
                  variant="text"
                  size="md"
                  disabled={workbench.mutating || selectedDisabledCount === 0}
                  onClick={() => void handleBulkStatus(false)}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t('credentialsPage.bulk.enableSelected')}
                </Button>
                <Button
                  variant="text"
                  size="md"
                  disabled={workbench.mutating || selectedEnabledCount === 0}
                  onClick={() => void handleBulkStatus(true)}
                >
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  {t('credentialsPage.bulk.disableSelected')}
                </Button>
                <Button
                  variant="destructiveText"
                  size="md"
                  disabled={workbench.mutating}
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t('credentialsPage.bulk.deleteSelected')}
                </Button>
              </div>
            </div>
          ) : null}
          <CredentialList
            resources={filteredResources}
            selectedResourceId={selectedResourceId}
            selectedResourceIds={selectedResourceIds}
            mutating={workbench.mutating}
            cooldownResetSupported={workbench.credentialCooldownReset}
            quotaAvailable={quotaAvailable}
            quotaLoading={quotaLoading}
            quotaRecollectAvailable={quotaRecollectAvailable && Boolean(onCollectQuota)}
            quotaSyncing={quotaSyncing}
            quotaTruncated={quotaTruncated}
            quotaMap={resolvedQuotaMap}
            quotaCollectingIds={quotaCollectingIds}
            emptyState={resources.length > 0 && hasActiveFilters ? 'filtered-empty' : 'empty'}
            onClearFilters={handleClearFilters}
            onCollectQuota={(resource) => void onCollectQuota?.(resource)}
            onClearCooldown={(resource) => void handleClearCooldown(resource)}
            onDeleteResource={(resource) => {
              handleDelete(resource)
            }}
            onDownloadResource={(resource) => void handleDownload(resource)}
            onOpenDrawer={(resource, tab) => {
              setSelectedResourceId(resource.id)
              setDrawerTab(tab)
              setDetailSheetOpen(true)
            }}
            onSaveInline={handleInlineMetadataSave}
            onToggleSelection={handleToggleSelection}
            onToggleAll={handleToggleAll}
            onToggleStatus={(resource, disabled) => {
              void handleSetStatus(resource, disabled)
            }}
          />
          {quotaAvailable && quotaTruncated ? (
            <p className="text-muted-foreground mt-3 text-xs leading-5">
              {t('upstreamPage.quota.truncated', { count: upstreamQuotaListLimit })}
            </p>
          ) : null}
        </TableSurfaceContent>
      </TableSurface>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {selectedResource ? (
            <CredentialDetailDrawer
              resource={selectedResource}
              open={detailSheetOpen}
              tab={drawerTab}
              mutating={workbench.mutating}
              models={workbench.models}
              quotaEntry={findUpstreamQuotaEntry(resolvedQuotaMap, selectedResource)}
              quotaRecollectAvailable={quotaRecollectAvailable && Boolean(onCollectQuota)}
              quotaCollecting={
                quotaSyncing || quotaCollectingIds.has(getCredentialQuotaId(selectedResource))
              }
              onCollectQuota={() => void onCollectQuota?.(selectedResource)}
              showConcurrency={
                workbench.credentialInFlight || workbench.credentialConcurrencyLimits
              }
              observationAvailable={workbench.credentialInFlight}
              canEditConcurrency={workbench.credentialConcurrencyLimits}
              inFlightSummary={
                inFlightByCredentialId.get(getCredentialInFlightId(selectedResource)) ?? null
              }
              inFlightObservation={workbench.inFlightSnapshot}
              concurrencyPending={
                (workbench.credentialInFlight && workbench.inFlightPending) ||
                (workbench.credentialConcurrencyLimits && workbench.concurrencyPending)
              }
              concurrencyStale={workbench.inFlightStale || workbench.concurrencyStale}
              concurrencyErrorMessage={concurrencyErrorMessage || null}
              onTabChange={setDrawerTab}
              onUpdateMetadata={handleMetadataUpdate}
              onToggleStatus={() => handleToggleStatus(selectedResource)}
              onFetchModels={handleFetchModels}
              onDownload={() => handleDownload(selectedResource)}
              onDelete={() => {
                setDetailSheetOpen(false)
                handleDelete(selectedResource)
              }}
            />
          ) : (
            <SheetHeader className="border-b p-5">
              <SheetTitle>{t('credentialsPage.detail.title')}</SheetTitle>
              <SheetDescription>{t('credentialsPage.detail.empty')}</SheetDescription>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>

      <CreateCredentialSheet
        open={createSheetOpen}
        mode={createMode}
        fileInputRef={fileInputRef}
        oauthProviders={workbench.oauthProviders}
        oauthSessions={oauthSessions}
        oauthStatuses={oauthStatuses}
        vertexImportResult={workbench.vertexImportResult}
        mutating={workbench.mutating}
        uploadItems={uploadItems}
        uploadInProgress={uploadInProgress}
        onOpenChange={handleCreateSheetOpenChange}
        onModeChange={setCreateMode}
        onUpload={handleUpload}
        onRetryUpload={handleRetryUpload}
        onRetryFailedUploads={handleRetryFailedUploads}
        onRemoveUploadResult={(itemId) => {
          setUploadItems((current) => current.filter((item) => item.id !== itemId))
        }}
        onClearUploadResults={() => setUploadItems([])}
        onStartOAuth={handleStartOAuth}
        onCheckOAuthStatus={handleCheckOAuthStatus}
        onSubmitOAuthCallback={handleSubmitOAuthCallback}
        onImportVertex={handleImportVertex}
      />

      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !workbench.mutating) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmAction()
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {confirmationCopy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
