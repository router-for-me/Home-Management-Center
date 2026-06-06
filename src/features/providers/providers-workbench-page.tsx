import { useEffect, useId, useMemo, useRef, useState } from 'react'

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
  X,
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
import { Textarea } from '@/components/ui/textarea'
import { useProviderWorkbench } from '@/features/providers/use-provider-workbench'
import type {
  ProviderConnectivityTestInput,
  ProviderDescriptor,
  ProviderDiscoveredModel,
  ProviderEntryFormInput,
  ProviderGroup,
  ProviderHeaderEntryInput,
  ProviderId,
  ProviderModelChannel,
  ProviderModelDefinition,
  ProviderModelDiscoveryInput,
  ProviderModelEntryInput,
  ProviderResource,
} from '@/lib/api/management/providers'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type PanelMode = 'detail' | 'create' | 'edit'

type TestModelOption = {
  value: string
  label: string
  searchText: string
  isAuto?: boolean
}

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
  priority: undefined,
  models: [],
  headers: [],
  excludedModelsText: '',
  testModel: undefined,
  cloak: undefined,
}

type UnknownRecord = Record<string, unknown>

function emptyModelEntry(): ProviderModelEntryInput {
  return {
    name: '',
    alias: '',
  }
}

function emptyHeaderEntry(): ProviderHeaderEntryInput {
  return {
    key: '',
    value: '',
  }
}

function emptyCloakInput() {
  return {
    mode: '',
    strictMode: false,
    cacheUserId: false,
    sensitiveWordsText: '',
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStringField(record: UnknownRecord, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function readProviderModels(raw: UnknownRecord): ProviderModelEntryInput[] {
  const models = raw.models
  if (!Array.isArray(models)) return []

  return models.filter(isRecord).map((model) => ({
    name: readStringField(model, 'name'),
    alias: readStringField(model, 'alias'),
  }))
}

function readProviderHeaders(raw: UnknownRecord): ProviderHeaderEntryInput[] {
  const headers = raw.headers
  if (!isRecord(headers)) return []

  return Object.entries(headers).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : String(value ?? ''),
  }))
}

function readExcludedModelsText(raw: UnknownRecord): string {
  const excludedModels = raw['excluded-models']
  return Array.isArray(excludedModels)
    ? excludedModels
        .filter((item): item is string => typeof item === 'string')
        .filter((item) => item.trim() !== '*')
        .join('\n')
    : ''
}

function readProviderCloak(raw: UnknownRecord) {
  const cloak = raw.cloak
  if (!isRecord(cloak)) return emptyCloakInput()

  const sensitiveWords = cloak['sensitive-words']
  return {
    mode: readStringField(cloak, 'mode'),
    strictMode: cloak['strict-mode'] === true,
    cacheUserId: cloak['cache-user-id'] === true,
    sensitiveWordsText: Array.isArray(sensitiveWords)
      ? sensitiveWords.filter((item): item is string => typeof item === 'string').join('\n')
      : '',
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function createFormState(
  resource: ProviderResource | null,
  descriptor?: ProviderDescriptor,
): ProviderEntryFormInput {
  const providerId = descriptor?.id ?? resource?.providerId
  const supportsTestModel =
    descriptor?.supportsTestModel ??
    (providerId === 'claude' || providerId === 'openaiCompatibility')
  const supportsCloak = descriptor?.supportsCloak ?? providerId === 'claude'

  if (!resource) {
    return {
      ...emptyForm,
      models: [],
      headers: [],
      testModel: supportsTestModel ? '' : undefined,
      cloak: supportsCloak ? emptyCloakInput() : undefined,
    }
  }

  const raw = resource.raw

  return {
    apiKey: '',
    name: resource.name ?? '',
    baseUrl: resource.baseUrl ?? '',
    proxyUrl: resource.proxyUrl ?? '',
    prefix: resource.prefix ?? '',
    disabled: resource.disabled,
    priority: resource.priority ?? undefined,
    models: readProviderModels(raw),
    headers: readProviderHeaders(raw),
    excludedModelsText: readExcludedModelsText(raw),
    testModel: supportsTestModel ? readStringField(raw, 'test-model') : undefined,
    cloak: supportsCloak ? readProviderCloak(raw) : undefined,
  }
}

function requiresBaseUrl(descriptor: ProviderDescriptor) {
  return descriptor.id === 'codex' || descriptor.id === 'openaiCompatibility'
}

function getDefaultModelDefinitionChannel(providerId: ProviderId) {
  return defaultModelDefinitionChannelByProvider[providerId] ?? null
}

function supportsProviderModelDiscovery(providerId: ProviderId) {
  return (
    providerId === 'gemini' ||
    providerId === 'claude' ||
    providerId === 'codex' ||
    providerId === 'openaiCompatibility'
  )
}

function supportsProviderConnectivityTest(providerId: ProviderId) {
  return providerId === 'claude' || providerId === 'openaiCompatibility'
}

function hasHeaderEntry(headers: ProviderHeaderEntryInput[], names: string[]) {
  const targets = new Set(names.map((name) => name.toLowerCase()))
  return headers.some(
    (header) => targets.has(header.key.trim().toLowerCase()) && header.value.trim(),
  )
}

function hasProviderDiscoveryHeaderAuth(
  providerId: ProviderId,
  headers: ProviderHeaderEntryInput[],
) {
  if (providerId === 'gemini') {
    return hasHeaderEntry(headers, ['x-goog-api-key'])
  }

  if (providerId === 'claude') {
    return hasHeaderEntry(headers, ['x-api-key'])
  }

  return hasHeaderEntry(headers, ['authorization'])
}

function getProviderDiscoveryValidationError(
  providerId: ProviderId,
  form: ProviderEntryFormInput,
  resource: ProviderResource | null,
) {
  const hasApiKey = Boolean(form.apiKey.trim())
  const hasAuthIndex = Boolean(resource?.authIndex?.trim())
  const hasHeaderAuth = hasProviderDiscoveryHeaderAuth(providerId, form.headers)
  const hasAuth = hasApiKey || hasAuthIndex || hasHeaderAuth
  const needsBaseUrl = providerId === 'codex' || providerId === 'openaiCompatibility'
  const hasBaseUrl = Boolean(form.baseUrl.trim())

  if (needsBaseUrl && !hasBaseUrl && !hasAuth) {
    return 'apiKeyAndBaseUrlRequired'
  }

  if (needsBaseUrl && !hasBaseUrl) {
    return 'baseUrlRequired'
  }

  if (!hasAuth) {
    return 'apiKeyRequired'
  }

  return null
}

function pickProviderTestModel(form: ProviderEntryFormInput) {
  const explicit = form.testModel?.trim()
  if (explicit) return explicit

  for (const model of form.models) {
    const name = model.name.trim()
    if (name) return name
  }

  return ''
}

function getProviderConnectivityValidationError(
  providerId: ProviderId,
  form: ProviderEntryFormInput,
  resource: ProviderResource | null,
) {
  const hasApiKey = Boolean(form.apiKey.trim())
  const hasAuthIndex = Boolean(resource?.authIndex?.trim())
  const hasHeaderAuth = hasProviderDiscoveryHeaderAuth(providerId, form.headers)
  const hasAuth = hasApiKey || hasAuthIndex || hasHeaderAuth
  const needsBaseUrl = providerId === 'openaiCompatibility'
  const hasBaseUrl = Boolean(form.baseUrl.trim())
  const hasModel = Boolean(pickProviderTestModel(form))

  if (needsBaseUrl && !hasBaseUrl && !hasAuth) {
    return 'apiKeyAndBaseUrlRequired'
  }

  if (needsBaseUrl && !hasBaseUrl) {
    return 'baseUrlRequired'
  }

  if (!hasAuth) {
    return 'apiKeyRequired'
  }

  if (!hasModel) {
    return 'modelRequired'
  }

  return null
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

  if (form.models.some((model) => !model.name.trim() && model.alias.trim())) {
    return 'modelNameRequired'
  }

  if (form.headers.some((header) => !header.key.trim() && header.value.trim())) {
    return 'headerNameRequired'
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
        <Table className="min-w-[1080px] table-fixed">
          <colgroup>
            <col className="w-[220px]" />
            <col className="w-[240px]" />
            <col className="w-[96px]" />
            <col className="w-[150px]" />
            <col className="w-[120px]" />
            <col className="w-[248px]" />
          </colgroup>
          <TableHeader className="bg-muted/70 text-muted-foreground">
            <TableRow variant="static">
              <TableHead>{t('providersPage.table.key')}</TableHead>
              <TableHead>{t('providersPage.table.baseUrl')}</TableHead>
              <TableHead>{t('providersPage.table.prefix')}</TableHead>
              <TableHead>{t('providersPage.table.models')}</TableHead>
              <TableHead>{t('providersPage.table.status')}</TableHead>
              <TableHead className="table-sticky-action-head w-[248px] text-right">
                {t('providersPage.table.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => (
              <TableRow
                key={resource.id}
                className={cn('group', resource.id === selectedResourceId ? 'bg-primary/8' : null)}
                variant="resource"
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
                <TableCell className="table-sticky-action-cell w-[248px] text-right transition-colors">
                  <div className="table-action-cell-content">
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
  onDiscoverModels,
  onTestModel,
}: {
  mode: PanelMode
  descriptor: ProviderDescriptor
  resource: ProviderResource | null
  mutating: boolean
  className?: string
  onCancel: () => void
  onCreate: (input: ProviderEntryFormInput) => Promise<void>
  onUpdate: (input: ProviderEntryFormInput) => Promise<void>
  onDiscoverModels: (input: ProviderModelDiscoveryInput) => Promise<ProviderDiscoveredModel[]>
  onTestModel: (input: ProviderConnectivityTestInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ProviderEntryFormInput>(() =>
    createFormState(resource, descriptor),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [modelDiscoveryOpen, setModelDiscoveryOpen] = useState(false)
  const [modelDiscoverySearch, setModelDiscoverySearch] = useState('')
  const [modelDiscoveryModels, setModelDiscoveryModels] = useState<ProviderDiscoveredModel[]>([])
  const [modelDiscoverySelected, setModelDiscoverySelected] = useState<Set<string>>(() => new Set())
  const [modelDiscoveryError, setModelDiscoveryError] = useState<string | null>(null)
  const [modelDiscoveryFetched, setModelDiscoveryFetched] = useState(false)
  const [modelDiscoveryLoading, setModelDiscoveryLoading] = useState(false)
  const [connectivityState, setConnectivityState] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [connectivityMessage, setConnectivityMessage] = useState<string | null>(null)
  const [testModelSuggestionsOpen, setTestModelSuggestionsOpen] = useState(false)
  const modelDiscoveryDisabledReasonId = useId()
  const testModelSuggestionsId = useId()
  const apiKeyInputRef = useRef<HTMLInputElement>(null)
  const baseUrlInputRef = useRef<HTMLInputElement>(null)
  const testModelComboboxRef = useRef<HTMLDivElement>(null)
  const editing = mode === 'edit'
  const creating = mode === 'create'

  useEffect(() => {
    setForm(createFormState(mode === 'create' ? null : resource, descriptor))
    setLocalError(null)
    setModelDiscoveryOpen(false)
    setModelDiscoverySearch('')
    setModelDiscoveryModels([])
    setModelDiscoverySelected(new Set())
    setModelDiscoveryError(null)
    setModelDiscoveryFetched(false)
    setModelDiscoveryLoading(false)
    setConnectivityState('idle')
    setConnectivityMessage(null)
    setTestModelSuggestionsOpen(false)
  }, [mode, resource, descriptor])

  useEffect(() => {
    if (!testModelSuggestionsOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (testModelComboboxRef.current?.contains(event.target as Node)) return
      setTestModelSuggestionsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setTestModelSuggestionsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [testModelSuggestionsOpen])

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

  const modelsList = form.models.length ? form.models : [emptyModelEntry()]
  const headersList = form.headers.length ? form.headers : [emptyHeaderEntry()]
  const modelDiscoveryAvailable = supportsProviderModelDiscovery(descriptor.id)
  const connectivityTestAvailable = supportsProviderConnectivityTest(descriptor.id)
  const testModelQuery = (form.testModel ?? '').trim().toLowerCase()
  const testModelOptions = useMemo<TestModelOption[]>(() => {
    const seen = new Set<string>()
    const names: Array<{ value: string; label: string; searchText: string }> = []

    form.models.forEach((model) => {
      const value = model.name.trim()
      if (!value || seen.has(value)) return

      seen.add(value)
      const alias = model.alias.trim()
      const label = alias ? `${value} · ${alias}` : value
      names.push({
        value,
        label,
        searchText: `${value} ${alias}`.toLowerCase(),
      })
    })

    return [
      {
        value: '',
        label: t('providersPage.connectivity.testModelAutoOption'),
        searchText: t('providersPage.connectivity.testModelAutoOption').toLowerCase(),
        isAuto: true,
      },
      ...names,
    ]
  }, [form.models, t])
  const filteredTestModelOptions = useMemo(() => {
    if (!testModelQuery) return testModelOptions

    return testModelOptions.filter(
      (option) => option.isAuto || option.searchText.includes(testModelQuery),
    )
  }, [testModelOptions, testModelQuery])
  const hasFilteredTestModelMatches = filteredTestModelOptions.some((option) => !option.isAuto)
  const connectivitySignature = useMemo(
    () =>
      [
        descriptor.id,
        form.apiKey,
        form.baseUrl,
        form.testModel ?? '',
        resource?.authIndex ?? '',
        form.headers.map((header) => `${header.key}:${header.value}`).join('|'),
        form.models.map((model) => `${model.name}:${model.alias}`).join('|'),
      ].join('||'),
    [descriptor.id, form.apiKey, form.baseUrl, form.headers, form.models, form.testModel, resource],
  )

  useEffect(() => {
    setConnectivityState('idle')
    setConnectivityMessage(null)
  }, [connectivitySignature])

  const existingModelNames = useMemo(() => {
    const names = new Set<string>()
    form.models.forEach((model) => {
      const name = model.name.trim()
      if (name) names.add(name)
    })
    return names
  }, [form.models])
  const filteredDiscoveredModels = useMemo(() => {
    const query = modelDiscoverySearch.trim().toLowerCase()
    if (!query) return modelDiscoveryModels

    return modelDiscoveryModels.filter((model) =>
      `${model.name} ${model.alias ?? ''} ${model.description ?? ''}`.toLowerCase().includes(query),
    )
  }, [modelDiscoveryModels, modelDiscoverySearch])
  const selectableDiscoveredModels = useMemo(
    () => filteredDiscoveredModels.filter((model) => !existingModelNames.has(model.name)),
    [existingModelNames, filteredDiscoveredModels],
  )
  const allDiscoveredModelsSelected =
    selectableDiscoveredModels.length > 0 &&
    selectableDiscoveredModels.every((model) => modelDiscoverySelected.has(model.name))
  const hasDiscoveryApiKey = Boolean(form.apiKey.trim())
  const hasDiscoveryAuthIndex = Boolean(resource?.authIndex?.trim())
  const hasDiscoveryHeaderAuth = hasProviderDiscoveryHeaderAuth(descriptor.id, form.headers)
  const discoveryAuthStatus = hasDiscoveryApiKey
    ? 'apiKey'
    : hasDiscoveryAuthIndex
      ? 'savedCredential'
      : hasDiscoveryHeaderAuth
        ? 'header'
        : 'missing'
  const discoveryAuthReady = discoveryAuthStatus !== 'missing'
  const discoveryNeedsBaseUrl = descriptor.id === 'codex' || descriptor.id === 'openaiCompatibility'
  const discoveryBaseUrlStatus = form.baseUrl.trim()
    ? 'ready'
    : discoveryNeedsBaseUrl
      ? 'missing'
      : 'default'
  const discoveryBaseUrlReady = discoveryBaseUrlStatus !== 'missing'
  const discoveryValidationError = getProviderDiscoveryValidationError(
    descriptor.id,
    form,
    resource,
  )
  const canDiscoverModels = !discoveryValidationError
  const discoveryDisabledReason = discoveryValidationError
    ? t(`providersPage.discovery.disabledReason.${discoveryValidationError}`)
    : null
  const discoveryStatusBadgeClass =
    'rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap'

  const updateModelField = <Field extends keyof ProviderModelEntryInput>(
    index: number,
    field: Field,
    value: ProviderModelEntryInput[Field],
  ) => {
    updateField(
      'models',
      modelsList.map((model, modelIndex) =>
        modelIndex === index ? { ...model, [field]: value } : model,
      ),
    )
  }

  const updateHeaderField = <Field extends keyof ProviderHeaderEntryInput>(
    index: number,
    field: Field,
    value: ProviderHeaderEntryInput[Field],
  ) => {
    updateField(
      'headers',
      headersList.map((header, headerIndex) =>
        headerIndex === index ? { ...header, [field]: value } : header,
      ),
    )
  }

  const updateCloakField = <Field extends keyof NonNullable<ProviderEntryFormInput['cloak']>>(
    field: Field,
    value: NonNullable<ProviderEntryFormInput['cloak']>[Field],
  ) => {
    updateField('cloak', {
      ...(form.cloak ?? emptyCloakInput()),
      [field]: value,
    })
  }

  const handleFetchModels = async () => {
    setModelDiscoveryOpen(true)
    const validationError = getProviderDiscoveryValidationError(descriptor.id, form, resource)
    if (validationError) {
      if (validationError === 'baseUrlRequired') {
        baseUrlInputRef.current?.focus()
      } else {
        apiKeyInputRef.current?.focus()
      }
      setModelDiscoveryLoading(false)
      setModelDiscoveryFetched(false)
      setModelDiscoveryModels([])
      setModelDiscoverySelected(new Set())
      setModelDiscoveryError(t(`providersPage.discovery.validation.${validationError}`))
      return
    }

    setModelDiscoveryLoading(true)
    setModelDiscoveryError(null)

    try {
      const models = await onDiscoverModels({
        providerId: descriptor.id,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        authIndex: resource?.authIndex,
        headers: form.headers,
      })
      setModelDiscoveryModels(models)
      setModelDiscoveryFetched(true)
      setModelDiscoverySelected(new Set())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setModelDiscoveryModels([])
      setModelDiscoveryFetched(true)
      setModelDiscoveryError(
        message === 'Network Error' ? t('providersPage.discovery.networkError') : message,
      )
    } finally {
      setModelDiscoveryLoading(false)
    }
  }

  const handleTestModel = async () => {
    const validationError = getProviderConnectivityValidationError(descriptor.id, form, resource)
    if (validationError) {
      if (validationError === 'baseUrlRequired') {
        baseUrlInputRef.current?.focus()
      } else if (
        validationError === 'apiKeyRequired' ||
        validationError === 'apiKeyAndBaseUrlRequired'
      ) {
        apiKeyInputRef.current?.focus()
      }
      setConnectivityState('error')
      setConnectivityMessage(t(`providersPage.connectivity.validation.${validationError}`))
      return
    }

    setConnectivityState('loading')
    setConnectivityMessage(null)

    try {
      await onTestModel({
        providerId: descriptor.id,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        authIndex: resource?.authIndex,
        headers: form.headers,
        testModel: form.testModel,
        models: form.models,
      })
      setConnectivityState('success')
      setConnectivityMessage(t('providersPage.connectivity.success'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setConnectivityState('error')
      setConnectivityMessage(
        message === 'Network Error' ? t('providersPage.connectivity.networkError') : message,
      )
    }
  }

  const toggleDiscoveredModel = (name: string) => {
    setModelDiscoverySelected((current) => {
      const next = new Set(current)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const toggleAllDiscoveredModels = () => {
    if (allDiscoveredModelsSelected) {
      setModelDiscoverySelected(new Set())
      return
    }

    setModelDiscoverySelected(new Set(selectableDiscoveredModels.map((model) => model.name)))
  }

  const applyDiscoveredModels = () => {
    const selectedModels = modelDiscoveryModels.filter(
      (model) => modelDiscoverySelected.has(model.name) && !existingModelNames.has(model.name),
    )
    if (!selectedModels.length) return

    const baseModels = form.models.filter((model) => model.name.trim() || model.alias.trim())
    updateField('models', [
      ...baseModels,
      ...selectedModels.map((model) => ({
        name: model.name,
        alias: model.alias ?? '',
      })),
    ])
    setModelDiscoverySelected(new Set())
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
              ref={apiKeyInputRef}
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
            ref={baseUrlInputRef}
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

        <label className="grid gap-2 text-sm font-medium">
          <span>{t('providersPage.form.priority')}</span>
          <Input
            type="number"
            value={form.priority ?? ''}
            onChange={(event) =>
              updateField(
                'priority',
                event.target.value === '' ? undefined : Number(event.target.value),
              )
            }
            disabled={mutating}
          />
        </label>

        {connectivityTestAvailable ? (
          <div className="bg-muted/20 grid gap-2 rounded-md border p-3">
            <div className="grid gap-1.5">
              <span className="text-xs font-medium">
                {t('providersPage.connectivity.testModel')}
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div ref={testModelComboboxRef} className="relative min-w-0 flex-1">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    className="h-9 pr-9 pl-9"
                    value={form.testModel ?? ''}
                    onChange={(event) => {
                      updateField('testModel', event.target.value)
                      setTestModelSuggestionsOpen(true)
                    }}
                    onFocus={() => setTestModelSuggestionsOpen(true)}
                    placeholder={t('providersPage.connectivity.testModelSearchPlaceholder')}
                    disabled={mutating || connectivityState === 'loading'}
                    aria-autocomplete="list"
                    aria-controls={testModelSuggestionsId}
                    aria-expanded={testModelSuggestionsOpen}
                  />
                  <Button
                    type="button"
                    variant="text"
                    size="icon-sm"
                    className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2"
                    disabled={mutating || connectivityState === 'loading'}
                    aria-label={t('providersPage.connectivity.testModel')}
                    onClick={() => setTestModelSuggestionsOpen((open) => !open)}
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </Button>
                  {testModelSuggestionsOpen ? (
                    <div
                      id={testModelSuggestionsId}
                      role="listbox"
                      className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-md border shadow-md"
                    >
                      <div className="max-h-56 overflow-y-auto p-1">
                        {filteredTestModelOptions.map((option) => (
                          <button
                            key={`${option.isAuto ? 'auto' : 'model'}:${option.value}`}
                            type="button"
                            className={cn(
                              'hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 items-center rounded-sm px-3 py-2 text-left text-sm outline-none',
                              option.value === (form.testModel ?? '').trim()
                                ? 'bg-accent text-accent-foreground'
                                : 'text-foreground',
                            )}
                            role="option"
                            aria-selected={option.value === (form.testModel ?? '').trim()}
                            onClick={() => {
                              updateField('testModel', option.value)
                              setTestModelSuggestionsOpen(false)
                            }}
                          >
                            <span className="min-w-0 truncate">{option.label}</span>
                          </button>
                        ))}
                        {testModelQuery && !hasFilteredTestModelMatches ? (
                          <div className="text-muted-foreground px-3 py-3 text-xs leading-5">
                            {t('providersPage.connectivity.testModelSearchEmpty')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 sm:shrink-0"
                  disabled={mutating || connectivityState === 'loading'}
                  onClick={() => void handleTestModel()}
                >
                  {connectivityState === 'loading' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Network className="size-4" aria-hidden="true" />
                  )}
                  {t('providersPage.connectivity.test')}
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              {t('providersPage.connectivity.testModelHint')}
            </p>
            {connectivityMessage ? (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-5',
                  connectivityState === 'success'
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-destructive/30 bg-destructive/10 text-destructive',
                )}
              >
                {connectivityState === 'success' ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 break-words">{connectivityMessage}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {descriptor.supportsDisabled ? (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
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

        <Collapsible className="rounded-md border px-3 py-2.5 text-sm">
          <CollapsibleTrigger className="group focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px]">
            <span className="min-w-0">
              <span className="block">{t('providersPage.form.modelsSection')}</span>
              <span className="text-muted-foreground mt-1 block text-xs leading-5 font-normal">
                {t('providersPage.form.modelsHint')}
              </span>
            </span>
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 grid gap-3">
            {modelDiscoveryAvailable ? (
              <div className="bg-muted/20 grid gap-3 rounded-md border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t('providersPage.discovery.title')}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5 sm:whitespace-nowrap">
                      {t('providersPage.discovery.description')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:shrink-0 sm:items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="sm:shrink-0"
                      disabled={mutating || modelDiscoveryLoading || !canDiscoverModels}
                      aria-describedby={
                        discoveryDisabledReason ? modelDiscoveryDisabledReasonId : undefined
                      }
                      onClick={() => void handleFetchModels()}
                    >
                      {modelDiscoveryLoading ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden="true" />
                      )}
                      {modelDiscoveryFetched
                        ? t('providersPage.discovery.reload')
                        : t('providersPage.discovery.openButton')}
                    </Button>
                    {discoveryDisabledReason ? (
                      <p
                        id={modelDiscoveryDisabledReasonId}
                        className="text-warning text-xs leading-5 sm:text-right sm:whitespace-nowrap"
                      >
                        {discoveryDisabledReason}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-1.5 border-t pt-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t('providersPage.discovery.authStatusLabel')}
                    </span>
                    <span
                      className={cn(
                        discoveryStatusBadgeClass,
                        discoveryAuthReady
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-warning/35 bg-warning/12 text-warning',
                      )}
                    >
                      {t(`providersPage.discovery.authStatus.${discoveryAuthStatus}`)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t('providersPage.discovery.baseUrlStatusLabel')}
                    </span>
                    <span
                      className={cn(
                        discoveryStatusBadgeClass,
                        discoveryBaseUrlReady
                          ? 'border-info/30 bg-info/10 text-info'
                          : 'border-warning/35 bg-warning/12 text-warning',
                      )}
                    >
                      {t(`providersPage.discovery.baseUrlStatus.${discoveryBaseUrlStatus}`)}
                    </span>
                  </div>
                </div>

                {modelDiscoveryOpen ? (
                  <div className="grid gap-3">
                    <div className="relative">
                      <Search
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <Input
                        type="search"
                        className="pl-9"
                        value={modelDiscoverySearch}
                        onChange={(event) => setModelDiscoverySearch(event.target.value)}
                        placeholder={t('providersPage.discovery.searchPlaceholder')}
                        disabled={modelDiscoveryLoading}
                      />
                    </div>

                    {modelDiscoveryError ? (
                      <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs leading-5">
                        {modelDiscoveryError}
                      </div>
                    ) : null}

                    {modelDiscoveryLoading && !modelDiscoveryModels.length ? (
                      <div className="text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
                        {t('providersPage.discovery.loading')}
                      </div>
                    ) : modelDiscoveryFetched &&
                      !modelDiscoveryModels.length &&
                      !modelDiscoveryError ? (
                      <div className="text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
                        {t('providersPage.discovery.empty')}
                      </div>
                    ) : modelDiscoveryModels.length ? (
                      <div className="grid gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={allDiscoveredModelsSelected}
                              disabled={selectableDiscoveredModels.length === 0}
                              onCheckedChange={toggleAllDiscoveredModels}
                            />
                            <span>
                              {allDiscoveredModelsSelected
                                ? t('providersPage.discovery.clearAll')
                                : t('providersPage.discovery.selectAll')}
                            </span>
                          </label>
                          <span className="text-muted-foreground text-xs">
                            {t('providersPage.discovery.selectedCount', {
                              selected: modelDiscoverySelected.size,
                              total: selectableDiscoveredModels.length,
                            })}
                          </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto rounded-md border">
                          {filteredDiscoveredModels.length ? (
                            filteredDiscoveredModels.map((model) => {
                              const existing = existingModelNames.has(model.name)
                              return (
                                <label
                                  key={model.name}
                                  className={cn(
                                    'hover:bg-muted/60 flex items-start gap-2 border-b px-3 py-2 text-xs last:border-b-0',
                                    existing && 'text-muted-foreground bg-muted/40',
                                  )}
                                >
                                  <Checkbox
                                    className="mt-0.5"
                                    checked={existing || modelDiscoverySelected.has(model.name)}
                                    disabled={existing}
                                    onCheckedChange={() => toggleDiscoveredModel(model.name)}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-mono break-all">{model.name}</span>
                                    {model.alias || model.description ? (
                                      <span className="text-muted-foreground mt-1 block leading-5">
                                        {model.alias ?? model.description}
                                      </span>
                                    ) : null}
                                  </span>
                                  {existing ? (
                                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]">
                                      {t('providersPage.discovery.alreadyAdded')}
                                    </span>
                                  ) : null}
                                </label>
                              )
                            })
                          ) : (
                            <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                              {t('providersPage.discovery.empty')}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setModelDiscoveryOpen(false)}
                          >
                            {t('providersPage.discovery.close')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={modelDiscoverySelected.size === 0}
                            onClick={applyDiscoveredModels}
                          >
                            {t('providersPage.discovery.apply', {
                              count: modelDiscoverySelected.size,
                            })}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
                        {t('providersPage.discovery.notLoaded')}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {modelsList.map((model, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="grid gap-1.5 text-xs font-medium">
                  <span>{t('providersPage.form.modelName')}</span>
                  <Input
                    value={model.name}
                    onChange={(event) => updateModelField(index, 'name', event.target.value)}
                    placeholder="model-name"
                    disabled={mutating}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium">
                  <span>{t('providersPage.form.modelAlias')}</span>
                  <Input
                    value={model.alias}
                    onChange={(event) => updateModelField(index, 'alias', event.target.value)}
                    placeholder="alias"
                    disabled={mutating}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  disabled={mutating || modelsList.length <= 1}
                  aria-label={t('providersPage.form.removeModel')}
                  onClick={() =>
                    updateField(
                      'models',
                      modelsList.filter((_, modelIndex) => modelIndex !== index),
                    )
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={mutating}
              onClick={() => updateField('models', [...modelsList, emptyModelEntry()])}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('providersPage.form.addModel')}
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible className="rounded-md border px-3 py-2.5 text-sm">
          <CollapsibleTrigger className="group focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px]">
            <span className="min-w-0">
              <span className="block">{t('providersPage.form.excludedModels')}</span>
              <span className="text-muted-foreground mt-1 block text-xs leading-5 font-normal">
                {t('providersPage.form.excludedModelsHint')}
              </span>
            </span>
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Textarea
              value={form.excludedModelsText}
              onChange={(event) => updateField('excludedModelsText', event.target.value)}
              rows={4}
              placeholder={'model-a\nmodel-b'}
              disabled={mutating}
            />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible className="rounded-md border px-3 py-2.5 text-sm">
          <CollapsibleTrigger className="group focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px]">
            <span className="min-w-0">
              <span className="block">{t('providersPage.form.headersSection')}</span>
              <span className="text-muted-foreground mt-1 block text-xs leading-5 font-normal">
                {t('providersPage.form.headersHint')}
              </span>
            </span>
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 grid gap-3">
            {headersList.map((header, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="grid gap-1.5 text-xs font-medium">
                  <span>{t('providersPage.form.headerName')}</span>
                  <Input
                    value={header.key}
                    onChange={(event) => updateHeaderField(index, 'key', event.target.value)}
                    placeholder="X-Custom-Header"
                    disabled={mutating}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium">
                  <span>{t('providersPage.form.headerValue')}</span>
                  <Input
                    value={header.value}
                    onChange={(event) => updateHeaderField(index, 'value', event.target.value)}
                    placeholder="value"
                    disabled={mutating}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  disabled={mutating || headersList.length <= 1}
                  aria-label={t('providersPage.form.removeHeader')}
                  onClick={() =>
                    updateField(
                      'headers',
                      headersList.filter((_, headerIndex) => headerIndex !== index),
                    )
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={mutating}
              onClick={() => updateField('headers', [...headersList, emptyHeaderEntry()])}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('providersPage.form.addHeader')}
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {descriptor.supportsCloak && form.cloak ? (
          <Collapsible className="rounded-md border px-3 py-2.5 text-sm">
            <CollapsibleTrigger className="group focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px]">
              <span className="min-w-0">
                <span className="block">{t('providersPage.form.cloakSection')}</span>
                <span className="text-muted-foreground mt-1 block text-xs leading-5 font-normal">
                  {t('providersPage.form.cloakHint')}
                </span>
              </span>
              <ChevronDown
                className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-3">
              <label className="grid gap-1.5 text-xs font-medium">
                <span>{t('providersPage.form.cloakMode')}</span>
                <Input
                  value={form.cloak.mode}
                  onChange={(event) => updateCloakField('mode', event.target.value)}
                  placeholder="auto / always / never"
                  disabled={mutating}
                />
              </label>
              <label className="flex items-start gap-3 text-xs">
                <Checkbox
                  className="mt-0.5"
                  checked={form.cloak.strictMode}
                  disabled={mutating}
                  onCheckedChange={(checked) => updateCloakField('strictMode', checked === true)}
                />
                <span className="grid gap-1">
                  <span className="font-medium">{t('providersPage.form.cloakStrict')}</span>
                  <span className="text-muted-foreground leading-5">
                    {t('providersPage.form.cloakStrictHint')}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-xs">
                <Checkbox
                  className="mt-0.5"
                  checked={form.cloak.cacheUserId}
                  disabled={mutating}
                  onCheckedChange={(checked) => updateCloakField('cacheUserId', checked === true)}
                />
                <span className="grid gap-1">
                  <span className="font-medium">{t('providersPage.form.cloakCacheUserId')}</span>
                  <span className="text-muted-foreground leading-5">
                    {t('providersPage.form.cloakCacheUserIdHint')}
                  </span>
                </span>
              </label>
              <label className="grid gap-1.5 text-xs font-medium">
                <span>{t('providersPage.form.cloakSensitiveWords')}</span>
                <Textarea
                  value={form.cloak.sensitiveWordsText}
                  onChange={(event) => updateCloakField('sensitiveWordsText', event.target.value)}
                  rows={3}
                  disabled={mutating}
                />
              </label>
            </CollapsibleContent>
          </Collapsible>
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
            onDiscoverModels={workbench.discoverProviderModels}
            onTestModel={workbench.testProviderModel}
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
