import { useEffect, useId, useMemo, useRef, useState } from 'react'

import type { TFunction } from 'i18next'
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

import { TableEmptyState } from '@/components/shared/empty-state'
import { fieldClassName } from '@/components/shared/form-layout'
import { ProviderLogo } from '@/components/shared/provider-logo'
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
import { isValidProxyUrl } from '@/features/credentials/credential-detail-drawer'
import { useProviderWorkbench } from '@/features/providers/use-provider-workbench'
import type { UpstreamProvidersStats } from '@/features/upstream/summary-cards'
import { MAX_CREDENTIAL_WEIGHT } from '@/lib/api/management/credentials'
import {
  PROVIDER_ERROR_RULE_ACTIONS,
  PROVIDER_THINKING_LEVELS,
  type ProviderApiKeyEntryInput,
  type ProviderConnectivityTestInput,
  type ProviderDescriptor,
  type ProviderDiscoveredModel,
  type ProviderEntryFormInput,
  type ProviderErrorRuleAction,
  type ProviderGroup,
  type ProviderHeaderEntryInput,
  type ProviderId,
  type ProviderModelChannel,
  type ProviderModelDefinition,
  type ProviderModelDiscoveryInput,
  type ProviderModelEntryInput,
  type ProviderRequestScopedErrorRule,
  type ProviderResource,
  type ProviderThinkingLevel,
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

const emptyForm: ProviderEntryFormInput = {
  apiKey: '',
  name: '',
  baseUrl: '',
  proxyUrl: '',
  prefix: '',
  disabled: false,
  disableCooling: null,
  websockets: false,
  priority: undefined,
  weight: undefined,
  requestRetry: undefined,
  models: [],
  headers: [],
  excludedModelsText: '',
  testModel: undefined,
  cloak: undefined,
  requestScopedErrors: [],
  disableCodexCloaking: null,
  alphaSearch: false,
  rebuildMidSystemMessage: false,
  nativeToolSearch: false,
  fingerprintProfile: '',
  experimentalCchSigning: false,
  supportPromptCacheKey: false,
  apiKeyEntries: undefined,
}

type UnknownRecord = Record<string, unknown>

function emptyModelEntry(): ProviderModelEntryInput {
  return {
    name: '',
    alias: '',
    displayName: '',
    forceMapping: false,
    maxContextLength: '',
    isCompat: false,
    supportConfigurationUpdate: false,
    image: false,
    inputModalitiesText: '',
    outputModalitiesText: '',
    useMaxCompletionTokens: false,
    thinkingEnabled: false,
    thinkingLevels: [],
    thinkingMin: '',
    thinkingMax: '',
    thinkingZeroAllowed: false,
    thinkingDynamicAllowed: false,
  }
}

function emptyApiKeyEntry(): ProviderApiKeyEntryInput {
  return {
    apiKey: '',
    proxyUrl: '',
    weight: undefined,
  }
}

function emptyErrorRule(): ProviderRequestScopedErrorRule {
  return {
    status: 429,
    action: 'continue-and-cooldown',
    match: [],
    'match-regexr': [],
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

  const allowedLevels = new Set<string>(PROVIDER_THINKING_LEVELS)

  return models.filter(isRecord).map((model) => {
    const thinking = isRecord(model.thinking) ? model.thinking : null
    const rawLevels = Array.isArray(thinking?.levels) ? thinking.levels : []
    const thinkingLevels = rawLevels
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter((item): item is ProviderThinkingLevel => allowedLevels.has(item))
    const inputModalities = Array.isArray(model['input-modalities'])
      ? model['input-modalities'].filter((item): item is string => typeof item === 'string')
      : []
    const outputModalities = Array.isArray(model['output-modalities'])
      ? model['output-modalities'].filter((item): item is string => typeof item === 'string')
      : []

    return {
      name: readStringField(model, 'name'),
      alias: readStringField(model, 'alias'),
      displayName: readStringField(model, 'display-name'),
      forceMapping: model['force-mapping'] === true,
      maxContextLength:
        typeof model['max-context-length'] === 'number' &&
        Number.isFinite(model['max-context-length'])
          ? String(model['max-context-length'])
          : '',
      isCompat: model['is-compat'] === true,
      supportConfigurationUpdate: model['support-configuration-update'] === true,
      image: model.image === true,
      inputModalitiesText: inputModalities.join(', '),
      outputModalitiesText: outputModalities.join(', '),
      useMaxCompletionTokens: model['use-max-completion-tokens'] === true,
      thinkingEnabled: thinking !== null,
      thinkingLevels,
      thinkingMin:
        typeof thinking?.min === 'number' && Number.isFinite(thinking.min)
          ? String(thinking.min)
          : '',
      thinkingMax:
        typeof thinking?.max === 'number' && Number.isFinite(thinking.max)
          ? String(thinking.max)
          : '',
      thinkingZeroAllowed: thinking?.['zero-allowed'] === true || thinking?.zero_allowed === true,
      thinkingDynamicAllowed:
        thinking?.['dynamic-allowed'] === true || thinking?.dynamic_allowed === true,
      raw: model,
    }
  })
}

function readRequestScopedErrors(raw: UnknownRecord): ProviderRequestScopedErrorRule[] {
  const rules = raw['request-scoped-errors']
  if (!Array.isArray(rules)) return []
  const allowedActions = new Set<string>(PROVIDER_ERROR_RULE_ACTIONS)

  return rules.filter(isRecord).flatMap((rule) => {
    const status = typeof rule.status === 'number' && Number.isFinite(rule.status) ? rule.status : 0
    const rawAction = readStringField(rule, 'action').trim().toLowerCase()
    const action: ProviderErrorRuleAction = allowedActions.has(rawAction)
      ? (rawAction as ProviderErrorRuleAction)
      : 'continue'
    const match = Array.isArray(rule.match)
      ? rule.match.filter((item): item is string => typeof item === 'string')
      : undefined
    const matchRegex = Array.isArray(rule['match-regexr'])
      ? rule['match-regexr'].filter((item): item is string => typeof item === 'string')
      : undefined
    return [
      {
        status,
        action,
        ...(match ? { match } : {}),
        ...(matchRegex ? { 'match-regexr': matchRegex } : {}),
      },
    ]
  })
}

function readCompatibilityApiKeyEntries(raw: UnknownRecord): ProviderApiKeyEntryInput[] {
  const rawKeys = Array.isArray(raw.keys)
    ? raw.keys
    : Array.isArray(raw['api-key-entries'])
      ? raw['api-key-entries']
      : []
  const entries = rawKeys.filter(isRecord).map((key) => ({
    id: readStringField(key, 'id') || readStringField(key, 'uuid') || undefined,
    apiKey: '',
    existingApiKey: readStringField(key, 'api-key') || undefined,
    proxyUrl: readStringField(key, 'proxy-url'),
    weight: typeof key.weight === 'number' && Number.isFinite(key.weight) ? key.weight : undefined,
  }))
  return entries.length > 0 ? entries : [emptyApiKeyEntry()]
}

function readProviderHeaders(raw: UnknownRecord): ProviderHeaderEntryInput[] {
  const headers = raw.headers
  if (!isRecord(headers)) return []

  return Object.entries(headers).map(([key, value]) => ({
    key,
    value:
      typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '',
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
    descriptor?.supportsConnectivityTest ??
    (providerId === 'claude' || providerId === 'openaiCompatibility')
  const supportsCloak = descriptor?.supportsCloak ?? providerId === 'claude'

  if (!resource) {
    return {
      ...emptyForm,
      baseUrl: descriptor?.defaultBaseUrl ?? '',
      models: [],
      headers: [],
      testModel: supportsTestModel ? '' : undefined,
      cloak: supportsCloak ? emptyCloakInput() : undefined,
      apiKeyEntries: providerId === 'openaiCompatibility' ? [emptyApiKeyEntry()] : undefined,
    }
  }

  const raw = resource.raw
  const coolingOverride =
    resource.disableCoolingOverride !== undefined
      ? resource.disableCoolingOverride
      : typeof raw['disable-cooling'] === 'boolean'
        ? raw['disable-cooling']
        : null

  return {
    apiKey: '',
    name: resource.name ?? '',
    baseUrl: resource.baseUrl ?? '',
    proxyUrl: resource.proxyUrl ?? '',
    prefix: resource.prefix ?? '',
    disabled: resource.disabled,
    disableCooling: coolingOverride,
    websockets: resource.websockets,
    priority: resource.priority ?? undefined,
    weight:
      resource.weight ??
      (typeof raw.weight === 'number' && Number.isFinite(raw.weight) ? raw.weight : undefined),
    requestRetry: resource.requestRetry ?? undefined,
    models: readProviderModels(raw),
    headers: readProviderHeaders(raw),
    excludedModelsText: readExcludedModelsText(raw),
    testModel: supportsTestModel ? readStringField(raw, 'test-model') : undefined,
    cloak: supportsCloak ? readProviderCloak(raw) : undefined,
    requestScopedErrors: readRequestScopedErrors(raw),
    disableCodexCloaking:
      typeof raw['disable-codex-cloaking'] === 'boolean' ? raw['disable-codex-cloaking'] : null,
    alphaSearch: raw['alpha-search'] === true,
    rebuildMidSystemMessage: raw['rebuild-mid-system-message'] === true,
    nativeToolSearch: raw['native-tool-search'] === true,
    fingerprintProfile: readStringField(raw, 'fingerprint-profile'),
    experimentalCchSigning: raw['experimental-cch-signing'] === true,
    supportPromptCacheKey: raw['support-prompt-cache-key'] === true,
    apiKeyEntries:
      providerId === 'openaiCompatibility' ? readCompatibilityApiKeyEntries(raw) : undefined,
  }
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
  if (providerId === 'gemini' || providerId === 'interactions') {
    return hasHeaderEntry(headers, ['x-goog-api-key'])
  }

  if (providerId === 'claude') {
    return hasHeaderEntry(headers, ['x-api-key'])
  }

  return hasHeaderEntry(headers, ['authorization'])
}

function resolvePrimaryFormApiKey(form: ProviderEntryFormInput): string {
  const direct = form.apiKey.trim()
  if (direct) return direct
  for (const entry of form.apiKeyEntries ?? []) {
    const candidate = entry.apiKey.trim() || entry.existingApiKey?.trim() || ''
    if (candidate) return candidate
  }
  return ''
}

function getProviderDiscoveryValidationError(
  descriptor: ProviderDescriptor,
  form: ProviderEntryFormInput,
  resource: ProviderResource | null,
) {
  const hasApiKey = Boolean(resolvePrimaryFormApiKey(form))
  const hasAuthIndex = Boolean(resource?.authIndex?.trim())
  const hasHeaderAuth = hasProviderDiscoveryHeaderAuth(descriptor.id, form.headers)
  const hasAuth = hasApiKey || hasAuthIndex || hasHeaderAuth
  const needsBaseUrl = descriptor.requiresBaseUrl
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
  descriptor: ProviderDescriptor,
  form: ProviderEntryFormInput,
  resource: ProviderResource | null,
) {
  const hasApiKey = Boolean(resolvePrimaryFormApiKey(form))
  const hasAuthIndex = Boolean(resource?.authIndex?.trim())
  const hasHeaderAuth = hasProviderDiscoveryHeaderAuth(descriptor.id, form.headers)
  const hasAuth = hasApiKey || hasAuthIndex || hasHeaderAuth
  const needsBaseUrl = descriptor.id === 'openaiCompatibility'
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

type ProviderFormField =
  | 'name'
  | 'apiKey'
  | 'baseUrl'
  | 'proxyUrl'
  | 'priority'
  | 'weight'
  | 'requestRetry'
type ProviderFieldErrors = Partial<Record<ProviderFormField, string>>

export function validateProviderForm(
  descriptor: ProviderDescriptor,
  form: ProviderEntryFormInput,
  mode: PanelMode,
  t: TFunction,
): { fieldErrors: ProviderFieldErrors; generalError: string | null } {
  const fieldErrors: ProviderFieldErrors = {}

  if (descriptor.supportsName && !form.name.trim()) {
    fieldErrors.name = t('providersPage.form.validation.nameRequired')
  }

  if (mode === 'create' && descriptor.supportsApiKey && !resolvePrimaryFormApiKey(form)) {
    fieldErrors.apiKey = t('providersPage.form.validation.apiKeyRequired')
  }

  if (descriptor.requiresBaseUrl && !form.baseUrl.trim()) {
    fieldErrors.baseUrl = t('providersPage.form.validation.baseUrlRequired')
  }

  const trimmedProxy = form.proxyUrl.trim()
  if (trimmedProxy && !isValidProxyUrl(trimmedProxy)) {
    fieldErrors.proxyUrl = t('configPage.proxyPools.validation.urlInvalid')
  }

  if (
    form.priority !== undefined &&
    form.priority !== null &&
    !Number.isSafeInteger(form.priority)
  ) {
    fieldErrors.priority = t('credentialsPage.form.priorityInvalid')
  }

  if (
    form.weight !== undefined &&
    form.weight !== null &&
    (!Number.isSafeInteger(form.weight) || form.weight > MAX_CREDENTIAL_WEIGHT)
  ) {
    fieldErrors.weight = t('credentialsPage.form.weightInvalid')
  }

  if (
    form.requestRetry !== undefined &&
    form.requestRetry !== null &&
    (!Number.isSafeInteger(form.requestRetry) || form.requestRetry < 0)
  ) {
    fieldErrors.requestRetry = t('providersPage.form.validation.requestRetryInvalid')
  }

  let generalError: string | null = null
  if (
    form.apiKeyEntries?.some(
      (entry) => entry.proxyUrl.trim() && !isValidProxyUrl(entry.proxyUrl.trim()),
    )
  ) {
    generalError = t('configPage.proxyPools.validation.urlInvalid')
  } else if (
    form.apiKeyEntries?.some(
      (entry) =>
        entry.weight !== undefined &&
        entry.weight !== null &&
        (!Number.isSafeInteger(entry.weight) || entry.weight > MAX_CREDENTIAL_WEIGHT),
    )
  ) {
    generalError = t('credentialsPage.form.weightInvalid')
  } else if (
    form.models.some(
      (model) =>
        !model.name.trim() &&
        (model.alias.trim() || model.displayName.trim() || model.forceMapping),
    )
  ) {
    generalError = t('providersPage.form.validation.modelNameRequired')
  } else if (
    form.models.some((model) => {
      if (!model.name.trim()) return false
      const ctx = model.maxContextLength?.trim()
      if (ctx && (!/^\d+$/.test(ctx) || !Number.isSafeInteger(Number(ctx)) || Number(ctx) <= 0)) {
        return true
      }
      if (model.thinkingEnabled) {
        const minText = model.thinkingMin?.trim()
        const maxText = model.thinkingMax?.trim()
        if (minText && (!/^\d+$/.test(minText) || !Number.isSafeInteger(Number(minText)))) {
          return true
        }
        if (maxText && (!/^\d+$/.test(maxText) || !Number.isSafeInteger(Number(maxText)))) {
          return true
        }
        if (minText && maxText && Number(minText) > Number(maxText)) {
          return true
        }
      }
      return false
    })
  ) {
    generalError = t('providersPage.form.validation.modelOptionsInvalid')
  } else if (form.headers.some((header) => !header.key.trim() && header.value.trim())) {
    generalError = t('providersPage.form.validation.headerNameRequired')
  } else if (
    form.requestScopedErrors?.some(
      (rule) =>
        !Number.isSafeInteger(rule.status) ||
        rule.status <= 0 ||
        ((rule.match?.filter((m) => m.trim()).length ?? 0) === 0 &&
          (rule['match-regexr']?.filter((m) => m.trim()).length ?? 0) === 0),
    )
  ) {
    generalError = t('providersPage.form.validation.errorRuleInvalid')
  }

  return { fieldErrors, generalError }
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
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <Skeleton className="h-[520px] rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg" />
    </div>
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
                <AlertTriangle
                  className="text-warning size-4 shrink-0"
                  aria-label={t('providersPage.categories.issue')}
                />
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
  unsupported,
  selectedResourceId,
  onCreateResource,
  onDeleteResource,
  onEditResource,
  onViewResource,
}: {
  resources: ProviderResource[]
  unsupported: boolean
  selectedResourceId: string | null
  onCreateResource: () => void
  onDeleteResource: (resource: ProviderResource) => void
  onEditResource: (resource: ProviderResource) => void
  onViewResource: (resource: ProviderResource) => void
}) {
  const { t } = useTranslation()
  /*
   * Base URL, prefix and the model count are all in the detail sheet the eye
   * opens. The key names the row and status is why anyone scans this table, so
   * those two are what survives a phone.
   */
  const showSecondary = useSecondaryColumns()

  if (resources.length === 0) {
    if (unsupported) {
      return (
        <TableEmptyState
          kind="unsupported"
          className="m-0"
          title={t('providersPage.table.unsupportedTitle')}
          description={t('providersPage.table.unsupportedDescription')}
        />
      )
    }

    return (
      <TableEmptyState
        kind="empty"
        className="m-0"
        title={t('providersPage.table.empty')}
        action={
          <Button variant="outline" size="md" onClick={onCreateResource}>
            <Plus className="size-4" aria-hidden="true" />
            {t('providersPage.actions.new')}
          </Button>
        }
      />
    )
  }

  return (
    <Table
      containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
      className="table-fixed sm:min-w-[1080px]"
    >
      <colgroup>
        <col className={showSecondary ? 'w-[220px]' : undefined} />
        {showSecondary ? (
          <>
            <col className="w-[240px]" />
            <col className="w-[96px]" />
            <col className="w-[150px]" />
          </>
        ) : null}
        <col className={showSecondary ? 'w-[120px]' : 'w-28'} />
        <col className="table-action-column-3" />
      </colgroup>
      <TableHeader className={stickyTableHeaderClassName}>
        <TableRow variant="static">
          <TableHead>{t('providersPage.table.key')}</TableHead>
          {showSecondary ? (
            <>
              <TableHead>{t('providersPage.table.baseUrl')}</TableHead>
              <TableHead>{t('providersPage.table.prefix')}</TableHead>
              <TableHead>{t('providersPage.table.models')}</TableHead>
            </>
          ) : null}
          <TableHead>{t('providersPage.table.status')}</TableHead>
          <TableHead className="table-sticky-action-head table-action-column-3 text-right">
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
            {showSecondary ? (
              <>
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
              </>
            ) : null}
            <TableCell>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                  resource.disabled
                    ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
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
            <TableCell className="table-sticky-action-cell table-action-column-3 text-right transition-colors">
              <RowActions
                menuLabel={resource.name ?? resource.identifier}
                actions={[
                  {
                    id: 'view',
                    label: t('providersPage.actions.view'),
                    icon: Eye,
                    onSelect: () => onViewResource(resource),
                  },
                  {
                    id: 'edit',
                    label: t('providersPage.actions.edit'),
                    icon: Pencil,
                    onSelect: () => onEditResource(resource),
                  },
                  {
                    id: 'delete',
                    label: t('providersPage.actions.delete'),
                    icon: Trash2,
                    tone: 'destructive',
                    onSelect: () => onDeleteResource(resource),
                  },
                ]}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function formatNumber(value: number | null) {
  if (value === null || value <= 0) return null
  return new Intl.NumberFormat(undefined).format(value)
}

function ProviderModelCatalog({
  channels,
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
  channels: ProviderModelChannel[]
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
                  {channels.map((item) => (
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
          <div className="border-warning/35 bg-warning/12 rounded-md border px-3 py-2.5 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-warning-foreground dark:text-warning font-medium">
                  {t('providersPage.modelCatalog.errorTitle')}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-5 break-words">
                  {errorMessage}
                </p>
              </div>
              <Button variant="outline" size="md" disabled={loading} onClick={onRetry}>
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
            <TableEmptyState
              compact
              kind="empty"
              className="m-0 min-h-28"
              title={t('providersPage.modelCatalog.empty')}
            />
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
            <span className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-2.5 py-1 text-xs font-medium">
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
          <Button variant="outline" size="md" onClick={onOpen}>
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
  onToggleStatus,
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
  onToggleStatus: (resource: ProviderResource, disabled: boolean) => Promise<void>
  onDiscoverModels: (input: ProviderModelDiscoveryInput) => Promise<ProviderDiscoveredModel[]>
  onTestModel: (input: ProviderConnectivityTestInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ProviderEntryFormInput>(() =>
    createFormState(resource, descriptor),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ProviderFieldErrors>({})
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
    setFieldErrors({})
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
    setLocalError(null)
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const { fieldErrors: nextFieldErrors, generalError } = validateProviderForm(
      descriptor,
      form,
      mode,
      t,
    )

    if (Object.keys(nextFieldErrors).length > 0 || generalError) {
      setFieldErrors(nextFieldErrors)
      setLocalError(generalError)
      setTimeout(() => {
        document.querySelector<HTMLElement>('#provider-entry-form [aria-invalid="true"]')?.focus()
      }, 0)
      return
    }

    try {
      setLocalError(null)
      setFieldErrors({})
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
  const modelDiscoveryAvailable = descriptor.supportsModelDiscovery
  const connectivityTestAvailable = descriptor.supportsConnectivityTest
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
        form.models
          .map(
            (model) =>
              `${model.name}:${model.alias}:${model.displayName}:${String(model.forceMapping)}`,
          )
          .join('|'),
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
  const hasDiscoveryApiKey = Boolean(resolvePrimaryFormApiKey(form))
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
  const discoveryNeedsBaseUrl = descriptor.requiresBaseUrl
  const discoveryBaseUrlStatus = form.baseUrl.trim()
    ? 'ready'
    : discoveryNeedsBaseUrl
      ? 'missing'
      : 'default'
  const discoveryBaseUrlReady = discoveryBaseUrlStatus !== 'missing'
  const discoveryValidationError = getProviderDiscoveryValidationError(descriptor, form, resource)
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
    const validationError = getProviderDiscoveryValidationError(descriptor, form, resource)
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
        apiKey: resolvePrimaryFormApiKey(form),
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
    const validationError = getProviderConnectivityValidationError(descriptor, form, resource)
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
        apiKey: resolvePrimaryFormApiKey(form),
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
        ...emptyModelEntry(),
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
        [
          'priority',
          resource.priority === null ? t('providersPage.status.notSet') : String(resource.priority),
        ],
        [
          'requestRetry',
          resource.requestRetry === null
            ? t('providersPage.status.inherited')
            : String(resource.requestRetry),
        ],
        [
          'disableCooling',
          resource.disableCoolingOverride === null
            ? t('providersPage.status.inherited')
            : resource.disableCooling
              ? t('providersPage.status.enabled')
              : t('providersPage.status.disabled'),
        ],
        ...(descriptor.supportsWebsockets
          ? ([
              [
                'websockets',
                resource.websockets
                  ? t('providersPage.status.enabled')
                  : t('providersPage.status.disabled'),
              ],
            ] as const)
          : []),
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

        {descriptor.disabledMode === 'auth-status' ? (
          <div className="border-warning/25 bg-warning/8 mt-5 rounded-md border px-3 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-medium">
                  {t('providersPage.detail.statusActionTitle')}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {resource.disabled
                    ? t('providersPage.detail.enableDescription')
                    : t('providersPage.detail.disableDescription')}
                </p>
              </div>
              <Button
                type="button"
                variant={resource.disabled ? 'secondary' : 'warning'}
                size="md"
                disabled={mutating}
                onClick={() => void onToggleStatus(resource, !resource.disabled)}
              >
                {resource.disabled
                  ? t('providersPage.actions.enable')
                  : t('providersPage.actions.disable')}
              </Button>
            </div>
          </div>
        ) : null}
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

  const baseUrlRequired = descriptor.requiresBaseUrl

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

      <form
        id="provider-entry-form"
        noValidate
        className="mt-5 grid gap-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {descriptor.supportsName ? (
          <label className={fieldClassName}>
            <span>{t('providersPage.form.name')}</span>
            <Input
              value={form.name}
              aria-invalid={Boolean(fieldErrors.name)}
              onChange={(event) => updateField('name', event.target.value)}
              onBlur={() => {
                if (descriptor.supportsName && !form.name.trim()) {
                  setFieldErrors((current) => ({
                    ...current,
                    name: t('providersPage.form.validation.nameRequired'),
                  }))
                }
              }}
              disabled={mutating}
            />
            {fieldErrors.name ? (
              <span className="text-destructive text-xs leading-5 font-normal">
                {fieldErrors.name}
              </span>
            ) : null}
          </label>
        ) : null}

        {descriptor.id === 'openaiCompatibility' ? (
          <div className="grid gap-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t('providersPage.form.apiKeyEntriesTitle')}</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                  {t('providersPage.form.apiKeyEntriesHint')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={mutating}
                onClick={() =>
                  updateField('apiKeyEntries', [
                    ...(form.apiKeyEntries ?? [emptyApiKeyEntry()]),
                    emptyApiKeyEntry(),
                  ])
                }
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t('providersPage.form.addApiKeyEntry')}
              </Button>
            </div>
            {(form.apiKeyEntries ?? [emptyApiKeyEntry()]).map((entry, idx) => (
              <div key={entry.id ?? idx} className="grid gap-2.5 rounded-md border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">
                    {t('providersPage.form.apiKeyEntryLabel', { index: idx + 1 })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={mutating}
                    aria-label={t('providersPage.form.removeApiKeyEntry')}
                    onClick={() => {
                      const next = (form.apiKeyEntries ?? []).filter((_, i) => i !== idx)
                      updateField('apiKeyEntries', next.length ? next : [emptyApiKeyEntry()])
                    }}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
                <label className="grid gap-1 text-xs font-medium">
                  <span>{t('providersPage.form.apiKey')}</span>
                  <Input
                    ref={idx === 0 ? apiKeyInputRef : undefined}
                    type="password"
                    value={entry.apiKey}
                    aria-invalid={idx === 0 && Boolean(fieldErrors.apiKey)}
                    placeholder={
                      entry.existingApiKey
                        ? t('providersPage.form.apiKeyEditPlaceholder')
                        : t('providersPage.form.apiKeyCreatePlaceholder')
                    }
                    disabled={mutating}
                    onChange={(event) => {
                      const next = [...(form.apiKeyEntries ?? [emptyApiKeyEntry()])]
                      next[idx] = { ...entry, apiKey: event.target.value }
                      updateField('apiKeyEntries', next)
                    }}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1 text-xs font-medium">
                    <div className="flex items-center justify-between gap-1">
                      <span>{t('providersPage.form.proxyUrl')}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={mutating}
                        onClick={() => {
                          const next = [...(form.apiKeyEntries ?? [emptyApiKeyEntry()])]
                          next[idx] = {
                            ...entry,
                            proxyUrl:
                              entry.proxyUrl.trim().toLowerCase() === 'direct' ? '' : 'direct',
                          }
                          updateField('apiKeyEntries', next)
                        }}
                      >
                        {entry.proxyUrl.trim().toLowerCase() === 'direct'
                          ? t('credentialsPage.form.proxyInherit')
                          : t('credentialsPage.form.proxyDirect')}
                      </Button>
                    </div>
                    <Input
                      value={entry.proxyUrl}
                      placeholder="http://127.0.0.1:7890 | direct"
                      disabled={mutating}
                      className="font-mono text-xs"
                      onChange={(event) => {
                        const next = [...(form.apiKeyEntries ?? [emptyApiKeyEntry()])]
                        next[idx] = { ...entry, proxyUrl: event.target.value }
                        updateField('apiKeyEntries', next)
                      }}
                    />
                  </div>
                  <label className="grid gap-1 text-xs font-medium">
                    <span>{t('credentialsPage.form.weight')}</span>
                    <Input
                      type="number"
                      step={1}
                      max={MAX_CREDENTIAL_WEIGHT}
                      inputMode="numeric"
                      value={entry.weight ?? ''}
                      placeholder="1"
                      disabled={mutating}
                      onChange={(event) => {
                        const rawVal = event.target.value.trim()
                        const next = [...(form.apiKeyEntries ?? [emptyApiKeyEntry()])]
                        next[idx] = {
                          ...entry,
                          weight: rawVal === '' ? null : Number(rawVal),
                        }
                        updateField('apiKeyEntries', next)
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
            {fieldErrors.apiKey ? (
              <span className="text-destructive text-xs leading-5 font-normal">
                {fieldErrors.apiKey}
              </span>
            ) : null}
          </div>
        ) : descriptor.supportsApiKey ? (
          <label className={fieldClassName}>
            <span>{t('providersPage.form.apiKey')}</span>
            <Input
              ref={apiKeyInputRef}
              type="password"
              value={form.apiKey}
              aria-invalid={Boolean(fieldErrors.apiKey)}
              onChange={(event) => updateField('apiKey', event.target.value)}
              onBlur={() => {
                if (creating && descriptor.supportsApiKey && !form.apiKey.trim()) {
                  setFieldErrors((current) => ({
                    ...current,
                    apiKey: t('providersPage.form.validation.apiKeyRequired'),
                  }))
                }
              }}
              placeholder={
                editing
                  ? t('providersPage.form.apiKeyEditPlaceholder')
                  : t('providersPage.form.apiKeyCreatePlaceholder')
              }
              disabled={mutating}
            />
            {fieldErrors.apiKey ? (
              <span className="text-destructive text-xs leading-5 font-normal">
                {fieldErrors.apiKey}
              </span>
            ) : null}
          </label>
        ) : null}

        <label className={fieldClassName}>
          <span>{t('providersPage.form.baseUrl')}</span>
          <Input
            ref={baseUrlInputRef}
            value={form.baseUrl}
            aria-invalid={Boolean(fieldErrors.baseUrl)}
            onChange={(event) => updateField('baseUrl', event.target.value)}
            onBlur={() => {
              if (baseUrlRequired && !form.baseUrl.trim()) {
                setFieldErrors((current) => ({
                  ...current,
                  baseUrl: t('providersPage.form.validation.baseUrlRequired'),
                }))
              }
            }}
            placeholder={descriptor.defaultBaseUrl || 'https://api.example.com'}
            disabled={mutating}
          />
          {fieldErrors.baseUrl ? (
            <span className="text-destructive text-xs leading-5 font-normal">
              {fieldErrors.baseUrl}
            </span>
          ) : baseUrlRequired ? (
            <span className="text-muted-foreground text-xs leading-5">
              {t('providersPage.form.baseUrlRequiredHint')}
            </span>
          ) : null}
        </label>

        {descriptor.id !== 'openaiCompatibility' ? (
          <div className={fieldClassName}>
            <div className="flex items-center justify-between gap-2">
              <span>{t('providersPage.form.proxyUrl')}</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={mutating}
                onClick={() =>
                  updateField(
                    'proxyUrl',
                    form.proxyUrl.trim().toLowerCase() === 'direct' ? '' : 'direct',
                  )
                }
              >
                {form.proxyUrl.trim().toLowerCase() === 'direct'
                  ? t('credentialsPage.form.proxyInherit')
                  : t('credentialsPage.form.proxyDirect')}
              </Button>
            </div>
            <Input
              value={form.proxyUrl}
              aria-invalid={Boolean(fieldErrors.proxyUrl)}
              onChange={(event) => updateField('proxyUrl', event.target.value)}
              onBlur={() => {
                const trimmed = form.proxyUrl.trim()
                if (trimmed && !isValidProxyUrl(trimmed)) {
                  setFieldErrors((current) => ({
                    ...current,
                    proxyUrl: t('configPage.proxyPools.validation.urlInvalid'),
                  }))
                }
              }}
              placeholder="http://127.0.0.1:7890 | direct"
              disabled={mutating}
              className="font-mono"
            />
            {fieldErrors.proxyUrl ? (
              <span className="text-destructive text-xs leading-5 font-normal">
                {fieldErrors.proxyUrl}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs leading-5 font-normal">
                {t('credentialsPage.form.proxyUrlHint')}
              </span>
            )}
          </div>
        ) : null}

        <label className={fieldClassName}>
          <span>{t('providersPage.form.prefix')}</span>
          <Input
            value={form.prefix}
            onChange={(event) => updateField('prefix', event.target.value)}
            disabled={mutating}
          />
        </label>

        <label className={fieldClassName}>
          <span>{t('providersPage.form.priority')}</span>
          <Input
            type="number"
            inputMode="numeric"
            value={form.priority ?? ''}
            aria-invalid={Boolean(fieldErrors.priority)}
            onChange={(event) =>
              updateField(
                'priority',
                event.target.value === '' ? undefined : Number(event.target.value),
              )
            }
            onBlur={() => {
              if (
                form.priority !== undefined &&
                form.priority !== null &&
                !Number.isSafeInteger(form.priority)
              ) {
                setFieldErrors((current) => ({
                  ...current,
                  priority: t('credentialsPage.form.priorityInvalid'),
                }))
              }
            }}
            disabled={mutating}
          />
          {fieldErrors.priority ? (
            <span className="text-destructive text-xs leading-5 font-normal">
              {fieldErrors.priority}
            </span>
          ) : null}
        </label>

        {descriptor.id !== 'openaiCompatibility' ? (
          <label className={fieldClassName}>
            <span>{t('credentialsPage.form.weight')}</span>
            <Input
              type="number"
              step={1}
              max={MAX_CREDENTIAL_WEIGHT}
              inputMode="numeric"
              value={form.weight ?? ''}
              placeholder="1"
              aria-invalid={Boolean(fieldErrors.weight)}
              onChange={(event) => {
                const rawVal = event.target.value.trim()
                updateField('weight', rawVal === '' ? null : Number(rawVal))
              }}
              onBlur={() => {
                if (
                  form.weight !== undefined &&
                  form.weight !== null &&
                  (!Number.isSafeInteger(form.weight) || form.weight > MAX_CREDENTIAL_WEIGHT)
                ) {
                  setFieldErrors((current) => ({
                    ...current,
                    weight: t('credentialsPage.form.weightInvalid'),
                  }))
                }
              }}
              disabled={mutating}
            />
            {fieldErrors.weight ? (
              <span className="text-destructive text-xs leading-5 font-normal">
                {fieldErrors.weight}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs leading-5 font-normal">
                {t('credentialsPage.form.weightHint')}
              </span>
            )}
          </label>
        ) : null}

        <label className={fieldClassName}>
          <span>{t('providersPage.form.requestRetry')}</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={form.requestRetry ?? ''}
            placeholder={t('providersPage.form.requestRetryPlaceholder')}
            aria-invalid={Boolean(fieldErrors.requestRetry)}
            onChange={(event) => {
              const val = event.target.value.trim()
              updateField('requestRetry', val === '' ? null : Number(val))
            }}
            onBlur={() => {
              if (
                form.requestRetry !== undefined &&
                form.requestRetry !== null &&
                (!Number.isSafeInteger(form.requestRetry) || form.requestRetry < 0)
              ) {
                setFieldErrors((current) => ({
                  ...current,
                  requestRetry: t('providersPage.form.validation.requestRetryInvalid'),
                }))
              }
            }}
            disabled={mutating}
          />
          {fieldErrors.requestRetry ? (
            <span className="text-destructive text-xs leading-5 font-normal">
              {fieldErrors.requestRetry}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs leading-5 font-normal">
              {t('providersPage.form.requestRetryHint')}
            </span>
          )}
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
                    className="pr-9 pl-9"
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
                    size="icon-md"
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
                      className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-[var(--z-overlay)] mt-1 overflow-hidden rounded-md border shadow-md"
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
                  className="sm:shrink-0"
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

        <div className={fieldClassName}>
          <span>{t('providersPage.form.disableCooling')}</span>
          <Select
            value={
              form.disableCooling === null || form.disableCooling === undefined
                ? 'inherit'
                : form.disableCooling
                  ? 'disabled'
                  : 'enabled'
            }
            disabled={mutating}
            onValueChange={(value) =>
              updateField('disableCooling', value === 'inherit' ? null : value === 'disabled')
            }
          >
            <SelectTrigger aria-label={t('providersPage.form.disableCooling')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">
                {t('credentialsPage.form.coolingOptions.inherit')}
              </SelectItem>
              <SelectItem value="enabled">
                {t('credentialsPage.form.coolingOptions.enabled')}
              </SelectItem>
              <SelectItem value="disabled">
                {t('credentialsPage.form.coolingOptions.disabled')}
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs leading-5 font-normal">
            {t('providersPage.form.disableCoolingHint')}
          </span>
        </div>

        {descriptor.id === 'codex' ? (
          <div className="grid gap-3 rounded-md border p-3">
            <div className={fieldClassName}>
              <span>{t('providersPage.form.disableCodexCloaking')}</span>
              <Select
                value={
                  form.disableCodexCloaking === null || form.disableCodexCloaking === undefined
                    ? 'inherit'
                    : form.disableCodexCloaking
                      ? 'true'
                      : 'false'
                }
                disabled={mutating}
                onValueChange={(value) =>
                  updateField('disableCodexCloaking', value === 'inherit' ? null : value === 'true')
                }
              >
                <SelectTrigger aria-label={t('providersPage.form.disableCodexCloaking')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">
                    {t('credentialsPage.form.coolingOptions.inherit')}
                  </SelectItem>
                  <SelectItem value="false">{t('providersPage.status.disabled')}</SelectItem>
                  <SelectItem value="true">{t('providersPage.status.enabled')}</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-xs leading-5 font-normal">
                {t('providersPage.form.disableCodexCloakingHint')}
              </span>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={form.alphaSearch === true}
                disabled={mutating}
                onCheckedChange={(checked) => updateField('alphaSearch', checked === true)}
              />
              <span className="grid gap-1">
                <span className="font-medium">{t('providersPage.form.alphaSearch')}</span>
                <span className="text-muted-foreground text-xs leading-5">
                  {t('providersPage.form.alphaSearchHint')}
                </span>
              </span>
            </label>
          </div>
        ) : null}

        {descriptor.id === 'claude' ? (
          <div className="grid gap-3 rounded-md border p-3">
            <label className={fieldClassName}>
              <span>{t('providersPage.form.fingerprintProfile')}</span>
              <Input
                value={form.fingerprintProfile ?? ''}
                placeholder="claude-code-cli"
                disabled={mutating}
                className="font-mono"
                onChange={(event) => updateField('fingerprintProfile', event.target.value)}
              />
              <span className="text-muted-foreground text-xs leading-5 font-normal">
                {t('providersPage.form.fingerprintProfileHint')}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={form.rebuildMidSystemMessage === true}
                disabled={mutating}
                onCheckedChange={(checked) =>
                  updateField('rebuildMidSystemMessage', checked === true)
                }
              />
              <span className="grid gap-1">
                <span className="font-medium">
                  {t('providersPage.form.rebuildMidSystemMessage')}
                </span>
                <span className="text-muted-foreground text-xs leading-5">
                  {t('providersPage.form.rebuildMidSystemMessageHint')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={form.nativeToolSearch === true}
                disabled={mutating}
                onCheckedChange={(checked) => updateField('nativeToolSearch', checked === true)}
              />
              <span className="grid gap-1">
                <span className="font-medium">{t('providersPage.form.nativeToolSearch')}</span>
                <span className="text-muted-foreground text-xs leading-5">
                  {t('providersPage.form.nativeToolSearchHint')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={form.experimentalCchSigning === true}
                disabled={mutating}
                onCheckedChange={(checked) =>
                  updateField('experimentalCchSigning', checked === true)
                }
              />
              <span className="grid gap-1">
                <span className="font-medium">
                  {t('providersPage.form.experimentalCchSigning')}
                </span>
                <span className="text-muted-foreground text-xs leading-5">
                  {t('providersPage.form.experimentalCchSigningHint')}
                </span>
              </span>
            </label>
          </div>
        ) : null}

        {descriptor.id === 'openaiCompatibility' ? (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={form.supportPromptCacheKey === true}
              disabled={mutating}
              onCheckedChange={(checked) => updateField('supportPromptCacheKey', checked === true)}
            />
            <span className="grid gap-1">
              <span className="font-medium">{t('providersPage.form.supportPromptCacheKey')}</span>
              <span className="text-muted-foreground text-xs leading-5">
                {t('providersPage.form.supportPromptCacheKeyHint')}
              </span>
            </span>
          </label>
        ) : null}

        {descriptor.supportsWebsockets ? (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={form.websockets}
              disabled={mutating}
              onCheckedChange={(checked) => updateField('websockets', checked === true)}
            />
            <span className="grid gap-1">
              <span className="font-medium">{t('providersPage.form.websockets')}</span>
              <span className="text-muted-foreground text-xs leading-5">
                {t('providersPage.form.websocketsHint')}
              </span>
            </span>
          </label>
        ) : null}

        {descriptor.disabledMode === 'provider-payload' ? (
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
                      size="md"
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
                            size="md"
                            onClick={() => setModelDiscoveryOpen(false)}
                          >
                            {t('providersPage.discovery.close')}
                          </Button>
                          <Button
                            type="button"
                            size="md"
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
              <div key={index} className="grid gap-3 rounded-md border p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
                    size="icon-lg"
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

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium">
                    <span>{t('providersPage.form.modelDisplayName')}</span>
                    <Input
                      value={model.displayName}
                      onChange={(event) =>
                        updateModelField(index, 'displayName', event.target.value)
                      }
                      placeholder={t('providersPage.form.modelDisplayNamePlaceholder')}
                      disabled={mutating}
                    />
                  </label>
                  {descriptor.id !== 'vertex' ? (
                    <label className="grid gap-1.5 text-xs font-medium">
                      <span>{t('providersPage.form.modelMaxContextLength')}</span>
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={model.maxContextLength ?? ''}
                        onChange={(event) =>
                          updateModelField(index, 'maxContextLength', event.target.value)
                        }
                        placeholder="128000"
                        disabled={mutating}
                      />
                    </label>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <label className="flex items-start gap-3 text-xs">
                    <Checkbox
                      className="mt-0.5"
                      checked={model.forceMapping}
                      disabled={mutating}
                      onCheckedChange={(checked) =>
                        updateModelField(index, 'forceMapping', checked === true)
                      }
                    />
                    <span className="grid gap-1">
                      <span className="font-medium">
                        {t('providersPage.form.modelForceMapping')}
                      </span>
                      <span className="text-muted-foreground leading-5">
                        {t('providersPage.form.modelForceMappingHint')}
                      </span>
                    </span>
                  </label>

                  {descriptor.id !== 'vertex' ? (
                    <label className="flex items-start gap-3 text-xs">
                      <Checkbox
                        className="mt-0.5"
                        checked={model.isCompat === true}
                        disabled={mutating}
                        onCheckedChange={(checked) =>
                          updateModelField(index, 'isCompat', checked === true)
                        }
                      />
                      <span className="grid gap-1">
                        <span className="font-medium">{t('providersPage.form.modelIsCompat')}</span>
                        <span className="text-muted-foreground leading-5">
                          {t('providersPage.form.modelIsCompatHint')}
                        </span>
                      </span>
                    </label>
                  ) : null}

                  {descriptor.id === 'codex' ? (
                    <label className="flex items-start gap-3 text-xs">
                      <Checkbox
                        className="mt-0.5"
                        checked={model.supportConfigurationUpdate === true}
                        disabled={mutating}
                        onCheckedChange={(checked) =>
                          updateModelField(index, 'supportConfigurationUpdate', checked === true)
                        }
                      />
                      <span className="grid gap-1">
                        <span className="font-medium">
                          {t('providersPage.form.modelSupportConfigurationUpdate')}
                        </span>
                        <span className="text-muted-foreground leading-5">
                          {t('providersPage.form.modelSupportConfigurationUpdateHint')}
                        </span>
                      </span>
                    </label>
                  ) : null}

                  {descriptor.id === 'openaiCompatibility' ? (
                    <>
                      <label className="flex items-start gap-3 text-xs">
                        <Checkbox
                          className="mt-0.5"
                          checked={model.image === true}
                          disabled={mutating}
                          onCheckedChange={(checked) =>
                            updateModelField(index, 'image', checked === true)
                          }
                        />
                        <span className="grid gap-1">
                          <span className="font-medium">{t('providersPage.form.modelImage')}</span>
                          <span className="text-muted-foreground leading-5">
                            {t('providersPage.form.modelImageHint')}
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 text-xs">
                        <Checkbox
                          className="mt-0.5"
                          checked={model.useMaxCompletionTokens === true}
                          disabled={mutating}
                          onCheckedChange={(checked) =>
                            updateModelField(index, 'useMaxCompletionTokens', checked === true)
                          }
                        />
                        <span className="grid gap-1">
                          <span className="font-medium">
                            {t('providersPage.form.modelUseMaxCompletionTokens')}
                          </span>
                          <span className="text-muted-foreground leading-5">
                            {t('providersPage.form.modelUseMaxCompletionTokensHint')}
                          </span>
                        </span>
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs font-medium">
                          <span>{t('providersPage.form.modelInputModalities')}</span>
                          <Input
                            value={model.inputModalitiesText ?? ''}
                            placeholder="text, image"
                            disabled={mutating}
                            onChange={(event) =>
                              updateModelField(index, 'inputModalitiesText', event.target.value)
                            }
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-medium">
                          <span>{t('providersPage.form.modelOutputModalities')}</span>
                          <Input
                            value={model.outputModalitiesText ?? ''}
                            placeholder="text"
                            disabled={mutating}
                            onChange={(event) =>
                              updateModelField(index, 'outputModalitiesText', event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="grid gap-2.5 border-t pt-2.5">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <Checkbox
                      checked={model.thinkingEnabled === true}
                      disabled={mutating}
                      onCheckedChange={(checked) =>
                        updateModelField(index, 'thinkingEnabled', checked === true)
                      }
                    />
                    <span>{t('providersPage.form.modelThinkingEnabled')}</span>
                  </label>
                  {model.thinkingEnabled ? (
                    <div className="grid gap-2.5 pl-6">
                      <div className="grid gap-1.5">
                        <span className="text-muted-foreground text-xs font-medium">
                          {t('providersPage.form.modelThinkingLevels')}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {PROVIDER_THINKING_LEVELS.map((level) => {
                            const selected = (model.thinkingLevels ?? []).includes(level)
                            return (
                              <label
                                key={level}
                                className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
                              >
                                <Checkbox
                                  checked={selected}
                                  disabled={mutating}
                                  onCheckedChange={(checked) => {
                                    const current = model.thinkingLevels ?? []
                                    const next =
                                      checked === true
                                        ? PROVIDER_THINKING_LEVELS.filter(
                                            (item) => item === level || current.includes(item),
                                          )
                                        : current.filter((item) => item !== level)
                                    updateModelField(index, 'thinkingLevels', next)
                                  }}
                                />
                                <span className="font-mono">{level}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-medium">
                          <span>{t('providersPage.form.modelThinkingMin')}</span>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={model.thinkingMin ?? ''}
                            placeholder="0"
                            disabled={mutating}
                            onChange={(event) =>
                              updateModelField(index, 'thinkingMin', event.target.value)
                            }
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium">
                          <span>{t('providersPage.form.modelThinkingMax')}</span>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={model.thinkingMax ?? ''}
                            placeholder="0"
                            disabled={mutating}
                            onChange={(event) =>
                              updateModelField(index, 'thinkingMax', event.target.value)
                            }
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={model.thinkingZeroAllowed === true}
                            disabled={mutating}
                            onCheckedChange={(checked) =>
                              updateModelField(index, 'thinkingZeroAllowed', checked === true)
                            }
                          />
                          <span>{t('providersPage.form.modelThinkingZeroAllowed')}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={model.thinkingDynamicAllowed === true}
                            disabled={mutating}
                            onCheckedChange={(checked) =>
                              updateModelField(index, 'thinkingDynamicAllowed', checked === true)
                            }
                          />
                          <span>{t('providersPage.form.modelThinkingDynamicAllowed')}</span>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="md"
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
                  size="icon-lg"
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
              size="md"
              className="w-fit"
              disabled={mutating}
              onClick={() => updateField('headers', [...headersList, emptyHeaderEntry()])}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('providersPage.form.addHeader')}
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {descriptor.id !== 'vertex' ? (
          <Collapsible className="rounded-md border px-3 py-2.5 text-sm">
            <CollapsibleTrigger className="group focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 text-left text-sm font-medium outline-none focus-visible:ring-[3px]">
              <span className="min-w-0">
                <span className="block">{t('providersPage.form.errorRulesSection')}</span>
                <span className="text-muted-foreground mt-1 block text-xs leading-5 font-normal">
                  {t('providersPage.form.errorRulesHint')}
                </span>
              </span>
              <ChevronDown
                className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-3">
              {(form.requestScopedErrors ?? []).map((rule, index) => (
                <div key={index} className="grid gap-2.5 rounded-md border p-3">
                  <div className="grid gap-2 sm:grid-cols-[7rem_1fr_auto] sm:items-end">
                    <label className="grid gap-1 text-xs font-medium">
                      <span>{t('providersPage.form.errorRuleStatus')}</span>
                      <Input
                        type="number"
                        min={100}
                        max={599}
                        inputMode="numeric"
                        value={rule.status || ''}
                        disabled={mutating}
                        onChange={(event) => {
                          const next = [...(form.requestScopedErrors ?? [])]
                          next[index] = {
                            ...rule,
                            status: Number(event.target.value) || 0,
                          }
                          updateField('requestScopedErrors', next)
                        }}
                      />
                    </label>
                    <div className="grid gap-1 text-xs font-medium">
                      <span>{t('providersPage.form.errorRuleAction')}</span>
                      <Select
                        value={rule.action}
                        disabled={mutating}
                        onValueChange={(value) => {
                          const next = [...(form.requestScopedErrors ?? [])]
                          next[index] = { ...rule, action: value as ProviderErrorRuleAction }
                          updateField('requestScopedErrors', next)
                        }}
                      >
                        <SelectTrigger aria-label={t('providersPage.form.errorRuleAction')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_ERROR_RULE_ACTIONS.map((action) => (
                            <SelectItem key={action} value={action}>
                              {action}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-md"
                      disabled={mutating}
                      aria-label={t('providersPage.form.removeErrorRule')}
                      onClick={() =>
                        updateField(
                          'requestScopedErrors',
                          (form.requestScopedErrors ?? []).filter((_, idx) => idx !== index),
                        )
                      }
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-medium">
                      <span>{t('providersPage.form.errorRuleMatch')}</span>
                      <Textarea
                        rows={2}
                        className="font-mono text-xs"
                        value={(rule.match ?? []).join('\n')}
                        placeholder="invalid request"
                        disabled={mutating}
                        onChange={(event) => {
                          const next = [...(form.requestScopedErrors ?? [])]
                          const match = event.target.value
                            .split(/\r?\n/)
                            .map((item) => item.trim())
                            .filter(Boolean)
                          next[index] = {
                            ...rule,
                            match: match.length ? match : undefined,
                          }
                          updateField('requestScopedErrors', next)
                        }}
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-medium">
                      <span>{t('providersPage.form.errorRuleMatchRegex')}</span>
                      <Textarea
                        rows={2}
                        className="font-mono text-xs"
                        value={(rule['match-regexr'] ?? []).join('\n')}
                        placeholder="rate.*limit"
                        disabled={mutating}
                        onChange={(event) => {
                          const next = [...(form.requestScopedErrors ?? [])]
                          const regexes = event.target.value
                            .split(/\r?\n/)
                            .map((item) => item.trim())
                            .filter(Boolean)
                          next[index] = {
                            ...rule,
                            'match-regexr': regexes.length ? regexes : undefined,
                          }
                          updateField('requestScopedErrors', next)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="md"
                className="w-fit"
                disabled={mutating}
                onClick={() =>
                  updateField('requestScopedErrors', [
                    ...(form.requestScopedErrors ?? []),
                    emptyErrorRule(),
                  ])
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('providersPage.form.addErrorRule')}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

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

const EMPTY_PROVIDER_GROUPS: ProviderGroup[] = []

export function ProvidersPanel({
  onStatsChange,
}: {
  onStatsChange?: (stats: UpstreamProvidersStats) => void
} = {}) {
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

  const groups = workbench.snapshot?.groups ?? EMPTY_PROVIDER_GROUPS
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
  const activeProviderName = activeGroup ? t(`providersPage.providerNames.${activeGroup.id}`) : ''
  const currentModelCatalog =
    workbench.modelDefinitions?.channel === modelCatalogChannel ? workbench.modelDefinitions : null

  useEffect(() => {
    if (!activeGroup && groups[0]) {
      setActiveProviderId(groups[0].id)
    }
  }, [activeGroup, groups])

  useEffect(() => {
    if (!workbench.snapshot) return
    onStatsChange?.({
      totalKeys: groups.reduce((total, group) => total + group.resources.length, 0),
      groupIds: groups.map((group) => group.id),
    })
  }, [groups, onStatsChange, workbench.snapshot])

  if (workbench.checking) {
    return <ProviderLoadingState />
  }

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

    const defaultChannel = groups.find((group) => group.id === providerId)?.modelDefinitionChannel
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

  const handleToggleStatus = async (resource: ProviderResource, disabled: boolean) => {
    try {
      await workbench.updateProviderStatus({
        resource,
        disabled,
      })
      toast.success(t('providersPage.toast.statusUpdated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const openModelCatalog = () => {
    const defaultChannel = activeGroup.modelDefinitionChannel
    if (defaultChannel) {
      setModelCatalogChannel(defaultChannel)
      setModelCatalogFilter('')
    }

    setModelCatalogOpen(true)
  }

  return (
    <section className="grid w-full gap-4">
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <ProviderCategoryList
          groups={groups}
          activeProviderId={activeGroup.id}
          onSelectProvider={handleSelectProvider}
        />

        <TableSurface className="min-w-0">
          <TableSurfaceHeader
            title={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ProviderLogo providerId={activeGroup.id} size="sm" />
                {t(`providersPage.providerNames.${activeGroup.id}`)}
                <span className="text-muted-foreground font-mono text-xs font-normal">
                  {activeGroup.path}
                </span>
              </span>
            }
            actions={
              <>
                <div className="relative min-w-0 md:w-72">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    size="md"
                    className="pl-9"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder={t('providersPage.table.filterPlaceholder')}
                  />
                </div>
                <Button
                  size="md"
                  disabled={activeGroup.issue?.kind === 'unsupported'}
                  onClick={openCreatePanel}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t('providersPage.actions.new')}
                </Button>
              </>
            }
            actionsClassName="w-full md:w-auto"
          />

          {activeGroup.issue ? (
            <div className="border-warning/35 bg-warning/12 mx-4 mt-4 rounded-md border px-3 py-2.5 text-sm">
              <p className="text-warning-foreground dark:text-warning font-medium">
                {t(
                  activeGroup.issue.kind === 'unsupported'
                    ? 'providersPage.table.providerUnsupported'
                    : 'providersPage.table.providerIssue',
                )}
                {activeGroup.issue.status ? ` · ${activeGroup.issue.status}` : ''}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5 break-words">
                {activeGroup.issue.message}
              </p>
            </div>
          ) : null}

          <TableSurfaceContent>
            <ProviderResourceTable
              resources={activeResources}
              unsupported={activeGroup.issue?.kind === 'unsupported'}
              selectedResourceId={selectedResourceId}
              onCreateResource={openCreatePanel}
              onDeleteResource={openDeleteDialog}
              onEditResource={openEditPanel}
              onViewResource={openDetailPanel}
            />
          </TableSurfaceContent>
        </TableSurface>
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
            onToggleStatus={handleToggleStatus}
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
                activeGroup.modelDefinitionChannel === modelCatalogChannel
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
            channels={workbench.modelDefinitionChannels}
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
