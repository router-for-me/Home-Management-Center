import { type ReactNode, useEffect, useMemo, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Code2,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileDiff,
  Filter,
  Hourglass,
  Image,
  Info,
  KeyRound,
  Layers,
  Loader2,
  Mail,
  Network,
  PanelTop,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Save,
  Search,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TableEmptyState } from '@/components/shared/empty-state'
import { fieldClassName } from '@/components/shared/form-layout'
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
  ConfigFieldValue,
  ConfigStructuredValues,
  WritableConfigFieldKey,
} from '@/lib/api/management/config'
import type { ProviderModelChannel, ProviderModelDefinition } from '@/lib/api/management/providers'
import { scrollElementIntoShell } from '@/lib/shell-scroll'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type ConfigSectionId =
  | 'server'
  | 'discovery'
  | 'tls'
  | 'remoteManagement'
  | 'userEmail'
  | 'plugins'
  | 'oauthRules'
  | 'oauthProviders'
  | 'system'
  | 'network'
  | 'streaming'
  | 'credentialConcurrency'
  | 'credentialInFlight'
  | 'upstream'
  | 'headers'
  | 'payload'
  | 'multimedia'

type ConfigSubgroupId = 'liveMediaRelay' | 'antigravity'

type ConfigFieldKind =
  | 'boolean'
  | 'number'
  | 'text'
  | 'sensitiveText'
  | 'select'
  | 'duration'
  | 'nullableBoolean'
  | 'jsonArray'
  | 'jsonObject'

type JsonConfigFieldKey =
  | 'oauthExcludedModelsJson'
  | 'oauthModelAliasJson'
  | 'pluginStoreSourcesJson'
  | 'payloadRulesJson'
  | 'antigravitySensitiveWordsJson'
  | 'serverAllowHostJson'
  | 'serverTrustedProxiesJson'
  | 'discoverySubtypesJson'
  | 'discoveryInterfacesIncludeJson'
  | 'discoveryInterfacesExcludeJson'
  | 'devinSensitiveWordsJson'
  | 'oauthRequestScopedErrorsJson'
  | 'liveMediaRelayIceServersJson'

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
  forceMapping?: boolean
  'force-mapping'?: boolean
}

type PayloadParamValueType = 'string' | 'number' | 'boolean' | 'json'

type PayloadParamEntry = {
  path: string
  valueType: PayloadParamValueType
  value: string
}

type PayloadHeaderEntry = {
  name: string
  value: string
}

type PayloadModelEntry = {
  name: string
  protocol: string
  fromProtocol: string
  headers: PayloadHeaderEntry[]
  match: PayloadParamEntry[]
  notMatch: PayloadParamEntry[]
  exist: string[]
  notExist: string[]
}

type PayloadRule = {
  models: PayloadModelEntry[]
  params: PayloadParamEntry[]
}

type PayloadFilterRule = {
  models: PayloadModelEntry[]
  params: string[]
}

type PayloadRulesConfig = {
  default: PayloadRule[]
  'default-raw': PayloadRule[]
  override: PayloadRule[]
  'override-raw': PayloadRule[]
  filter: PayloadFilterRule[]
}

type PayloadRuleSection = 'default' | 'default-raw' | 'override' | 'override-raw'

type PayloadSectionKey = PayloadRuleSection | 'filter'

type PayloadRuleIntentId = 'fill' | 'override' | 'filter'

type PayloadRuleIssueKey = 'modelRequired' | 'paramRequired' | 'paramPathRequired'

type RemovedPayloadRule =
  | {
      sectionKey: PayloadRuleSection
      index: number
      rule: PayloadRule
    }
  | {
      sectionKey: 'filter'
      index: number
      rule: PayloadFilterRule
    }

type NetworkProxyPanel = 'current' | 'pool'

type PendingConfigConfirmation = {
  type: 'reload'
}

type ConfigFieldDefinition = {
  key: ConfigFieldKey
  kind: ConfigFieldKind
  sectionId: ConfigSectionId
  groupId?: ConfigSubgroupId
  min?: number
  max?: number
  options?: string[]
}

type ConfigSectionDefinition = {
  id: ConfigSectionId
  fields: ConfigFieldDefinition[]
}

export const sectionDefinitions: ConfigSectionDefinition[] = [
  {
    id: 'server',
    fields: [
      { key: 'port', kind: 'number', sectionId: 'server', min: 1, max: 65535 },
      { key: 'serverHost', kind: 'text', sectionId: 'server' },
      { key: 'serverAllowHostJson', kind: 'jsonArray', sectionId: 'server' },
      { key: 'serverTrustedProxiesJson', kind: 'jsonArray', sectionId: 'server' },
      { key: 'serverCommercialMode', kind: 'boolean', sectionId: 'server' },
    ],
  },
  {
    id: 'discovery',
    fields: [
      { key: 'discoveryEnabled', kind: 'boolean', sectionId: 'discovery' },
      { key: 'discoveryServiceName', kind: 'text', sectionId: 'discovery' },
      { key: 'discoveryServiceType', kind: 'text', sectionId: 'discovery' },
      { key: 'discoverySubtypesJson', kind: 'jsonArray', sectionId: 'discovery' },
      { key: 'discoveryInterfacesIncludeJson', kind: 'jsonArray', sectionId: 'discovery' },
      { key: 'discoveryInterfacesExcludeJson', kind: 'jsonArray', sectionId: 'discovery' },
      { key: 'discoveryAuthRequired', kind: 'boolean', sectionId: 'discovery' },
      { key: 'discoveryAdvertiseManagement', kind: 'boolean', sectionId: 'discovery' },
    ],
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
      { key: 'managementBaseUrl', kind: 'text', sectionId: 'remoteManagement' },
    ],
  },
  {
    id: 'userEmail',
    fields: [
      { key: 'userEmailEnabled', kind: 'boolean', sectionId: 'userEmail' },
      { key: 'userEmailPublicUrl', kind: 'text', sectionId: 'userEmail' },
      { key: 'userEmailFromAddress', kind: 'text', sectionId: 'userEmail' },
      { key: 'userEmailFromName', kind: 'text', sectionId: 'userEmail' },
      { key: 'userEmailSmtpHost', kind: 'text', sectionId: 'userEmail' },
      { key: 'userEmailSmtpPort', kind: 'number', sectionId: 'userEmail', max: 65535 },
      { key: 'userEmailSmtpUsername', kind: 'text', sectionId: 'userEmail' },
      { key: 'userEmailSmtpPasswordEnv', kind: 'text', sectionId: 'userEmail' },
      { key: 'userEmailSmtpStarttls', kind: 'boolean', sectionId: 'userEmail' },
      { key: 'userEmailVerificationTokenTtl', kind: 'duration', sectionId: 'userEmail' },
      { key: 'userEmailResetTokenTtl', kind: 'duration', sectionId: 'userEmail' },
    ],
  },
  {
    id: 'plugins',
    fields: [
      { key: 'pluginsEnabled', kind: 'boolean', sectionId: 'plugins' },
      { key: 'pluginsDir', kind: 'text', sectionId: 'plugins' },
      { key: 'pluginStoreSourcesJson', kind: 'jsonArray', sectionId: 'plugins' },
    ],
  },
  {
    id: 'system',
    fields: [
      { key: 'debug', kind: 'boolean', sectionId: 'system' },
      { key: 'requestLog', kind: 'boolean', sectionId: 'system' },
      { key: 'usageStatisticsEnabled', kind: 'boolean', sectionId: 'system' },
      { key: 'loggingToFile', kind: 'boolean', sectionId: 'system' },
      { key: 'logsMaxTotalSizeMb', kind: 'number', sectionId: 'system', min: 0 },
      { key: 'errorLogsMaxFiles', kind: 'number', sectionId: 'system', min: 0 },
      { key: 'pprofEnable', kind: 'boolean', sectionId: 'system' },
      { key: 'pprofAddr', kind: 'text', sectionId: 'system' },
      {
        key: 'redisUsageQueueRetentionSeconds',
        kind: 'number',
        sectionId: 'system',
        min: 0,
        max: 3600,
      },
    ],
  },
  {
    id: 'network',
    fields: [
      { key: 'proxyUrl', kind: 'text', sectionId: 'network' },
      { key: 'passthroughHeaders', kind: 'boolean', sectionId: 'network' },
    ],
  },
  {
    id: 'streaming',
    fields: [
      { key: 'requestRetry', kind: 'number', sectionId: 'streaming', min: 0 },
      { key: 'maxRetryCredentials', kind: 'number', sectionId: 'streaming', min: 0 },
      { key: 'maxRetryInterval', kind: 'number', sectionId: 'streaming', min: 0 },
      { key: 'disableCooling', kind: 'boolean', sectionId: 'streaming' },
      { key: 'forceModelPrefix', kind: 'boolean', sectionId: 'streaming' },
      {
        key: 'routingStrategy',
        kind: 'select',
        sectionId: 'streaming',
        options: ['round-robin', 'weighted-round-robin', 'fill-first'],
      },
      { key: 'sessionAffinity', kind: 'boolean', sectionId: 'streaming' },
      { key: 'sessionAffinityTtl', kind: 'duration', sectionId: 'streaming' },
      { key: 'sessionAffinitySubagents', kind: 'boolean', sectionId: 'streaming' },
      { key: 'streamingKeepaliveSeconds', kind: 'number', sectionId: 'streaming', min: 0 },
      { key: 'streamingBootstrapRetries', kind: 'number', sectionId: 'streaming', min: 0 },
      { key: 'nonstreamKeepaliveInterval', kind: 'number', sectionId: 'streaming', min: 0 },
    ],
  },
  {
    id: 'credentialConcurrency',
    fields: [
      {
        key: 'concurrencyCpaHeartbeatTimeout',
        kind: 'duration',
        sectionId: 'credentialConcurrency',
      },
      {
        key: 'concurrencyCpaCancelBound',
        kind: 'duration',
        sectionId: 'credentialConcurrency',
      },
      { key: 'concurrencyReclaimGrace', kind: 'duration', sectionId: 'credentialConcurrency' },
      { key: 'concurrencyCleanupInterval', kind: 'duration', sectionId: 'credentialConcurrency' },
      {
        key: 'concurrencyReleaseFlushInterval',
        kind: 'duration',
        sectionId: 'credentialConcurrency',
      },
      {
        key: 'concurrencyReleaseMaxBackoff',
        kind: 'duration',
        sectionId: 'credentialConcurrency',
      },
      { key: 'concurrencyBusyRetryMin', kind: 'duration', sectionId: 'credentialConcurrency' },
      { key: 'concurrencyBusyRetryMax', kind: 'duration', sectionId: 'credentialConcurrency' },
      {
        key: 'concurrencyMaxLimit',
        kind: 'number',
        sectionId: 'credentialConcurrency',
        min: 1,
        max: 1000000,
      },
      {
        key: 'concurrencyLifecycleConfigRevision',
        kind: 'number',
        sectionId: 'credentialConcurrency',
      },
      {
        key: 'concurrencyObservationBarrierRevision',
        kind: 'number',
        sectionId: 'credentialConcurrency',
      },
    ],
  },
  {
    id: 'credentialInFlight',
    fields: [
      { key: 'inFlightSnapshotInterval', kind: 'duration', sectionId: 'credentialInFlight' },
      { key: 'inFlightStaleAfter', kind: 'duration', sectionId: 'credentialInFlight' },
      { key: 'inFlightStagingRetention', kind: 'duration', sectionId: 'credentialInFlight' },
      { key: 'inFlightMaxPartBytes', kind: 'number', sectionId: 'credentialInFlight', min: 1 },
      { key: 'inFlightMaxPartCount', kind: 'number', sectionId: 'credentialInFlight', min: 1 },
      { key: 'inFlightMaxRevisionBytes', kind: 'number', sectionId: 'credentialInFlight', min: 1 },
      {
        key: 'inFlightMaxAggregateGroups',
        kind: 'number',
        sectionId: 'credentialInFlight',
        min: 1,
      },
      { key: 'inFlightMaxDetails', kind: 'number', sectionId: 'credentialInFlight', min: 1 },
      { key: 'inFlightMaxStringBytes', kind: 'number', sectionId: 'credentialInFlight', min: 1 },
    ],
  },
  {
    id: 'upstream',
    fields: [
      { key: 'upstreamCodexDisableCloaking', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamCodexStreamBootstrapBuffering', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamCodexStreamBootstrapTimeout', kind: 'duration', sectionId: 'upstream' },
      { key: 'upstreamCodexOrphanDelegationCompatibility', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamCodexModelLevelCooling', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamCodexResponseSteering', kind: 'boolean', sectionId: 'upstream' },
      { key: 'clientCodexOptimizeMultiAgentV2', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamClaudeModelLevelCooling', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamClaudeToolSearch', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamClaudeDisableCloakMode', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamClaudeDisableCloakingModelList', kind: 'boolean', sectionId: 'upstream' },
      { key: 'upstreamXaiInjectXSearch', kind: 'boolean', sectionId: 'upstream' },
    ],
  },
  {
    id: 'headers',
    fields: [
      { key: 'upstreamClaudeHeaderUserAgent', kind: 'text', sectionId: 'headers' },
      { key: 'upstreamClaudeHeaderPackageVersion', kind: 'text', sectionId: 'headers' },
      { key: 'upstreamClaudeHeaderRuntimeVersion', kind: 'text', sectionId: 'headers' },
      { key: 'upstreamClaudeHeaderOs', kind: 'text', sectionId: 'headers' },
      { key: 'upstreamClaudeHeaderArch', kind: 'text', sectionId: 'headers' },
      { key: 'upstreamClaudeHeaderTimeout', kind: 'text', sectionId: 'headers' },
      { key: 'upstreamClaudeHeaderTimezone', kind: 'text', sectionId: 'headers' },
      {
        key: 'upstreamClaudeHeaderStabilizeDeviceProfile',
        kind: 'nullableBoolean',
        sectionId: 'headers',
      },
      { key: 'oauthCodexHeaderUserAgent', kind: 'text', sectionId: 'headers' },
      { key: 'oauthCodexHeaderBetaFeatures', kind: 'text', sectionId: 'headers' },
    ],
  },
  {
    id: 'payload',
    fields: [{ key: 'payloadRulesJson', kind: 'jsonObject', sectionId: 'payload' }],
  },
  {
    id: 'oauthRules',
    fields: [
      { key: 'oauthExcludedModelsJson', kind: 'jsonObject', sectionId: 'oauthRules' },
      { key: 'oauthModelAliasJson', kind: 'jsonObject', sectionId: 'oauthRules' },
      { key: 'oauthRequestScopedErrorsJson', kind: 'jsonObject', sectionId: 'oauthRules' },
    ],
  },
  {
    id: 'oauthProviders',
    fields: [
      { key: 'oauthAuthDir', kind: 'text', sectionId: 'oauthProviders' },
      { key: 'devinSensitiveWordsJson', kind: 'jsonArray', sectionId: 'oauthProviders' },
      {
        key: 'liveMediaRelayEnabled',
        kind: 'boolean',
        sectionId: 'oauthProviders',
        groupId: 'liveMediaRelay',
      },
      {
        key: 'liveMediaRelayMaxSessions',
        kind: 'number',
        sectionId: 'oauthProviders',
        groupId: 'liveMediaRelay',
        min: 0,
      },
      {
        key: 'liveMediaRelayDisablePrivateRemoteIps',
        kind: 'boolean',
        sectionId: 'oauthProviders',
        groupId: 'liveMediaRelay',
      },
      {
        key: 'liveMediaRelayPublicIp',
        kind: 'text',
        sectionId: 'oauthProviders',
        groupId: 'liveMediaRelay',
      },
      {
        key: 'liveMediaRelayUdpPortMin',
        kind: 'number',
        sectionId: 'oauthProviders',
        groupId: 'liveMediaRelay',
      },
      {
        key: 'liveMediaRelayUdpPortMax',
        kind: 'number',
        sectionId: 'oauthProviders',
        groupId: 'liveMediaRelay',
      },
      {
        key: 'liveMediaRelayIceServersJson',
        kind: 'jsonArray',
        sectionId: 'oauthProviders',
        groupId: 'liveMediaRelay',
      },
      {
        key: 'antigravitySensitiveWordsJson',
        kind: 'jsonArray',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravityCredits',
        kind: 'boolean',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravitySignatureCacheEnabled',
        kind: 'nullableBoolean',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravitySignatureBypassStrict',
        kind: 'nullableBoolean',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravityConnPoolEnabled',
        kind: 'boolean',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravityConnPoolIdleTimeout',
        kind: 'duration',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravityConnPoolMaxIdleConnsPerHost',
        kind: 'number',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
        min: 0,
      },
    ],
  },
  {
    id: 'multimedia',
    fields: [
      {
        key: 'multimediaDisableImageGeneration',
        kind: 'select',
        sectionId: 'multimedia',
        options: ['false', 'true', 'chat', 'passthrough'],
      },
      { key: 'multimediaGptImage2BaseModel', kind: 'text', sectionId: 'multimedia' },
      { key: 'multimediaVideoResultAuthCacheTtl', kind: 'duration', sectionId: 'multimedia' },
    ],
  },
]

const modelDefinitionChannels: ProviderModelChannel[] = [
  'claude',
  'gemini',
  'gemini-interactions',
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
  discovery: Radio,
  tls: ShieldCheck,
  remoteManagement: Network,
  userEmail: Mail,
  plugins: Plug,
  oauthRules: Route,
  oauthProviders: KeyRound,
  system: Database,
  network: Network,
  streaming: Route,
  credentialConcurrency: Hourglass,
  credentialInFlight: Layers,
  upstream: CloudUpload,
  headers: PanelTop,
  payload: Code2,
  multimedia: Image,
}

const jsonConfigFieldKeys = new Set<ConfigFieldKey>([
  'oauthExcludedModelsJson',
  'oauthModelAliasJson',
  'pluginStoreSourcesJson',
  'payloadRulesJson',
  'antigravitySensitiveWordsJson',
  'serverAllowHostJson',
  'serverTrustedProxiesJson',
  'discoverySubtypesJson',
  'discoveryInterfacesIncludeJson',
  'discoveryInterfacesExcludeJson',
  'devinSensitiveWordsJson',
  'oauthRequestScopedErrorsJson',
  'liveMediaRelayIceServersJson',
])

const stringListConfigFieldKeys = new Set<JsonConfigFieldKey>([
  'serverAllowHostJson',
  'serverTrustedProxiesJson',
  'discoverySubtypesJson',
  'discoveryInterfacesIncludeJson',
  'discoveryInterfacesExcludeJson',
  'devinSensitiveWordsJson',
])

const defaultJsonEditorFieldKeys = new Set<JsonConfigFieldKey>([
  'oauthRequestScopedErrorsJson',
  'liveMediaRelayIceServersJson',
])

const readOnlyConfigFieldKeys = new Set<ConfigFieldKey>([
  'concurrencyLifecycleConfigRevision',
  'concurrencyObservationBarrierRevision',
])

const forcedDisabledConfigFieldKeys = new Set<ConfigFieldKey>(['usageStatisticsEnabled'])

const durationPattern = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/

const payloadRuleSections: PayloadRuleSection[] = [
  'default',
  'default-raw',
  'override',
  'override-raw',
]

const payloadSectionKeys: PayloadSectionKey[] = [...payloadRuleSections, 'filter']
const payloadDraftValueTypeKey = '__hmc_payload_value_type'
const payloadDraftValueKey = '__hmc_payload_value'

const payloadRuleIntentGroups: Array<{
  id: PayloadRuleIntentId
  sectionKeys: PayloadSectionKey[]
}> = [
  { id: 'fill', sectionKeys: ['default', 'default-raw'] },
  { id: 'override', sectionKeys: ['override', 'override-raw'] },
  { id: 'filter', sectionKeys: ['filter'] },
]

const payloadProtocols = ['openai', 'responses', 'gemini', 'claude', 'codex', 'antigravity']

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
          hasOnlyKeys(item, ['name', 'alias', 'fork', 'force-mapping', 'forceMapping']) &&
          (item.name === undefined || typeof item.name === 'string') &&
          (item.alias === undefined || typeof item.alias === 'string') &&
          (item.fork === undefined || typeof item.fork === 'boolean') &&
          (item['force-mapping'] === undefined || typeof item['force-mapping'] === 'boolean') &&
          (item.forceMapping === undefined || typeof item.forceMapping === 'boolean'),
      ),
  )
}

function normalizeModelAliasRule(rule: Record<string, unknown>): AliasRule {
  const forceMapping = rule['force-mapping'] ?? rule.forceMapping

  return {
    ...(typeof rule.name === 'string' ? { name: rule.name } : {}),
    ...(typeof rule.alias === 'string' ? { alias: rule.alias } : {}),
    ...(typeof rule.fork === 'boolean' ? { fork: rule.fork } : {}),
    ...(typeof forceMapping === 'boolean' ? { forceMapping } : {}),
  }
}

function normalizeModelAliases(value: unknown): Record<string, AliasRule[]> {
  if (!isRecord(value)) return {}

  return Object.entries(value).reduce<Record<string, AliasRule[]>>(
    (nextValue, [channel, rules]) => {
      if (!Array.isArray(rules)) return nextValue

      return {
        ...nextValue,
        [channel]: rules.filter(isRecord).map((rule) => normalizeModelAliasRule(rule)),
      }
    },
    {},
  )
}

function serializeModelAliasRule(rule: AliasRule) {
  const nextRule: Record<string, string | boolean> = {}
  const forceMapping = rule['force-mapping'] ?? rule.forceMapping

  if (rule.name !== undefined) nextRule.name = rule.name
  if (rule.alias !== undefined) nextRule.alias = rule.alias
  if (typeof rule.fork === 'boolean') nextRule.fork = rule.fork
  if (forceMapping === true) nextRule['force-mapping'] = true

  return nextRule
}

function serializeModelAliases(value: Record<string, AliasRule[]>) {
  return Object.entries(value).reduce<Record<string, ReturnType<typeof serializeModelAliasRule>[]>>(
    (nextValue, [channel, rules]) => ({
      ...nextValue,
      [channel]: rules.map(serializeModelAliasRule),
    }),
    {},
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

function normalizeAntigravitySensitiveWords(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function canEditAntigravitySensitiveWords(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false

  return value.every((item) => typeof item === 'string')
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function canEditStringList(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false

  return value.every((item) => typeof item === 'string')
}

function isWritableConfigField(
  field: ConfigFieldDefinition,
): field is ConfigFieldDefinition & { key: WritableConfigFieldKey } {
  return !readOnlyConfigFieldKeys.has(field.key)
}

function selectOptionFromValue(value: ConfigStructuredValues[ConfigFieldKey]) {
  return String(value)
}

function selectValueFromOption(option: string): ConfigStructuredValues[ConfigFieldKey] {
  if (option === 'true') return true
  if (option === 'false') return false
  return option
}

function nullableBooleanOptionFromValue(value: ConfigStructuredValues[ConfigFieldKey]) {
  if (value === null) return 'unset'
  return value === true ? 'enabled' : 'disabled'
}

function nullableBooleanValueFromOption(option: string) {
  if (option === 'enabled') return true
  if (option === 'disabled') return false
  return null
}

function parsePayloadParamValue(value: unknown): {
  valueType: PayloadParamValueType
  value: string
} {
  if (isRecord(value) && typeof value[payloadDraftValueTypeKey] === 'string') {
    const valueType = value[payloadDraftValueTypeKey]

    if (
      valueType === 'string' ||
      valueType === 'number' ||
      valueType === 'boolean' ||
      valueType === 'json'
    ) {
      return {
        valueType,
        value:
          typeof value[payloadDraftValueKey] === 'string'
            ? value[payloadDraftValueKey]
            : stringifyPayloadPrimitiveValue(value[payloadDraftValueKey]),
      }
    }
  }

  if (typeof value === 'number') {
    return { valueType: 'number', value: String(value) }
  }
  if (typeof value === 'boolean') {
    return { valueType: 'boolean', value: String(value) }
  }
  if (value !== null && typeof value === 'object') {
    return { valueType: 'json', value: JSON.stringify(value, null, 2) }
  }

  return { valueType: 'string', value: stringifyPayloadPrimitiveValue(value) }
}

function parseRawPayloadParamValue(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2) ?? ''
}

function stringifyPayloadPrimitiveValue(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return ''
}

function normalizePayloadModels(value: unknown): PayloadModelEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') return createPayloadModel({ name: item })
      if (!isRecord(item)) return null
      const name = typeof item.name === 'string' ? item.name : ''
      const protocol = typeof item.protocol === 'string' ? item.protocol : ''
      const fromProtocol = typeof item['from-protocol'] === 'string' ? item['from-protocol'] : ''

      return createPayloadModel({
        name,
        protocol,
        fromProtocol,
        headers: normalizePayloadHeaders(item.headers),
        match: normalizePayloadConditions(item.match),
        notMatch: normalizePayloadConditions(item['not-match']),
        exist: normalizePayloadStringList(item.exist),
        notExist: normalizePayloadStringList(item['not-exist']),
      })
    })
    .filter((item): item is PayloadModelEntry => Boolean(item))
}

function normalizePayloadHeaders(value: unknown): PayloadHeaderEntry[] {
  if (!isRecord(value)) return []

  return Object.entries(value).map(([name, headerValue]) => ({
    name,
    value: stringifyPayloadPrimitiveValue(headerValue),
  }))
}

function normalizePayloadConditions(value: unknown): PayloadParamEntry[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!isRecord(item)) return []

    return Object.entries(item).map(([path, conditionValue]) => {
      const parsed = parsePayloadParamValue(conditionValue)

      return {
        path,
        valueType: parsed.valueType,
        value: parsed.value,
      }
    })
  })
}

function normalizePayloadStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => stringifyPayloadPrimitiveValue(item))
}

function normalizePayloadRules(value: unknown, rawValues = false): PayloadRule[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => {
    const record = isRecord(item) ? item : {}
    const params = isRecord(record.params)
      ? Object.entries(record.params).map(([path, paramValue]) => {
          const parsed = rawValues
            ? { valueType: 'json' as const, value: parseRawPayloadParamValue(paramValue) }
            : parsePayloadParamValue(paramValue)

          return {
            path,
            valueType: parsed.valueType,
            value: parsed.value,
          }
        })
      : []

    return {
      models: normalizePayloadModels(record.models),
      params,
    }
  })
}

function normalizePayloadFilterRules(value: unknown): PayloadFilterRule[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => {
    const record = isRecord(item) ? item : {}
    const params = Array.isArray(record.params)
      ? record.params.map((param) => stringifyPayloadPrimitiveValue(param))
      : []

    return {
      models: normalizePayloadModels(record.models),
      params,
    }
  })
}

function normalizePayloadConfig(value: unknown): PayloadRulesConfig {
  const record = isRecord(value) ? value : {}

  return {
    default: normalizePayloadRules(record.default),
    'default-raw': normalizePayloadRules(record['default-raw'], true),
    override: normalizePayloadRules(record.override),
    'override-raw': normalizePayloadRules(record['override-raw'], true),
    filter: normalizePayloadFilterRules(record.filter),
  }
}

function serializePayloadParamValue(param: PayloadParamEntry): unknown {
  const value = param.value.trim()

  if (param.valueType === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : param.value
  }
  if (param.valueType === 'boolean') {
    return value.toLowerCase() === 'true'
  }
  if (param.valueType === 'json') {
    try {
      return JSON.parse(param.value) as unknown
    } catch {
      return param.value
    }
  }

  return param.value
}

function serializePayloadDraftParamValue(param: PayloadParamEntry): unknown {
  const validationError = getPayloadParamValidationError(param)

  if (validationError) {
    return {
      [payloadDraftValueTypeKey]: param.valueType,
      [payloadDraftValueKey]: param.value,
    }
  }

  return serializePayloadParamValue(param)
}

function serializePayloadModels(models: PayloadModelEntry[]) {
  return models
    .map((model) => {
      const name = model.name.trim()
      const protocol = model.protocol.trim()
      const fromProtocol = model.fromProtocol.trim()
      const headers = serializePayloadHeaders(model.headers)
      const match = serializePayloadConditions(model.match)
      const notMatch = serializePayloadConditions(model.notMatch)
      const exist = serializePayloadStringList(model.exist)
      const notExist = serializePayloadStringList(model.notExist)
      if (!name) return null

      return {
        name,
        ...(protocol ? { protocol } : {}),
        ...(fromProtocol ? { 'from-protocol': fromProtocol } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(match.length > 0 ? { match } : {}),
        ...(notMatch.length > 0 ? { 'not-match': notMatch } : {}),
        ...(exist.length > 0 ? { exist } : {}),
        ...(notExist.length > 0 ? { 'not-exist': notExist } : {}),
      }
    })
    .filter(
      (
        model,
      ): model is {
        name: string
        protocol?: string
        'from-protocol'?: string
        headers?: Record<string, string>
        match?: Array<Record<string, unknown>>
        'not-match'?: Array<Record<string, unknown>>
        exist?: string[]
        'not-exist'?: string[]
      } => Boolean(model),
    )
}

function serializePayloadHeaders(headers: PayloadHeaderEntry[]) {
  return headers.reduce<Record<string, string>>((nextHeaders, header) => {
    const name = header.name.trim()
    if (!name) return nextHeaders

    return {
      ...nextHeaders,
      [name]: header.value,
    }
  }, {})
}

function serializePayloadConditions(conditions: PayloadParamEntry[]) {
  return conditions
    .map((condition) => {
      const path = condition.path.trim()
      if (!path) return null

      return { [path]: serializePayloadParamValue(condition) }
    })
    .filter((condition): condition is Record<string, unknown> => Boolean(condition))
}

function serializePayloadStringList(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean)
}

function serializePayloadRules(rules: PayloadRule[], rawValues = false) {
  return rules
    .map((rule) => {
      const models = serializePayloadModels(rule.models)
      const params = rule.params.reduce<Record<string, unknown>>((nextParams, param) => {
        const path = param.path.trim()
        if (!path) return nextParams

        return {
          ...nextParams,
          [path]: rawValues ? param.value : serializePayloadParamValue(param),
        }
      }, {})

      return { models, params }
    })
    .filter((rule) => rule.models.length > 0)
}

function serializePayloadFilterRules(rules: PayloadFilterRule[]) {
  return rules
    .map((rule) => {
      const models = serializePayloadModels(rule.models)
      const params = rule.params.map((param) => param.trim()).filter(Boolean)

      return { models, params }
    })
    .filter((rule) => rule.models.length > 0)
}

function serializePayloadConfig(config: PayloadRulesConfig) {
  return {
    default: serializePayloadRules(config.default),
    'default-raw': serializePayloadRules(config['default-raw'], true),
    override: serializePayloadRules(config.override),
    'override-raw': serializePayloadRules(config['override-raw'], true),
    filter: serializePayloadFilterRules(config.filter),
  }
}

function serializePayloadDraftModels(models: PayloadModelEntry[]) {
  return models.map((model) => {
    const name = model.name.trim()
    const protocol = model.protocol.trim()
    const fromProtocol = model.fromProtocol.trim()
    const headers = serializePayloadDraftHeaders(model.headers)
    const match = serializePayloadDraftConditions(model.match)
    const notMatch = serializePayloadDraftConditions(model.notMatch)
    const exist = model.exist.map((item) => item.trim())
    const notExist = model.notExist.map((item) => item.trim())

    return {
      name,
      ...(protocol ? { protocol } : {}),
      ...(fromProtocol ? { 'from-protocol': fromProtocol } : {}),
      ...(headers.length > 0
        ? {
            headers: headers.reduce<Record<string, string>>(
              (nextHeaders, header) => ({ ...nextHeaders, [header.name]: header.value }),
              {},
            ),
          }
        : {}),
      ...(match.length > 0 ? { match } : {}),
      ...(notMatch.length > 0 ? { 'not-match': notMatch } : {}),
      ...(exist.length > 0 ? { exist } : {}),
      ...(notExist.length > 0 ? { 'not-exist': notExist } : {}),
    }
  })
}

function serializePayloadDraftHeaders(headers: PayloadHeaderEntry[]) {
  return headers.map((header) => ({
    name: header.name.trim(),
    value: header.value,
  }))
}

function serializePayloadDraftConditions(conditions: PayloadParamEntry[]) {
  return conditions.map((condition) => ({
    [condition.path.trim()]: serializePayloadDraftParamValue(condition),
  }))
}

function serializePayloadDraftRules(rules: PayloadRule[], rawValues = false) {
  return rules.map((rule) => {
    const models = serializePayloadDraftModels(rule.models)
    const params = rule.params.reduce<Record<string, unknown>>((nextParams, param) => {
      const path = param.path.trim()

      return {
        ...nextParams,
        [path]: rawValues ? param.value : serializePayloadDraftParamValue(param),
      }
    }, {})

    return { models, params }
  })
}

function serializePayloadDraftFilterRules(rules: PayloadFilterRule[]) {
  return rules.map((rule) => ({
    models: serializePayloadDraftModels(rule.models),
    params: rule.params.map((param) => param.trim()),
  }))
}

function serializePayloadDraftConfig(config: PayloadRulesConfig) {
  return {
    default: serializePayloadDraftRules(config.default),
    'default-raw': serializePayloadDraftRules(config['default-raw'], true),
    override: serializePayloadDraftRules(config.override),
    'override-raw': serializePayloadDraftRules(config['override-raw'], true),
    filter: serializePayloadDraftFilterRules(config.filter),
  }
}

function clonePayloadRule(rule: PayloadRule): PayloadRule {
  return {
    models: rule.models.map(clonePayloadModel),
    params: rule.params.map((param) => ({ ...param })),
  }
}

function clonePayloadFilterRule(rule: PayloadFilterRule): PayloadFilterRule {
  return {
    models: rule.models.map(clonePayloadModel),
    params: [...rule.params],
  }
}

function clonePayloadModel(model: PayloadModelEntry): PayloadModelEntry {
  return {
    ...model,
    headers: model.headers.map((header) => ({ ...header })),
    match: model.match.map((condition) => ({ ...condition })),
    notMatch: model.notMatch.map((condition) => ({ ...condition })),
    exist: [...model.exist],
    notExist: [...model.notExist],
  }
}

function insertAt<T>(items: T[], index: number, item: T) {
  const nextItems = [...items]
  nextItems.splice(Math.min(Math.max(index, 0), nextItems.length), 0, item)
  return nextItems
}

function countPayloadRules(config: PayloadRulesConfig) {
  return (
    config.default.length +
    config['default-raw'].length +
    config.override.length +
    config['override-raw'].length +
    config.filter.length
  )
}

function isPayloadRuleComplete(
  rule: PayloadRule | PayloadFilterRule,
  sectionKey: PayloadSectionKey,
) {
  return countPayloadRuleIssues(rule, sectionKey) === 0
}

function countPayloadSectionDrafts(config: PayloadRulesConfig, sectionKey: PayloadSectionKey) {
  const rules = sectionKey === 'filter' ? config.filter : config[sectionKey]

  return rules.filter((rule) => !isPayloadRuleComplete(rule, sectionKey)).length
}

function countPayloadDrafts(value: unknown) {
  const config = normalizePayloadConfig(value)

  return payloadSectionKeys.reduce(
    (total, sectionKey) => total + countPayloadSectionDrafts(config, sectionKey),
    0,
  )
}

function hasBlankPayloadParam(params: PayloadParamEntry[]) {
  return params.some((param) => !param.path.trim())
}

function hasBlankPayloadModel(models: PayloadModelEntry[]) {
  return models.some((model) => !model.name.trim())
}

function hasBlankPayloadHeader(headers: PayloadHeaderEntry[]) {
  return headers.some((header) => !header.name.trim())
}

function hasBlankPayloadCondition(conditions: PayloadParamEntry[]) {
  return conditions.some((condition) => !condition.path.trim())
}

function hasBlankPayloadPath(items: string[]) {
  return items.some((item) => !item.trim())
}

function hasPayloadModelContent(models: PayloadModelEntry[]) {
  return models.some(
    (model) =>
      model.name.trim() ||
      model.protocol.trim() ||
      model.fromProtocol.trim() ||
      model.headers.some((header) => header.name.trim() || header.value.trim()) ||
      model.match.some((condition) => condition.path.trim() || condition.value.trim()) ||
      model.notMatch.some((condition) => condition.path.trim() || condition.value.trim()) ||
      model.exist.some((item) => item.trim()) ||
      model.notExist.some((item) => item.trim()),
  )
}

function hasPayloadModelAdvancedSettings(model: PayloadModelEntry) {
  return Boolean(
    model.fromProtocol.trim() ||
    model.headers.some((header) => header.name.trim() || header.value.trim()) ||
    model.match.some((condition) => condition.path.trim() || condition.value.trim()) ||
    model.notMatch.some((condition) => condition.path.trim() || condition.value.trim()) ||
    model.exist.some((item) => item.trim()) ||
    model.notExist.some((item) => item.trim()),
  )
}

function countPayloadModelAdvancedItems(model: PayloadModelEntry) {
  return (
    (model.fromProtocol.trim() ? 1 : 0) +
    model.headers.filter((header) => header.name.trim() || header.value.trim()).length +
    model.match.filter((condition) => condition.path.trim() || condition.value.trim()).length +
    model.notMatch.filter((condition) => condition.path.trim() || condition.value.trim()).length +
    model.exist.filter((item) => item.trim()).length +
    model.notExist.filter((item) => item.trim()).length
  )
}

function getPayloadHeaderValidationError(header: PayloadHeaderEntry) {
  if (!header.name.trim() && header.value.trim()) return 'headerName'
  return null
}

function getPayloadConditionValidationError(condition: PayloadParamEntry) {
  if (!condition.path.trim() && !condition.value.trim()) return null
  if (!condition.path.trim()) return 'conditionPath'
  return getPayloadParamValidationError(condition)
}

function getDefaultPayloadParamValue(valueType: PayloadParamValueType) {
  return valueType === 'boolean' ? 'true' : ''
}

function countPayloadModelIssues(model: PayloadModelEntry) {
  return (
    model.headers.filter((header) => Boolean(getPayloadHeaderValidationError(header))).length +
    model.match.filter((condition) => Boolean(getPayloadConditionValidationError(condition)))
      .length +
    model.notMatch.filter((condition) => Boolean(getPayloadConditionValidationError(condition)))
      .length
  )
}

function countPayloadModelIssuesForRule(rule: PayloadRule | PayloadFilterRule) {
  return rule.models.reduce((total, model) => total + countPayloadModelIssues(model), 0)
}

function countPayloadValueIssues(
  rule: PayloadRule | PayloadFilterRule,
  sectionKey: PayloadSectionKey,
) {
  const modelIssueCount = countPayloadModelIssuesForRule(rule)
  if (sectionKey === 'filter') return modelIssueCount

  const paramValidationCount = (rule as PayloadRule).params.filter((param) =>
    Boolean(
      getPayloadParamValidationError(
        sectionKey.endsWith('-raw') ? { ...param, valueType: 'json' } : param,
      ),
    ),
  ).length

  return modelIssueCount + paramValidationCount
}

function hasPayloadRuleSavableModel(rule: PayloadRule | PayloadFilterRule) {
  return serializePayloadModels(rule.models).length > 0
}

function hasPayloadRuleTargetParam(
  rule: PayloadRule | PayloadFilterRule,
  sectionKey: PayloadSectionKey,
) {
  if (sectionKey === 'filter') {
    return (rule as PayloadFilterRule).params.some((param) => param.trim())
  }

  return (rule as PayloadRule).params.some((param) => param.path.trim())
}

function shouldShowPayloadRuleIssues(
  rule: PayloadRule | PayloadFilterRule,
  sectionKey: PayloadSectionKey,
) {
  if (countPayloadValueIssues(rule, sectionKey) > 0) return true

  const ruleIssues = getPayloadRuleIssueKeys(rule, sectionKey)
  if (ruleIssues.length === 0) return false

  return hasPayloadRuleSavableModel(rule) && hasPayloadRuleTargetParam(rule, sectionKey)
}

function hasBlankPayloadFilterParam(params: string[]) {
  return params.some((param) => !param.trim())
}

function getPayloadRuleIssueKeys(
  rule: PayloadRule | PayloadFilterRule,
  sectionKey: PayloadSectionKey,
): PayloadRuleIssueKey[] {
  const issues: PayloadRuleIssueKey[] = []

  if (serializePayloadModels(rule.models).length === 0) {
    issues.push('modelRequired')
  }

  if (sectionKey === 'filter') {
    const params = (rule as PayloadFilterRule).params
    if (params.length === 0) {
      issues.push('paramRequired')
    } else if (params.some((param) => !param.trim())) {
      issues.push('paramPathRequired')
    }

    return issues
  }

  const params = (rule as PayloadRule).params
  if (params.length === 0) {
    issues.push('paramRequired')
  } else if (params.some((param) => !param.path.trim())) {
    issues.push('paramPathRequired')
  }

  return issues
}

function countPayloadRuleIssues(
  rule: PayloadRule | PayloadFilterRule,
  sectionKey: PayloadSectionKey,
) {
  return (
    getPayloadRuleIssueKeys(rule, sectionKey).length + countPayloadValueIssues(rule, sectionKey)
  )
}

function countPayloadSectionIssues(config: PayloadRulesConfig, sectionKey: PayloadSectionKey) {
  if (sectionKey === 'filter') {
    return config.filter.reduce(
      (total, rule) => total + countPayloadRuleIssues(rule, sectionKey),
      0,
    )
  }

  return config[sectionKey].reduce(
    (total, rule) => total + countPayloadRuleIssues(rule, sectionKey),
    0,
  )
}

function countPayloadSectionVisibleIssues(
  config: PayloadRulesConfig,
  sectionKey: PayloadSectionKey,
) {
  const rules = sectionKey === 'filter' ? config.filter : config[sectionKey]

  return rules.reduce(
    (total, rule) =>
      total +
      (shouldShowPayloadRuleIssues(rule, sectionKey)
        ? countPayloadRuleIssues(rule, sectionKey)
        : 0),
    0,
  )
}

function getPayloadRuleAnchor(
  rule: PayloadRule | PayloadFilterRule,
  sectionKey: PayloadSectionKey,
) {
  const model = rule.models.find((item) => item.name.trim())
  const modelTarget = model
    ? [model.protocol.trim(), model.name.trim()].filter(Boolean).join('/')
    : ''

  if (sectionKey === 'filter') {
    const param = (rule as PayloadFilterRule).params.find((item) => item.trim())?.trim() ?? ''
    return [modelTarget, param].filter(Boolean).join(' -> ')
  }

  const param = (rule as PayloadRule).params.find((item) => item.path.trim())?.path.trim() ?? ''
  return [modelTarget, param].filter(Boolean).join(' -> ')
}

function getPayloadAffectedTargets(config: PayloadRulesConfig) {
  const targets = payloadSectionKeys.flatMap((sectionKey) => {
    const rules = sectionKey === 'filter' ? config.filter : config[sectionKey]

    return rules.flatMap((rule) =>
      rule.models
        .map((model) => [model.protocol.trim(), model.name.trim()].filter(Boolean).join('/').trim())
        .filter(Boolean),
    )
  })

  return Array.from(new Set(targets))
}

function canEditPayloadHeaders(value: unknown) {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string')
}

function canEditPayloadConditions(value: unknown) {
  return Array.isArray(value) && value.every((item) => isRecord(item))
}

function canEditPayloadStringList(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function canEditPayloadModel(model: unknown) {
  if (typeof model === 'string') return true
  if (!isRecord(model)) return false
  if (
    !hasOnlyKeys(model, [
      'name',
      'protocol',
      'from-protocol',
      'headers',
      'match',
      'not-match',
      'exist',
      'not-exist',
    ])
  ) {
    return false
  }

  return (
    (model.name === undefined || typeof model.name === 'string') &&
    (model.protocol === undefined || typeof model.protocol === 'string') &&
    (model['from-protocol'] === undefined || typeof model['from-protocol'] === 'string') &&
    (model.headers === undefined || canEditPayloadHeaders(model.headers)) &&
    (model.match === undefined || canEditPayloadConditions(model.match)) &&
    (model['not-match'] === undefined || canEditPayloadConditions(model['not-match'])) &&
    (model.exist === undefined || canEditPayloadStringList(model.exist)) &&
    (model['not-exist'] === undefined || canEditPayloadStringList(model['not-exist']))
  )
}

function canEditPayloadConfig(value: unknown) {
  if (!isRecord(value)) return false

  return Object.entries(value).every(([key, rules]) => {
    if (!payloadSectionKeys.includes(key as PayloadSectionKey)) return false
    if (!Array.isArray(rules)) return false

    return rules.every((rule) => {
      if (!isRecord(rule)) return false
      if (!hasOnlyKeys(rule, ['models', 'params'])) return false
      if (!Array.isArray(rule.models)) return false
      const modelsValid = rule.models.every(canEditPayloadModel)
      if (!modelsValid) return false
      if (key === 'filter') return Array.isArray(rule.params)

      return isRecord(rule.params)
    })
  })
}

function getPayloadParamValidationError(param: PayloadParamEntry) {
  const value = param.value.trim()

  if (param.valueType === 'number') {
    return value && Number.isFinite(Number(value)) ? null : 'number'
  }
  if (param.valueType === 'boolean') {
    const normalized = value.toLowerCase()
    return normalized === 'true' || normalized === 'false' ? null : 'boolean'
  }
  if (param.valueType === 'json') {
    if (!value) return 'json'
    try {
      JSON.parse(param.value)
      return null
    } catch {
      return 'json'
    }
  }

  return null
}

function hasPayloadValidationErrors(value: unknown) {
  const config = normalizePayloadConfig(value)

  return payloadSectionKeys.some((section) => countPayloadSectionIssues(config, section) > 0)
}

function hasVisiblePayloadValidationErrors(value: unknown) {
  const config = normalizePayloadConfig(value)

  return payloadSectionKeys.some((section) => countPayloadSectionVisibleIssues(config, section) > 0)
}

function getModelDisplayName(model: ProviderModelDefinition) {
  return model.displayName || model.name || model.id
}

function canEditJsonField(fieldKey: JsonConfigFieldKey, value: unknown) {
  if (stringListConfigFieldKeys.has(fieldKey)) return canEditStringList(value)
  if (defaultJsonEditorFieldKeys.has(fieldKey)) return true

  switch (fieldKey) {
    case 'oauthExcludedModelsJson':
      return canEditExcludedModels(value)
    case 'oauthModelAliasJson':
      return canEditModelAliases(value)
    case 'pluginStoreSourcesJson':
      return canEditPluginStoreSources(value)
    case 'payloadRulesJson':
      return canEditPayloadConfig(value)
    case 'antigravitySensitiveWordsJson':
      return canEditAntigravitySensitiveWords(value)
    default:
      return false
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function scrollToSection(sectionId: ConfigSectionId) {
  scrollElementIntoShell(`config-section-${sectionId}`)
}

export function scrollToField(key: ConfigFieldKey) {
  const field = fieldDefinitionByKey[key]
  scrollElementIntoShell(`config-section-${field.groupId ?? field.sectionId}`)
}

function scrollToPayloadSection(sectionKey: PayloadSectionKey) {
  scrollElementIntoShell(`payload-section-${sectionKey}`)
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
    .filter(isWritableConfigField)
    .filter((field) => !areConfigValuesEqual(baseline[field.key], draft[field.key]))
    .map((field) => ({
      key: field.key,
      previousValue: baseline[field.key],
      nextValue: draft[field.key],
    }))
}

function getValidationErrors(draft: ConfigStructuredValues) {
  return getValidationErrorsWithOptions(draft, { visibleOnly: false })
}

function getVisibleValidationErrors(draft: ConfigStructuredValues) {
  return getValidationErrorsWithOptions(draft, { visibleOnly: true })
}

function getValidationErrorsWithOptions(
  draft: ConfigStructuredValues,
  { visibleOnly }: { visibleOnly: boolean },
) {
  return fieldDefinitions
    .filter((field) => {
      if (readOnlyConfigFieldKeys.has(field.key)) return false

      const value = draft[field.key]
      if (field.kind === 'number') {
        const num = typeof value === 'number' ? value : Number(value)
        if (typeof value !== 'number' || Number.isNaN(value) || !Number.isInteger(num)) return true
        if (field.min !== undefined && num < field.min) return true
        if (field.max !== undefined && num > field.max) return true
        return false
      }
      if (field.kind === 'select') {
        return !field.options?.includes(String(value))
      }
      if (field.kind === 'duration') {
        const text = typeof value === 'string' ? value.trim() : ''
        return text.length > 0 && !durationPattern.test(text)
      }
      if (field.kind === 'nullableBoolean') {
        return value !== null && typeof value !== 'boolean'
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
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return true
          if (field.key === 'payloadRulesJson') {
            return (
              !canEditPayloadConfig(parsed) ||
              (visibleOnly
                ? hasVisiblePayloadValidationErrors(parsed)
                : hasPayloadValidationErrors(parsed))
            )
          }
          return false
        } catch {
          return true
        }
      }
      return false
    })
    .map((field) => field.key)
}

function formatConfigValue(value: ConfigChange['nextValue'], emptyLabel: string) {
  return value === '' || value === null ? emptyLabel : String(value)
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
      <aside className="bg-card sticky top-[4.625rem] hidden max-h-[calc(100dvh-12rem)] min-w-0 self-start overflow-y-auto rounded-lg border p-3 shadow-sm xl:block">
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

      <div className="bg-background/95 sticky top-[9.125rem] z-10 -mx-1 overflow-x-auto border-y px-1 py-2 backdrop-blur md:top-[3.625rem] xl:hidden">
        <div className="flex min-w-max gap-2">
          {sectionDefinitions.map((section) => (
            <Button
              key={section.id}
              type="button"
              variant="outline"
              size="md"
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
  onChange: (key: ConfigFieldKey, value: ConfigFieldValue) => void
}) {
  const { t, i18n } = useTranslation()
  const [sensitiveVisible, setSensitiveVisible] = useState(false)
  const locked =
    readOnlyConfigFieldKeys.has(field.key) || forcedDisabledConfigFieldKeys.has(field.key)
  const controlDisabled = disabled || locked
  const placeholderKey = `configPage.fields.${field.key}.placeholder`
  const placeholder = i18n.exists(placeholderKey) ? t(placeholderKey) : undefined

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
            disabled={controlDisabled}
            onChange={(nextValue) => onChange(field.key, nextValue)}
          />
        ) : null}
        {field.kind === 'number' ? (
          <Input
            type="number"
            min={field.min}
            max={field.max}
            value={String(value)}
            disabled={controlDisabled}
            className="md:max-w-56"
            placeholder={placeholder}
            onChange={(event) => onChange(field.key, Number(event.target.value))}
          />
        ) : null}
        {field.kind === 'text' || field.kind === 'duration' ? (
          <Input
            value={String(value)}
            disabled={controlDisabled}
            className="md:max-w-80"
            placeholder={placeholder}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        ) : null}
        {field.kind === 'sensitiveText' ? (
          <div className="relative min-w-0 md:w-full md:max-w-80">
            <Input
              type={sensitiveVisible ? 'text' : 'password'}
              value={String(value)}
              disabled={controlDisabled}
              className="pr-10"
              placeholder={placeholder}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              disabled={controlDisabled}
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
            value={selectOptionFromValue(value)}
            disabled={controlDisabled}
            onValueChange={(nextValue) => onChange(field.key, selectValueFromOption(nextValue))}
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
                  {field.key === 'routingStrategy'
                    ? t(`configPage.routingStrategies.${option}`)
                    : t(`configPage.fields.${field.key}.options.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {field.kind === 'nullableBoolean' ? (
          <Select
            value={nullableBooleanOptionFromValue(value)}
            disabled={controlDisabled}
            onValueChange={(nextValue) =>
              onChange(field.key, nullableBooleanValueFromOption(nextValue))
            }
          >
            <SelectTrigger
              className="md:w-56"
              aria-label={t(`configPage.fields.${field.key}.label`)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['unset', 'enabled', 'disabled'] as const).map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`configPage.nullableBoolean.${option}`)}
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
          // 20px because it is positioned inside the input it reveals, not laid out
          // beside it.
          // eslint-disable-next-line home-ui/no-control-size-override
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
            size="md"
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
    'lg:grid-cols-[minmax(8rem,0.7fr)_minmax(11rem,1fr)_minmax(10rem,0.9fr)_minmax(7rem,auto)_minmax(9rem,auto)_auto]'

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
          size="md"
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
            <TableHeaderCell
              label={t('configPage.json.columns.forceMapping')}
              description={t('configPage.json.columnDescriptions.forceMapping')}
            />
            <TableHeaderCell label={t('configPage.json.columns.actions')} />
          </div>

          <div className="divide-y">
            {rows.map(({ channel, item }, rowIndex) => (
              <div
                key={rowIndex}
                className={cn('grid gap-2 px-3 py-3 lg:items-start', columnsClass)}
              >
                <label className={fieldClassName}>
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
                <label className={fieldClassName}>
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
                <label className={fieldClassName}>
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
                <label className="border-input bg-background flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                  <Checkbox
                    checked={Boolean(item.forceMapping ?? item['force-mapping'])}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      updateRow(rowIndex, { item: { forceMapping: checked === true } })
                    }
                  />
                  <span>{t('configPage.json.columns.forceMapping')}</span>
                </label>
                <Button
                  type="button"
                  variant="text"
                  size="lg"
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

function AntigravitySensitiveWordsEditor({
  value,
  disabled,
  onChange,
}: {
  value: string[]
  disabled: boolean
  onChange: (value: string[]) => void
}) {
  const { t } = useTranslation()
  const normalizedValue = normalizeAntigravitySensitiveWords(value).join('\n')
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
        placeholder={t('configPage.antigravitySensitiveWords.placeholder')}
        onChange={(event) => {
          setDraft(event.target.value)
          commitDraft(event.target.value)
        }}
      />
      <div className="text-muted-foreground flex flex-col gap-1 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between">
        <span>{t('configPage.antigravitySensitiveWords.hint')}</span>
        <span>
          {t('configPage.antigravitySensitiveWords.count', {
            count: normalizeAntigravitySensitiveWords(value).length,
          })}
        </span>
      </div>
    </div>
  )
}

function StringListEditor({
  value,
  disabled,
  placeholder,
  hint,
  countLabel,
  onChange,
}: {
  value: string[]
  disabled: boolean
  placeholder: string
  hint: string
  countLabel: string
  onChange: (value: string[]) => void
}) {
  const normalizedValue = normalizeStringList(value).join('\n')
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
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value)
          commitDraft(event.target.value)
        }}
      />
      <div className="text-muted-foreground flex flex-col gap-1 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between">
        <span>{hint}</span>
        <span>{countLabel}</span>
      </div>
    </div>
  )
}

function createPayloadModel(patch: Partial<PayloadModelEntry> = {}): PayloadModelEntry {
  return {
    name: patch.name ?? '',
    protocol: patch.protocol ?? '',
    fromProtocol: patch.fromProtocol ?? '',
    headers: patch.headers?.map((header) => ({ ...header })) ?? [],
    match: patch.match?.map((condition) => ({ ...condition })) ?? [],
    notMatch: patch.notMatch?.map((condition) => ({ ...condition })) ?? [],
    exist: patch.exist ? [...patch.exist] : [],
    notExist: patch.notExist ? [...patch.notExist] : [],
  }
}

function createPayloadHeader(): PayloadHeaderEntry {
  return { name: '', value: '' }
}

function createPayloadCondition(): PayloadParamEntry {
  return { path: '', valueType: 'string', value: '' }
}

function createPayloadParam(rawValues = false): PayloadParamEntry {
  return { path: '', valueType: rawValues ? 'json' : 'string', value: rawValues ? '{}' : '' }
}

function createPayloadRule(rawValues = false): PayloadRule {
  return {
    models: [createPayloadModel()],
    params: [createPayloadParam(rawValues)],
  }
}

function createPayloadFilterRule(): PayloadFilterRule {
  return {
    models: [createPayloadModel()],
    params: [''],
  }
}

function PayloadIntentAction({
  sectionKey,
  count,
  draftCount,
  disabled,
  onAddRule,
  onFocusSection,
}: {
  sectionKey: PayloadSectionKey
  count: number
  draftCount: number
  disabled: boolean
  onAddRule: (sectionKey: PayloadSectionKey) => void
  onFocusSection: (sectionKey: PayloadSectionKey) => void
}) {
  const { t } = useTranslation()
  const hasSection = count > 0
  const addDisabled = disabled || (!hasSection && draftCount > 0)

  return (
    <Button
      type="button"
      variant={hasSection ? 'secondary' : 'outline'}
      size="md"
      className="min-h-control-lg h-auto justify-start whitespace-normal"
      disabled={addDisabled}
      onClick={() => {
        if (hasSection) {
          onFocusSection(sectionKey)
          return
        }

        onAddRule(sectionKey)
      }}
    >
      {hasSection
        ? t('configPage.payload.viewExistingRules', { count })
        : t(`configPage.payload.addRuleActions.${sectionKey}`)}
    </Button>
  )
}

function PayloadAddRulePanel({
  disabled,
  value,
  draftCount,
  onAddRule,
  onFocusSection,
}: {
  disabled: boolean
  value: PayloadRulesConfig
  draftCount: number
  onAddRule: (sectionKey: PayloadSectionKey) => void
  onFocusSection: (sectionKey: PayloadSectionKey) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-muted/20 grid gap-3 rounded-md border px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{t('configPage.payload.addRuleTitle')}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          {t('configPage.payload.addRuleDescription')}
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          {t('configPage.payload.valueModeHint')}
        </p>
      </div>
      {draftCount > 0 ? (
        <div className="bg-muted/30 text-muted-foreground rounded-md border px-3 py-2 text-xs leading-5">
          {t('configPage.payload.draftBlockingHint')}
        </div>
      ) : null}
      <div className="grid gap-2 lg:grid-cols-3">
        {payloadRuleIntentGroups.map((intent) => (
          <div
            key={intent.id}
            className="bg-background/50 grid content-start gap-3 rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {t(`configPage.payload.intentOptions.${intent.id}.title`)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {t(`configPage.payload.intentOptions.${intent.id}.description`)}
              </p>
            </div>
            <div className="grid gap-2">
              {intent.sectionKeys.map((sectionKey) => (
                <PayloadIntentAction
                  key={sectionKey}
                  sectionKey={sectionKey}
                  count={value[sectionKey].length}
                  draftCount={draftCount}
                  disabled={disabled}
                  onAddRule={onAddRule}
                  onFocusSection={onFocusSection}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PayloadHeaderRows({
  headers,
  disabled,
  onChange,
}: {
  headers: PayloadHeaderEntry[]
  disabled: boolean
  onChange: (headers: PayloadHeaderEntry[]) => void
}) {
  const { t } = useTranslation()
  const hasBlankHeader = hasBlankPayloadHeader(headers)
  const updateHeader = (index: number, patch: Partial<PayloadHeaderEntry>) => {
    onChange(
      headers.map((header, headerIndex) =>
        headerIndex === index ? { ...header, ...patch } : header,
      ),
    )
  }
  const addHeader = () => onChange([...headers, createPayloadHeader()])
  const removeHeader = (index: number) =>
    onChange(headers.filter((_, headerIndex) => headerIndex !== index))

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">
          {t('configPage.payload.headers')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={disabled || hasBlankHeader}
          onClick={addHeader}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addHeader')}
        </Button>
      </div>
      {hasBlankHeader ? (
        <p className="text-muted-foreground text-xs leading-5">
          {t('configPage.payload.completeCurrentHeaderFirst')}
        </p>
      ) : null}
      {headers.length === 0 ? (
        <EmptyJsonRows label={t('configPage.payload.emptyHeaders')} />
      ) : (
        <div className="grid gap-2">
          <div className="hidden gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <TableHeaderCell
              label={t('configPage.payload.headerName')}
              description={t('configPage.payload.headerNameHelp')}
              className="px-0 py-0"
            />
            <TableHeaderCell
              label={t('configPage.payload.headerValue')}
              description={t('configPage.payload.headerValueHelp')}
              className="px-0 py-0"
            />
            <div aria-hidden="true" />
          </div>
          {headers.map((header, index) => {
            const validationError = getPayloadHeaderValidationError(header)

            return (
              <div key={index} className="grid gap-1.5">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className={fieldClassName}>
                    <span className="text-muted-foreground text-xs font-medium sm:sr-only">
                      {t('configPage.payload.headerName')}
                    </span>
                    <Input
                      value={header.name}
                      disabled={disabled}
                      className="font-mono"
                      aria-label={t('configPage.payload.headerName')}
                      placeholder={t('configPage.payload.headerNamePlaceholder')}
                      onChange={(event) => updateHeader(index, { name: event.target.value })}
                    />
                  </label>
                  <label className={fieldClassName}>
                    <span className="text-muted-foreground text-xs font-medium sm:sr-only">
                      {t('configPage.payload.headerValue')}
                    </span>
                    <Input
                      value={header.value}
                      disabled={disabled}
                      className="font-mono"
                      aria-label={t('configPage.payload.headerValue')}
                      placeholder={t('configPage.payload.headerValuePlaceholder')}
                      onChange={(event) => updateHeader(index, { value: event.target.value })}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="text"
                    size="lg"
                    disabled={disabled}
                    onClick={() => removeHeader(index)}
                  >
                    {t('configPage.payload.remove')}
                  </Button>
                </div>
                {validationError ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {t(`configPage.payload.validation.${validationError}`)}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PayloadConditionRows({
  title,
  emptyLabel,
  conditions,
  disabled,
  onChange,
}: {
  title: string
  emptyLabel: string
  conditions: PayloadParamEntry[]
  disabled: boolean
  onChange: (conditions: PayloadParamEntry[]) => void
}) {
  const { t } = useTranslation()
  const [valueMemory, setValueMemory] = useState<
    Record<number, Partial<Record<PayloadParamValueType, string>>>
  >({})
  const hasBlankCondition = hasBlankPayloadCondition(conditions)
  const updateCondition = (index: number, patch: Partial<PayloadParamEntry>) => {
    onChange(
      conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, ...patch } : condition,
      ),
    )
  }
  const updateConditionValue = (index: number, condition: PayloadParamEntry, value: string) => {
    setValueMemory((current) => ({
      ...current,
      [index]: {
        ...current[index],
        [condition.valueType]: value,
      },
    }))
    updateCondition(index, { value })
  }
  const updateConditionValueType = (
    index: number,
    condition: PayloadParamEntry,
    valueType: PayloadParamValueType,
  ) => {
    const cachedValue = valueMemory[index]?.[valueType]
    setValueMemory((current) => ({
      ...current,
      [index]: {
        ...current[index],
        [condition.valueType]: condition.value,
      },
    }))
    updateCondition(index, {
      valueType,
      value: cachedValue ?? getDefaultPayloadParamValue(valueType),
    })
  }
  const addCondition = () => onChange([...conditions, createPayloadCondition()])
  const removeCondition = (index: number) =>
    onChange(conditions.filter((_, conditionIndex) => conditionIndex !== index))

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={disabled || hasBlankCondition}
          onClick={addCondition}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addCondition')}
        </Button>
      </div>
      {hasBlankCondition ? (
        <p className="text-muted-foreground text-xs leading-5">
          {t('configPage.payload.completeCurrentConditionFirst')}
        </p>
      ) : null}
      {conditions.length === 0 ? (
        <EmptyJsonRows label={emptyLabel} />
      ) : (
        <div className="grid gap-2">
          <div className="hidden gap-2 lg:grid lg:grid-cols-[minmax(10rem,0.8fr)_9rem_minmax(12rem,1.2fr)_auto]">
            <TableHeaderCell
              label={t('configPage.payload.conditionPath')}
              description={t('configPage.payload.conditionPathHelp')}
              className="px-0 py-0"
            />
            <TableHeaderCell
              label={t('configPage.payload.valueType')}
              description={t('configPage.payload.valueTypeHelp')}
              className="px-0 py-0"
            />
            <TableHeaderCell
              label={t('configPage.payload.conditionValue')}
              description={t('configPage.payload.conditionValueHelp')}
              className="px-0 py-0"
            />
            <div aria-hidden="true" />
          </div>
          {conditions.map((condition, index) => {
            const validationError = getPayloadConditionValidationError(condition)

            return (
              <div key={index} className="grid gap-1.5">
                <div className="grid gap-2 lg:grid-cols-[minmax(10rem,0.8fr)_9rem_minmax(12rem,1.2fr)_auto]">
                  <label className={fieldClassName}>
                    <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                      {t('configPage.payload.conditionPath')}
                    </span>
                    <Input
                      value={condition.path}
                      disabled={disabled}
                      className="font-mono"
                      aria-label={t('configPage.payload.conditionPath')}
                      placeholder={t('configPage.payload.conditionPathPlaceholder')}
                      onChange={(event) => updateCondition(index, { path: event.target.value })}
                    />
                  </label>
                  <label className={fieldClassName}>
                    <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                      {t('configPage.payload.valueType')}
                    </span>
                    <Select
                      value={condition.valueType}
                      disabled={disabled}
                      onValueChange={(value) =>
                        updateConditionValueType(index, condition, value as PayloadParamValueType)
                      }
                    >
                      <SelectTrigger aria-label={t('configPage.payload.valueType')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['string', 'number', 'boolean', 'json'] as const).map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`configPage.payload.valueTypes.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  {condition.valueType === 'json' ? (
                    <label className={fieldClassName}>
                      <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                        {t('configPage.payload.conditionValue')}
                      </span>
                      <Textarea
                        value={condition.value}
                        disabled={disabled}
                        className="min-h-9 font-mono text-sm"
                        aria-label={t('configPage.payload.conditionValue')}
                        placeholder={t('configPage.payload.jsonValuePlaceholder')}
                        onChange={(event) =>
                          updateConditionValue(index, condition, event.target.value)
                        }
                      />
                    </label>
                  ) : condition.valueType === 'boolean' ? (
                    <label className={fieldClassName}>
                      <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                        {t('configPage.payload.conditionValue')}
                      </span>
                      <Select
                        value={condition.value.toLowerCase() === 'false' ? 'false' : 'true'}
                        disabled={disabled}
                        onValueChange={(value) => updateConditionValue(index, condition, value)}
                      >
                        <SelectTrigger aria-label={t('configPage.payload.conditionValue')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">
                            {t('configPage.payload.booleanTrue')}
                          </SelectItem>
                          <SelectItem value="false">
                            {t('configPage.payload.booleanFalse')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  ) : (
                    <label className={fieldClassName}>
                      <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                        {t('configPage.payload.conditionValue')}
                      </span>
                      <Input
                        value={condition.value}
                        disabled={disabled}
                        className="font-mono"
                        aria-label={t('configPage.payload.conditionValue')}
                        placeholder={t(
                          `configPage.payload.valuePlaceholders.${condition.valueType}`,
                        )}
                        onChange={(event) =>
                          updateConditionValue(index, condition, event.target.value)
                        }
                      />
                    </label>
                  )}
                  <Button
                    type="button"
                    variant="text"
                    size="lg"
                    disabled={disabled}
                    onClick={() => removeCondition(index)}
                  >
                    {t('configPage.payload.remove')}
                  </Button>
                </div>
                {validationError ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {t(`configPage.payload.validation.${validationError}`)}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PayloadPathListRows({
  title,
  emptyLabel,
  paths,
  disabled,
  onChange,
}: {
  title: string
  emptyLabel: string
  paths: string[]
  disabled: boolean
  onChange: (paths: string[]) => void
}) {
  const { t } = useTranslation()
  const hasBlankPath = hasBlankPayloadPath(paths)
  const addPath = () => onChange([...paths, ''])
  const updatePath = (index: number, value: string) => {
    onChange(paths.map((path, pathIndex) => (pathIndex === index ? value : path)))
  }
  const removePath = (index: number) =>
    onChange(paths.filter((_, pathIndex) => pathIndex !== index))

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={disabled || hasBlankPath}
          onClick={addPath}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addPath')}
        </Button>
      </div>
      {hasBlankPath ? (
        <p className="text-muted-foreground text-xs leading-5">
          {t('configPage.payload.completeCurrentPathFirst')}
        </p>
      ) : null}
      {paths.length === 0 ? (
        <EmptyJsonRows label={emptyLabel} />
      ) : (
        <div className="grid gap-2">
          <div className="hidden gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
            <TableHeaderCell
              label={t('configPage.payload.conditionPath')}
              description={t('configPage.payload.conditionPathHelp')}
              className="px-0 py-0"
            />
            <div aria-hidden="true" />
          </div>
          {paths.map((path, index) => (
            <div key={index} className="grid gap-1.5">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className={fieldClassName}>
                  <span className="text-muted-foreground text-xs font-medium sm:sr-only">
                    {t('configPage.payload.conditionPath')}
                  </span>
                  <Input
                    value={path}
                    disabled={disabled}
                    className="font-mono"
                    aria-label={t('configPage.payload.conditionPath')}
                    placeholder={t('configPage.payload.conditionPathPlaceholder')}
                    onChange={(event) => updatePath(index, event.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  variant="text"
                  size="lg"
                  disabled={disabled}
                  onClick={() => removePath(index)}
                >
                  {t('configPage.payload.remove')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PayloadModelAdvancedFields({
  model,
  disabled,
  protocolOptions,
  onChange,
}: {
  model: PayloadModelEntry
  disabled: boolean
  protocolOptions: string[]
  onChange: (patch: Partial<PayloadModelEntry>) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-muted/15 grid gap-4 rounded-md border px-3 py-3">
      <p className="text-muted-foreground text-xs leading-5">
        {t('configPage.payload.advancedMatchersSummary')}
      </p>
      <label className="grid max-w-sm gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">
          {t('configPage.payload.fromProtocol')}
        </span>
        <Select
          value={model.fromProtocol || '__any__'}
          disabled={disabled}
          onValueChange={(value) => onChange({ fromProtocol: value === '__any__' ? '' : value })}
        >
          <SelectTrigger aria-label={t('configPage.payload.fromProtocol')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any__">{t('configPage.payload.anyProtocol')}</SelectItem>
            {protocolOptions.map((protocol) => (
              <SelectItem key={protocol} value={protocol}>
                {protocol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-xs leading-5">
          {t('configPage.payload.fromProtocolHelp')}
        </span>
      </label>

      <PayloadHeaderRows
        headers={model.headers}
        disabled={disabled}
        onChange={(headers) => onChange({ headers })}
      />
      <PayloadConditionRows
        title={t('configPage.payload.matchConditions')}
        emptyLabel={t('configPage.payload.emptyConditions')}
        conditions={model.match}
        disabled={disabled}
        onChange={(match) => onChange({ match })}
      />
      <PayloadConditionRows
        title={t('configPage.payload.notMatchConditions')}
        emptyLabel={t('configPage.payload.emptyConditions')}
        conditions={model.notMatch}
        disabled={disabled}
        onChange={(notMatch) => onChange({ notMatch })}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <PayloadPathListRows
          title={t('configPage.payload.existPaths')}
          emptyLabel={t('configPage.payload.emptyExistPaths')}
          paths={model.exist}
          disabled={disabled}
          onChange={(exist) => onChange({ exist })}
        />
        <PayloadPathListRows
          title={t('configPage.payload.notExistPaths')}
          emptyLabel={t('configPage.payload.emptyNotExistPaths')}
          paths={model.notExist}
          disabled={disabled}
          onChange={(notExist) => onChange({ notExist })}
        />
      </div>
    </div>
  )
}

function PayloadModelRow({
  model,
  disabled,
  canRemove,
  protocolOptions,
  onChange,
  onRemove,
}: {
  model: PayloadModelEntry
  disabled: boolean
  canRemove: boolean
  protocolOptions: string[]
  onChange: (patch: Partial<PayloadModelEntry>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const hasAdvancedSettings = hasPayloadModelAdvancedSettings(model)
  const advancedCount = countPayloadModelAdvancedItems(model)
  const [advancedExpanded, setAdvancedExpanded] = useState(hasAdvancedSettings)

  useEffect(() => {
    if (hasAdvancedSettings) setAdvancedExpanded(true)
  }, [hasAdvancedSettings])

  return (
    <div className="grid gap-2 rounded-md border p-2 sm:border-0 sm:p-0">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_minmax(10.5rem,12rem)_minmax(4.5rem,auto)]">
        <label className={fieldClassName}>
          <span className="text-muted-foreground text-xs font-medium sm:sr-only">
            {t('configPage.payload.modelName')}
          </span>
          <Input
            value={model.name}
            disabled={disabled}
            className="font-mono"
            aria-label={t('configPage.payload.modelName')}
            placeholder={t('configPage.payload.modelNamePlaceholder')}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <label className={fieldClassName}>
          <span className="text-muted-foreground text-xs font-medium sm:sr-only">
            {t('configPage.payload.protocol')}
          </span>
          <Select
            value={model.protocol || '__any__'}
            disabled={disabled}
            onValueChange={(value) => onChange({ protocol: value === '__any__' ? '' : value })}
          >
            <SelectTrigger aria-label={t('configPage.payload.protocol')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">{t('configPage.payload.anyProtocol')}</SelectItem>
              {protocolOptions.map((protocol) => (
                <SelectItem key={protocol} value={protocol}>
                  {protocol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button
          type="button"
          variant={advancedExpanded ? 'secondary' : 'outline'}
          size="lg"
          className="w-full justify-start"
          disabled={disabled}
          onClick={() => setAdvancedExpanded((expanded) => !expanded)}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {advancedExpanded
            ? t('configPage.payload.hideAdvancedMatchers')
            : t('configPage.payload.advancedMatchers')}
          {advancedCount > 0 ? (
            <span className="bg-background text-muted-foreground rounded-md border px-1.5 py-0.5 text-[11px] leading-none">
              {advancedCount}
            </span>
          ) : null}
        </Button>
        <Button
          type="button"
          variant="text"
          size="lg"
          disabled={disabled || !canRemove}
          onClick={onRemove}
        >
          {t('configPage.payload.remove')}
        </Button>
      </div>
      {advancedExpanded ? (
        <PayloadModelAdvancedFields
          model={model}
          disabled={disabled}
          protocolOptions={protocolOptions}
          onChange={onChange}
        />
      ) : null}
    </div>
  )
}

function PayloadModelRows({
  models,
  disabled,
  onChange,
}: {
  models: PayloadModelEntry[]
  disabled: boolean
  onChange: (models: PayloadModelEntry[]) => void
}) {
  const { t } = useTranslation()
  const rows = models.length > 0 ? models : [createPayloadModel()]
  const hasBlankModel = hasBlankPayloadModel(rows)
  const showBlankModelHint = hasBlankModel && (rows.length > 1 || hasPayloadModelContent(rows))
  const protocolOptions = Array.from(
    new Set([
      ...payloadProtocols,
      ...rows.map((model) => model.protocol).filter(Boolean),
      ...rows.map((model) => model.fromProtocol).filter(Boolean),
    ]),
  )
  const updateModel = (index: number, patch: Partial<PayloadModelEntry>) => {
    onChange(
      rows.map((model, modelIndex) => (modelIndex === index ? { ...model, ...patch } : model)),
    )
  }
  const addModel = () => onChange([...rows, createPayloadModel()])
  const removeModel = (index: number) => {
    onChange(rows.filter((_, modelIndex) => modelIndex !== index))
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">
          {t('configPage.payload.models')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={disabled || hasBlankModel}
          onClick={addModel}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addModel')}
        </Button>
      </div>
      {showBlankModelHint ? (
        <p className="text-muted-foreground text-xs leading-5">
          {t('configPage.payload.completeCurrentModelFirst')}
        </p>
      ) : null}
      <div className="grid gap-2">
        <div className="hidden gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_12rem_minmax(10.5rem,12rem)_minmax(4.5rem,auto)]">
          <TableHeaderCell
            label={t('configPage.payload.modelName')}
            description={t('configPage.payload.modelNameHelp')}
            className="px-0 py-0"
          />
          <TableHeaderCell
            label={t('configPage.payload.protocol')}
            description={t('configPage.payload.protocolHelp')}
            className="px-0 py-0"
          />
          <TableHeaderCell
            label={t('configPage.payload.advancedMatchers')}
            description={t('configPage.payload.advancedMatchersSummary')}
            className="px-0 py-0"
          />
          <div aria-hidden="true" />
        </div>
        {rows.map((model, index) => (
          <PayloadModelRow
            key={index}
            model={model}
            disabled={disabled}
            canRemove={rows.length > 1}
            protocolOptions={protocolOptions}
            onChange={(patch) => updateModel(index, patch)}
            onRemove={() => removeModel(index)}
          />
        ))}
      </div>
    </div>
  )
}

function PayloadParamRows({
  params,
  disabled,
  rawValues,
  onChange,
}: {
  params: PayloadParamEntry[]
  disabled: boolean
  rawValues: boolean
  onChange: (params: PayloadParamEntry[]) => void
}) {
  const { t } = useTranslation()
  const [valueMemory, setValueMemory] = useState<
    Record<number, Partial<Record<PayloadParamValueType, string>>>
  >({})
  const hasBlankParam = hasBlankPayloadParam(params)
  const addParamDisabled = disabled || hasBlankParam
  const updateParam = (index: number, patch: Partial<PayloadParamEntry>) => {
    onChange(
      params.map((param, paramIndex) => (paramIndex === index ? { ...param, ...patch } : param)),
    )
  }
  const updateParamValue = (index: number, param: PayloadParamEntry, value: string) => {
    setValueMemory((current) => ({
      ...current,
      [index]: {
        ...current[index],
        [param.valueType]: value,
      },
    }))
    updateParam(index, { value })
  }
  const updateParamValueType = (
    index: number,
    param: PayloadParamEntry,
    valueType: PayloadParamValueType,
  ) => {
    const cachedValue = valueMemory[index]?.[valueType]
    setValueMemory((current) => ({
      ...current,
      [index]: {
        ...current[index],
        [param.valueType]: param.value,
      },
    }))
    updateParam(index, {
      valueType,
      value: cachedValue ?? getDefaultPayloadParamValue(valueType),
    })
  }
  const addParam = () => onChange([...params, createPayloadParam(rawValues)])
  const removeParam = (index: number) =>
    onChange(params.filter((_, paramIndex) => paramIndex !== index))

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">
          {t('configPage.payload.params')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={addParamDisabled}
          onClick={addParam}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addParam')}
        </Button>
      </div>
      {hasBlankParam ? (
        <p className="text-muted-foreground text-xs leading-5">
          {t('configPage.payload.completeCurrentParamFirst')}
        </p>
      ) : null}
      {params.length === 0 ? (
        <EmptyJsonRows label={t('configPage.payload.emptyParams')} />
      ) : (
        <div className="grid gap-2">
          <div
            className={cn(
              'hidden gap-2 lg:grid lg:grid-cols-[minmax(10rem,0.8fr)_9rem_minmax(12rem,1.2fr)_auto]',
              rawValues ? 'lg:grid-cols-[minmax(10rem,0.8fr)_minmax(14rem,1.4fr)_auto]' : null,
            )}
          >
            <TableHeaderCell
              label={t('configPage.payload.paramPath')}
              description={t('configPage.payload.paramPathHelp')}
              className="px-0 py-0"
            />
            {rawValues ? null : (
              <TableHeaderCell
                label={t('configPage.payload.valueType')}
                description={t('configPage.payload.valueTypeHelp')}
                className="px-0 py-0"
              />
            )}
            <TableHeaderCell
              label={t('configPage.payload.paramValue')}
              description={
                rawValues
                  ? t('configPage.payload.rawValueHelp')
                  : t('configPage.payload.paramValueHelp')
              }
              className="px-0 py-0"
            />
            <div aria-hidden="true" />
          </div>
          {params.map((param, index) => {
            const validationError = getPayloadParamValidationError(
              rawValues ? { ...param, valueType: 'json' } : param,
            )

            return (
              <div key={index} className="grid gap-1.5">
                <div
                  className={cn(
                    'grid gap-2 lg:grid-cols-[minmax(10rem,0.8fr)_9rem_minmax(12rem,1.2fr)_auto]',
                    rawValues
                      ? 'lg:grid-cols-[minmax(10rem,0.8fr)_minmax(14rem,1.4fr)_auto]'
                      : null,
                  )}
                >
                  <label className={fieldClassName}>
                    <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                      {t('configPage.payload.paramPath')}
                    </span>
                    <Input
                      value={param.path}
                      disabled={disabled}
                      className="font-mono"
                      aria-label={t('configPage.payload.paramPath')}
                      placeholder={t('configPage.payload.paramPathPlaceholder')}
                      onChange={(event) => updateParam(index, { path: event.target.value })}
                    />
                  </label>
                  {rawValues ? null : (
                    <label className={fieldClassName}>
                      <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                        {t('configPage.payload.valueType')}
                      </span>
                      <Select
                        value={param.valueType}
                        disabled={disabled}
                        onValueChange={(value) =>
                          updateParamValueType(index, param, value as PayloadParamValueType)
                        }
                      >
                        <SelectTrigger aria-label={t('configPage.payload.valueType')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['string', 'number', 'boolean', 'json'] as const).map((type) => (
                            <SelectItem key={type} value={type}>
                              {t(`configPage.payload.valueTypes.${type}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  )}
                  {param.valueType === 'json' || rawValues ? (
                    <label className={fieldClassName}>
                      <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                        {t('configPage.payload.paramValue')}
                      </span>
                      <Textarea
                        value={param.value}
                        disabled={disabled}
                        className="min-h-9 font-mono text-sm"
                        aria-label={t('configPage.payload.paramValue')}
                        placeholder={
                          rawValues
                            ? t('configPage.payload.rawValuePlaceholder')
                            : t('configPage.payload.jsonValuePlaceholder')
                        }
                        onChange={(event) => updateParamValue(index, param, event.target.value)}
                      />
                    </label>
                  ) : param.valueType === 'boolean' ? (
                    <label className={fieldClassName}>
                      <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                        {t('configPage.payload.paramValue')}
                      </span>
                      <Select
                        value={param.value.toLowerCase() === 'false' ? 'false' : 'true'}
                        disabled={disabled}
                        onValueChange={(value) => updateParamValue(index, param, value)}
                      >
                        <SelectTrigger aria-label={t('configPage.payload.paramValue')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">
                            {t('configPage.payload.booleanTrue')}
                          </SelectItem>
                          <SelectItem value="false">
                            {t('configPage.payload.booleanFalse')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  ) : (
                    <label className={fieldClassName}>
                      <span className="text-muted-foreground text-xs font-medium lg:sr-only">
                        {t('configPage.payload.paramValue')}
                      </span>
                      <Input
                        value={param.value}
                        disabled={disabled}
                        className="font-mono"
                        aria-label={t('configPage.payload.paramValue')}
                        placeholder={t(`configPage.payload.valuePlaceholders.${param.valueType}`)}
                        onChange={(event) => updateParamValue(index, param, event.target.value)}
                      />
                    </label>
                  )}
                  <Button
                    type="button"
                    variant="text"
                    size="lg"
                    disabled={disabled}
                    onClick={() => removeParam(index)}
                  >
                    {t('configPage.payload.remove')}
                  </Button>
                </div>
                {validationError ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {t(`configPage.payload.validation.${validationError}`)}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PayloadFilterParamRows({
  params,
  disabled,
  onChange,
}: {
  params: string[]
  disabled: boolean
  onChange: (params: string[]) => void
}) {
  const { t } = useTranslation()
  const hasBlankParam = hasBlankPayloadFilterParam(params)
  const addParamDisabled = disabled || hasBlankParam
  const addParam = () => onChange([...params, ''])
  const updateParam = (index: number, value: string) => {
    onChange(params.map((param, paramIndex) => (paramIndex === index ? value : param)))
  }
  const removeParam = (index: number) =>
    onChange(params.filter((_, paramIndex) => paramIndex !== index))

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">
          {t('configPage.payload.removeParams')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={addParamDisabled}
          onClick={addParam}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addParam')}
        </Button>
      </div>
      {hasBlankParam ? (
        <p className="text-muted-foreground text-xs leading-5">
          {t('configPage.payload.completeCurrentParamFirst')}
        </p>
      ) : null}
      {params.length === 0 ? (
        <EmptyJsonRows label={t('configPage.payload.emptyFilterParams')} />
      ) : (
        <div className="grid gap-2">
          <div className="hidden gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
            <TableHeaderCell
              label={t('configPage.payload.paramPath')}
              description={t('configPage.payload.filterParamPathHelp')}
              className="px-0 py-0"
            />
            <div aria-hidden="true" />
          </div>
          {params.map((param, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className={fieldClassName}>
                <span className="text-muted-foreground text-xs font-medium sm:sr-only">
                  {t('configPage.payload.paramPath')}
                </span>
                <Input
                  value={param}
                  disabled={disabled}
                  className="font-mono"
                  aria-label={t('configPage.payload.paramPath')}
                  placeholder={t('configPage.payload.paramPathPlaceholder')}
                  onChange={(event) => updateParam(index, event.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="text"
                size="lg"
                disabled={disabled}
                onClick={() => removeParam(index)}
              >
                {t('configPage.payload.remove')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PayloadRuleEditor({
  sectionKey,
  rules,
  disabled,
  onChange,
  onRemoveRule,
}: {
  sectionKey: PayloadRuleSection
  rules: PayloadRule[]
  disabled: boolean
  onChange: (rules: PayloadRule[]) => void
  onRemoveRule: (sectionKey: PayloadRuleSection, index: number) => void
}) {
  const { t } = useTranslation()
  const rawValues = sectionKey.endsWith('-raw')
  const updateRule = (index: number, patch: Partial<PayloadRule>) => {
    onChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)))
  }
  const duplicateRule = (index: number) => {
    const rule = rules[index]
    if (!rule) return
    onChange(insertAt(rules, index + 1, clonePayloadRule(rule)))
  }

  return (
    <div className="grid gap-3">
      {rules.length === 0 ? (
        <EmptyJsonRows label={t('configPage.payload.emptyRules')} />
      ) : (
        rules.map((rule, index) => {
          const ruleIssues = getPayloadRuleIssueKeys(rule, sectionKey)
          const issueCount = countPayloadRuleIssues(rule, sectionKey)
          const showIssues = shouldShowPayloadRuleIssues(rule, sectionKey)
          const isDraft = issueCount > 0 && !showIssues
          const anchor = getPayloadRuleAnchor(rule, sectionKey)

          return (
            <div
              key={index}
              className={cn(
                'grid gap-4 rounded-md border px-3 py-3',
                showIssues ? 'border-amber-500/35 bg-amber-500/5' : null,
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {t('configPage.payload.ruleTitle', { index: index + 1 })}
                    </p>
                    {anchor ? (
                      <code className="bg-muted text-muted-foreground max-w-full truncate rounded px-1.5 py-0.5 font-mono text-[11px]">
                        {anchor}
                      </code>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {t('configPage.payload.ruleSummary', {
                      models: rule.models.filter((model) => model.name.trim()).length,
                      params: rule.params.filter((param) => param.path.trim()).length,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="text"
                    size="md"
                    disabled={disabled || issueCount > 0}
                    onClick={() => duplicateRule(index)}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    {t('configPage.payload.duplicateRule')}
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    size="md"
                    className="text-destructive hover:text-destructive justify-start"
                    disabled={disabled}
                    onClick={() => onRemoveRule(sectionKey, index)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t('configPage.payload.removeRule')}
                  </Button>
                </div>
              </div>
              {isDraft ? (
                <div className="bg-muted/30 text-muted-foreground rounded-md border px-3 py-2 text-xs leading-5">
                  {t('configPage.payload.draftHint')}
                </div>
              ) : null}
              {showIssues && ruleIssues.length > 0 ? (
                <div className="grid gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
                  {ruleIssues.map((issue) => (
                    <p key={issue}>{t(`configPage.payload.ruleIssues.${issue}`)}</p>
                  ))}
                </div>
              ) : null}
              <PayloadModelRows
                models={rule.models}
                disabled={disabled}
                onChange={(models) => updateRule(index, { models })}
              />
              <PayloadParamRows
                params={rule.params}
                disabled={disabled}
                rawValues={rawValues}
                onChange={(params) => updateRule(index, { params })}
              />
            </div>
          )
        })
      )}
    </div>
  )
}

function PayloadFilterEditor({
  rules,
  disabled,
  onChange,
  onRemoveRule,
}: {
  rules: PayloadFilterRule[]
  disabled: boolean
  onChange: (rules: PayloadFilterRule[]) => void
  onRemoveRule: (index: number) => void
}) {
  const { t } = useTranslation()
  const updateRule = (index: number, patch: Partial<PayloadFilterRule>) => {
    onChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)))
  }
  const duplicateRule = (index: number) => {
    const rule = rules[index]
    if (!rule) return
    onChange(insertAt(rules, index + 1, clonePayloadFilterRule(rule)))
  }

  return (
    <div className="grid gap-3">
      {rules.length === 0 ? (
        <EmptyJsonRows label={t('configPage.payload.emptyRules')} />
      ) : (
        rules.map((rule, index) => {
          const ruleIssues = getPayloadRuleIssueKeys(rule, 'filter')
          const issueCount = countPayloadRuleIssues(rule, 'filter')
          const showIssues = shouldShowPayloadRuleIssues(rule, 'filter')
          const isDraft = issueCount > 0 && !showIssues
          const anchor = getPayloadRuleAnchor(rule, 'filter')

          return (
            <div
              key={index}
              className={cn(
                'grid gap-4 rounded-md border px-3 py-3',
                showIssues ? 'border-amber-500/35 bg-amber-500/5' : null,
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {t('configPage.payload.ruleTitle', { index: index + 1 })}
                    </p>
                    {anchor ? (
                      <code className="bg-muted text-muted-foreground max-w-full truncate rounded px-1.5 py-0.5 font-mono text-[11px]">
                        {anchor}
                      </code>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {t('configPage.payload.ruleSummary', {
                      models: rule.models.filter((model) => model.name.trim()).length,
                      params: rule.params.filter((param) => param.trim()).length,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="text"
                    size="md"
                    disabled={disabled || issueCount > 0}
                    onClick={() => duplicateRule(index)}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    {t('configPage.payload.duplicateRule')}
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    size="md"
                    className="text-destructive hover:text-destructive justify-start"
                    disabled={disabled}
                    onClick={() => onRemoveRule(index)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t('configPage.payload.removeRule')}
                  </Button>
                </div>
              </div>
              {isDraft ? (
                <div className="bg-muted/30 text-muted-foreground rounded-md border px-3 py-2 text-xs leading-5">
                  {t('configPage.payload.draftHint')}
                </div>
              ) : null}
              {showIssues && ruleIssues.length > 0 ? (
                <div className="grid gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
                  {ruleIssues.map((issue) => (
                    <p key={issue}>{t(`configPage.payload.ruleIssues.${issue}`)}</p>
                  ))}
                </div>
              ) : null}
              <PayloadModelRows
                models={rule.models}
                disabled={disabled}
                onChange={(models) => updateRule(index, { models })}
              />
              <PayloadFilterParamRows
                params={rule.params}
                disabled={disabled}
                onChange={(params) => updateRule(index, { params })}
              />
            </div>
          )
        })
      )}
    </div>
  )
}

function PayloadRulesEditor({
  value,
  disabled,
  onChange,
}: {
  value: PayloadRulesConfig
  disabled: boolean
  onChange: (value: PayloadRulesConfig) => void
}) {
  const { t } = useTranslation()
  const [removedRule, setRemovedRule] = useState<RemovedPayloadRule | null>(null)
  const serialized = serializePayloadConfig(value)
  const totalRules = countPayloadRules(value)
  const totalDrafts = countPayloadDrafts(value)
  const activeSections = payloadSectionKeys.filter((sectionKey) => value[sectionKey].length > 0)
  const affectedTargets = getPayloadAffectedTargets(value)
  const visibleTargets =
    affectedTargets.length > 0
      ? [
          affectedTargets.slice(0, 3).join(', '),
          affectedTargets.length > 3
            ? t('configPage.payload.moreTargets', { count: affectedTargets.length - 3 })
            : '',
        ]
          .filter(Boolean)
          .join(' ')
      : t('configPage.payload.noTargets')
  const updateSection = <T extends PayloadSectionKey>(
    sectionKey: T,
    rules: PayloadRulesConfig[T],
  ) => {
    onChange({ ...value, [sectionKey]: rules })
  }
  const addRuleToSection = (sectionKey: PayloadSectionKey) => {
    setRemovedRule(null)

    if (sectionKey === 'filter') {
      updateSection('filter', [...value.filter, createPayloadFilterRule()])
      return
    }

    updateSection(sectionKey, [
      ...value[sectionKey],
      createPayloadRule(sectionKey.endsWith('-raw')),
    ])
  }
  const removePayloadRule = (sectionKey: PayloadRuleSection, index: number) => {
    const rule = value[sectionKey][index]
    if (!rule) return
    setRemovedRule({ sectionKey, index, rule: clonePayloadRule(rule) })
    updateSection(
      sectionKey,
      value[sectionKey].filter((_, ruleIndex) => ruleIndex !== index),
    )
  }
  const removeFilterRule = (index: number) => {
    const rule = value.filter[index]
    if (!rule) return
    setRemovedRule({ sectionKey: 'filter', index, rule: clonePayloadFilterRule(rule) })
    updateSection(
      'filter',
      value.filter.filter((_, ruleIndex) => ruleIndex !== index),
    )
  }
  const restoreRemovedRule = () => {
    if (!removedRule) return

    if (removedRule.sectionKey === 'filter') {
      updateSection(
        'filter',
        insertAt(value.filter, removedRule.index, clonePayloadFilterRule(removedRule.rule)),
      )
    } else {
      updateSection(
        removedRule.sectionKey,
        insertAt(
          value[removedRule.sectionKey],
          removedRule.index,
          clonePayloadRule(removedRule.rule),
        ),
      )
    }

    setRemovedRule(null)
  }

  return (
    <div className="grid gap-4">
      <div className="bg-muted/30 grid gap-3 rounded-md border px-3 py-3 text-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{t('configPage.payload.summaryTitle')}</p>
            <span className="bg-background text-muted-foreground w-fit rounded-md border px-2.5 py-1 text-xs">
              {t('configPage.payload.totalRules', { count: totalRules })}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {totalRules > 0
              ? t('configPage.payload.impactSummary', {
                  fill: value.default.length,
                  rawFill: value['default-raw'].length,
                  force: value.override.length,
                  rawForce: value['override-raw'].length,
                  remove: value.filter.length,
                  targets: visibleTargets,
                })
              : t('configPage.payload.emptyImpactSummary')}
          </p>
        </div>
        {totalRules === 0 && removedRule ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t('configPage.payload.emptyRootWarning')}</span>
          </div>
        ) : null}
      </div>

      <PayloadAddRulePanel
        disabled={disabled}
        value={value}
        draftCount={totalDrafts}
        onAddRule={addRuleToSection}
        onFocusSection={scrollToPayloadSection}
      />

      {removedRule ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:text-amber-200">
          <span>
            {t('configPage.payload.removedRuleNotice', {
              section: t(`configPage.payload.sections.${removedRule.sectionKey}.title`),
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="md"
            className="bg-background/70 w-fit border-amber-500/40"
            disabled={disabled}
            onClick={restoreRemovedRule}
          >
            <Undo2 className="size-4" aria-hidden="true" />
            {t('configPage.payload.restoreRule')}
          </Button>
        </div>
      ) : null}

      {activeSections.length > 0
        ? activeSections.map((sectionKey) => {
            const issueCount = countPayloadSectionVisibleIssues(value, sectionKey)
            const draftCount = countPayloadSectionDrafts(value, sectionKey)

            return (
              <div
                key={sectionKey}
                id={`payload-section-${sectionKey}`}
                className="grid scroll-mt-28 gap-3 rounded-lg border px-3 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {t(`configPage.payload.sections.${sectionKey}.title`)}
                      </p>
                      <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px]">
                        {sectionKey}
                      </code>
                      {issueCount > 0 ? (
                        <span className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {t('configPage.payload.needsAttention', { count: issueCount })}
                        </span>
                      ) : null}
                      {draftCount > 0 ? (
                        <span className="bg-muted text-muted-foreground rounded-md border px-2 py-0.5 text-xs font-medium">
                          {t('configPage.payload.draftCount', { count: draftCount })}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      {t(`configPage.payload.sections.${sectionKey}.description`)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      {t('configPage.payload.groupingHint')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-fit"
                    disabled={disabled || draftCount > 0}
                    onClick={() => addRuleToSection(sectionKey)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {t('configPage.payload.addRule')}
                  </Button>
                </div>
                {sectionKey === 'filter' ? (
                  <PayloadFilterEditor
                    rules={value.filter}
                    disabled={disabled}
                    onChange={(rules) => updateSection('filter', rules)}
                    onRemoveRule={removeFilterRule}
                  />
                ) : (
                  <PayloadRuleEditor
                    sectionKey={sectionKey}
                    rules={value[sectionKey]}
                    disabled={disabled}
                    onChange={(rules) => updateSection(sectionKey, rules)}
                    onRemoveRule={removePayloadRule}
                  />
                )}
              </div>
            )
          })
        : null}

      <details className="group bg-muted/20 rounded-lg border px-3 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          {t('configPage.payload.preview')}
        </summary>
        <pre className="bg-background mt-3 max-h-96 overflow-auto rounded-md border p-3 font-mono text-xs leading-5">
          {JSON.stringify(serialized, null, 2)}
        </pre>
      </details>
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
  const { t } = useTranslation()

  if (stringListConfigFieldKeys.has(fieldKey)) {
    const items = normalizeStringList(value)

    return (
      <StringListEditor
        value={items}
        disabled={disabled}
        placeholder={t(`configPage.stringList.${fieldKey}.placeholder`)}
        hint={t(`configPage.stringList.${fieldKey}.hint`)}
        countLabel={t(`configPage.stringList.${fieldKey}.count`, { count: items.length })}
        onChange={onChange}
      />
    )
  }

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
          value={normalizeModelAliases(value)}
          disabled={disabled}
          onChange={(nextValue) => onChange(serializeModelAliases(nextValue))}
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
    case 'payloadRulesJson':
      return (
        <PayloadRulesEditor
          value={normalizePayloadConfig(value)}
          disabled={disabled}
          onChange={(nextValue) => onChange(serializePayloadDraftConfig(nextValue))}
        />
      )
    case 'antigravitySensitiveWordsJson':
      return (
        <AntigravitySensitiveWordsEditor
          value={normalizeAntigravitySensitiveWords(value)}
          disabled={disabled}
          onChange={onChange}
        />
      )
    default:
      return null
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
  onChange: (key: ConfigFieldKey, value: ConfigFieldValue) => void
}) {
  const { t, i18n } = useTranslation()
  const parsed = parseJsonDraft(field, value)
  const parseError = parsed.ok ? null : parsed.message

  if (defaultJsonEditorFieldKeys.has(field.key)) {
    const placeholderKey = `configPage.fields.${field.key}.placeholder`

    return (
      <JsonEditorFrame field={field} invalid={invalid} parseError={parseError}>
        <Textarea
          value={value}
          disabled={disabled}
          className="min-h-32 font-mono text-sm"
          placeholder={i18n.exists(placeholderKey) ? t(placeholderKey) : undefined}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      </JsonEditorFrame>
    )
  }

  const canUseStructured = parsed.ok && canEditJsonField(field.key, parsed.value)

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
  onChange: (key: ConfigFieldKey, value: ConfigFieldValue) => void
}) {
  const { t } = useTranslation()
  const [networkPanel, setNetworkPanel] = useState<NetworkProxyPanel>('current')

  const renderField = (field: ConfigFieldDefinition) =>
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
    )

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
                      size="md"
                      variant={networkPanel === panel ? 'secondary' : 'ghost'}
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
              (() => {
                const ungroupedFields = section.fields.filter((field) => !field.groupId)
                const subgroupIds = Array.from(
                  new Set(
                    section.fields
                      .map((field) => field.groupId)
                      .filter((groupId): groupId is ConfigSubgroupId => Boolean(groupId)),
                  ),
                )

                if (subgroupIds.length === 0) {
                  return <div className="mt-4 grid gap-3">{section.fields.map(renderField)}</div>
                }

                return (
                  <div className="mt-4 grid gap-4">
                    {ungroupedFields.length > 0 ? (
                      <div className="grid gap-3">{ungroupedFields.map(renderField)}</div>
                    ) : null}
                    {subgroupIds.map((groupId) => {
                      const groupFields = section.fields.filter(
                        (field) => field.groupId === groupId,
                      )
                      return (
                        <div
                          key={groupId}
                          id={`config-section-${groupId}`}
                          className="border-t pt-4"
                        >
                          <h3 className="text-sm font-semibold">
                            {t(`configPage.sections.${groupId}.title`)}
                          </h3>
                          <p className="text-muted-foreground mt-1 text-xs leading-5">
                            {t(`configPage.sections.${groupId}.description`)}
                          </p>
                          <div className="mt-3 grid gap-3">{groupFields.map(renderField)}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()
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
  draftCount,
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
  draftCount: number
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
    <div className="bg-background/95 sticky -top-4 z-[var(--z-page-sticky)] -mx-4 px-4 py-3 backdrop-blur md:-top-6 md:-mx-6 md:px-6">
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
            {validationCount === 0 && draftCount > 0 ? (
              <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs font-medium">
                {t('configPage.payload.draftCount', { count: draftCount })}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button variant="outline" size="md" disabled={!dirty} onClick={onOpenChanges}>
              <FileDiff className="size-4" aria-hidden="true" />
              {t('configPage.actions.viewChanges')}
            </Button>
            <Button
              variant="outline"
              size="md"
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
            <Button size="md" disabled={saveDisabled} onClick={onSave}>
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
                    className="grid h-auto w-full min-w-0 justify-stretch gap-2 rounded-md border px-3 py-2 text-left whitespace-normal"
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
  const visibleValidationErrors = useMemo(
    () => (structuredDraft ? getVisibleValidationErrors(structuredDraft) : []),
    [structuredDraft],
  )
  const draftCount = useMemo(() => {
    if (!structuredDraft) return 0

    try {
      return countPayloadDrafts(
        JSON.parse(String(structuredDraft.payloadRulesJson || '{}')) as unknown,
      )
    } catch {
      return 0
    }
  }, [structuredDraft])
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

  const handleStructuredChange = (key: ConfigFieldKey, value: ConfigFieldValue) => {
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
        validationCount={visibleValidationErrors.length}
        draftCount={draftCount}
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
        validationErrors={visibleValidationErrors}
        disabled={workbench.mutating}
        oauthModelCatalog={oauthModelCatalog}
        onChange={handleStructuredChange}
      />
    </section>
  )
}
