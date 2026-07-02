import { type ReactNode, useEffect, useMemo, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Database,
  Eye,
  EyeOff,
  FileDiff,
  Filter,
  Gauge,
  Info,
  KeyRound,
  Loader2,
  Network,
  Plug,
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TableEmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
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
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ProxyPoolsPanel } from '@/features/config/proxy-pools-panel'
import { useConfigWorkbench } from '@/features/config/use-config-workbench'
import type {
  ConfigChange,
  ConfigFieldKey,
  ConfigStructuredValues,
} from '@/lib/api/management/config'
import type { ProviderModelChannel, ProviderModelDefinition } from '@/lib/api/management/providers'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type ConfigSectionId =
  | 'server'
  | 'tls'
  | 'remoteManagement'
  | 'authentication'
  | 'plugins'
  | 'oauthRules'
  | 'system'
  | 'network'
  | 'quota'
  | 'streaming'
  | 'payload'

type ConfigFieldKind =
  | 'boolean'
  | 'number'
  | 'text'
  | 'sensitiveText'
  | 'select'
  | 'jsonArray'
  | 'jsonObject'

type JsonConfigFieldKey =
  | 'oauthExcludedModelsJson'
  | 'oauthModelAliasJson'
  | 'pluginStoreSourcesJson'
  | 'pluginStoreAuthJson'

type OAuthModelCatalogState = {
  channel: ProviderModelChannel
  models: ProviderModelDefinition[]
  fetchedAt: string | null
  loading: boolean
  errorMessage: string | null
  filter: string
  onChannelChange: (channel: ProviderModelChannel) => void
  onFilterChange: (filter: string) => void
  onRetry: () => void
}

type AliasRule = {
  name?: string
  alias?: string
  fork?: boolean
}

type PluginStoreAuthType = 'none' | 'bearer' | 'github-token' | 'basic' | 'header'

type PluginStoreAuthApplyTo = 'registry' | 'metadata' | 'artifact'

type PluginStoreAuthRule = {
  match: string
  applyTo: PluginStoreAuthApplyTo[]
  type: PluginStoreAuthType
  tokenEnv: string
  usernameEnv: string
  passwordEnv: string
  headerName: string
  headerValueEnv: string
  allowInsecure: boolean
}

type NetworkProxyPanel = 'current' | 'pool'

type PendingConfigConfirmation = {
  type: 'reload'
}

type ConfigFieldDefinition = {
  key: ConfigFieldKey
  kind: ConfigFieldKind
  sectionId: ConfigSectionId
  min?: number
  options?: string[]
}

type ConfigSectionDefinition = {
  id: ConfigSectionId
  fields: ConfigFieldDefinition[]
}

const sectionDefinitions: ConfigSectionDefinition[] = [
  {
    id: 'server',
    fields: [{ key: 'debug', kind: 'boolean', sectionId: 'server' }],
  },
  {
    id: 'tls',
    fields: [
      { key: 'tlsEnable', kind: 'boolean', sectionId: 'tls' },
      { key: 'tlsCert', kind: 'text', sectionId: 'tls' },
      { key: 'tlsKey', kind: 'text', sectionId: 'tls' },
    ],
  },
  {
    id: 'remoteManagement',
    fields: [
      { key: 'remoteManagementAllowRemote', kind: 'boolean', sectionId: 'remoteManagement' },
      {
        key: 'remoteManagementSecretKey',
        kind: 'sensitiveText',
        sectionId: 'remoteManagement',
      },
      {
        key: 'remoteManagementDisableControlPanel',
        kind: 'boolean',
        sectionId: 'remoteManagement',
      },
      {
        key: 'remoteManagementDisableAutoUpdatePanel',
        kind: 'boolean',
        sectionId: 'remoteManagement',
      },
      {
        key: 'remoteManagementPanelGithubRepository',
        kind: 'text',
        sectionId: 'remoteManagement',
      },
    ],
  },
  {
    id: 'authentication',
    fields: [{ key: 'wsAuth', kind: 'boolean', sectionId: 'authentication' }],
  },
  {
    id: 'plugins',
    fields: [
      { key: 'pluginsEnabled', kind: 'boolean', sectionId: 'plugins' },
      { key: 'pluginsDir', kind: 'text', sectionId: 'plugins' },
      { key: 'pluginStoreSourcesJson', kind: 'jsonArray', sectionId: 'plugins' },
      { key: 'pluginStoreAuthJson', kind: 'jsonArray', sectionId: 'plugins' },
    ],
  },
  {
    id: 'oauthRules',
    fields: [
      { key: 'oauthExcludedModelsJson', kind: 'jsonObject', sectionId: 'oauthRules' },
      { key: 'oauthModelAliasJson', kind: 'jsonObject', sectionId: 'oauthRules' },
    ],
  },
  {
    id: 'system',
    fields: [
      { key: 'requestLog', kind: 'boolean', sectionId: 'system' },
      { key: 'usageStatisticsEnabled', kind: 'boolean', sectionId: 'system' },
      { key: 'loggingToFile', kind: 'boolean', sectionId: 'system' },
      { key: 'logsMaxTotalSizeMb', kind: 'number', sectionId: 'system', min: 0 },
      { key: 'errorLogsMaxFiles', kind: 'number', sectionId: 'system', min: 0 },
    ],
  },
  {
    id: 'network',
    fields: [{ key: 'proxyUrl', kind: 'text', sectionId: 'network' }],
  },
  {
    id: 'quota',
    fields: [
      { key: 'quotaSwitchProject', kind: 'boolean', sectionId: 'quota' },
      { key: 'quotaSwitchPreviewModel', kind: 'boolean', sectionId: 'quota' },
    ],
  },
  {
    id: 'streaming',
    fields: [
      { key: 'requestRetry', kind: 'number', sectionId: 'streaming', min: 0 },
      { key: 'maxRetryInterval', kind: 'number', sectionId: 'streaming', min: 0 },
      {
        key: 'routingStrategy',
        kind: 'select',
        sectionId: 'streaming',
        options: ['round-robin', 'fill-first'],
      },
    ],
  },
  {
    id: 'payload',
    fields: [{ key: 'forceModelPrefix', kind: 'boolean', sectionId: 'payload' }],
  },
]

const modelDefinitionChannels: ProviderModelChannel[] = [
  'claude',
  'gemini',
  'vertex',
  'aistudio',
  'codex',
  'kimi',
  'antigravity',
  'xai',
]

const fieldDefinitions = sectionDefinitions.flatMap((section) => section.fields)
const fieldDefinitionByKey = fieldDefinitions.reduce<Record<ConfigFieldKey, ConfigFieldDefinition>>(
  (nextMap, field) => ({
    ...nextMap,
    [field.key]: field,
  }),
  {} as Record<ConfigFieldKey, ConfigFieldDefinition>,
)

const sectionIcons: Record<ConfigSectionId, typeof ServerCog> = {
  server: ServerCog,
  tls: ShieldCheck,
  remoteManagement: Network,
  authentication: KeyRound,
  plugins: Plug,
  oauthRules: Route,
  system: Database,
  network: Network,
  quota: Gauge,
  streaming: Route,
  payload: Code2,
}

const jsonConfigFieldKeys = new Set<ConfigFieldKey>([
  'oauthExcludedModelsJson',
  'oauthModelAliasJson',
  'pluginStoreSourcesJson',
  'pluginStoreAuthJson',
])

const pluginStoreAuthTypes: PluginStoreAuthType[] = [
  'none',
  'bearer',
  'github-token',
  'basic',
  'header',
]

const pluginStoreAuthApplyToOptions: PluginStoreAuthApplyTo[] = ['registry', 'metadata', 'artifact']

type JsonParseResult =
  | {
      ok: true
      value: unknown
    }
  | {
      ok: false
      message: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonConfigFieldKey(key: ConfigFieldKey): key is JsonConfigFieldKey {
  return jsonConfigFieldKeys.has(key)
}

function parseJsonDraft(field: ConfigFieldDefinition, value: string): JsonParseResult {
  const text = value.trim() || (field.kind === 'jsonArray' ? '[]' : '{}')

  try {
    const parsed = JSON.parse(text) as unknown

    if (field.kind === 'jsonArray' && !Array.isArray(parsed)) {
      return { ok: false, message: 'Expected a JSON array' }
    }

    if (field.kind === 'jsonObject' && !isRecord(parsed)) {
      return { ok: false, message: 'Expected a JSON object' }
    }

    return { ok: true, value: parsed }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]) {
  const allowed = new Set(keys)
  return Object.keys(record).every((key) => allowed.has(key))
}

function canEditExcludedModels(value: unknown): value is Record<string, string[]> {
  if (!isRecord(value)) return false

  return Object.values(value).every(
    (models) => Array.isArray(models) && models.every((model) => typeof model === 'string'),
  )
}

function canEditModelAliases(value: unknown) {
  if (!isRecord(value)) return false

  return Object.values(value).every(
    (items) =>
      Array.isArray(items) &&
      items.every(
        (item) =>
          isRecord(item) &&
          hasOnlyKeys(item, ['name', 'alias', 'fork']) &&
          (item.name === undefined || typeof item.name === 'string') &&
          (item.alias === undefined || typeof item.alias === 'string') &&
          (item.fork === undefined || typeof item.fork === 'boolean'),
      ),
  )
}

function normalizePluginStoreSources(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function canEditPluginStoreSources(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false

  return value.every((item) => typeof item === 'string')
}

function hasKnownPluginStoreAuthKeys(value: Record<string, unknown>) {
  return hasOnlyKeys(value, [
    'match',
    'apply-to',
    'apply_to',
    'type',
    'token-env',
    'username-env',
    'password-env',
    'header-name',
    'header-value-env',
    'allow-insecure',
    'allow_insecure',
  ])
}

function normalizePluginStoreAuthRule(value: Record<string, unknown>): PluginStoreAuthRule {
  const typeValue = typeof value.type === 'string' ? value.type : 'none'
  const type = pluginStoreAuthTypes.includes(typeValue as PluginStoreAuthType)
    ? (typeValue as PluginStoreAuthType)
    : 'none'
  const applyToRaw = value['apply-to'] ?? value.apply_to
  const applyTo = Array.isArray(applyToRaw)
    ? applyToRaw.filter((item): item is PluginStoreAuthApplyTo =>
        pluginStoreAuthApplyToOptions.includes(item as PluginStoreAuthApplyTo),
      )
    : []

  return {
    match: typeof value.match === 'string' ? value.match : '',
    applyTo,
    type,
    tokenEnv: typeof value['token-env'] === 'string' ? value['token-env'] : '',
    usernameEnv: typeof value['username-env'] === 'string' ? value['username-env'] : '',
    passwordEnv: typeof value['password-env'] === 'string' ? value['password-env'] : '',
    headerName: typeof value['header-name'] === 'string' ? value['header-name'] : '',
    headerValueEnv: typeof value['header-value-env'] === 'string' ? value['header-value-env'] : '',
    allowInsecure: Boolean(value['allow-insecure'] ?? value.allow_insecure),
  }
}

function normalizePluginStoreAuthRules(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map(normalizePluginStoreAuthRule)
    .filter(
      (rule) =>
        rule.match.trim() ||
        rule.type !== 'none' ||
        rule.applyTo.length > 0 ||
        rule.tokenEnv.trim() ||
        rule.usernameEnv.trim() ||
        rule.passwordEnv.trim() ||
        rule.headerName.trim() ||
        rule.headerValueEnv.trim() ||
        rule.allowInsecure,
    )
}

function canEditPluginStoreAuthRules(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && hasKnownPluginStoreAuthKeys(item))
  )
}

function serializePluginStoreAuthRule(rule: PluginStoreAuthRule) {
  const nextRule: Record<string, unknown> = {}
  const match = rule.match.trim()
  const tokenEnv = rule.tokenEnv.trim()
  const usernameEnv = rule.usernameEnv.trim()
  const passwordEnv = rule.passwordEnv.trim()
  const headerName = rule.headerName.trim()
  const headerValueEnv = rule.headerValueEnv.trim()

  if (match) nextRule.match = match
  if (rule.applyTo.length > 0) nextRule['apply-to'] = rule.applyTo
  nextRule.type = rule.type

  if (rule.type === 'bearer' || rule.type === 'github-token') {
    if (tokenEnv) nextRule['token-env'] = tokenEnv
  }

  if (rule.type === 'basic') {
    if (usernameEnv) nextRule['username-env'] = usernameEnv
    if (passwordEnv) nextRule['password-env'] = passwordEnv
  }

  if (rule.type === 'header') {
    if (headerName) nextRule['header-name'] = headerName
    if (headerValueEnv) nextRule['header-value-env'] = headerValueEnv
  }

  if (rule.allowInsecure) nextRule['allow-insecure'] = true

  return nextRule
}

function getModelDisplayName(model: ProviderModelDefinition) {
  return model.displayName || model.name || model.id
}

function canEditJsonField(fieldKey: JsonConfigFieldKey, value: unknown) {
  switch (fieldKey) {
    case 'oauthExcludedModelsJson':
      return canEditExcludedModels(value)
    case 'oauthModelAliasJson':
      return canEditModelAliases(value)
    case 'pluginStoreSourcesJson':
      return canEditPluginStoreSources(value)
    case 'pluginStoreAuthJson':
      return canEditPluginStoreAuthRules(value)
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function scrollToSection(sectionId: ConfigSectionId) {
  document.getElementById(`config-section-${sectionId}`)?.scrollIntoView({
    block: 'start',
    behavior: 'smooth',
  })
}

function scrollToField(key: ConfigFieldKey) {
  scrollToSection(fieldDefinitionByKey[key].sectionId)
}

function areConfigValuesEqual(
  left: ConfigStructuredValues[ConfigFieldKey],
  right: ConfigStructuredValues[ConfigFieldKey],
) {
  return String(left) === String(right)
}

function getStructuredChanges(
  baseline: ConfigStructuredValues,
  draft: ConfigStructuredValues,
): ConfigChange[] {
  return fieldDefinitions
    .filter((field) => !areConfigValuesEqual(baseline[field.key], draft[field.key]))
    .map((field) => ({
      key: field.key,
      previousValue: baseline[field.key],
      nextValue: draft[field.key],
    }))
}

function getValidationErrors(draft: ConfigStructuredValues) {
  return fieldDefinitions
    .filter((field) => {
      const value = draft[field.key]
      if (field.kind === 'number') {
        return typeof value !== 'number' || Number.isNaN(value) || value < (field.min ?? 0)
      }
      if (field.kind === 'select') {
        return !field.options?.includes(String(value))
      }
      if (field.kind === 'jsonArray') {
        try {
          const parsed: unknown = JSON.parse(String(value || '[]'))
          return !Array.isArray(parsed)
        } catch {
          return true
        }
      }
      if (field.kind === 'jsonObject') {
        try {
          const parsed: unknown = JSON.parse(String(value || '{}'))
          return typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
        } catch {
          return true
        }
      }
      return false
    })
    .map((field) => field.key)
}

function formatConfigValue(value: ConfigChange['nextValue'], emptyLabel: string) {
  return value === '' ? emptyLabel : String(value)
}

function ConfigDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('configPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('configPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {t('configPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function ConfigLoadingState() {
  const { t } = useTranslation()

  return (
    <section className="grid gap-4">
      <PageHeader
        title={t('configPage.loading.title')}
        description={t('configPage.loading.description')}
        tags={<Skeleton className="h-7 w-36 rounded-md" />}
      />
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <Skeleton className="hidden h-[520px] rounded-lg xl:block" />
        <div className="grid gap-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </section>
  )
}

function ConfigErrorState({
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
                {t('configPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('configPage.error.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('configPage.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function SectionNavigation({
  changes,
  validationErrors,
}: {
  changes: ConfigChange[]
  validationErrors: ConfigFieldKey[]
}) {
  const { t } = useTranslation()

  return (
    <>
      <aside className="bg-card sticky top-[10.25rem] hidden max-h-[calc(100dvh-11.25rem)] min-w-0 self-start overflow-y-auto rounded-lg border p-3 shadow-sm xl:block">
        <div>
          <p className="text-muted-foreground px-2 pb-2 text-xs font-medium uppercase">
            {t('configPage.outline.title')}
          </p>
          <div className="grid gap-1">
            {sectionDefinitions.map((section) => {
              const changed = changes.some((change) =>
                section.fields.some((field) => field.key === change.key),
              )
              const invalid = validationErrors.some((key) =>
                section.fields.some((field) => field.key === key),
              )

              return (
                <Button
                  key={section.id}
                  type="button"
                  variant="ghost"
                  className="h-auto min-w-0 justify-between gap-2 px-2 py-2 text-left"
                  onClick={() => scrollToSection(section.id)}
                >
                  <span className="min-w-0 truncate">
                    {t(`configPage.sections.${section.id}.title`)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {invalid ? (
                      <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-300" />
                    ) : null}
                    {changed ? <span className="bg-primary size-1.5 rounded-full" /> : null}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>
      </aside>

      <div className="bg-background/95 sticky top-[10.25rem] z-10 -mx-1 overflow-x-auto border-y px-1 py-2 backdrop-blur xl:hidden">
        <div className="flex min-w-max gap-2">
          {sectionDefinitions.map((section) => (
            <Button
              key={section.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => scrollToSection(section.id)}
            >
              {t(`configPage.sections.${section.id}.shortTitle`)}
            </Button>
          ))}
        </div>
      </div>
    </>
  )
}

function BooleanControl({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label={checked ? t('configPage.status.enabled') : t('configPage.status.disabled')}
    />
  )
}

function ConfigField({
  field,
  value,
  disabled,
  invalid,
  onChange,
}: {
  field: ConfigFieldDefinition
  value: ConfigStructuredValues[ConfigFieldKey]
  disabled: boolean
  invalid: boolean
  onChange: (key: ConfigFieldKey, value: boolean | number | string) => void
}) {
  const { t } = useTranslation()
  const [sensitiveVisible, setSensitiveVisible] = useState(false)

  return (
    <div
      className={cn(
        'grid gap-3 rounded-md border px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] md:items-center',
        invalid ? 'border-amber-500/40 bg-amber-500/5' : null,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{t(`configPage.fields.${field.key}.label`)}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          {t(`configPage.fields.${field.key}.description`)}
        </p>
        {invalid ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {t('configPage.validation.invalidField')}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 justify-start md:justify-end">
        {field.kind === 'boolean' ? (
          <BooleanControl
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(nextValue) => onChange(field.key, nextValue)}
          />
        ) : null}
        {field.kind === 'number' ? (
          <Input
            type="number"
            min={field.min}
            value={String(value)}
            disabled={disabled}
            className="md:max-w-56"
            onChange={(event) => onChange(field.key, Number(event.target.value))}
          />
        ) : null}
        {field.kind === 'text' ? (
          <Input
            value={String(value)}
            disabled={disabled}
            className="md:max-w-80"
            placeholder={t(`configPage.fields.${field.key}.placeholder`)}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        ) : null}
        {field.kind === 'sensitiveText' ? (
          <div className="relative min-w-0 md:w-full md:max-w-80">
            <Input
              type={sensitiveVisible ? 'text' : 'password'}
              value={String(value)}
              disabled={disabled}
              className="pr-10"
              placeholder={t(`configPage.fields.${field.key}.placeholder`)}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
              disabled={disabled}
              aria-label={
                sensitiveVisible
                  ? t('configPage.actions.hideSensitive')
                  : t('configPage.actions.showSensitive')
              }
              onClick={() => setSensitiveVisible((current) => !current)}
            >
              {sensitiveVisible ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        ) : null}
        {field.kind === 'select' ? (
          <Select
            value={String(value)}
            disabled={disabled}
            onValueChange={(nextValue) => onChange(field.key, nextValue)}
          >
            <SelectTrigger
              className="md:w-56"
              aria-label={t(`configPage.fields.${field.key}.label`)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`configPage.routingStrategies.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  )
}

function JsonEditorFrame({
  field,
  invalid,
  parseError,
  children,
}: {
  field: ConfigFieldDefinition
  invalid: boolean
  parseError: string | null
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'grid gap-4 rounded-lg border px-3 py-3',
        invalid ? 'border-amber-500/40 bg-amber-500/5' : 'bg-background/35',
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{t(`configPage.fields.${field.key}.label`)}</p>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-5">
            {t(`configPage.fields.${field.key}.description`)}
          </p>
          {invalid ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {parseError
                ? t('configPage.validation.jsonParseError', { message: parseError })
                : t('configPage.validation.invalidField')}
            </p>
          ) : null}
        </div>
      </div>

      {children}
    </div>
  )
}

function EmptyJsonRows({ label }: { label: string }) {
  return <TableEmptyState compact kind="empty" className="m-0 min-h-20 px-3 py-4" title={label} />
}

function FieldHelp({ label, description }: { label: string; description: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground size-5"
          aria-label={label}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 text-left leading-5">
        {description}
      </TooltipContent>
    </Tooltip>
  )
}

function TableHeaderCell({
  label,
  description,
  className,
}: {
  label: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex items-center gap-1.5 px-3 py-2 text-xs font-medium',
        className,
      )}
    >
      <span>{label}</span>
      {description ? <FieldHelp label={label} description={description} /> : null}
    </div>
  )
}

function ExcludedModelsEditor({
  value,
  disabled,
  catalog,
  onChange,
}: {
  value: Record<string, string[]>
  disabled: boolean
  catalog: OAuthModelCatalogState | null
  onChange: (value: Record<string, string[]>) => void
}) {
  const { t } = useTranslation()
  const channel = catalog?.channel ?? 'claude'
  const selectedModels = value[channel] ?? []
  const selectedModelSet = new Set(selectedModels)
  const customEntries = Object.entries(value).filter(
    ([provider]) => !modelDefinitionChannels.includes(provider as ProviderModelChannel),
  )
  const normalizedFilter = catalog?.filter.trim().toLowerCase() ?? ''
  const filteredModels = catalog
    ? catalog.models.filter((model) =>
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
          .some((item) => item?.toLowerCase().includes(normalizedFilter)),
      )
    : []

  const removeProvider = (provider: string) => {
    const nextValue = { ...value }
    delete nextValue[provider]
    onChange(nextValue)
  }

  const toggleModel = (modelId: string) => {
    const nextValue = { ...value }
    const nextModels = selectedModelSet.has(modelId)
      ? selectedModels.filter((item) => item !== modelId)
      : [...selectedModels, modelId]

    if (nextModels.length === 0) {
      delete nextValue[channel]
    } else {
      nextValue[channel] = nextModels
    }

    onChange(nextValue)
  }

  const clearChannel = () => {
    removeProvider(channel)
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Select
            value={channel}
            disabled={disabled || !catalog}
            onValueChange={(nextChannel) => {
              catalog?.onChannelChange(nextChannel as ProviderModelChannel)
            }}
          >
            <SelectTrigger
              className="sm:w-44"
              aria-label={t('configPage.oauthExcluded.channelLabel')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelDefinitionChannels.map((nextChannel) => (
                <SelectItem key={nextChannel} value={nextChannel}>
                  {t(`configPage.oauthExcluded.channels.${nextChannel}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs">
            <Filter className="size-3" aria-hidden="true" />
            {t('configPage.oauthExcluded.selectedCount', {
              count: selectedModels.length,
            })}
          </span>
          {selectedModels.length > 0 ? (
            <Button
              type="button"
              variant="text"
              size="xs"
              disabled={disabled}
              onClick={clearChannel}
            >
              {t('configPage.oauthExcluded.clearChannel')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative min-w-0 lg:w-80">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          value={catalog?.filter ?? ''}
          disabled={disabled || !catalog}
          placeholder={t('configPage.oauthExcluded.searchPlaceholder')}
          onChange={(event) => catalog?.onFilterChange(event.target.value)}
        />
      </div>

      {catalog?.errorMessage ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm leading-6 text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:text-amber-200">
          <div className="min-w-0">
            <AlertTriangle className="mr-2 inline size-4 align-text-bottom" aria-hidden="true" />
            {catalog.errorMessage}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-background/70 border-amber-500/35 text-amber-800 hover:bg-amber-500/10 sm:shrink-0 dark:text-amber-200"
            disabled={disabled || !catalog || catalog.loading}
            onClick={catalog?.onRetry}
          >
            {catalog?.loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {t('configPage.oauthExcluded.reloadModels')}
          </Button>
        </div>
      ) : null}

      {catalog?.loading && filteredModels.length === 0 ? (
        <div className="grid gap-2">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>
      ) : filteredModels.length > 0 ? (
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {filteredModels.map((model) => {
            const checked = selectedModelSet.has(model.id)

            return (
              <label
                key={model.id}
                className="hover:bg-accent/70 flex cursor-pointer items-start gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <Checkbox
                  className="mt-1"
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => toggleModel(model.id)}
                />
                <span className="grid min-w-0 gap-1">
                  <span className="truncate text-sm font-medium">{getModelDisplayName(model)}</span>
                  <span className="text-muted-foreground truncate font-mono text-xs">
                    {model.id}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      ) : (
        <EmptyJsonRows
          label={
            normalizedFilter
              ? t('configPage.oauthExcluded.emptyFiltered')
              : t('configPage.oauthExcluded.emptyModels')
          }
        />
      )}

      {customEntries.length > 0 ? (
        <div className="grid gap-2 rounded-md border border-amber-500/35 bg-amber-500/5 px-3 py-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {t('configPage.oauthExcluded.customTitle')}
          </p>
          <p className="text-muted-foreground text-xs leading-5">
            {t('configPage.oauthExcluded.customDescription')}
          </p>
          <div className="flex flex-wrap gap-2">
            {customEntries.map(([provider, models]) => (
              <span
                key={provider}
                className="bg-background inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs"
              >
                <span className="font-mono">{provider}</span>
                <span className="text-muted-foreground">
                  {t('configPage.oauthExcluded.selectedCount', { count: models.length })}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ModelAliasEditor({
  value,
  disabled,
  onChange,
}: {
  value: Record<string, AliasRule[]>
  disabled: boolean
  onChange: (value: Record<string, AliasRule[]>) => void
}) {
  const { t } = useTranslation()
  const channels = Object.entries(value)
  const rows = channels.flatMap(([channel, aliases]) =>
    aliases.map((item, index) => ({
      channel,
      index,
      item,
    })),
  )
  const columnsClass =
    'lg:grid-cols-[minmax(9rem,0.75fr)_minmax(12rem,1fr)_minmax(11rem,0.9fr)_minmax(8rem,auto)_auto]'

  const updateRow = (rowIndex: number, patch: Partial<{ channel: string; item: AliasRule }>) => {
    const nextRows = rows.map((row, index) => ({
      channel: index === rowIndex ? (patch.channel ?? row.channel) : row.channel,
      item: index === rowIndex ? { ...row.item, ...patch.item } : row.item,
    }))

    const nextValue = nextRows.reduce<Record<string, AliasRule[]>>((nextRecord, row) => {
      return {
        ...nextRecord,
        [row.channel]: [...(nextRecord[row.channel] ?? []), row.item],
      }
    }, {})

    onChange(nextValue)
  }

  const addAlias = () => {
    const defaultChannel = channels.at(-1)?.[0] ?? 'claude'
    onChange({
      ...value,
      [defaultChannel]: [...(value[defaultChannel] ?? []), { name: '', alias: '', fork: false }],
    })
  }

  const removeAlias = (rowIndex: number) => {
    const nextRows = rows.filter((_, index) => index !== rowIndex)
    const nextValue = nextRows.reduce<Record<string, AliasRule[]>>((nextRecord, row) => {
      return {
        ...nextRecord,
        [row.channel]: [...(nextRecord[row.channel] ?? []), row.item],
      }
    }, {})

    onChange(nextValue)
  }

  return (
    <div className="grid gap-3">
      <div className="flex justify-start lg:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={disabled}
          onClick={addAlias}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('configPage.json.addAlias')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyJsonRows label={t('configPage.json.emptyRows')} />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className={cn('bg-muted/45 hidden border-b lg:grid', columnsClass)}>
            <TableHeaderCell
              label={t('configPage.json.columns.channel')}
              description={t('configPage.json.columnDescriptions.channel')}
            />
            <TableHeaderCell
              label={t('configPage.json.columns.name')}
              description={t('configPage.json.columnDescriptions.name')}
            />
            <TableHeaderCell
              label={t('configPage.json.columns.alias')}
              description={t('configPage.json.columnDescriptions.alias')}
            />
            <TableHeaderCell
              label={t('configPage.json.columns.fork')}
              description={t('configPage.json.columnDescriptions.fork')}
            />
            <TableHeaderCell label={t('configPage.json.columns.actions')} />
          </div>

          <div className="divide-y">
            {rows.map(({ channel, item }, rowIndex) => (
              <div
                key={rowIndex}
                className={cn('grid gap-2 px-3 py-3 lg:items-start', columnsClass)}
              >
                <label className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium lg:hidden">
                    {t('configPage.json.columns.channel')}
                  </span>
                  <Input
                    value={channel}
                    disabled={disabled}
                    aria-label={t('configPage.json.columns.channel')}
                    placeholder={t('configPage.json.placeholders.channel')}
                    onChange={(event) => updateRow(rowIndex, { channel: event.target.value })}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium lg:hidden">
                    {t('configPage.json.columns.name')}
                  </span>
                  <Input
                    value={item.name ?? ''}
                    disabled={disabled}
                    aria-label={t('configPage.json.columns.name')}
                    placeholder={t('configPage.json.placeholders.name')}
                    onChange={(event) =>
                      updateRow(rowIndex, { item: { name: event.target.value } })
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium lg:hidden">
                    {t('configPage.json.columns.alias')}
                  </span>
                  <Input
                    value={item.alias ?? ''}
                    disabled={disabled}
                    aria-label={t('configPage.json.columns.alias')}
                    placeholder={t('configPage.json.placeholders.alias')}
                    onChange={(event) =>
                      updateRow(rowIndex, { item: { alias: event.target.value } })
                    }
                  />
                </label>
                <label className="border-input bg-background flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                  <Checkbox
                    checked={Boolean(item.fork)}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      updateRow(rowIndex, { item: { fork: checked === true } })
                    }
                  />
                  <span>{t('configPage.json.columns.fork')}</span>
                </label>
                <Button
                  type="button"
                  variant="text"
                  size="sm"
                  className="justify-start lg:justify-center"
                  disabled={disabled}
                  onClick={() => removeAlias(rowIndex)}
                >
                  {t('configPage.json.remove')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PluginStoreSourcesEditor({
  value,
  disabled,
  onChange,
}: {
  value: string[]
  disabled: boolean
  onChange: (value: string[]) => void
}) {
  const { t } = useTranslation()
  const normalizedValue = normalizePluginStoreSources(value).join('\n')
  const [draft, setDraft] = useState(normalizedValue)

  useEffect(() => {
    const normalizedDraft = draft
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .join('\n')

    if (normalizedDraft !== normalizedValue) {
      setDraft(normalizedValue)
    }
  }, [draft, normalizedValue])

  const commitDraft = (nextDraft: string) => {
    onChange(
      nextDraft
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    )
  }

  return (
    <div className="grid gap-3">
      <Textarea
        value={draft}
        disabled={disabled}
        className="min-h-28 font-mono text-sm"
        placeholder={t('configPage.pluginStoreSources.placeholder')}
        onChange={(event) => {
          setDraft(event.target.value)
          commitDraft(event.target.value)
        }}
      />
      <div className="text-muted-foreground flex flex-col gap-1 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between">
        <span>{t('configPage.pluginStoreSources.hint')}</span>
        <span>
          {t('configPage.pluginStoreSources.count', {
            count: normalizePluginStoreSources(value).length,
          })}
        </span>
      </div>
    </div>
  )
}

function createPluginStoreAuthRule(): PluginStoreAuthRule {
  return {
    match: '',
    applyTo: [],
    type: 'bearer',
    tokenEnv: '',
    usernameEnv: '',
    passwordEnv: '',
    headerName: '',
    headerValueEnv: '',
    allowInsecure: false,
  }
}

function PluginStoreAuthEditor({
  value,
  disabled,
  onChange,
}: {
  value: PluginStoreAuthRule[]
  disabled: boolean
  onChange: (value: PluginStoreAuthRule[]) => void
}) {
  const { t } = useTranslation()
  const updateRule = (index: number, patch: Partial<PluginStoreAuthRule>) => {
    onChange(value.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)))
  }
  const addRule = () => onChange([...value, createPluginStoreAuthRule()])
  const removeRule = (index: number) => {
    onChange(value.filter((_, ruleIndex) => ruleIndex !== index))
  }
  const toggleApplyTo = (index: number, item: PluginStoreAuthApplyTo) => {
    const rule = value[index]
    if (!rule) return
    const nextApplyTo = rule.applyTo.includes(item)
      ? rule.applyTo.filter((current) => current !== item)
      : [...rule.applyTo, item]
    updateRule(index, { applyTo: nextApplyTo })
  }

  return (
    <div className="grid gap-3">
      <div className="border-info/25 bg-info/10 text-info rounded-md border px-3 py-2 text-xs leading-5">
        {t('configPage.pluginStoreAuth.secretHint')}
      </div>

      {value.length === 0 ? (
        <EmptyJsonRows label={t('configPage.pluginStoreAuth.empty')} />
      ) : (
        <div className="grid gap-3">
          {value.map((rule, index) => {
            const usesToken = rule.type === 'bearer' || rule.type === 'github-token'
            const usesBasic = rule.type === 'basic'
            const usesHeader = rule.type === 'header'

            return (
              <div key={index} className="grid gap-3 rounded-md border px-3 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {rule.match.trim() ||
                        t('configPage.pluginStoreAuth.ruleTitle', { index: index + 1 })}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t(`configPage.pluginStoreAuth.types.${rule.type}`)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    className="text-destructive hover:text-destructive justify-start sm:justify-center"
                    disabled={disabled}
                    onClick={() => removeRule(index)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t('configPage.pluginStoreAuth.remove')}
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1.4fr)_minmax(12rem,0.7fr)]">
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground text-xs font-medium">
                      {t('configPage.pluginStoreAuth.match')}
                    </span>
                    <Input
                      value={rule.match}
                      disabled={disabled}
                      className="font-mono"
                      placeholder={t('configPage.pluginStoreAuth.matchPlaceholder')}
                      onChange={(event) => updateRule(index, { match: event.target.value })}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground text-xs font-medium">
                      {t('configPage.pluginStoreAuth.type')}
                    </span>
                    <Select
                      value={rule.type}
                      disabled={disabled}
                      onValueChange={(type) =>
                        updateRule(index, { type: type as PluginStoreAuthType })
                      }
                    >
                      <SelectTrigger aria-label={t('configPage.pluginStoreAuth.type')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pluginStoreAuthTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`configPage.pluginStoreAuth.types.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="grid gap-2">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t('configPage.pluginStoreAuth.applyTo')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pluginStoreAuthApplyToOptions.map((item) => (
                      <label
                        key={item}
                        className="border-input bg-background flex h-8 items-center gap-2 rounded-md border px-3 text-sm"
                      >
                        <Checkbox
                          checked={rule.applyTo.includes(item)}
                          disabled={disabled}
                          onCheckedChange={() => toggleApplyTo(index, item)}
                        />
                        <span>{t(`configPage.pluginStoreAuth.applyToOptions.${item}`)}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs leading-5">
                    {t('configPage.pluginStoreAuth.applyToHint')}
                  </p>
                </div>

                {usesToken ? (
                  <label className="grid gap-1.5 lg:max-w-md">
                    <span className="text-muted-foreground text-xs font-medium">
                      {t('configPage.pluginStoreAuth.tokenEnv')}
                    </span>
                    <Input
                      value={rule.tokenEnv}
                      disabled={disabled}
                      className="font-mono"
                      placeholder={t('configPage.pluginStoreAuth.tokenEnvPlaceholder')}
                      onChange={(event) => updateRule(index, { tokenEnv: event.target.value })}
                    />
                  </label>
                ) : null}

                {usesBasic ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="text-muted-foreground text-xs font-medium">
                        {t('configPage.pluginStoreAuth.usernameEnv')}
                      </span>
                      <Input
                        value={rule.usernameEnv}
                        disabled={disabled}
                        className="font-mono"
                        placeholder={t('configPage.pluginStoreAuth.usernameEnvPlaceholder')}
                        onChange={(event) => updateRule(index, { usernameEnv: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-muted-foreground text-xs font-medium">
                        {t('configPage.pluginStoreAuth.passwordEnv')}
                      </span>
                      <Input
                        value={rule.passwordEnv}
                        disabled={disabled}
                        className="font-mono"
                        placeholder={t('configPage.pluginStoreAuth.passwordEnvPlaceholder')}
                        onChange={(event) => updateRule(index, { passwordEnv: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}

                {usesHeader ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="text-muted-foreground text-xs font-medium">
                        {t('configPage.pluginStoreAuth.headerName')}
                      </span>
                      <Input
                        value={rule.headerName}
                        disabled={disabled}
                        className="font-mono"
                        placeholder={t('configPage.pluginStoreAuth.headerNamePlaceholder')}
                        onChange={(event) => updateRule(index, { headerName: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-muted-foreground text-xs font-medium">
                        {t('configPage.pluginStoreAuth.headerValueEnv')}
                      </span>
                      <Input
                        value={rule.headerValueEnv}
                        disabled={disabled}
                        className="font-mono"
                        placeholder={t('configPage.pluginStoreAuth.headerValueEnvPlaceholder')}
                        onChange={(event) =>
                          updateRule(index, { headerValueEnv: event.target.value })
                        }
                      />
                    </label>
                  </div>
                ) : null}

                <label className="border-input bg-background flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox
                    checked={rule.allowInsecure}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      updateRule(index, { allowInsecure: checked === true })
                    }
                  />
                  <span>{t('configPage.pluginStoreAuth.allowInsecure')}</span>
                </label>
              </div>
            )
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={addRule}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('configPage.pluginStoreAuth.add')}
      </Button>
    </div>
  )
}

function StructuredJsonEditor({
  fieldKey,
  value,
  disabled,
  oauthModelCatalog,
  onChange,
}: {
  fieldKey: JsonConfigFieldKey
  value: unknown
  disabled: boolean
  oauthModelCatalog: OAuthModelCatalogState | null
  onChange: (value: unknown) => void
}) {
  switch (fieldKey) {
    case 'oauthExcludedModelsJson':
      return (
        <ExcludedModelsEditor
          value={value as Record<string, string[]>}
          disabled={disabled}
          catalog={oauthModelCatalog}
          onChange={onChange}
        />
      )
    case 'oauthModelAliasJson':
      return (
        <ModelAliasEditor
          value={value as Record<string, AliasRule[]>}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case 'pluginStoreSourcesJson':
      return (
        <PluginStoreSourcesEditor
          value={normalizePluginStoreSources(value)}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case 'pluginStoreAuthJson':
      return (
        <PluginStoreAuthEditor
          value={normalizePluginStoreAuthRules(value)}
          disabled={disabled}
          onChange={(nextValue) => onChange(nextValue.map(serializePluginStoreAuthRule))}
        />
      )
  }
}

function JsonConfigField({
  field,
  value,
  disabled,
  invalid,
  oauthModelCatalog,
  onChange,
}: {
  field: ConfigFieldDefinition & { key: JsonConfigFieldKey }
  value: string
  disabled: boolean
  invalid: boolean
  oauthModelCatalog: OAuthModelCatalogState | null
  onChange: (key: ConfigFieldKey, value: boolean | number | string) => void
}) {
  const { t } = useTranslation()
  const parsed = parseJsonDraft(field, value)
  const canUseStructured = parsed.ok && canEditJsonField(field.key, parsed.value)
  const parseError = parsed.ok ? null : parsed.message

  return (
    <JsonEditorFrame field={field} invalid={invalid} parseError={parseError}>
      {canUseStructured ? (
        <StructuredJsonEditor
          fieldKey={field.key}
          value={parsed.value}
          disabled={disabled}
          oauthModelCatalog={oauthModelCatalog}
          onChange={(nextValue) => onChange(field.key, stringifyJson(nextValue))}
        />
      ) : (
        <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mr-2 inline size-4 align-text-bottom" aria-hidden="true" />
          {parseError
            ? t('configPage.validation.jsonParseError', { message: parseError })
            : t('configPage.json.unsupportedStructure')}
        </div>
      )}
    </JsonEditorFrame>
  )
}

function StructuredWorkspace({
  draft,
  changes,
  validationErrors,
  disabled,
  oauthModelCatalog,
  onChange,
}: {
  draft: ConfigStructuredValues
  changes: ConfigChange[]
  validationErrors: ConfigFieldKey[]
  disabled: boolean
  oauthModelCatalog: OAuthModelCatalogState | null
  onChange: (key: ConfigFieldKey, value: boolean | number | string) => void
}) {
  const { t } = useTranslation()
  const [networkPanel, setNetworkPanel] = useState<NetworkProxyPanel>('current')

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <SectionNavigation changes={changes} validationErrors={validationErrors} />
      <div className="grid min-w-0 gap-4">
        {sectionDefinitions.map((section) => (
          <section
            key={section.id}
            id={`config-section-${section.id}`}
            className="bg-card scroll-mt-24 rounded-lg border p-4 shadow-sm"
          >
            {(() => {
              const SectionIcon = sectionIcons[section.id]

              return (
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
                    <SectionIcon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">
                      {t(`configPage.sections.${section.id}.title`)}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      {t(`configPage.sections.${section.id}.description`)}
                    </p>
                  </div>
                </div>
              )
            })()}

            {section.id === 'network' ? (
              <div className="mt-4 grid gap-4">
                <div className="bg-muted/50 inline-flex w-fit items-center gap-1 rounded-md border p-1 shadow-xs">
                  {(['current', 'pool'] as const).map((panel) => (
                    <Button
                      key={panel}
                      type="button"
                      size="sm"
                      variant={networkPanel === panel ? 'secondary' : 'ghost'}
                      className="h-8"
                      onClick={() => setNetworkPanel(panel)}
                    >
                      {t(`configPage.networkPanels.${panel}`)}
                    </Button>
                  ))}
                </div>

                {networkPanel === 'current' ? (
                  <div className="grid gap-3">
                    {section.fields.map((field) => (
                      <ConfigField
                        key={field.key}
                        field={field}
                        value={draft[field.key]}
                        disabled={disabled}
                        invalid={validationErrors.includes(field.key)}
                        onChange={onChange}
                      />
                    ))}
                  </div>
                ) : (
                  <ProxyPoolsPanel enabled={networkPanel === 'pool'} />
                )}
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {section.fields.map((field) =>
                  isJsonConfigFieldKey(field.key) ? (
                    <JsonConfigField
                      key={field.key}
                      field={field as ConfigFieldDefinition & { key: JsonConfigFieldKey }}
                      value={String(draft[field.key])}
                      disabled={disabled}
                      invalid={validationErrors.includes(field.key)}
                      oauthModelCatalog={oauthModelCatalog}
                      onChange={onChange}
                    />
                  ) : (
                    <ConfigField
                      key={field.key}
                      field={field}
                      value={draft[field.key]}
                      disabled={disabled}
                      invalid={validationErrors.includes(field.key)}
                      onChange={onChange}
                    />
                  ),
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

function ConfigActionBar({
  changeCount,
  validationCount,
  isFetching,
  mutating,
  runtimeMode,
  fetchedAt,
  saveDisabled,
  onOpenChanges,
  onReload,
  onSave,
}: {
  changeCount: number
  validationCount: number
  isFetching: boolean
  mutating: boolean
  runtimeMode: string
  fetchedAt: string
  saveDisabled: boolean
  onOpenChanges: () => void
  onReload: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const dirty = changeCount > 0

  return (
    <div className="bg-background/95 sticky top-16 z-[var(--z-page-sticky)] -mx-4 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <div className="bg-card rounded-lg border p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {t('configPage.header.runtime', {
                mode: t(`runtimeMode.${runtimeMode}`),
              })}
            </span>
            <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
              {t('configPage.header.updatedAt', {
                time: formatDateTime(fetchedAt),
              })}
            </span>
            <span
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium',
                dirty
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {dirty
                ? t('configPage.status.visualChangeCount', { count: changeCount })
                : t('configPage.status.clean')}
            </span>
            {validationCount > 0 ? (
              <span className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                {t('configPage.validation.summary', { count: validationCount })}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button variant="outline" size="sm" disabled={!dirty} onClick={onOpenChanges}>
              <FileDiff className="size-4" aria-hidden="true" />
              {t('configPage.actions.viewChanges')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching || mutating}
              onClick={onReload}
            >
              {isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {t('configPage.actions.reload')}
            </Button>
            <Button size="sm" disabled={saveDisabled} onClick={onSave}>
              {mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {t('configPage.actions.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChangeDetailSheet({
  open,
  changes,
  onOpenChange,
  onJumpToField,
}: {
  open: boolean
  changes: ConfigChange[]
  onOpenChange: (open: boolean) => void
  onJumpToField: (key: ConfigFieldKey) => void
}) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full overflow-hidden sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t('configPage.diff.title')}</SheetTitle>
          <SheetDescription>
            {t('configPage.diff.visualDescription', { count: changes.length })}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {changes.length === 0 ? (
            <div className="text-muted-foreground rounded-md border px-3 py-3 text-sm">
              {t('configPage.diff.empty')}
            </div>
          ) : (
            <div className="grid gap-2">
              {changes.map((change) => {
                const field = fieldDefinitionByKey[change.key]

                return (
                  <Button
                    key={change.key}
                    type="button"
                    variant="ghost"
                    className="grid h-auto w-full min-w-0 justify-stretch gap-2 rounded-md border px-3 py-2 text-left text-sm whitespace-normal"
                    onClick={() => {
                      onOpenChange(false)
                      onJumpToField(change.key)
                    }}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">
                        {t(`configPage.fields.${change.key}.label`)}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {t(`configPage.sections.${field.sectionId}.shortTitle`)}
                      </span>
                    </span>
                    <span className="text-muted-foreground min-w-0 font-mono text-xs break-all whitespace-normal">
                      {formatConfigValue(change.previousValue, t('configPage.status.emptyValue'))}
                      {' -> '}
                      <span className="text-foreground">
                        {formatConfigValue(change.nextValue, t('configPage.status.emptyValue'))}
                      </span>
                    </span>
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ConfigConfirmationDialog({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: PendingConfigConfirmation | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()

  return (
    <AlertDialog
      open={Boolean(confirmation)}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('configPage.confirmDialog.reloadTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('configPage.confirm.reload')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
            onClick={onConfirm}
          >
            {t('configPage.confirmDialog.discardAndReload')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ConfigWorkbenchPage() {
  const { t } = useTranslation()
  const [oauthModelChannel, setOauthModelChannel] = useState<ProviderModelChannel>('claude')
  const [oauthModelFilter, setOauthModelFilter] = useState('')
  const workbench = useConfigWorkbench(oauthModelChannel)
  const [structuredDraft, setStructuredDraft] = useState<ConfigStructuredValues | null>(null)
  const [changeSheetOpen, setChangeSheetOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<PendingConfigConfirmation | null>(null)

  useEffect(() => {
    if (!workbench.snapshot) return
    setStructuredDraft(workbench.snapshot.structured)
  }, [workbench.snapshot])

  const changes = useMemo(() => {
    if (!workbench.snapshot || !structuredDraft) return []
    return getStructuredChanges(workbench.snapshot.structured, structuredDraft)
  }, [structuredDraft, workbench.snapshot])
  const validationErrors = useMemo(
    () => (structuredDraft ? getValidationErrors(structuredDraft) : []),
    [structuredDraft],
  )
  const isDirty = changes.length > 0
  const saveDisabled = !isDirty || workbench.mutating || validationErrors.length > 0
  const oauthModelCatalog: OAuthModelCatalogState = {
    channel: oauthModelChannel,
    models: workbench.modelDefinitions?.models ?? [],
    fetchedAt: workbench.modelDefinitions?.fetchedAt ?? null,
    loading: workbench.isFetchingModelDefinitions,
    errorMessage: workbench.modelDefinitionsErrorMessage,
    filter: oauthModelFilter,
    onChannelChange: (channel) => {
      setOauthModelChannel(channel)
      setOauthModelFilter('')
    },
    onFilterChange: setOauthModelFilter,
    onRetry: workbench.refetchModelDefinitions,
  }

  if (workbench.checking) {
    return <ConfigLoadingState />
  }

  if (!workbench.connected) {
    return <ConfigDisconnectedState />
  }

  if (workbench.isPending || !structuredDraft) {
    return <ConfigLoadingState />
  }

  if (workbench.isError || !workbench.snapshot) {
    return <ConfigErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
  }

  const snapshot = workbench.snapshot

  const handleStructuredChange = (key: ConfigFieldKey, value: boolean | number | string) => {
    setStructuredDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  const handleReload = () => {
    if (isDirty) {
      setConfirmation({ type: 'reload' })
      return
    }
    setStructuredDraft(snapshot.structured)
    workbench.refetch()
  }

  const reloadFromRuntime = () => {
    setStructuredDraft(snapshot.structured)
    workbench.refetch()
  }

  const handleSave = async () => {
    try {
      if (validationErrors.length > 0) {
        toast.error(t('configPage.toast.validationFailed'))
        return
      }
      await workbench.saveStructured(changes)
      toast.success(t('configPage.toast.saved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleConfirmAction = () => {
    const currentConfirmation = confirmation
    setConfirmation(null)

    if (!currentConfirmation) return

    if (currentConfirmation.type === 'reload') {
      reloadFromRuntime()
    }
  }

  return (
    <section className="grid w-full gap-4">
      <PageHeader
        className="p-4"
        title={t('configPage.header.title')}
        description={t('configPage.header.description')}
      />

      <ConfigActionBar
        changeCount={changes.length}
        validationCount={validationErrors.length}
        isFetching={workbench.isFetching}
        mutating={workbench.mutating}
        runtimeMode={workbench.runtimeMode}
        fetchedAt={snapshot.fetchedAt}
        saveDisabled={saveDisabled}
        onOpenChanges={() => setChangeSheetOpen(true)}
        onReload={handleReload}
        onSave={() => void handleSave()}
      />

      <ChangeDetailSheet
        open={changeSheetOpen}
        changes={changes}
        onOpenChange={setChangeSheetOpen}
        onJumpToField={(key) => {
          window.requestAnimationFrame(() => scrollToField(key))
        }}
      />

      <ConfigConfirmationDialog
        confirmation={confirmation}
        onCancel={() => setConfirmation(null)}
        onConfirm={handleConfirmAction}
      />

      <StructuredWorkspace
        draft={structuredDraft}
        changes={changes}
        validationErrors={validationErrors}
        disabled={workbench.mutating}
        oauthModelCatalog={oauthModelCatalog}
        onChange={handleStructuredChange}
      />
    </section>
  )
}
