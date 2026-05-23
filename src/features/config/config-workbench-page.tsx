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
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfigWorkbench } from '@/features/config/use-config-workbench'
import type {
  ConfigChange,
  ConfigFieldKey,
  ConfigMode,
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
  | 'oauthRules'
  | 'system'
  | 'network'
  | 'quota'
  | 'streaming'
  | 'ampcode'
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
  | 'ampcodeModelMappingsJson'
  | 'ampcodeUpstreamApiKeysJson'

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

type ModelMappingRule = {
  from?: string
  to?: string
  regex?: boolean
}

type ConfigYamlDiffLine =
  | {
      type: 'context' | 'added' | 'removed'
      oldLineNumber: number | null
      newLineNumber: number | null
      content: string
    }
  | {
      type: 'omitted'
      skipped: number
    }

type ConfigYamlDiff = {
  lines: ConfigYamlDiffLine[]
  added: number
  removed: number
}

type PendingConfigConfirmation =
  | {
      type: 'switchMode'
      fromMode: ConfigMode
      nextMode: ConfigMode
    }
  | {
      type: 'reload'
    }
  | {
      type: 'saveYaml'
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
    id: 'ampcode',
    fields: [
      { key: 'ampcodeUpstreamUrl', kind: 'text', sectionId: 'ampcode' },
      { key: 'ampcodeUpstreamApiKey', kind: 'text', sectionId: 'ampcode' },
      { key: 'ampcodeRestrictManagementToLocalhost', kind: 'boolean', sectionId: 'ampcode' },
      { key: 'ampcodeForceModelMappings', kind: 'boolean', sectionId: 'ampcode' },
      { key: 'ampcodeModelMappingsJson', kind: 'jsonArray', sectionId: 'ampcode' },
      { key: 'ampcodeUpstreamApiKeysJson', kind: 'jsonArray', sectionId: 'ampcode' },
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
  'gemini-cli',
  'aistudio',
  'codex',
  'kimi',
  'antigravity',
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
  oauthRules: Route,
  system: Database,
  network: Network,
  quota: Gauge,
  streaming: Route,
  ampcode: Terminal,
  payload: Code2,
}

const jsonConfigFieldKeys = new Set<ConfigFieldKey>([
  'oauthExcludedModelsJson',
  'oauthModelAliasJson',
  'ampcodeModelMappingsJson',
  'ampcodeUpstreamApiKeysJson',
])

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

function parseListText(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
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

function canEditModelMappings(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        hasOnlyKeys(item, ['from', 'to', 'regex']) &&
        (item.from === undefined || typeof item.from === 'string') &&
        (item.to === undefined || typeof item.to === 'string') &&
        (item.regex === undefined || typeof item.regex === 'boolean'),
    )
  )
}

function canEditUpstreamApiKeys(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        hasOnlyKeys(item, ['upstream-api-key', 'api-keys']) &&
        (item['upstream-api-key'] === undefined || typeof item['upstream-api-key'] === 'string') &&
        (item['api-keys'] === undefined ||
          (Array.isArray(item['api-keys']) &&
            item['api-keys'].every((key) => typeof key === 'string'))),
    )
  )
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
    case 'ampcodeModelMappingsJson':
      return canEditModelMappings(value)
    case 'ampcodeUpstreamApiKeysJson':
      return canEditUpstreamApiKeys(value)
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

function splitConfigTextLines(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized) return []

  const lines = normalized.split('\n')
  if (normalized.endsWith('\n')) {
    lines.pop()
  }

  return lines
}

function compactYamlDiffLines(lines: ConfigYamlDiffLine[], contextSize = 3): ConfigYamlDiffLine[] {
  const visibleIndexes = new Set<number>()

  lines.forEach((line, index) => {
    if (line.type === 'context') return

    const start = Math.max(0, index - contextSize)
    const end = Math.min(lines.length - 1, index + contextSize)

    for (let nextIndex = start; nextIndex <= end; nextIndex += 1) {
      visibleIndexes.add(nextIndex)
    }
  })

  const compacted: ConfigYamlDiffLine[] = []
  let skipped = 0

  lines.forEach((line, index) => {
    if (visibleIndexes.has(index)) {
      if (skipped > 0) {
        compacted.push({ type: 'omitted', skipped })
        skipped = 0
      }
      compacted.push(line)
      return
    }

    skipped += 1
  })

  if (skipped > 0) {
    compacted.push({ type: 'omitted', skipped })
  }

  return compacted
}

function getYamlDiff(previousYaml: string, nextYaml: string): ConfigYamlDiff {
  if (previousYaml === nextYaml) {
    return { lines: [], added: 0, removed: 0 }
  }

  const previousLines = splitConfigTextLines(previousYaml)
  const nextLines = splitConfigTextLines(nextYaml)

  if (previousLines.length * nextLines.length > 2_500_000) {
    const lines: ConfigYamlDiffLine[] = [
      ...previousLines.map((content, index) => ({
        type: 'removed' as const,
        oldLineNumber: index + 1,
        newLineNumber: null,
        content,
      })),
      ...nextLines.map((content, index) => ({
        type: 'added' as const,
        oldLineNumber: null,
        newLineNumber: index + 1,
        content,
      })),
    ]

    return {
      lines: compactYamlDiffLines(lines, 8),
      added: nextLines.length,
      removed: previousLines.length,
    }
  }

  const width = nextLines.length + 1
  const lcs = new Uint32Array((previousLines.length + 1) * width)

  for (let oldIndex = 1; oldIndex <= previousLines.length; oldIndex += 1) {
    for (let newIndex = 1; newIndex <= nextLines.length; newIndex += 1) {
      const current = oldIndex * width + newIndex
      if (previousLines[oldIndex - 1] === nextLines[newIndex - 1]) {
        lcs[current] = lcs[(oldIndex - 1) * width + newIndex - 1] + 1
      } else {
        lcs[current] = Math.max(lcs[(oldIndex - 1) * width + newIndex], lcs[current - 1])
      }
    }
  }

  const reversedLines: ConfigYamlDiffLine[] = []
  let oldIndex = previousLines.length
  let newIndex = nextLines.length
  let added = 0
  let removed = 0

  while (oldIndex > 0 || newIndex > 0) {
    if (oldIndex > 0 && newIndex > 0 && previousLines[oldIndex - 1] === nextLines[newIndex - 1]) {
      reversedLines.push({
        type: 'context',
        oldLineNumber: oldIndex,
        newLineNumber: newIndex,
        content: previousLines[oldIndex - 1],
      })
      oldIndex -= 1
      newIndex -= 1
    } else if (
      newIndex > 0 &&
      (oldIndex === 0 ||
        lcs[oldIndex * width + newIndex - 1] >= lcs[(oldIndex - 1) * width + newIndex])
    ) {
      reversedLines.push({
        type: 'added',
        oldLineNumber: null,
        newLineNumber: newIndex,
        content: nextLines[newIndex - 1],
      })
      added += 1
      newIndex -= 1
    } else {
      reversedLines.push({
        type: 'removed',
        oldLineNumber: oldIndex,
        newLineNumber: null,
        content: previousLines[oldIndex - 1],
      })
      removed += 1
      oldIndex -= 1
    }
  }

  const lines = reversedLines.reverse()

  return {
    lines: compactYamlDiffLines(lines),
    added,
    removed,
  }
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
  return (
    <section className="grid gap-4">
      <Skeleton className="h-36 rounded-lg" />
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

function ModeSwitch({
  mode,
  onModeChange,
}: {
  mode: ConfigMode
  onModeChange: (mode: ConfigMode) => void
}) {
  const { t } = useTranslation()

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={(value) => {
        if (value) onModeChange(value as ConfigMode)
      }}
      className="bg-background"
      aria-label={t('configPage.modes.label')}
    >
      {(['structured', 'yaml'] as const).map((nextMode) => (
        <ToggleGroupItem
          key={nextMode}
          value={nextMode}
          size="sm"
          variant="outline"
          className="gap-1.5"
        >
          {nextMode === 'structured' ? (
            <Settings2 className="size-3.5" aria-hidden="true" />
          ) : (
            <Code2 className="size-3.5" aria-hidden="true" />
          )}
          {t(`configPage.modes.${nextMode}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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
      <aside className="bg-card hidden min-w-0 rounded-lg border p-3 shadow-sm xl:block">
        <div className="sticky top-[9.75rem] max-h-[calc(100dvh-10.75rem)] overflow-y-auto">
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

      <div className="bg-background/95 sticky top-[9.75rem] z-10 -mx-1 overflow-x-auto border-y px-1 py-2 backdrop-blur xl:hidden">
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
  return (
    <div className="text-muted-foreground rounded-md border border-dashed px-3 py-3 text-sm">
      {label}
    </div>
  )
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

function ModelMappingsEditor({
  value,
  disabled,
  onChange,
}: {
  value: ModelMappingRule[]
  disabled: boolean
  onChange: (value: ModelMappingRule[]) => void
}) {
  const { t } = useTranslation()
  const columnsClass = 'lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(8rem,auto)_auto]'

  const updateItem = (index: number, patch: Partial<ModelMappingRule>) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-muted-foreground text-xs leading-5">
          {t('configPage.json.modelMappings.description')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={disabled}
          onClick={() => onChange([...value, { from: '', to: '', regex: false }])}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('configPage.json.addMapping')}
        </Button>
      </div>

      {value.length === 0 ? (
        <EmptyJsonRows label={t('configPage.json.emptyRows')} />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className={cn('bg-muted/45 hidden border-b lg:grid', columnsClass)}>
            <TableHeaderCell
              label={t('configPage.json.columns.from')}
              description={t('configPage.json.columnDescriptions.from')}
            />
            <TableHeaderCell
              label={t('configPage.json.columns.to')}
              description={t('configPage.json.columnDescriptions.to')}
            />
            <TableHeaderCell
              label={t('configPage.json.columns.regex')}
              description={t('configPage.json.columnDescriptions.regex')}
            />
            <TableHeaderCell label={t('configPage.json.columns.actions')} />
          </div>

          <div className="divide-y">
            {value.map((item, index) => (
              <div key={index} className={cn('grid gap-2 px-3 py-3 lg:items-start', columnsClass)}>
                <label className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium lg:hidden">
                    {t('configPage.json.columns.from')}
                  </span>
                  <Input
                    value={item.from ?? ''}
                    disabled={disabled}
                    aria-label={t('configPage.json.columns.from')}
                    placeholder={t('configPage.json.placeholders.from')}
                    onChange={(event) => updateItem(index, { from: event.target.value })}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium lg:hidden">
                    {t('configPage.json.columns.to')}
                  </span>
                  <Input
                    value={item.to ?? ''}
                    disabled={disabled}
                    aria-label={t('configPage.json.columns.to')}
                    placeholder={t('configPage.json.placeholders.to')}
                    onChange={(event) => updateItem(index, { to: event.target.value })}
                  />
                </label>
                <label className="border-input bg-background flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                  <Checkbox
                    checked={Boolean(item.regex)}
                    disabled={disabled}
                    onCheckedChange={(checked) => updateItem(index, { regex: checked === true })}
                  />
                  <span>{t('configPage.json.columns.regex')}</span>
                </label>
                <Button
                  type="button"
                  variant="text"
                  size="sm"
                  className="justify-start lg:justify-center"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
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

function UpstreamApiKeysEditor({
  value,
  disabled,
  onChange,
}: {
  value: Array<{ 'upstream-api-key'?: string; 'api-keys'?: string[] }>
  disabled: boolean
  onChange: (value: Array<{ 'upstream-api-key'?: string; 'api-keys'?: string[] }>) => void
}) {
  const { t } = useTranslation()

  const updateItem = (
    index: number,
    patch: Partial<{ 'upstream-api-key': string; 'api-keys': string[] }>,
  ) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="grid gap-3">
      {value.length === 0 ? (
        <EmptyJsonRows label={t('configPage.json.emptyRows')} />
      ) : (
        value.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border px-3 py-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto]"
          >
            <Input
              value={item['upstream-api-key'] ?? ''}
              disabled={disabled}
              aria-label={t('configPage.json.columns.upstreamApiKey')}
              placeholder={t('configPage.json.placeholders.upstreamApiKey')}
              onChange={(event) => updateItem(index, { 'upstream-api-key': event.target.value })}
            />
            <Input
              value={(item['api-keys'] ?? []).join(', ')}
              disabled={disabled}
              aria-label={t('configPage.json.columns.clientKeys')}
              placeholder={t('configPage.json.placeholders.clientKeys')}
              onChange={(event) =>
                updateItem(index, { 'api-keys': parseListText(event.target.value) })
              }
            />
            <Button
              type="button"
              variant="text"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
            >
              {t('configPage.json.remove')}
            </Button>
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={() => onChange([...value, { 'upstream-api-key': '', 'api-keys': [] }])}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('configPage.json.addUpstreamKey')}
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
    case 'ampcodeModelMappingsJson':
      return (
        <ModelMappingsEditor
          value={value as ModelMappingRule[]}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case 'ampcodeUpstreamApiKeysJson':
      return (
        <UpstreamApiKeysEditor
          value={value as Array<{ 'upstream-api-key'?: string; 'api-keys'?: string[] }>}
          disabled={disabled}
          onChange={onChange}
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

            <div className="mt-4 grid gap-3">
              {section.fields.length > 0 ? (
                section.fields.map((field) =>
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
                )
              ) : (
                <div className="bg-muted/60 text-muted-foreground rounded-md border px-3 py-3 text-sm leading-6">
                  {t(`configPage.sections.${section.id}.yamlOnly`)}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function ConfigActionBar({
  mode,
  changeCount,
  validationCount,
  yamlDirty,
  isFetching,
  mutating,
  runtimeMode,
  fetchedAt,
  saveDisabled,
  onOpenChanges,
  onReload,
  onSave,
}: {
  mode: ConfigMode
  changeCount: number
  validationCount: number
  yamlDirty: boolean
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
  const dirty = mode === 'structured' ? changeCount > 0 : yamlDirty

  return (
    <div className="bg-background/95 sticky top-16 z-20 -mx-4 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
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
              {mode === 'structured'
                ? t('configPage.status.visualChangeCount', { count: changeCount })
                : yamlDirty
                  ? t('configPage.status.fileChanged')
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

function YamlDiffViewer({ diff }: { diff: ConfigYamlDiff }) {
  const { t } = useTranslation()

  if (diff.added === 0 && diff.removed === 0) {
    return (
      <div className="text-muted-foreground rounded-md border px-3 py-3 text-sm">
        {t('configPage.diff.empty')}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {t('configPage.diff.addedLines', { count: diff.added })}
        </span>
        <span className="inline-flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300">
          {t('configPage.diff.removedLines', { count: diff.removed })}
        </span>
      </div>

      <div className="bg-card overflow-hidden rounded-md border">
        <div className="max-h-[70dvh] overflow-auto">
          <Table className="border-collapse font-mono text-xs">
            <TableBody>
              {diff.lines.map((line, index) => {
                if (line.type === 'omitted') {
                  return (
                    <TableRow
                      key={`omitted-${index}`}
                      className="bg-muted/50 text-muted-foreground"
                    >
                      <TableCell className="w-12 border-r px-2 py-1 text-right select-none">
                        ...
                      </TableCell>
                      <TableCell className="w-12 border-r px-2 py-1 text-right select-none">
                        ...
                      </TableCell>
                      <TableCell className="w-7 border-r px-2 py-1 text-center select-none">
                        ...
                      </TableCell>
                      <TableCell className="px-2 py-1 italic">
                        {t('configPage.diff.omittedLines', { count: line.skipped })}
                      </TableCell>
                    </TableRow>
                  )
                }

                const isAdded = line.type === 'added'
                const isRemoved = line.type === 'removed'

                return (
                  <TableRow
                    key={`${line.type}-${line.oldLineNumber ?? 'new'}-${line.newLineNumber ?? 'old'}-${index}`}
                    className={cn(
                      isAdded
                        ? 'bg-emerald-500/10 text-emerald-950 dark:text-emerald-50'
                        : isRemoved
                          ? 'bg-red-500/10 text-red-950 dark:text-red-50'
                          : 'bg-background text-muted-foreground',
                    )}
                  >
                    <TableCell
                      className={cn(
                        'text-muted-foreground w-12 border-r px-2 py-1 text-right select-none',
                        isRemoved ? 'bg-red-500/10' : null,
                      )}
                    >
                      {line.oldLineNumber ?? ''}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-muted-foreground w-12 border-r px-2 py-1 text-right select-none',
                        isAdded ? 'bg-emerald-500/10' : null,
                      )}
                    >
                      {line.newLineNumber ?? ''}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'w-7 border-r px-2 py-1 text-center font-semibold select-none',
                        isAdded
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : isRemoved
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-muted-foreground',
                      )}
                    >
                      {isAdded ? '+' : isRemoved ? '-' : ' '}
                    </TableCell>
                    <TableCell className="min-w-[28rem] px-2 py-1 break-words whitespace-pre-wrap">
                      {line.content || ' '}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function ChangeDetailSheet({
  open,
  mode,
  changes,
  yamlDirty,
  yamlDiff,
  onOpenChange,
  onJumpToField,
}: {
  open: boolean
  mode: ConfigMode
  changes: ConfigChange[]
  yamlDirty: boolean
  yamlDiff: ConfigYamlDiff
  onOpenChange: (open: boolean) => void
  onJumpToField: (key: ConfigFieldKey) => void
}) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t('configPage.diff.title')}</SheetTitle>
          <SheetDescription>
            {mode === 'structured'
              ? t('configPage.diff.visualDescription', { count: changes.length })
              : t('configPage.diff.fileDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {mode === 'yaml' ? (
            yamlDirty ? (
              <YamlDiffViewer diff={yamlDiff} />
            ) : (
              <div className="text-muted-foreground rounded-md border px-3 py-3 text-sm">
                {t('configPage.diff.empty')}
              </div>
            )
          ) : changes.length === 0 ? (
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
                    className="grid h-auto justify-stretch gap-2 rounded-md border px-3 py-2 text-left text-sm"
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
                    <span className="text-muted-foreground min-w-0 font-mono text-xs break-words">
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

function YamlWorkspace({
  yaml,
  runtimeMode,
  disabled,
  yamlDirty,
  onYamlChange,
}: {
  yaml: string
  runtimeMode: string
  disabled: boolean
  yamlDirty: boolean
  onYamlChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const matchCount = search ? yaml.toLowerCase().split(search.toLowerCase()).length - 1 : 0

  return (
    <div className="grid gap-4">
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t('configPage.yaml.title')}</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {runtimeMode === 'home-cluster'
                ? t('configPage.yaml.clusterWarning')
                : t('configPage.yaml.localWarning')}
            </p>
          </div>
          <div className="relative min-w-0 lg:w-72">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              value={search}
              disabled={disabled}
              placeholder={t('configPage.yaml.searchPlaceholder')}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('configPage.yaml.matches', { count: matchCount })}
          </span>
          {yamlDirty ? (
            <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
              {t('configPage.status.unsaved')}
            </span>
          ) : null}
        </div>
      </div>

      <Textarea
        className="bg-card min-h-[620px] rounded-lg p-4 font-mono text-xs leading-5 disabled:opacity-60"
        value={yaml}
        disabled={disabled}
        spellCheck={false}
        onChange={(event) => onYamlChange(event.target.value)}
      />
    </div>
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
  const titleKey =
    confirmation?.type === 'switchMode'
      ? 'configPage.confirmDialog.switchModeTitle'
      : confirmation?.type === 'reload'
        ? 'configPage.confirmDialog.reloadTitle'
        : 'configPage.confirmDialog.saveYamlTitle'
  const descriptionKey =
    confirmation?.type === 'switchMode'
      ? 'configPage.confirm.switchMode'
      : confirmation?.type === 'reload'
        ? 'configPage.confirm.reload'
        : 'configPage.confirm.saveYaml'
  const actionLabel =
    confirmation?.type === 'switchMode'
      ? t('configPage.confirmDialog.discardAndSwitch')
      : confirmation?.type === 'reload'
        ? t('configPage.confirmDialog.discardAndReload')
        : t('configPage.actions.save')
  const actionClassName =
    confirmation?.type === 'saveYaml'
      ? undefined
      : 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40'

  return (
    <AlertDialog
      open={Boolean(confirmation)}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(titleKey)}</AlertDialogTitle>
          <AlertDialogDescription>{t(descriptionKey)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction className={actionClassName} onClick={onConfirm}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ConfigWorkbenchPage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ConfigMode>('structured')
  const [oauthModelChannel, setOauthModelChannel] = useState<ProviderModelChannel>('claude')
  const [oauthModelFilter, setOauthModelFilter] = useState('')
  const workbench = useConfigWorkbench(oauthModelChannel)
  const [structuredDraft, setStructuredDraft] = useState<ConfigStructuredValues | null>(null)
  const [yamlDraft, setYamlDraft] = useState('')
  const [changeSheetOpen, setChangeSheetOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<PendingConfigConfirmation | null>(null)

  useEffect(() => {
    if (!workbench.snapshot) return
    setStructuredDraft(workbench.snapshot.structured)
    setYamlDraft(workbench.snapshot.yaml)
  }, [workbench.snapshot])

  const changes = useMemo(() => {
    if (!workbench.snapshot || !structuredDraft) return []
    return getStructuredChanges(workbench.snapshot.structured, structuredDraft)
  }, [structuredDraft, workbench.snapshot])
  const validationErrors = useMemo(
    () => (structuredDraft ? getValidationErrors(structuredDraft) : []),
    [structuredDraft],
  )
  const yamlDirty = Boolean(workbench.snapshot && yamlDraft !== workbench.snapshot.yaml)
  const yamlDiff = useMemo(
    () =>
      workbench.snapshot
        ? getYamlDiff(workbench.snapshot.yaml, yamlDraft)
        : { lines: [], added: 0, removed: 0 },
    [workbench.snapshot, yamlDraft],
  )
  const isDirty = mode === 'structured' ? changes.length > 0 : yamlDirty
  const saveDisabled =
    !isDirty || workbench.mutating || (mode === 'structured' && validationErrors.length > 0)
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

  const handleModeChange = (nextMode: ConfigMode) => {
    if (nextMode === mode) return

    if (isDirty) {
      setConfirmation({
        type: 'switchMode',
        fromMode: mode,
        nextMode,
      })
      return
    }

    setChangeSheetOpen(false)
    setMode(nextMode)
  }

  const discardDraftForMode = (draftMode: ConfigMode) => {
    if (draftMode === 'structured') {
      setStructuredDraft(snapshot.structured)
    } else {
      setYamlDraft(snapshot.yaml)
    }
  }

  const confirmModeChange = (fromMode: ConfigMode, nextMode: ConfigMode) => {
    discardDraftForMode(fromMode)
    setChangeSheetOpen(false)
    setMode(nextMode)
  }

  const handleReload = () => {
    if (isDirty) {
      setConfirmation({ type: 'reload' })
      return
    }
    setStructuredDraft(snapshot.structured)
    setYamlDraft(snapshot.yaml)
    workbench.refetch()
  }

  const reloadFromRuntime = () => {
    setStructuredDraft(snapshot.structured)
    setYamlDraft(snapshot.yaml)
    workbench.refetch()
  }

  const saveYaml = async () => {
    try {
      await workbench.saveYaml(yamlDraft)
      toast.success(t('configPage.toast.saved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleSave = async () => {
    try {
      if (mode === 'structured') {
        if (validationErrors.length > 0) {
          toast.error(t('configPage.toast.validationFailed'))
          return
        }
        await workbench.saveStructured(changes)
        toast.success(t('configPage.toast.saved'))
        return
      }

      setConfirmation({ type: 'saveYaml' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleConfirmAction = () => {
    const currentConfirmation = confirmation
    setConfirmation(null)

    if (!currentConfirmation) return

    if (currentConfirmation.type === 'switchMode') {
      confirmModeChange(currentConfirmation.fromMode, currentConfirmation.nextMode)
      return
    }

    if (currentConfirmation.type === 'reload') {
      reloadFromRuntime()
      return
    }

    void saveYaml()
  }

  return (
    <section className="grid w-full gap-4">
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal">
              {t('configPage.header.title')}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
              {t('configPage.header.description')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <ModeSwitch mode={mode} onModeChange={handleModeChange} />
          </div>
        </div>
      </div>

      <ConfigActionBar
        mode={mode}
        changeCount={changes.length}
        validationCount={mode === 'structured' ? validationErrors.length : 0}
        yamlDirty={yamlDirty}
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
        mode={mode}
        changes={changes}
        yamlDirty={yamlDirty}
        yamlDiff={yamlDiff}
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

      {mode === 'structured' ? (
        <StructuredWorkspace
          draft={structuredDraft}
          changes={changes}
          validationErrors={validationErrors}
          disabled={workbench.mutating}
          oauthModelCatalog={oauthModelCatalog}
          onChange={handleStructuredChange}
        />
      ) : (
        <YamlWorkspace
          yaml={yamlDraft}
          runtimeMode={workbench.runtimeMode}
          disabled={workbench.mutating}
          yamlDirty={yamlDirty}
          onYamlChange={setYamlDraft}
        />
      )}
    </section>
  )
}
