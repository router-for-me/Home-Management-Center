import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { Copy, Loader2, Plus, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DrawerScaffoldBody,
  DrawerScaffoldContent,
  DrawerScaffoldFooter,
  DrawerScaffoldHeader,
} from '@/components/shared/drawer-scaffold'
import { TableEmptyState } from '@/components/shared/empty-state'
import { RowActions } from '@/components/shared/row-actions'
import { useSecondaryColumns } from '@/components/shared/table-columns'
import {
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
import { useProxyPoolsWorkbench } from '@/features/config/use-proxy-pools-workbench'
import type { ProxyPoolInput, ProxyPoolItem } from '@/lib/api/management/proxy-pools'
import { cn } from '@/lib/utils'

type ProxyPoolSheetMode = { type: 'create' } | { type: 'edit'; resource: ProxyPoolItem }

function formatDateTime(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function maskProxyUrl(value: string) {
  if (value.length <= 48) return value
  return `${value.slice(0, 24)}...${value.slice(-16)}`
}

function isValidProxyUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'socks5:', 'socks5h:'].includes(url.protocol)
  } catch {
    return false
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

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
  }
}

function InlineNotice({ message, fallback }: { message: string | null; fallback: string }) {
  const showDetail = Boolean(message && message !== fallback)

  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
      <div>{fallback}</div>
      {showDetail ? <div className="mt-1 font-mono text-xs opacity-80">{message}</div> : null}
    </div>
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

function CompactDrawerFormBody({ children }: { children: ReactNode }) {
  return (
    <DrawerScaffoldBody className="p-4 sm:p-5">
      <div className="grid w-full gap-4">{children}</div>
    </DrawerScaffoldBody>
  )
}

function ReadOnlySummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <span className="text-muted-foreground min-w-0 truncate">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  )
}

function ProxyRecordStatusBadge({ enabled }: { enabled: boolean }) {
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
      {enabled
        ? t('configPage.proxyPools.common.enabled')
        : t('configPage.proxyPools.common.disabled')}
    </span>
  )
}

function ProxyTestResultBadge({ result }: { result: ProxyPoolItem['lastTestResult'] }) {
  const { t } = useTranslation()
  const classes =
    result === 'passed'
      ? 'border-success/30 bg-success/10 text-success'
      : result === 'failed'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border bg-muted/45 text-muted-foreground'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        classes,
      )}
    >
      {t(`configPage.proxyPools.testResults.${result}`)}
    </span>
  )
}

function ProxyPoolSheet({
  mode,
  mutating,
  onCancel,
  onSubmit,
}: {
  mode: ProxyPoolSheetMode
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
      nextFieldErrors.name = t('configPage.proxyPools.validation.nameRequired')
    }
    if (!input.proxyUrl.trim()) {
      nextFieldErrors.proxyUrl = t('configPage.proxyPools.validation.urlRequired')
    } else if (!isValidProxyUrl(input.proxyUrl.trim())) {
      nextFieldErrors.proxyUrl = t('configPage.proxyPools.validation.urlInvalid')
    }
    if (!Number.isInteger(input.priority)) {
      nextFieldErrors.priority = t('configPage.proxyPools.validation.priorityInvalid')
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
      setError(
        error instanceof Error ? error.message : t('configPage.proxyPools.toast.actionFailed'),
      )
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
      <CompactDrawerFormBody>
        <section className="grid gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('configPage.proxyPools.form.identity')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('configPage.proxyPools.form.identityHint')}
            </p>
          </div>
          <CompactField label={t('configPage.proxyPools.form.name')} error={fieldErrors.name}>
            <Input
              value={input.name}
              aria-label={t('configPage.proxyPools.form.name')}
              aria-invalid={Boolean(fieldErrors.name)}
              disabled={mutating}
              onChange={(event) => {
                setInput((current) => ({ ...current, name: event.target.value }))
                setFieldErrors((current) => ({ ...current, name: undefined }))
              }}
            />
          </CompactField>
          <CompactField
            label={t('configPage.proxyPools.form.url')}
            hint={t('configPage.proxyPools.form.urlHint')}
            error={fieldErrors.proxyUrl}
          >
            <Input
              value={input.proxyUrl}
              aria-label={t('configPage.proxyPools.form.url')}
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
            <h3 className="text-sm font-semibold">{t('configPage.proxyPools.form.recordState')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('configPage.proxyPools.form.recordStateHint')}
            </p>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2">
            <CompactField label={t('configPage.proxyPools.form.enabled')}>
              <Select
                value={input.enabled ? 'enabled' : 'disabled'}
                onValueChange={(value) =>
                  setInput((current) => ({ ...current, enabled: value === 'enabled' }))
                }
                disabled={mutating}
              >
                <SelectTrigger aria-label={t('configPage.proxyPools.form.enabled')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">
                    {t('configPage.proxyPools.common.enabled')}
                  </SelectItem>
                  <SelectItem value="disabled">
                    {t('configPage.proxyPools.common.disabled')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </CompactField>
            <CompactField
              label={t('configPage.proxyPools.form.priority')}
              error={fieldErrors.priority}
            >
              <Input
                type="number"
                step="1"
                value={String(input.priority)}
                aria-label={t('configPage.proxyPools.form.priority')}
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
            {t('configPage.proxyPools.form.priorityHint')}
          </p>
          <div className="bg-muted/25 rounded-md border px-3 py-2 text-sm">
            <ReadOnlySummaryRow
              label={t('configPage.proxyPools.form.scope')}
              value={t('configPage.proxyPools.scope.global')}
            />
          </div>
        </section>

        <CompactField label={t('configPage.proxyPools.form.note')}>
          <Textarea
            value={input.note ?? ''}
            className="min-h-20"
            aria-label={t('configPage.proxyPools.form.note')}
            disabled={mutating}
            onChange={(event) => setInput((current) => ({ ...current, note: event.target.value }))}
          />
        </CompactField>
        {error ? <InlineNotice message={error} fallback={error} /> : null}
      </CompactDrawerFormBody>
      <DrawerScaffoldFooter>
        <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutating}>
          {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode.type === 'create'
            ? t('configPage.proxyPools.actions.create')
            : t('configPage.proxyPools.actions.save')}
        </Button>
      </DrawerScaffoldFooter>
    </form>
  )
}

export function ProxyPoolsPanel({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()
  /*
   * URL, scope, priority, last test and note are all in the edit sheet. The pool's
   * name and whether it is enabled are what a phone needs to see at a glance.
   */
  const showSecondary = useSecondaryColumns()
  const workbench = useProxyPoolsWorkbench(enabled)
  const [sheetMode, setSheetMode] = useState<ProxyPoolSheetMode | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProxyPoolItem | null>(null)
  const unsupported = workbench.errorCode === 'not-found'
  const closeSheet = () => setSheetMode(null)
  const showMutationError = (error: unknown) => {
    toast.error(
      error instanceof Error ? error.message : t('configPage.proxyPools.toast.actionFailed'),
    )
  }
  const copy = (value: string) => {
    void copyText(value).then(() => toast.success(t('configPage.proxyPools.toast.copied')))
  }

  if (!enabled) return null

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t('configPage.proxyPools.title')}</h3>
          <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-5">
            {t('configPage.proxyPools.description')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={workbench.fetching || workbench.mutating}
            onClick={() => void workbench.refetch()}
          >
            {workbench.fetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {t('configPage.proxyPools.actions.refresh')}
          </Button>
          <Button
            type="button"
            size="md"
            disabled={unsupported || workbench.mutating}
            onClick={() => setSheetMode({ type: 'create' })}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('configPage.proxyPools.actions.create')}
          </Button>
        </div>
      </div>

      {workbench.loading ? <Skeleton className="h-[280px] rounded-lg" /> : null}
      {!workbench.loading && unsupported ? (
        <InlineNotice
          message={workbench.errorMessage}
          fallback={t('configPage.proxyPools.unsupported')}
        />
      ) : null}
      {!workbench.loading && workbench.errorMessage && !unsupported ? (
        <InlineNotice
          message={workbench.errorMessage}
          fallback={t('configPage.proxyPools.error')}
        />
      ) : null}
      {!workbench.loading && !workbench.errorMessage && workbench.items.length === 0 ? (
        <TableEmptyState kind="empty" className="m-0" title={t('configPage.proxyPools.empty')} />
      ) : null}
      {!workbench.loading && !workbench.errorMessage && workbench.items.length > 0 ? (
        <div className="overflow-hidden rounded-md border">
          <Table
            className={cn(!showSecondary && 'table-fixed', 'sm:min-w-[980px]')}
            containerClassName={containedTableContainerClassName}
          >
            <TableHeader className={stickyTableHeaderClassName}>
              <TableRow variant="static">
                <TableHead>{t('configPage.proxyPools.columns.name')}</TableHead>
                {showSecondary ? (
                  <TableHead>{t('configPage.proxyPools.columns.url')}</TableHead>
                ) : null}
                <TableHead className={showSecondary ? undefined : 'w-24'}>
                  {t('configPage.proxyPools.columns.state')}
                </TableHead>
                {showSecondary ? (
                  <>
                    <TableHead>{t('configPage.proxyPools.columns.scope')}</TableHead>
                    <TableHead>{t('configPage.proxyPools.columns.priority')}</TableHead>
                    <TableHead>{t('configPage.proxyPools.columns.lastTest')}</TableHead>
                    <TableHead>{t('configPage.proxyPools.columns.note')}</TableHead>
                  </>
                ) : null}
                <TableHead className="table-sticky-action-head table-action-column-3 text-right">
                  {t('configPage.proxyPools.common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workbench.items.map((resource) => (
                <TableRow key={resource.id} variant="resource">
                  <TableCell>{resource.name}</TableCell>
                  {showSecondary ? (
                    <TableCell className="max-w-[280px]">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 truncate font-mono text-xs">
                          {maskProxyUrl(resource.proxyUrl)}
                        </span>
                        {resource.proxyUrl ? (
                          <Button
                            type="button"
                            variant="text"
                            size="icon-xs"
                            onClick={() => copy(resource.proxyUrl)}
                          >
                            <Copy className="size-3" aria-hidden="true" />
                            <span className="sr-only">
                              {t('configPage.proxyPools.common.copy')}
                            </span>
                          </Button>
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
                      <ProxyRecordStatusBadge enabled={resource.enabled} />
                      <Switch
                        checked={resource.enabled}
                        disabled={workbench.mutating}
                        aria-label={t('configPage.proxyPools.actions.toggleState', {
                          name: resource.name,
                        })}
                        onCheckedChange={() => {
                          void workbench
                            .updateProxyPool({
                              resource,
                              input: toProxyPoolInput(resource, !resource.enabled),
                            })
                            .then(() => toast.success(t('configPage.proxyPools.toast.updated')))
                            .catch(showMutationError)
                        }}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                  </TableCell>
                  {showSecondary ? (
                    <>
                      <TableCell>{t('configPage.proxyPools.scope.global')}</TableCell>
                      <TableCell className="tabular-nums">{resource.priority}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProxyTestResultBadge result={resource.lastTestResult} />
                          <span className="text-muted-foreground text-xs">
                            {formatDateTime(
                              resource.lastTestedAt,
                              t('configPage.proxyPools.common.na'),
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {resource.note || t('configPage.proxyPools.common.na')}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell className="table-sticky-action-cell table-action-column-3 text-right transition-colors">
                    <RowActions
                      menuLabel={resource.name}
                      actions={[
                        {
                          id: 'test',
                          label: t('configPage.proxyPools.actions.test'),
                          icon: RefreshCw,
                          disabled: workbench.mutating,
                          onSelect: () => {
                            void workbench
                              .testProxyPool(resource)
                              .then(() => toast.success(t('configPage.proxyPools.toast.tested')))
                              .catch(showMutationError)
                          },
                        },
                        {
                          id: 'edit',
                          label: t('configPage.proxyPools.common.edit'),
                          icon: SlidersHorizontal,
                          onSelect: () => setSheetMode({ type: 'edit', resource }),
                        },
                        {
                          id: 'delete',
                          label: t('configPage.proxyPools.common.delete'),
                          icon: Trash2,
                          tone: 'destructive',
                          onSelect: () => setPendingDelete(resource),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Sheet open={Boolean(sheetMode)} onOpenChange={(open) => !open && closeSheet()}>
        <DrawerScaffoldContent className="sm:max-w-2xl">
          {sheetMode ? (
            <>
              <DrawerScaffoldHeader>
                <SheetTitle>
                  {sheetMode.type === 'create'
                    ? t('configPage.proxyPools.sheet.createTitle')
                    : t('configPage.proxyPools.sheet.editTitle')}
                </SheetTitle>
                <SheetDescription>{t('configPage.proxyPools.sheet.description')}</SheetDescription>
              </DrawerScaffoldHeader>
              <ProxyPoolSheet
                mode={sheetMode}
                mutating={workbench.mutating}
                onCancel={closeSheet}
                onSubmit={async (input) => {
                  if (sheetMode.type === 'create') {
                    await workbench.createProxyPool(input)
                    toast.success(t('configPage.proxyPools.toast.created'))
                  } else {
                    await workbench.updateProxyPool({ resource: sheetMode.resource, input })
                    toast.success(t('configPage.proxyPools.toast.updated'))
                  }
                  closeSheet()
                }}
              />
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
            <AlertDialogTitle>{t('configPage.proxyPools.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('configPage.proxyPools.delete.description', {
                name: pendingDelete?.name ?? '',
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
                  .deleteProxyPool(pendingDelete)
                  .then(() => {
                    toast.success(t('configPage.proxyPools.toast.deleted'))
                    setPendingDelete(null)
                  })
                  .catch(showMutationError)
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('configPage.proxyPools.common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
