import { useEffect, useMemo, useState } from 'react'

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ProviderLogo } from '@/components/shared/provider-logo'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProviderWorkbench } from '@/features/providers/use-provider-workbench'
import type {
  ProviderDescriptor,
  ProviderEntryFormInput,
  ProviderGroup,
  ProviderId,
  ProviderModelChannel,
  ProviderModelDefinition,
  ProviderResource,
} from '@/lib/api/management/providers'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type PanelMode = 'detail' | 'create' | 'edit'

const modelDefinitionChannels: ProviderModelChannel[] = [
  'gemini',
  'claude',
  'codex',
  'vertex',
  'gemini-cli',
  'aistudio',
  'kimi',
  'antigravity',
  'xai',
]

const defaultModelDefinitionChannelByProvider: Partial<Record<ProviderId, ProviderModelChannel>> = {
  gemini: 'gemini',
  claude: 'claude',
  codex: 'codex',
  vertex: 'vertex',
}

const emptyForm: ProviderEntryFormInput = {
  apiKey: '',
  name: '',
  baseUrl: '',
  proxyUrl: '',
  prefix: '',
  disabled: false,
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function createFormState(resource: ProviderResource | null): ProviderEntryFormInput {
  if (!resource) return emptyForm

  return {
    apiKey: '',
    name: resource.name ?? '',
    baseUrl: resource.baseUrl ?? '',
    proxyUrl: resource.proxyUrl ?? '',
    prefix: resource.prefix ?? '',
    disabled: resource.disabled,
  }
}

function requiresBaseUrl(descriptor: ProviderDescriptor) {
  return descriptor.id === 'codex' || descriptor.id === 'openaiCompatibility'
}

function getDefaultModelDefinitionChannel(providerId: ProviderId) {
  return defaultModelDefinitionChannelByProvider[providerId] ?? null
}

function validateProviderInput(
  descriptor: ProviderDescriptor,
  form: ProviderEntryFormInput,
  mode: PanelMode,
) {
  if (descriptor.supportsName && !form.name.trim()) {
    return 'nameRequired'
  }

  if (mode === 'create' && descriptor.supportsApiKey && !form.apiKey.trim()) {
    return 'apiKeyRequired'
  }

  if (requiresBaseUrl(descriptor) && !form.baseUrl.trim()) {
    return 'baseUrlRequired'
  }

  return null
}

function ProviderDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <Network className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('providersPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('providersPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <Network className="size-4" aria-hidden="true" />
            {t('providersPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function ProviderLoadingState() {
  return (
    <section className="grid gap-5">
      <Skeleton className="h-32 rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <Skeleton className="h-[520px] rounded-lg" />
        <Skeleton className="h-[520px] rounded-lg" />
      </div>
    </section>
  )
}

function ProviderErrorState({
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
                {t('providersPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('providersPage.error.description')}
              </p>
            </div>
          </div>
          <Button variant="outline" className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('providersPage.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function ProviderCategoryList({
  groups,
  activeProviderId,
  onSelectProvider,
}: {
  groups: ProviderGroup[]
  activeProviderId: ProviderId
  onSelectProvider: (providerId: ProviderId) => void
}) {
  const { t } = useTranslation()

  return (
    <aside className="bg-card min-w-0 rounded-lg border p-3 shadow-sm">
      <p className="text-muted-foreground px-2 pb-2 text-xs font-medium uppercase">
        {t('providersPage.categories.title')}
      </p>
      <div className="grid gap-1">
        {groups.map((group) => {
          const active = group.id === activeProviderId
          const activeCount = group.resources.filter((resource) => !resource.disabled).length

          return (
            <Button
              key={group.id}
              type="button"
              variant="ghost"
              className={cn(
                'h-auto min-w-0 justify-between gap-3 rounded-md border px-3 py-3 text-left',
                active
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'hover:border-border hover:bg-accent border-transparent',
              )}
              onClick={() => onSelectProvider(group.id)}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <ProviderLogo providerId={group.id} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {t(`providersPage.providerNames.${group.id}`)}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {t('providersPage.categories.activeCount', {
                      active: activeCount,
                      total: group.resources.length,
                    })}
                  </span>
                </span>
              </div>
              {group.issue ? (
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-300" />
              ) : (
                <span className="bg-background text-muted-foreground rounded-md border px-2 py-1 text-xs">
                  {group.resources.length}
                </span>
              )}
            </Button>
          )
        })}
      </div>
    </aside>
  )
}

function ProviderResourceTable({
  resources,
  selectedResourceId,
  onCreateResource,
  onDeleteResource,
  onEditResource,
  onViewResource,
}: {
  resources: ProviderResource[]
  selectedResourceId: string | null
  onCreateResource: () => void
  onDeleteResource: (resource: ProviderResource) => void
  onEditResource: (resource: ProviderResource) => void
  onViewResource: (resource: ProviderResource) => void
}) {
  const { t } = useTranslation()

  if (resources.length === 0) {
    return (
      <div className="rounded-md border px-4 py-10 text-center text-sm">
        <p className="text-muted-foreground">{t('providersPage.table.empty')}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onCreateResource}>
          <Plus className="size-4" aria-hidden="true" />
          {t('providersPage.actions.new')}
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <Table className="min-w-[960px] table-fixed">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[22%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[26%]" />
          </colgroup>
          <TableHeader className="bg-muted/70 text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('providersPage.table.key')}</TableHead>
              <TableHead>{t('providersPage.table.baseUrl')}</TableHead>
              <TableHead>{t('providersPage.table.prefix')}</TableHead>
              <TableHead>{t('providersPage.table.models')}</TableHead>
              <TableHead>{t('providersPage.table.status')}</TableHead>
              <TableHead className="text-right">{t('providersPage.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => (
              <TableRow
                key={resource.id}
                className={cn(
                  'hover:bg-accent/40 transition-colors',
                  resource.id === selectedResourceId ? 'bg-primary/8' : null,
                )}
              >
                <TableCell>
                  <p className="max-w-[220px] truncate font-medium">
                    {resource.name ?? resource.identifier}
                  </p>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {resource.apiKeyPreview ?? resource.authIndex ?? resource.identifier}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-muted-foreground max-w-[220px] truncate font-mono text-xs">
                    {resource.baseUrl ?? t('providersPage.status.notSet')}
                  </p>
                </TableCell>
                <TableCell>
                  <span className="rounded-md border px-2 py-1 text-xs">
                    {resource.prefix ?? t('providersPage.status.none')}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-xs">
                    {t('providersPage.table.modelSummary', {
                      models: resource.modelCount,
                      headers: resource.headerCount,
                    })}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                      resource.disabled
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-primary/30 bg-primary/10 text-primary',
                    )}
                  >
                    {resource.disabled ? (
                      <AlertTriangle className="size-3" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                    )}
                    {resource.disabled
                      ? t('providersPage.status.disabled')
                      : t('providersPage.status.active')}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      className="px-2"
                      aria-label={t('providersPage.actions.view')}
                      onClick={(event) => {
                        event.stopPropagation()
                        onViewResource(resource)
                      }}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                      {t('providersPage.actions.view')}
                    </Button>
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      className="px-2"
                      aria-label={t('providersPage.actions.edit')}
                      onClick={(event) => {
                        event.stopPropagation()
                        onEditResource(resource)
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      {t('providersPage.actions.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructiveText"
                      size="sm"
                      className="px-2"
                      aria-label={t('providersPage.actions.delete')}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeleteResource(resource)
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t('providersPage.actions.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function formatNumber(value: number | null) {
  if (value === null || value <= 0) return null
  return new Intl.NumberFormat(undefined).format(value)
}

function ProviderModelCatalog({
  channel,
  models,
  fetchedAt,
  filter,
  loading,
  errorMessage,
  onChannelChange,
  onFilterChange,
  onRetry,
}: {
  channel: ProviderModelChannel
  models: ProviderModelDefinition[]
  fetchedAt: string | null
  filter: string
  loading: boolean
  errorMessage: string | null
  onChannelChange: (channel: ProviderModelChannel) => void
  onFilterChange: (filter: string) => void
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const normalizedFilter = filter.trim().toLowerCase()
  const filteredModels = normalizedFilter
    ? models.filter((model) =>
        [
          model.id,
          model.displayName,
          model.name,
          model.version,
          model.ownedBy,
          model.type,
          model.description,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedFilter)),
      )
    : models

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-5 py-4 pr-16">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <BookOpen className="text-primary size-4" aria-hidden="true" />
          {t('providersPage.modelCatalog.title')}
        </h3>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 p-5">
        <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 sm:w-72">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
              placeholder={t('providersPage.modelCatalog.filterPlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            <span className="text-muted-foreground text-xs">
              {fetchedAt
                ? t('providersPage.modelCatalog.updatedAt', {
                    time: formatDateTime(fetchedAt),
                  })
                : t('providersPage.modelCatalog.notLoaded')}
            </span>
            <div className="min-w-44">
              <Select
                value={channel}
                disabled={loading}
                onValueChange={(nextChannel) =>
                  onChannelChange(nextChannel as ProviderModelChannel)
                }
              >
                <SelectTrigger aria-label={t('providersPage.modelCatalog.channelLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelDefinitionChannels.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`providersPage.modelCatalog.channels.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  {t('providersPage.modelCatalog.errorTitle')}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-5 break-words">
                  {errorMessage}
                </p>
              </div>
              <Button variant="outline" size="sm" disabled={loading} onClick={onRetry}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                {t('providersPage.modelCatalog.retry')}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          {loading && models.length === 0 ? (
            <div className="grid gap-2">
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-muted-foreground rounded-md border px-4 py-8 text-center text-sm">
              {t('providersPage.modelCatalog.empty')}
            </div>
          ) : (
            <div className="grid h-full min-h-[360px] gap-2 overflow-y-auto pr-1">
              {filteredModels.slice(0, 80).map((model) => (
                <article key={model.id} className="rounded-md border px-3 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-medium">{model.displayName}</h4>
                      <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
                        {model.id}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      {model.type ? (
                        <span className="bg-muted text-muted-foreground rounded-md border px-2 py-1 text-xs">
                          {model.type}
                        </span>
                      ) : null}
                      {model.ownedBy ? (
                        <span className="bg-muted text-muted-foreground rounded-md border px-2 py-1 text-xs">
                          {model.ownedBy}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {model.description ? (
                    <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-5">
                      {model.description}
                    </p>
                  ) : null}
                  <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-xs">
                    {formatNumber(model.contextLength) ? (
                      <span>
                        {t('providersPage.modelCatalog.contextLength', {
                          value: formatNumber(model.contextLength),
                        })}
                      </span>
                    ) : null}
                    {formatNumber(model.maxCompletionTokens) ? (
                      <span>
                        {t('providersPage.modelCatalog.maxCompletionTokens', {
                          value: formatNumber(model.maxCompletionTokens),
                        })}
                      </span>
                    ) : null}
                    {model.inputModalities.length > 0 ? (
                      <span>
                        {t('providersPage.modelCatalog.modalities', {
                          value: model.inputModalities.join(', '),
                        })}
                      </span>
                    ) : null}
                    {model.thinkingLevels.length > 0 ? (
                      <span>
                        {t('providersPage.modelCatalog.thinking', {
                          value: model.thinkingLevels.join(', '),
                        })}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProviderModelCatalogSummary({
  fetchedAt,
  modelCount,
  loading,
  errorMessage,
  onOpen,
}: {
  fetchedAt: string | null
  modelCount: number
  loading: boolean
  errorMessage: string | null
  onOpen: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
            <BookOpen className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              {t('providersPage.modelCatalog.summaryTitle')}
            </h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {errorMessage ? (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              {t('providersPage.modelCatalog.summaryError')}
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
              {loading
                ? t('providersPage.modelCatalog.loading')
                : t('providersPage.modelCatalog.summaryCount', { count: modelCount })}
            </span>
          )}
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {fetchedAt
              ? t('providersPage.modelCatalog.updatedAt', {
                  time: formatDateTime(fetchedAt),
                })
              : t('providersPage.modelCatalog.notLoaded')}
          </span>
          <Button variant="outline" size="sm" onClick={onOpen}>
            <BookOpen className="size-4" aria-hidden="true" />
            {t('providersPage.modelCatalog.openAction')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function ProviderFormPanel({
  mode,
  descriptor,
  resource,
  mutating,
  className,
  onCancel,
  onCreate,
  onUpdate,
}: {
  mode: PanelMode
  descriptor: ProviderDescriptor
  resource: ProviderResource | null
  mutating: boolean
  className?: string
  onCancel: () => void
  onCreate: (input: ProviderEntryFormInput) => Promise<void>
  onUpdate: (input: ProviderEntryFormInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ProviderEntryFormInput>(() => createFormState(resource))
  const [localError, setLocalError] = useState<string | null>(null)
  const editing = mode === 'edit'
  const creating = mode === 'create'

  useEffect(() => {
    setForm(createFormState(mode === 'create' ? null : resource))
    setLocalError(null)
  }, [mode, resource])

  const updateField = <Field extends keyof ProviderEntryFormInput>(
    field: Field,
    value: ProviderEntryFormInput[Field],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validationError = validateProviderInput(descriptor, form, mode)

    if (validationError) {
      setLocalError(t(`providersPage.form.validation.${validationError}`))
      return
    }

    try {
      setLocalError(null)
      if (creating) {
        await onCreate(form)
      } else if (editing) {
        await onUpdate(form)
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  const primaryDetailFields = resource
    ? [
        ['identifier', resource.identifier],
        ['baseUrl', resource.baseUrl ?? t('providersPage.status.notSet')],
        ['proxyUrl', resource.proxyUrl ?? t('providersPage.status.notSet')],
        ['prefix', resource.prefix ?? t('providersPage.status.none')],
        ['models', String(resource.modelCount)],
        ['headers', String(resource.headerCount)],
      ]
    : []
  const metadataFields = resource
    ? [
        ['authIndex', resource.authIndex ?? t('providersPage.status.notAvailable')],
        ['excludedModels', String(resource.excludedModelCount)],
        ['apiKeyEntries', String(resource.apiKeyEntryCount)],
      ]
    : []

  if (mode === 'detail' && resource) {
    return (
      <div className={cn('min-w-0', className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium uppercase">
              {t('providersPage.detail.title')}
            </p>
            <h2 className="mt-2 truncate text-base font-semibold">
              {resource.name ?? resource.identifier}
            </h2>
          </div>
        </div>

        <dl className="mt-5 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          {primaryDetailFields.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-muted-foreground text-xs">
                {t(`providersPage.detail.fields.${key}`)}
              </dt>
              <dd className="mt-1 font-mono text-xs break-words">{value}</dd>
            </div>
          ))}
        </dl>

        <Collapsible className="mt-5 rounded-md border px-3 py-2.5 text-sm">
          <CollapsibleTrigger className="group focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px]">
            {t('providersPage.detail.metadataTitle')}
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent asChild>
            <dl className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {metadataFields.map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-muted-foreground text-xs">
                    {t(`providersPage.detail.fields.${key}`)}
                  </dt>
                  <dd className="mt-1 font-mono text-xs break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </CollapsibleContent>
        </Collapsible>
      </div>
    )
  }

  if (mode === 'detail') {
    return (
      <div className={cn('min-w-0 text-sm', className)}>
        <div className="bg-muted text-muted-foreground flex min-h-48 items-center justify-center rounded-md border px-4 text-center">
          {t('providersPage.detail.empty')}
        </div>
      </div>
    )
  }

  const baseUrlRequired = requiresBaseUrl(descriptor)

  return (
    <div className={cn('min-w-0', className)}>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium uppercase">
          {creating ? t('providersPage.form.createEyebrow') : t('providersPage.form.editEyebrow')}
        </p>
        <h2 className="mt-2 truncate text-base font-semibold">
          {t(`providersPage.providerNames.${descriptor.id}`)}
        </h2>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        {descriptor.supportsName ? (
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('providersPage.form.name')}</span>
            <Input
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              disabled={mutating}
            />
          </label>
        ) : null}

        {descriptor.supportsApiKey ? (
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('providersPage.form.apiKey')}</span>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(event) => updateField('apiKey', event.target.value)}
              placeholder={
                editing
                  ? t('providersPage.form.apiKeyEditPlaceholder')
                  : t('providersPage.form.apiKeyCreatePlaceholder')
              }
              disabled={mutating}
            />
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-medium">
          <span>{t('providersPage.form.baseUrl')}</span>
          <Input
            value={form.baseUrl}
            onChange={(event) => updateField('baseUrl', event.target.value)}
            placeholder="https://api.example.com"
            disabled={mutating}
          />
          {baseUrlRequired ? (
            <span className="text-muted-foreground text-xs leading-5">
              {t('providersPage.form.baseUrlRequiredHint')}
            </span>
          ) : null}
        </label>

        {descriptor.id !== 'openaiCompatibility' ? (
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('providersPage.form.proxyUrl')}</span>
            <Input
              value={form.proxyUrl}
              onChange={(event) => updateField('proxyUrl', event.target.value)}
              placeholder="http://127.0.0.1:7890"
              disabled={mutating}
            />
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-medium">
          <span>{t('providersPage.form.prefix')}</span>
          <Input
            value={form.prefix}
            onChange={(event) => updateField('prefix', event.target.value)}
            disabled={mutating}
          />
        </label>

        {descriptor.supportsDisabled ? (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              className="mt-1"
              checked={form.disabled}
              disabled={mutating}
              onCheckedChange={(checked) => updateField('disabled', checked === true)}
            />
            <span className="grid gap-1">
              <span className="font-medium">{t('providersPage.form.disabled')}</span>
              <span className="text-muted-foreground text-xs leading-5">
                {t('providersPage.form.disabledHint')}
              </span>
            </span>
          </label>
        ) : null}

        {localError ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {localError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" disabled={mutating} onClick={onCancel}>
            {t('providersPage.actions.cancel')}
          </Button>
          <Button type="submit" disabled={mutating}>
            {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {creating ? t('providersPage.actions.create') : t('providersPage.actions.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function ProvidersWorkbenchPage() {
  const { t } = useTranslation()
  const [activeProviderId, setActiveProviderId] = useState<ProviderId>('gemini')
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>('detail')
  const [resourcePanelOpen, setResourcePanelOpen] = useState(false)
  const [modelCatalogOpen, setModelCatalogOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [modelCatalogChannel, setModelCatalogChannel] = useState<ProviderModelChannel>('gemini')
  const [modelCatalogFilter, setModelCatalogFilter] = useState('')
  const workbench = useProviderWorkbench(modelCatalogChannel)

  const groups = workbench.snapshot?.groups ?? []
  const activeGroup = groups.find((group) => group.id === activeProviderId) ?? groups[0]
  const activeResources = useMemo(() => {
    if (!activeGroup) return []
    const normalizedFilter = filter.trim().toLowerCase()
    if (!normalizedFilter) return activeGroup.resources

    return activeGroup.resources.filter((resource) =>
      [
        resource.identifier,
        resource.name,
        resource.authIndex,
        resource.apiKeyPreview,
        resource.baseUrl,
        resource.proxyUrl,
        resource.prefix,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedFilter)),
    )
  }, [activeGroup, filter])
  const selectedResource =
    activeGroup?.resources.find((resource) => resource.id === selectedResourceId) ?? null
  const totalResources = groups.reduce((total, group) => total + group.resources.length, 0)
  const activeResourcesCount = groups.reduce(
    (total, group) => total + group.resources.filter((resource) => !resource.disabled).length,
    0,
  )
  const activeProviderName = activeGroup ? t(`providersPage.providerNames.${activeGroup.id}`) : ''
  const currentModelCatalog =
    workbench.modelDefinitions?.channel === modelCatalogChannel ? workbench.modelDefinitions : null

  useEffect(() => {
    if (!activeGroup && groups[0]) {
      setActiveProviderId(groups[0].id)
    }
  }, [activeGroup, groups])

  if (!workbench.connected) {
    return <ProviderDisconnectedState />
  }

  if (workbench.isPending) {
    return <ProviderLoadingState />
  }

  if (workbench.isError || !workbench.snapshot || !activeGroup) {
    return <ProviderErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
  }

  const handleSelectProvider = (providerId: ProviderId) => {
    setActiveProviderId(providerId)
    setSelectedResourceId(null)
    setPanelMode('detail')
    setResourcePanelOpen(false)

    const defaultChannel = getDefaultModelDefinitionChannel(providerId)
    if (defaultChannel) {
      setModelCatalogChannel(defaultChannel)
      setModelCatalogFilter('')
    }
  }

  const openCreatePanel = () => {
    setPanelMode('create')
    setSelectedResourceId(null)
    setResourcePanelOpen(true)
  }

  const openDetailPanel = (resource: ProviderResource) => {
    setSelectedResourceId(resource.id)
    setPanelMode('detail')
    setResourcePanelOpen(true)
  }

  const openEditPanel = (resource: ProviderResource) => {
    setSelectedResourceId(resource.id)
    setPanelMode('edit')
    setResourcePanelOpen(true)
  }

  const openDeleteDialog = (resource: ProviderResource) => {
    setSelectedResourceId(resource.id)
    setPanelMode('detail')
    setResourcePanelOpen(false)
    setDeleteDialogOpen(true)
  }

  const handleCreate = async (input: ProviderEntryFormInput) => {
    await workbench.createProvider({
      providerId: activeGroup.id,
      input,
    })
    toast.success(t('providersPage.toast.created'))
    setPanelMode('detail')
    setSelectedResourceId(null)
    setResourcePanelOpen(false)
  }

  const handleUpdate = async (input: ProviderEntryFormInput) => {
    if (!selectedResource) return
    await workbench.updateProvider({
      resource: selectedResource,
      input,
    })
    toast.success(t('providersPage.toast.updated'))
    setPanelMode('detail')
    setResourcePanelOpen(false)
  }

  const handleDelete = async () => {
    if (!selectedResource) return

    await workbench.deleteProvider(selectedResource)
    toast.success(t('providersPage.toast.deleted'))
    setSelectedResourceId(null)
    setPanelMode('detail')
    setResourcePanelOpen(false)
    setDeleteDialogOpen(false)
  }

  const openModelCatalog = () => {
    const defaultChannel = getDefaultModelDefinitionChannel(activeGroup.id)
    if (defaultChannel) {
      setModelCatalogChannel(defaultChannel)
      setModelCatalogFilter('')
    }

    setModelCatalogOpen(true)
  }

  return (
    <section className="grid w-full gap-5">
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal">
              {t('providersPage.header.title')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={workbench.isFetching}
              onClick={workbench.refetch}
              aria-label={
                workbench.isFetching
                  ? t('providersPage.actions.syncing')
                  : t('providersPage.actions.refresh')
              }
              title={
                workbench.isFetching
                  ? t('providersPage.actions.syncing')
                  : t('providersPage.actions.refresh')
              }
            >
              {workbench.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {workbench.isFetching
                ? t('providersPage.actions.syncing')
                : t('providersPage.actions.refresh')}
            </Button>
            <Button size="sm" onClick={openCreatePanel}>
              <Plus className="size-4" aria-hidden="true" />
              {t('providersPage.actions.new')}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
            {t('providersPage.header.activeResources', {
              active: activeResourcesCount,
              total: totalResources,
            })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('providersPage.header.providerFamilies', {
              count: groups.filter((group) => group.resources.length > 0).length,
            })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('providersPage.header.updatedAt', {
              time: formatDateTime(workbench.snapshot.fetchedAt),
            })}
          </span>
          {workbench.snapshot.issues.length > 0 ? (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              {t('providersPage.header.issueCount', {
                count: workbench.snapshot.issues.length,
              })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <ProviderCategoryList
          groups={groups}
          activeProviderId={activeGroup.id}
          onSelectProvider={handleSelectProvider}
        />

        <div className="bg-card min-w-0 rounded-lg border p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <ProviderLogo providerId={activeGroup.id} size="sm" />
                {t(`providersPage.providerNames.${activeGroup.id}`)}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {t('providersPage.table.description', {
                  route: activeGroup.path,
                })}
              </p>
            </div>
            <div className="relative min-w-0 md:w-72">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                className="pl-9"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t('providersPage.table.filterPlaceholder')}
              />
            </div>
          </div>

          {activeGroup.issue ? (
            <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                {t('providersPage.table.providerIssue')}
                {activeGroup.issue.status ? ` · ${activeGroup.issue.status}` : ''}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5 break-words">
                {activeGroup.issue.message}
              </p>
            </div>
          ) : null}

          <div className="mt-4">
            <ProviderResourceTable
              resources={activeResources}
              selectedResourceId={selectedResourceId}
              onCreateResource={openCreatePanel}
              onDeleteResource={openDeleteDialog}
              onEditResource={openEditPanel}
              onViewResource={openDetailPanel}
            />
          </div>
        </div>
      </div>

      <ProviderModelCatalogSummary
        fetchedAt={currentModelCatalog?.fetchedAt ?? null}
        modelCount={currentModelCatalog?.models.length ?? 0}
        loading={workbench.isFetchingModelDefinitions}
        errorMessage={workbench.modelDefinitionsErrorMessage}
        onOpen={openModelCatalog}
      />

      <Sheet
        open={resourcePanelOpen}
        onOpenChange={(open) => {
          setResourcePanelOpen(open)
          if (!open) {
            setPanelMode('detail')
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="sr-only">
            <SheetTitle>
              {panelMode === 'create'
                ? t('providersPage.actions.new')
                : panelMode === 'edit'
                  ? t('providersPage.actions.edit')
                  : t('providersPage.detail.title')}
            </SheetTitle>
            <SheetDescription>
              {t('providersPage.table.description', {
                route: activeGroup.path,
              })}
            </SheetDescription>
          </SheetHeader>
          <ProviderFormPanel
            className="p-5 pt-10"
            mode={panelMode}
            descriptor={activeGroup}
            resource={selectedResource}
            mutating={workbench.mutating}
            onCancel={() => {
              if (panelMode === 'detail' && selectedResource) {
                setPanelMode('edit')
                return
              }

              setPanelMode('detail')
              setResourcePanelOpen(false)
            }}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={modelCatalogOpen} onOpenChange={setModelCatalogOpen}>
        <SheetContent className="w-full overflow-hidden p-0 sm:max-w-3xl">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('providersPage.modelCatalog.title')}</SheetTitle>
            <SheetDescription>
              {t(
                getDefaultModelDefinitionChannel(activeGroup.id) === modelCatalogChannel
                  ? 'providersPage.modelCatalog.description'
                  : 'providersPage.modelCatalog.standaloneDescription',
                {
                  channel: t(`providersPage.modelCatalog.channels.${modelCatalogChannel}`),
                  provider: activeProviderName,
                },
              )}
            </SheetDescription>
          </SheetHeader>
          <ProviderModelCatalog
            channel={modelCatalogChannel}
            models={currentModelCatalog?.models ?? []}
            fetchedAt={currentModelCatalog?.fetchedAt ?? null}
            filter={modelCatalogFilter}
            loading={workbench.isFetchingModelDefinitions}
            errorMessage={workbench.modelDefinitionsErrorMessage}
            onChannelChange={(channel) => {
              setModelCatalogChannel(channel)
              setModelCatalogFilter('')
            }}
            onFilterChange={setModelCatalogFilter}
            onRetry={workbench.refetchModelDefinitions}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('providersPage.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedResource
                ? t('providersPage.delete.confirm', {
                    name: selectedResource.name ?? selectedResource.identifier,
                  })
                : null}
            </AlertDialogDescription>
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
                void handleDelete()
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('providersPage.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
