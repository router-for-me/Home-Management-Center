import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
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
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TableEmptyState } from '@/components/shared/empty-state'
import { fieldClassName } from '@/components/shared/form-layout'
import { PageHeader } from '@/components/shared/page-header'
import { RowActions } from '@/components/shared/row-actions'
import { SensitiveReplacementEditor } from '@/components/shared/sensitive-replacement-editor'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ModelAliasEditor } from '@/features/config/oauth-model-alias-editor'
import {
  ModelSettingFeedbackContext,
  type ModelSettingIssue,
  OAuthModelSettingsEditor,
} from '@/features/config/oauth-model-settings-editor'
import { PayloadFormField, PayloadReviewFieldContext } from '@/features/config/payload-form-field'
import {
  type PayloadParamEntry,
  type PayloadParamValueType,
  convertPayloadParamValue,
  getPayloadParamPathIssues,
  getPayloadParamValidationError,
  parsePayloadParamValue,
  serializePayloadParamValue,
  stringifyPayloadPrimitiveValue,
} from '@/features/config/payload-param-value'
import {
  type PayloadReplaceDraft,
  PayloadReplacePreview,
  PayloadReplacementSteps,
} from '@/features/config/payload-replace-fields'
import { ProxyPoolsPanel } from '@/features/config/proxy-pools-panel'
import { useConfigWorkbench } from '@/features/config/use-config-workbench'
import { isValidAntigravityPauseWindow } from '@/lib/api/management/antigravity-pause-window'
import {
  type ConfigChange,
  type ConfigFieldKey,
  ConfigFieldSaveError,
  type ConfigFieldValue,
  type ConfigSnapshot,
  type ConfigStructuredValues,
  type WritableConfigFieldKey,
  canEditPayloadConfig,
  hasOAuthChannelConflict,
  isReadOnlyConfigField,
  parseOptionalInteger,
} from '@/lib/api/management/config'
import { hasIncompleteAliasChanges } from '@/lib/api/management/oauth-model-aliases'
import { hasInvalidModelSettingChanges } from '@/lib/api/management/oauth-model-settings'
import {
  type PayloadReplaceIssueKey,
  canEditPayloadReplaceRule,
  describeReadOnlyPayloadReplace,
  getPayloadReplaceIssues,
  getPayloadReplaceTargetIssue,
  normalizePayloadReplaceContent,
  payloadReplaceTargetModes,
  serializePayloadReplaceContent,
} from '@/lib/api/management/payload-replace'
import type { ProviderModelChannel, ProviderModelDefinition } from '@/lib/api/management/providers'
import {
  type ReplacementKind,
  parseReplacementDraft,
  replacementIssues,
  serializeReplacementRows,
} from '@/lib/api/management/sensitive-replacements'
import { scrollElementIntoShell } from '@/lib/shell-scroll'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session-store'
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

type ConfigSubgroupId = 'devin' | 'liveMediaRelay' | 'antigravity'

type ConfigFieldKind =
  | ReplacementKind
  | 'boolean'
  | 'defaultOnBoolean'
  | 'optionalInteger'
  | 'number'
  | 'text'
  | 'sensitiveText'
  | 'select'
  | 'duration'
  | 'nullableBoolean'
  | 'jsonArray'
  | 'jsonObject'

export {
  normalizeModelAliasRule,
  serializeModelAliasRule,
} from '@/lib/api/management/oauth-model-aliases'

type JsonConfigFieldKey =
  | 'oauthExcludedModelsJson'
  | 'oauthModelAliasJson'
  | 'oauthModelSettingsJson'
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

type PayloadHeaderEntry = {
  id: number
  name: string
  value: string
}

type PayloadConditionEntry = PayloadParamEntry & { id: number; sourceGroup?: number }

type PayloadModelEntry = {
  id: number
  name: string
  protocol: string
  fromProtocol: string
  headers: PayloadHeaderEntry[]
  match: PayloadConditionEntry[]
  notMatch: PayloadConditionEntry[]
  exist: string[]
  notExist: string[]
}

type PayloadRuleTarget = {
  displayNumber: number
  models: PayloadModelEntry[]
}

type PayloadRule = PayloadRuleTarget & {
  params: (PayloadParamEntry & { id: number })[]
}

type PayloadFilterRule = PayloadRuleTarget & {
  params: { id: number; path: string }[]
}

type PayloadReplaceRule = PayloadRuleTarget &
  PayloadReplaceDraft & {
    savedModels?: unknown[]
    savedTarget?: Record<string, unknown>
  }

type ReadOnlyPayloadRule = PayloadRuleTarget & {
  original: unknown
  details: ReturnType<typeof describeReadOnlyPayloadReplace>
}

type AnyPayloadRule = PayloadRule | PayloadFilterRule | PayloadReplaceRule | ReadOnlyPayloadRule

type PayloadRulesConfig = {
  default: PayloadRule[]
  'default-raw': PayloadRule[]
  override: PayloadRule[]
  'override-raw': PayloadRule[]
  replace: (PayloadReplaceRule | ReadOnlyPayloadRule)[]
  filter: PayloadFilterRule[]
}

type PayloadRuleSection = 'default' | 'default-raw' | 'override' | 'override-raw'

type PayloadSectionKey = PayloadRuleSection | 'replace' | 'filter'

type PayloadRuleIntentId = 'fill' | 'override' | 'replace' | 'filter'

type PayloadRuleIdentity = { id: string; isNew: boolean }

const PayloadSnapshotContext = createContext<{
  revision: string
  value: ConfigFieldValue
  draft: PayloadRulesConfig | null
  setDraft: (draft: PayloadRulesConfig) => void
} | null>(null)

type PayloadRuleIssueKey =
  | 'modelRequired'
  | 'paramRequired'
  | 'paramPathRequired'
  | 'paramPathDuplicate'
  | PayloadReplaceIssueKey

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
  | {
      sectionKey: 'replace'
      index: number
      rule: PayloadReplaceRule
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
      { key: 'discoveryAuthRequired', kind: 'defaultOnBoolean', sectionId: 'discovery' },
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
      { key: 'loggingToFile', kind: 'boolean', sectionId: 'system' },
      { key: 'usageStatisticsEnabled', kind: 'boolean', sectionId: 'system' },
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
      {
        key: 'sessionAffinityRebindOn',
        kind: 'select',
        sectionId: 'streaming',
        options: ['any', 'quota', 'never'],
      },
      { key: 'sessionAffinityTtl', kind: 'duration', sectionId: 'streaming' },
      { key: 'sessionAffinitySubagents', kind: 'defaultOnBoolean', sectionId: 'streaming' },
      { key: 'streamingKeepaliveSeconds', kind: 'number', sectionId: 'streaming', min: 0 },
      { key: 'streamingSendKeepaliveBeforeFt', kind: 'boolean', sectionId: 'streaming' },
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
      { key: 'oauthModelSettingsJson', kind: 'jsonObject', sectionId: 'oauthRules' },
      { key: 'oauthRequestScopedErrorsJson', kind: 'jsonObject', sectionId: 'oauthRules' },
    ],
  },
  {
    id: 'oauthProviders',
    fields: [
      { key: 'oauthAuthDir', kind: 'text', sectionId: 'oauthProviders' },
      { key: 'oauthAutoRefreshWorkers', kind: 'optionalInteger', sectionId: 'oauthProviders' },
      {
        key: 'devinSensitiveWordsJson',
        kind: 'jsonArray',
        sectionId: 'oauthProviders',
        groupId: 'devin',
      },
      {
        key: 'devinLiteralReplacements',
        kind: 'literalReplacements',
        sectionId: 'oauthProviders',
        groupId: 'devin',
      },
      {
        key: 'devinPatternReplacements',
        kind: 'patternReplacements',
        sectionId: 'oauthProviders',
        groupId: 'devin',
      },
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
        key: 'antigravityTosPauseWindow',
        kind: 'duration',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravitySensitiveWordsJson',
        kind: 'jsonArray',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravityLiteralReplacements',
        kind: 'literalReplacements',
        sectionId: 'oauthProviders',
        groupId: 'antigravity',
      },
      {
        key: 'antigravityPatternReplacements',
        kind: 'patternReplacements',
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
  'meta',
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
  'oauthModelSettingsJson',
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

const durationPattern = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/

const payloadRuleSections: PayloadRuleSection[] = [
  'default',
  'default-raw',
  'override',
  'override-raw',
]

const payloadSectionKeys: PayloadSectionKey[] = [...payloadRuleSections, 'replace', 'filter']
const payloadRuleIntentGroups: Array<{
  id: PayloadRuleIntentId
  sectionKeys: PayloadSectionKey[]
}> = [
  { id: 'fill', sectionKeys: ['default', 'default-raw'] },
  { id: 'override', sectionKeys: ['override', 'override-raw'] },
  { id: 'replace', sectionKeys: ['replace'] },
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

function canEditExcludedModels(value: unknown): value is Record<string, string[]> {
  if (!isRecord(value)) return false

  return Object.values(value).every(
    (models) => Array.isArray(models) && models.every((model) => typeof model === 'string'),
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
  return !isReadOnlyConfigField(field.key)
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

function parseRawPayloadParamValue(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2) ?? ''
}

function nextPayloadRowId(rows: { id: number }[]) {
  return rows.reduce((next, row) => Math.max(next, row.id + 1), 0)
}

function normalizePayloadModels(value: unknown): PayloadModelEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item, id) => {
      if (typeof item === 'string') return createPayloadModel({ id, name: item })
      if (!isRecord(item)) return null
      const name = typeof item.name === 'string' ? item.name : ''
      const protocol = typeof item.protocol === 'string' ? item.protocol : ''
      const fromProtocol = typeof item['from-protocol'] === 'string' ? item['from-protocol'] : ''

      return createPayloadModel({
        id,
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

  return Object.entries(value).map(([name, headerValue], id) => ({
    id,
    name,
    value: stringifyPayloadPrimitiveValue(headerValue),
  }))
}

function normalizePayloadConditions(value: unknown): PayloadConditionEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((item, sourceGroup) => {
      if (!isRecord(item)) return []

      return Object.entries(item).map(([path, conditionValue]) => {
        const parsed = parsePayloadParamValue(conditionValue)

        return {
          sourceGroup,
          path,
          valueType: parsed.valueType,
          value: parsed.value,
        }
      })
    })
    .map((condition, id) => ({ ...condition, id }))
}

function normalizePayloadStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => stringifyPayloadPrimitiveValue(item))
}

function normalizePayloadRules(value: unknown, rawValues = false, offset = 0): PayloadRule[] {
  if (!Array.isArray(value)) return []

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {}
    const params = isRecord(record.params)
      ? Object.entries(record.params).map(([path, paramValue], id) => {
          const parsed = rawValues
            ? { valueType: 'json' as const, value: parseRawPayloadParamValue(paramValue) }
            : parsePayloadParamValue(paramValue)

          return {
            id,
            path,
            valueType: parsed.valueType,
            value: parsed.value,
          }
        })
      : []

    return {
      displayNumber: offset + index + 1,
      models: normalizePayloadModels(record.models),
      params,
    }
  })
}

function normalizePayloadFilterRules(value: unknown): PayloadFilterRule[] {
  if (!Array.isArray(value)) return []

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {}
    const params = Array.isArray(record.params)
      ? record.params.map((param, id) => ({ id, path: stringifyPayloadPrimitiveValue(param) }))
      : []

    return {
      displayNumber: index + 1,
      models: normalizePayloadModels(record.models),
      params,
    }
  })
}

function normalizePayloadConfig(value: unknown): PayloadRulesConfig {
  const record = isRecord(value) ? value : {}
  const defaults = normalizePayloadRules(record.default)
  const overrides = normalizePayloadRules(record.override)

  return {
    default: defaults,
    'default-raw': normalizePayloadRules(record['default-raw'], true, defaults.length),
    override: overrides,
    'override-raw': normalizePayloadRules(record['override-raw'], true, overrides.length),
    replace: Array.isArray(record.replace)
      ? record.replace.map((item: unknown, index) => {
          const rule = isRecord(item) ? item : {}
          const target = { displayNumber: index + 1, models: normalizePayloadModels(rule.models) }
          if (!canEditPayloadReplaceRule(rule)) {
            return { ...target, original: item, details: describeReadOnlyPayloadReplace(rule) }
          }
          const content = normalizePayloadReplaceContent(rule)
          return {
            ...target,
            savedModels: rule.models,
            savedTarget: rule.target,
            target: content.target,
            replacements: content.replacements.map((entry, id) => ({ ...entry, id })),
          }
        })
      : [],
    filter: normalizePayloadFilterRules(record.filter),
  }
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

function serializePayloadConditions(conditions: PayloadConditionEntry[]) {
  const result: Record<string, unknown>[] = []
  let lastGroup: number | undefined
  for (const condition of conditions) {
    const path = condition.path.trim()
    if (!path) continue
    const last = result[result.length - 1]
    const entry = { [path]: serializePayloadParamValue(condition) }
    // Preserve saved multi-path condition maps. A new or repeated path gets its own map.
    if (
      condition.sourceGroup !== undefined &&
      condition.sourceGroup === lastGroup &&
      last &&
      !Object.hasOwn(last, path)
    ) {
      result[result.length - 1] = { ...last, ...entry }
    } else {
      result.push(entry)
    }
    lastGroup = condition.sourceGroup
  }
  return result
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
      const params = rule.params.map((param) => param.path.trim()).filter(Boolean)

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
    replace: config.replace.map((rule) =>
      'original' in rule
        ? rule.original
        : {
            models: rule.savedModels ?? serializePayloadModels(rule.models),
            ...serializePayloadReplaceContent(rule),
            ...(rule.savedTarget && { target: rule.savedTarget }),
          },
    ),
    filter: serializePayloadFilterRules(config.filter),
  }
}

function clonePayloadRule(rule: PayloadRule): PayloadRule {
  return {
    displayNumber: rule.displayNumber,
    models: rule.models.map(clonePayloadModel),
    params: rule.params.map((param) => ({ ...param })),
  }
}

function clonePayloadFilterRule(rule: PayloadFilterRule): PayloadFilterRule {
  return {
    displayNumber: rule.displayNumber,
    models: rule.models.map(clonePayloadModel),
    params: rule.params.map((param) => ({ ...param })),
  }
}

function clonePayloadReplaceRule(rule: PayloadReplaceRule): PayloadReplaceRule {
  return {
    ...rule,
    models: rule.models.map(clonePayloadModel),
    target: { ...rule.target, paths: [...rule.target.paths] },
    replacements: rule.replacements.map((entry) => ({ ...entry })),
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
    config.replace.length +
    config.filter.length
  )
}

function isPayloadRuleComplete(rule: AnyPayloadRule, sectionKey: PayloadSectionKey) {
  return countPayloadRuleIssues(rule, sectionKey) === 0
}

function countPayloadSectionDrafts(config: PayloadRulesConfig, sectionKey: PayloadSectionKey) {
  const rules = sectionKey === 'filter' ? config.filter : config[sectionKey]

  return rules.filter((rule) => !isPayloadRuleComplete(rule, sectionKey)).length
}

function countPayloadDrafts(value: unknown) {
  if (!canEditPayloadConfig(value)) return 0
  return countPayloadConfigDrafts(normalizePayloadConfig(value))
}

function countPayloadConfigDrafts(config: PayloadRulesConfig) {
  return payloadSectionKeys.reduce(
    (total, sectionKey) => total + countPayloadSectionDrafts(config, sectionKey),
    0,
  )
}

function findPayloadDraft(config: PayloadRulesConfig) {
  for (const sectionKey of payloadSectionKeys) {
    const index = config[sectionKey].findIndex((rule) => !isPayloadRuleComplete(rule, sectionKey))
    if (index !== -1) return { sectionKey, index, rule: config[sectionKey][index] }
  }
  return null
}

function getPayloadRuleIntent(sectionKey: PayloadSectionKey): PayloadRuleIntentId {
  if (sectionKey.startsWith('default')) return 'fill'
  if (sectionKey.startsWith('override')) return 'override'
  return sectionKey as 'replace' | 'filter'
}

function hasBlankPayloadParam(params: { path: string }[]) {
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

function getPayloadHeaderIssues(headers: PayloadHeaderEntry[]) {
  const names = new Set<string>()
  return headers.map((header) => {
    const name = header.name.trim()
    if (!name) return header.value.trim() ? 'headerName' : null
    if (names.has(name)) return 'headerDuplicate'
    names.add(name)
    return null
  })
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
    getPayloadHeaderIssues(model.headers).filter(Boolean).length +
    model.match.filter((condition) => Boolean(getPayloadConditionValidationError(condition)))
      .length +
    model.notMatch.filter((condition) => Boolean(getPayloadConditionValidationError(condition)))
      .length
  )
}

function countPayloadModelIssuesForRule(rule: AnyPayloadRule) {
  return rule.models.reduce((total, model) => total + countPayloadModelIssues(model), 0)
}

function countPayloadValueIssues(rule: AnyPayloadRule, sectionKey: PayloadSectionKey) {
  if ('original' in rule) return 0
  const modelIssueCount = countPayloadModelIssuesForRule(rule)
  if (sectionKey === 'filter' || sectionKey === 'replace') return modelIssueCount

  const paramValidationCount = (rule as PayloadRule).params.filter((param) =>
    Boolean(getPayloadParamValidationError(param, sectionKey.endsWith('-raw'))),
  ).length

  return modelIssueCount + paramValidationCount
}

function getPayloadRuleIssueKeys(
  rule: AnyPayloadRule,
  sectionKey: PayloadSectionKey,
): PayloadRuleIssueKey[] {
  const issues: PayloadRuleIssueKey[] = []
  if ('original' in rule) return issues

  if (rule.models.length === 0 || hasBlankPayloadModel(rule.models)) {
    issues.push('modelRequired')
  }

  if (sectionKey === 'replace') {
    return [...issues, ...getPayloadReplaceIssues(rule as PayloadReplaceRule)]
  }

  if (sectionKey === 'filter') {
    const params = (rule as PayloadFilterRule).params
    if (params.length === 0) {
      issues.push('paramRequired')
    } else if (hasBlankPayloadParam(params)) {
      issues.push('paramPathRequired')
    }

    return issues
  }

  const params = (rule as PayloadRule).params
  if (params.length === 0) {
    issues.push('paramRequired')
  } else {
    for (const issue of getPayloadParamPathIssues(params)) {
      if (issue && !issues.includes(issue)) issues.push(issue)
    }
  }

  return issues
}

function countPayloadRuleIssues(rule: AnyPayloadRule, sectionKey: PayloadSectionKey) {
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

function operandExcerpt(value: string) {
  return JSON.stringify(value.length > 40 ? `${value.slice(0, 39)}…` : value)
}

function getPayloadRuleModel(rule: AnyPayloadRule) {
  const model = rule.models.find((item) => item.name.trim())
  return model ? [model.protocol.trim(), model.name.trim()].filter(Boolean).join('/') : ''
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

function hasPayloadValidationErrors(value: unknown) {
  const config = normalizePayloadConfig(value)

  return payloadSectionKeys.some((section) => countPayloadSectionIssues(config, section) > 0)
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
    case 'oauthModelSettingsJson':
      return isRecord(value)
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

function scrollToConfigTarget(target: Element | string) {
  const stickyHeight = Array.from(document.querySelectorAll('[data-config-sticky]')).reduce(
    (height, bar) => height + bar.getBoundingClientRect().height,
    0,
  )
  scrollElementIntoShell(target, stickyHeight + 16)
}

function scrollToSection(sectionId: ConfigSectionId | ConfigSubgroupId) {
  scrollToConfigTarget(`config-section-${sectionId}`)
}

export function scrollToField(key: ConfigFieldKey) {
  const field = fieldDefinitionByKey[key]
  scrollToSection(field.groupId ?? field.sectionId)
}

function areConfigValuesEqual(
  left: ConfigStructuredValues[ConfigFieldKey],
  right: ConfigStructuredValues[ConfigFieldKey],
) {
  if (left === null || right === null) return left === right
  return String(left) === String(right)
}

function getStructuredChanges(
  baseline: ConfigStructuredValues,
  draft: ConfigStructuredValues,
  hasPayloadDrafts: boolean,
): ConfigChange[] {
  return fieldDefinitions
    .filter(isWritableConfigField)
    .map((field) => ({
      key: field.key,
      previousValue: getConfigChangeValue(field.key, baseline[field.key]),
      nextValue: getConfigChangeValue(field.key, draft[field.key]),
    }))
    .filter(
      (change) =>
        (change.key === 'payloadRulesJson' && hasPayloadDrafts) ||
        !areConfigValuesEqual(change.previousValue, change.nextValue),
    )
}

function getConfigChangeValue(key: ConfigFieldKey, value: ConfigFieldValue): ConfigFieldValue {
  if (fieldDefinitionByKey[key].kind === 'optionalInteger') {
    const integer = parseOptionalInteger(value)
    return integer === undefined ? value : integer
  }
  if (key === 'antigravityTosPauseWindow') return String(value ?? '').trim()
  if (key !== 'payloadRulesJson') return value
  try {
    const parsed: unknown = JSON.parse(String(value))
    if (canEditPayloadConfig(parsed) && !hasPayloadValidationErrors(parsed)) {
      return stringifyJson(serializePayloadConfig(normalizePayloadConfig(parsed)))
    }
  } catch {
    return value
  }
  return value
}

function getValidationErrors(
  draft: ConfigStructuredValues,
  saved: ConfigStructuredValues | undefined,
  hasPayloadDrafts: boolean | null,
) {
  return fieldDefinitions
    .filter((field) => {
      if (isReadOnlyConfigField(field.key)) return false

      const value = draft[field.key]
      if (
        saved &&
        value === saved[field.key] &&
        !(field.key === 'payloadRulesJson' && hasPayloadDrafts)
      )
        return false
      if (field.key === 'payloadRulesJson') {
        if (hasPayloadDrafts !== null) return hasPayloadDrafts
        if (value === saved?.payloadRulesJson) return false
      }
      if (field.kind === 'optionalInteger') return parseOptionalInteger(value) === undefined
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
        if (field.key === 'antigravityTosPauseWindow') return !isValidAntigravityPauseWindow(text)
        return text.length > 0 && !durationPattern.test(text)
      }
      if (field.kind === 'nullableBoolean' || field.kind === 'defaultOnBoolean') {
        return value !== null && typeof value !== 'boolean'
      }
      if (field.kind === 'literalReplacements' || field.kind === 'patternReplacements') {
        const rows = parseReplacementDraft(value)
        return !rows || replacementIssues(field.kind, rows).some(Boolean)
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
          if (
            (field.key === 'oauthModelAliasJson' || field.key === 'oauthModelSettingsJson') &&
            isRecord(parsed)
          ) {
            const original: unknown = JSON.parse(String(saved?.[field.key] ?? '{}'))
            if (!isRecord(original)) return true
            return field.key === 'oauthModelAliasJson'
              ? hasIncompleteAliasChanges(original, parsed)
              : hasInvalidModelSettingChanges(original, parsed)
          }
          if (field.key === 'payloadRulesJson') {
            return !canEditPayloadConfig(parsed) || hasPayloadValidationErrors(parsed)
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

      <div
        data-config-sticky
        className="bg-background/95 sticky top-[calc(var(--config-action-height,10.125rem)-1rem)] z-10 -mx-1 overflow-x-auto border-y px-1 py-2 backdrop-blur md:top-[calc(var(--config-action-height,5.125rem)-1.5rem)] xl:hidden"
      >
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

function DefaultOnSwitch({
  label,
  value,
  disabled,
  descriptionId,
  onChange,
}: {
  label: string
  value: boolean | null
  disabled: boolean
  descriptionId?: string
  onChange: (value: boolean | null) => void
}) {
  const { t } = useTranslation()
  const switchRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="flex min-w-0 items-center gap-2 md:flex-row-reverse">
      <Switch
        ref={switchRef}
        aria-label={label}
        aria-describedby={descriptionId}
        checked={value ?? true}
        disabled={disabled}
        onCheckedChange={onChange}
      />
      {value !== null ? (
        <Button
          type="button"
          variant="text"
          size="sm"
          disabled={disabled}
          onClick={() => {
            switchRef.current?.focus({ preventScroll: true })
            onChange(null)
          }}
        >
          {t('configPage.actions.restoreDefault')}
        </Button>
      ) : null}
    </div>
  )
}

function ConfigField({
  field,
  value,
  disabled,
  invalid,
  onEditingIntegerChange,
  onChange,
}: {
  field: ConfigFieldDefinition
  value: ConfigStructuredValues[ConfigFieldKey]
  disabled: boolean
  invalid: boolean
  onEditingIntegerChange: (key: ConfigFieldKey | null) => void
  onChange: (key: ConfigFieldKey, value: ConfigFieldValue) => void
}) {
  const { t, i18n } = useTranslation()
  const integerInput = useRef<HTMLInputElement>(null)
  const [sensitiveVisible, setSensitiveVisible] = useState(false)
  const locked = isReadOnlyConfigField(field.key)
  const controlDisabled = disabled || locked
  const descriptionId = `config-field-${field.key}-description`
  const errorId = `config-field-${field.key}-error`
  const placeholderKey = `configPage.fields.${field.key}.placeholder`
  const placeholder = i18n.exists(placeholderKey) ? t(placeholderKey) : undefined
  const optionLabelKey =
    field.key === 'routingStrategy'
      ? 'configPage.routingStrategies'
      : `configPage.fields.${field.key}.options`

  return (
    <div
      className={cn(
        'grid gap-3 rounded-md border px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] md:items-center',
        invalid ? 'border-amber-500/40 bg-amber-500/5' : null,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{t(`configPage.fields.${field.key}.label`)}</p>
        <p id={descriptionId} className="text-muted-foreground mt-1 text-xs leading-5">
          {t(`configPage.fields.${field.key}.description`, {
            context: field.kind === 'select' ? String(value) : undefined,
          })}
        </p>
        {invalid ? (
          <p id={errorId} className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {t([`configPage.fields.${field.key}.invalid`, 'configPage.validation.invalidField'])}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 justify-start md:justify-end">
        {field.kind === 'boolean' && locked ? (
          <span className="text-sm font-medium">
            {typeof value === 'boolean'
              ? t(value ? 'configPage.status.enabled' : 'configPage.status.disabled')
              : t('configPage.status.unknown')}
          </span>
        ) : null}
        {field.kind === 'boolean' && !locked ? (
          <BooleanControl
            checked={Boolean(value)}
            disabled={controlDisabled}
            onChange={(nextValue) => onChange(field.key, nextValue)}
          />
        ) : null}
        {field.kind === 'optionalInteger' ? (
          <div className="flex w-full min-w-0 items-center gap-2 md:max-w-80">
            <Input
              ref={integerInput}
              inputMode="numeric"
              aria-label={t(`configPage.fields.${field.key}.label`)}
              aria-describedby={invalid ? `${descriptionId} ${errorId}` : descriptionId}
              aria-invalid={invalid || undefined}
              value={String(value ?? '')}
              placeholder={placeholder}
              disabled={controlDisabled}
              className="min-w-0 flex-1"
              onChange={(event) => {
                if (!invalid) onEditingIntegerChange(field.key)
                onChange(field.key, event.target.value)
              }}
              onBlur={() => onEditingIntegerChange(null)}
            />
            {parseOptionalInteger(value) !== null && (
              <Button
                type="button"
                variant="text"
                size="sm"
                disabled={controlDisabled}
                onClick={() => {
                  integerInput.current?.focus({ preventScroll: true })
                  onChange(field.key, null)
                }}
              >
                {t('configPage.actions.restoreDefault')}
              </Button>
            )}
          </div>
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
            aria-label={t(`configPage.fields.${field.key}.label`)}
            aria-describedby={invalid ? `${descriptionId} ${errorId}` : descriptionId}
            aria-invalid={invalid || undefined}
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
              aria-describedby={descriptionId}
            >
              <SelectValue>
                {t(`${optionLabelKey}.${value}`, { defaultValue: String(value) })}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`${optionLabelKey}.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {field.kind === 'defaultOnBoolean' ? (
          <DefaultOnSwitch
            label={t(`configPage.fields.${field.key}.label`)}
            value={typeof value === 'boolean' ? value : null}
            disabled={controlDisabled}
            descriptionId={descriptionId}
            onChange={(nextValue) => onChange(field.key, nextValue)}
          />
        ) : field.kind === 'nullableBoolean' ? (
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
              aria-describedby={descriptionId}
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

  if (field.key === 'payloadRulesJson') {
    return <div className="grid min-w-0 gap-4">{children}</div>
  }

  return (
    <div
      className={cn(
        'grid min-w-0 gap-4 rounded-lg border px-3 py-3',
        invalid ? 'border-amber-500/40 bg-amber-500/5' : 'bg-background/35',
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t(`configPage.fields.${field.key}.label`)}</p>
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
  fieldLabel = false,
}: {
  label: string
  description?: string
  fieldLabel?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        fieldLabel ? 'text-label' : 'text-muted-foreground px-3 py-2 text-xs font-medium',
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
    id: patch.id ?? 0,
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

function createPayloadParam(rawValues = false, id = 0): PayloadRule['params'][number] {
  return { id, path: '', valueType: rawValues ? 'json' : 'string', value: '' }
}

function createPayloadRule(displayNumber: number): PayloadRule {
  return {
    displayNumber,
    models: [createPayloadModel()],
    params: [createPayloadParam()],
  }
}

function createPayloadFilterRule(displayNumber: number): PayloadFilterRule {
  return {
    displayNumber,
    models: [createPayloadModel()],
    params: [{ id: 0, path: '' }],
  }
}

function createPayloadReplaceRule(displayNumber: number): PayloadReplaceRule {
  return {
    displayNumber,
    models: [createPayloadModel()],
    target: { mode: 'user', all: false, positions: '1', paths: [] },
    replacements: [{ id: 0, kind: 'literal', from: '', to: '' }],
  }
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
  const headerIssues = getPayloadHeaderIssues(headers)
  const updateHeader = (index: number, patch: Partial<PayloadHeaderEntry>) => {
    onChange(
      headers.map((header, headerIndex) =>
        headerIndex === index ? { ...header, ...patch } : header,
      ),
    )
  }
  const addHeader = () =>
    onChange([...headers, { id: nextPayloadRowId(headers), name: '', value: '' }])
  const removeHeader = (index: number) =>
    onChange(headers.filter((_, headerIndex) => headerIndex !== index))

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label">{t('configPage.payload.headers')}</p>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={disabled || hasBlankHeader}
          onClick={addHeader}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addHeader')}
        </Button>
      </div>
      {hasBlankHeader ? (
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.completeCurrentHeaderFirst')}
        </p>
      ) : null}
      {headers.length === 0 ? (
        <p className="text-muted-foreground text-meta py-2">
          {t('configPage.payload.emptyHeaders')}
        </p>
      ) : (
        <div className="grid gap-2">
          <div className="hidden gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <TableHeaderCell
              label={t('configPage.payload.headerName')}
              description={t('configPage.payload.headerNameHelp')}
              fieldLabel
            />
            <TableHeaderCell
              label={t('configPage.payload.headerValue')}
              description={t('configPage.payload.headerValueHelp')}
              fieldLabel
            />
            <div aria-hidden="true" />
          </div>
          {headers.map((header, index) => {
            const validationError = headerIssues[index]

            return (
              <div key={header.id} className="grid gap-1.5">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <PayloadFormField
                    label={t('configPage.payload.headerName')}
                    labelClassName="sm:sr-only"
                    error={validationError && t(`configPage.payload.validation.${validationError}`)}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        value={header.name}
                        disabled={disabled}
                        className="font-mono"
                        placeholder={t('configPage.payload.headerNamePlaceholder')}
                        onChange={(event) => updateHeader(index, { name: event.target.value })}
                      />
                    )}
                  </PayloadFormField>
                  <label className={fieldClassName}>
                    <span className="text-label sm:sr-only">
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PayloadValueField({
  label,
  param,
  error,
  rawValues = false,
  disabled,
  onChange,
}: {
  label: string
  param: PayloadParamEntry
  error?: string | null
  rawValues?: boolean
  disabled: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <PayloadFormField
      key={param.valueType}
      label={label}
      labelClassName="lg:sr-only"
      required={param.valueType !== 'string'}
      error={error}
    >
      {(control) => {
        if (rawValues || param.valueType === 'json')
          return (
            <Textarea
              {...control}
              value={param.value}
              disabled={disabled}
              rows={2}
              className="font-mono"
              placeholder={t(
                rawValues
                  ? 'configPage.payload.rawValuePlaceholder'
                  : 'configPage.payload.jsonValuePlaceholder',
              )}
              onChange={(event) => onChange(event.target.value)}
            />
          )
        if (param.valueType === 'boolean')
          return (
            <Select value={param.value} disabled={disabled} onValueChange={onChange}>
              <SelectTrigger {...control}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t('configPage.payload.booleanTrue')}</SelectItem>
                <SelectItem value="false">{t('configPage.payload.booleanFalse')}</SelectItem>
              </SelectContent>
            </Select>
          )
        return (
          <Input
            {...control}
            value={param.value}
            disabled={disabled}
            className="font-mono"
            placeholder={t(`configPage.payload.valuePlaceholders.${param.valueType}`)}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      }}
    </PayloadFormField>
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
  conditions: PayloadConditionEntry[]
  disabled: boolean
  onChange: (conditions: PayloadConditionEntry[]) => void
}) {
  const { t } = useTranslation()
  const valueMemory = useRef<Record<number, Partial<Record<PayloadParamValueType, string>>>>({})
  const hasBlankCondition = hasBlankPayloadCondition(conditions)
  const updateCondition = (index: number, patch: Partial<PayloadParamEntry>) => {
    onChange(
      conditions.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)),
    )
  }
  const updateConditionValueType = (
    index: number,
    condition: PayloadConditionEntry,
    valueType: PayloadParamValueType,
  ) => {
    const memory = valueMemory.current[condition.id] ?? {}
    memory[condition.valueType] = condition.value
    valueMemory.current[condition.id] = memory
    updateCondition(index, {
      valueType,
      value: memory[valueType] ?? getDefaultPayloadParamValue(valueType),
    })
  }
  const addCondition = () =>
    onChange([
      ...conditions,
      { id: nextPayloadRowId(conditions), path: '', valueType: 'string', value: '' },
    ])
  const removeCondition = (index: number) => {
    delete valueMemory.current[conditions[index].id]
    onChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={disabled || hasBlankCondition}
          onClick={addCondition}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addCondition')}
        </Button>
      </div>
      {hasBlankCondition ? (
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.completeCurrentConditionFirst')}
        </p>
      ) : null}
      {conditions.length === 0 ? (
        <p className="text-muted-foreground text-meta py-2">{emptyLabel}</p>
      ) : (
        <div className="grid gap-2">
          <div className="hidden gap-2 lg:grid lg:grid-cols-[minmax(0,0.8fr)_9rem_minmax(0,1.2fr)_auto]">
            <TableHeaderCell
              label={t('configPage.payload.conditionPath')}
              description={t('configPage.payload.conditionPathHelp')}
              fieldLabel
            />
            <TableHeaderCell
              label={t('configPage.payload.valueType')}
              description={t('configPage.payload.valueTypeHelp')}
              fieldLabel
            />
            <TableHeaderCell
              label={t('configPage.payload.conditionValue')}
              description={t('configPage.payload.conditionValueHelp')}
              fieldLabel
            />
            <div aria-hidden="true" />
          </div>
          {conditions.map((condition, index) => {
            const validationError = getPayloadConditionValidationError(condition)

            return (
              <div key={condition.id} className="grid gap-1.5">
                <div className="grid gap-2 lg:grid-cols-[minmax(0,0.8fr)_9rem_minmax(0,1.2fr)_auto]">
                  <PayloadFormField
                    label={t('configPage.payload.conditionPath')}
                    labelClassName="lg:sr-only"
                    error={
                      validationError === 'conditionPath'
                        ? t('configPage.payload.validation.conditionPath')
                        : null
                    }
                  >
                    {(control) => (
                      <Input
                        {...control}
                        value={condition.path}
                        disabled={disabled}
                        className="font-mono"
                        placeholder={t('configPage.payload.conditionPathPlaceholder')}
                        onChange={(event) => updateCondition(index, { path: event.target.value })}
                      />
                    )}
                  </PayloadFormField>
                  <label className={fieldClassName}>
                    <span className="text-label lg:sr-only">
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
                  <PayloadValueField
                    param={condition}
                    label={t('configPage.payload.conditionValue')}
                    disabled={disabled}
                    error={
                      validationError && validationError !== 'conditionPath'
                        ? t(`configPage.payload.validation.${validationError}`)
                        : null
                    }
                    onChange={(value) => updateCondition(index, { value })}
                  />
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
  required = false,
  onChange,
}: {
  title: string
  emptyLabel: string
  paths: string[]
  disabled: boolean
  required?: boolean
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={disabled || hasBlankPath}
          data-draft-missing={(required && !paths.length) || undefined}
          onClick={addPath}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t(required ? 'configPage.payload.replace.addPath' : 'configPage.payload.addPath')}
        </Button>
      </div>
      {hasBlankPath ? (
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.completeCurrentPathFirst')}
        </p>
      ) : null}
      {paths.length === 0 ? (
        <p className="text-muted-foreground text-meta py-2">{emptyLabel}</p>
      ) : (
        <div className="grid gap-2">
          <div className="hidden gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
            <TableHeaderCell
              label={t('configPage.payload.conditionPath')}
              description={required ? undefined : t('configPage.payload.conditionPathHelp')}
              fieldLabel
            />
            <div aria-hidden="true" />
          </div>
          {paths.map((path, index) => (
            <div key={index} className="grid gap-1.5">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                {required ? (
                  <PayloadFormField
                    label={t('configPage.payload.replace.pathEntry', { index: index + 1 })}
                    labelClassName="sm:sr-only"
                    required
                    error={
                      !path.trim()
                        ? t('configPage.payload.ruleIssues.replacePathsRequired')
                        : undefined
                    }
                  >
                    {(control) => (
                      <Textarea
                        {...control}
                        rows={1}
                        value={path}
                        disabled={disabled}
                        className="font-mono"
                        placeholder="metadata.description"
                        onChange={(event) => updatePath(index, event.target.value)}
                      />
                    )}
                  </PayloadFormField>
                ) : (
                  <label className={fieldClassName}>
                    <span className="text-label sm:sr-only">
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
                )}
                <Button
                  type="button"
                  variant="text"
                  size="lg"
                  disabled={disabled}
                  aria-label={
                    required
                      ? t('configPage.payload.replace.removePath', { index: index + 1 })
                      : undefined
                  }
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

function PayloadReplaceTargetFields({
  target,
  disabled,
  onChange,
}: {
  target: PayloadReplaceDraft['target']
  disabled: boolean
  onChange: (target: PayloadReplaceDraft['target']) => void
}) {
  const { t } = useTranslation()
  const issue = getPayloadReplaceTargetIssue(target)
  return (
    <div className="grid min-w-0 gap-3 border-t pt-4">
      <PayloadFormField
        label={t('configPage.payload.replace.target')}
        hint={
          target.mode === 'paths'
            ? t('configPage.payload.replace.pathsHint')
            : target.mode !== 'user'
              ? t('configPage.payload.replace.systemHint')
              : undefined
        }
      >
        {(control) => (
          <Select
            disabled={disabled}
            value={target.mode}
            onValueChange={(next) => {
              const mode = payloadReplaceTargetModes.find((option) => option === next)
              if (mode)
                onChange({
                  ...target,
                  mode,
                  paths: mode === 'paths' && !target.paths.length ? [''] : target.paths,
                })
            }}
          >
            <SelectTrigger {...control} className="sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {payloadReplaceTargetModes.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`configPage.payload.replace.targets.${mode}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PayloadFormField>
      {target.mode === 'paths' ? (
        <PayloadPathListRows
          title={t('configPage.payload.replace.targets.paths')}
          emptyLabel={t('configPage.payload.ruleIssues.replacePathsRequired')}
          paths={target.paths}
          disabled={disabled}
          required
          onChange={(paths) => onChange({ ...target, paths })}
        />
      ) : (
        <>
          <RadioGroup
            value={target.all ? 'all' : 'positions'}
            disabled={disabled}
            aria-label={t('configPage.payload.replace.messageScope')}
            className="flex flex-col gap-2 sm:flex-row sm:gap-4"
            onValueChange={(mode) => onChange({ ...target, all: mode === 'all' })}
          >
            <label className="text-body min-h-control-lg flex items-center gap-2">
              <RadioGroupItem value="positions" />
              {t('configPage.payload.replace.selectedPositions')}
            </label>
            <label className="text-body min-h-control-lg flex items-center gap-2">
              <RadioGroupItem value="all" />
              {t('configPage.payload.replace.allMessages')}
            </label>
          </RadioGroup>
          {!target.all ? (
            <PayloadFormField
              label={t('configPage.payload.replace.positions')}
              required
              error={issue && t(`configPage.payload.ruleIssues.${issue}`)}
              hint={t('configPage.payload.replace.positionsHint')}
            >
              {(control) => (
                <Input
                  {...control}
                  value={target.positions}
                  disabled={disabled}
                  className="font-mono sm:max-w-xs"
                  placeholder={t('configPage.payload.replace.positionsPlaceholder')}
                  onChange={(event) => onChange({ ...target, positions: event.target.value })}
                />
              )}
            </PayloadFormField>
          ) : null}
        </>
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
    <div className="grid min-w-0 gap-4 pt-2">
      <p className="text-muted-foreground text-meta">
        {t('configPage.payload.advancedMatchersSummary')}
      </p>
      <label className="grid max-w-sm gap-1.5">
        <span className="text-label">{t('configPage.payload.fromProtocol')}</span>
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
        <span className="text-muted-foreground text-meta">
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
  columns,
  protocolOptions,
  onChange,
  onRemove,
}: {
  model: PayloadModelEntry
  disabled: boolean
  canRemove: boolean
  columns: string
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
    <div className="grid min-w-0 grid-cols-1 gap-2">
      <div className={cn('grid min-w-0 grid-cols-1 items-start gap-2', columns)}>
        <PayloadFormField
          label={t('configPage.payload.modelName')}
          labelClassName="md:sr-only"
          required
          error={!model.name.trim() ? t('configPage.payload.ruleIssues.modelRequired') : null}
        >
          {(control) => (
            <Input
              {...control}
              value={model.name}
              disabled={disabled}
              className="font-mono"
              placeholder={t('configPage.payload.modelNamePlaceholder')}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          )}
        </PayloadFormField>
        <label className={fieldClassName}>
          <span className="text-label md:sr-only">{t('configPage.payload.protocol')}</span>
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
          aria-expanded={advancedExpanded}
          data-reveal-error={(!advancedExpanded && countPayloadModelIssues(model) > 0) || undefined}
          size="lg"
          className="w-full justify-start"
          title={
            advancedExpanded
              ? t('configPage.payload.hideAdvancedMatchers')
              : t('configPage.payload.advancedMatchers')
          }
          disabled={disabled}
          onClick={() => setAdvancedExpanded((expanded) => !expanded)}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span className="min-w-0 truncate">
            {advancedExpanded
              ? t('configPage.payload.hideAdvancedMatchers')
              : t('configPage.payload.advancedMatchers')}
          </span>
          {advancedCount > 0 ? (
            <span className="bg-background text-muted-foreground text-meta rounded-md border px-1.5 py-0.5">
              {advancedCount}
            </span>
          ) : null}
        </Button>
        {canRemove && (
          <Button type="button" variant="text" size="lg" disabled={disabled} onClick={onRemove}>
            {t('configPage.payload.remove')}
          </Button>
        )}
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
  const columns =
    rows.length > 1
      ? 'md:grid-cols-[minmax(0,1fr)_12rem_minmax(10.5rem,12rem)_4.5rem]'
      : 'md:grid-cols-[minmax(0,1fr)_12rem_minmax(10.5rem,12rem)]'
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
  const addModel = () => onChange([...rows, createPayloadModel({ id: nextPayloadRowId(rows) })])
  const removeModel = (index: number) => {
    onChange(rows.filter((_, modelIndex) => modelIndex !== index))
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label">{t('configPage.payload.models')}</p>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={disabled || hasBlankModel}
          onClick={addModel}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('configPage.payload.addModel')}
        </Button>
      </div>
      {showBlankModelHint ? (
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.completeCurrentModelFirst')}
        </p>
      ) : null}
      <div className="grid gap-2">
        <div className={cn('hidden gap-2 md:grid', columns)}>
          <TableHeaderCell
            label={t('configPage.payload.modelName')}
            description={t('configPage.payload.modelNameHelp')}
            fieldLabel
          />
          <TableHeaderCell
            label={t('configPage.payload.protocol')}
            description={t('configPage.payload.protocolHelp')}
            fieldLabel
          />
        </div>
        {rows.map((model, index) => (
          <PayloadModelRow
            key={model.id}
            model={model}
            disabled={disabled}
            canRemove={rows.length > 1}
            columns={columns}
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
  params: PayloadRule['params']
  disabled: boolean
  rawValues: boolean
  onChange: (params: PayloadRule['params']) => void
}) {
  const { t } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const valueMemory = useRef<Record<number, Partial<Record<PayloadParamValueType, string>>>>({})
  const updateParam = (index: number, patch: Partial<PayloadParamEntry>) => {
    onChange(params.map((param, i) => (i === index ? { ...param, ...patch } : param)))
  }
  const addParam = () => {
    const id = nextPayloadRowId(params)
    onChange([...params, createPayloadParam(rawValues, id)])
    window.requestAnimationFrame(() =>
      container.current?.querySelector<HTMLInputElement>(`[data-param-id="${id}"]`)?.focus(),
    )
  }
  const removeParam = (index: number) => {
    delete valueMemory.current[params[index].id]
    onChange(params.filter((_, i) => i !== index))
  }
  const columns = rawValues
    ? 'lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto]'
    : 'lg:grid-cols-[minmax(0,0.8fr)_9rem_minmax(0,1.2fr)_auto]'
  const pathIssues = getPayloadParamPathIssues(params)
  return (
    <div ref={container} className="grid min-w-0 gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label">{t('configPage.payload.params')}</p>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={disabled || hasBlankPayloadParam(params)}
          data-draft-missing={params.length === 0 || undefined}
          onClick={addParam}
        >
          <Plus aria-hidden="true" />
          {t('configPage.payload.addParam')}
        </Button>
      </div>
      {params.length === 0 ? (
        <p className="text-muted-foreground text-meta">{t('configPage.payload.emptyParams')}</p>
      ) : (
        <div className={cn('grid gap-x-2 gap-y-3', columns)}>
          <div className="hidden lg:col-span-full lg:grid lg:grid-cols-subgrid">
            <TableHeaderCell
              label={t('configPage.payload.paramPath')}
              description={t('configPage.payload.paramPathHelp')}
              fieldLabel
            />
            {!rawValues && (
              <TableHeaderCell
                label={t('configPage.payload.valueType')}
                description={t('configPage.payload.valueTypeHelp')}
                fieldLabel
              />
            )}
            <TableHeaderCell
              label={t('configPage.payload.paramValue')}
              description={t(
                rawValues ? 'configPage.payload.rawValueHelp' : 'configPage.payload.paramValueHelp',
              )}
              fieldLabel
            />
          </div>
          {params.map((param, index) => {
            const pathError = pathIssues[index]
            const valueError = getPayloadParamValidationError(param, rawValues)
            return (
              <div
                key={param.id}
                className="grid min-w-0 items-start gap-2 border-t pt-3 lg:col-span-full lg:grid-cols-subgrid lg:border-0 lg:pt-0"
              >
                <PayloadFormField
                  label={t('configPage.payload.paramPath')}
                  labelClassName="lg:sr-only"
                  required
                  error={pathError && t(`configPage.payload.ruleIssues.${pathError}`)}
                >
                  {(control) => (
                    <Input
                      {...control}
                      data-param-id={param.id}
                      value={param.path}
                      disabled={disabled}
                      className="font-mono"
                      placeholder={t('configPage.payload.paramPathPlaceholder')}
                      onChange={(event) => updateParam(index, { path: event.target.value })}
                    />
                  )}
                </PayloadFormField>
                {!rawValues && (
                  <label className={fieldClassName}>
                    <span className="text-label lg:sr-only">
                      {t('configPage.payload.valueType')}
                    </span>
                    <Select
                      value={param.valueType}
                      disabled={disabled}
                      onValueChange={(type) => {
                        const valueType = type as PayloadParamValueType
                        const memory = valueMemory.current[param.id] ?? {}
                        memory[param.valueType] = param.value
                        valueMemory.current[param.id] = memory
                        updateParam(index, {
                          valueType,
                          value: memory[valueType] ?? getDefaultPayloadParamValue(valueType),
                        })
                      }}
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
                <PayloadValueField
                  param={param}
                  label={t('configPage.payload.paramValue')}
                  rawValues={rawValues}
                  disabled={disabled}
                  error={valueError && t(`configPage.payload.validation.${valueError}`)}
                  onChange={(value) => updateParam(index, { value })}
                />
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
  params: PayloadFilterRule['params']
  disabled: boolean
  onChange: (params: PayloadFilterRule['params']) => void
}) {
  const { t } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const addParam = () => {
    const id = nextPayloadRowId(params)
    onChange([...params, { id, path: '' }])
    window.requestAnimationFrame(() =>
      container.current?.querySelector<HTMLInputElement>(`[data-param-id="${id}"]`)?.focus(),
    )
  }
  return (
    <div ref={container} className="grid min-w-0 gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label">{t('configPage.payload.removeParams')}</p>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={disabled || hasBlankPayloadParam(params)}
          data-draft-missing={params.length === 0 || undefined}
          onClick={addParam}
        >
          <Plus aria-hidden="true" />
          {t('configPage.payload.addParam')}
        </Button>
      </div>
      {params.length === 0 ? (
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.emptyFilterParams')}
        </p>
      ) : (
        <div className="grid gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="hidden sm:col-span-full sm:grid sm:grid-cols-subgrid">
            <TableHeaderCell
              label={t('configPage.payload.paramPath')}
              description={t('configPage.payload.filterParamPathHelp')}
              fieldLabel
            />
          </div>
          {params.map((param, index) => (
            <div
              key={param.id}
              className="grid items-start gap-2 sm:col-span-full sm:grid-cols-subgrid"
            >
              <PayloadFormField
                label={t('configPage.payload.paramPath')}
                labelClassName="sm:sr-only"
                required
                error={
                  !param.path.trim() ? t('configPage.payload.ruleIssues.paramPathRequired') : null
                }
              >
                {(control) => (
                  <Input
                    {...control}
                    data-param-id={param.id}
                    value={param.path}
                    disabled={disabled}
                    className="font-mono"
                    placeholder={t('configPage.payload.paramPathPlaceholder')}
                    onChange={(event) =>
                      onChange(
                        params.map((current, i) =>
                          i === index ? { ...current, path: event.target.value } : current,
                        ),
                      )
                    }
                  />
                )}
              </PayloadFormField>
              <Button
                type="button"
                variant="text"
                size="lg"
                disabled={disabled}
                onClick={() => {
                  onChange(params.filter((_, i) => i !== index))
                }}
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

function savedPayloadIdentities(config: PayloadRulesConfig, editorId: string) {
  return Object.fromEntries(
    payloadSectionKeys.map((key) => [
      key,
      config[key].map((_, index) => ({
        id: `payload-rule-${editorId}-${key}-${index}`,
        isNew: false,
      })),
    ]),
  ) as Record<PayloadSectionKey, PayloadRuleIdentity[]>
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
  const snapshot = useContext(PayloadSnapshotContext)
  const previousRevision = useRef(snapshot?.revision)
  const savedValue = snapshot?.value
  const savedConfig = useMemo(
    () => normalizePayloadConfig(JSON.parse(String(savedValue || '{}'))),
    [savedValue],
  )
  const editorId = useId()
  const nextDraftId = useRef(0)
  const [activeIntent, setActiveIntent] = useState<PayloadRuleIntentId>(
    () =>
      payloadRuleIntentGroups.find((intent) => intent.sectionKeys.some((key) => value[key].length))
        ?.id ?? 'fill',
  )
  // Identities belong to this editing session, never to the saved API payload.
  const [identities, setIdentities] = useState(() => savedPayloadIdentities(value, editorId))
  const [expanded, setExpanded] = useState<Partial<Record<PayloadRuleIntentId, string>>>({})
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({})
  const [removedRule, setRemovedRule] = useState<
    | (RemovedPayloadRule & {
        identity: PayloadRuleIdentity
      })
    | null
  >(null)
  const [removing, setRemoving] = useState<{ sectionKey: PayloadSectionKey; index: number } | null>(
    null,
  )
  const newIdentity = (): PayloadRuleIdentity => ({
    id: `payload-rule-${editorId}-new-${++nextDraftId.current}`,
    isNew: true,
  })
  const [reviewedField, setReviewedField] = useState<string | null>(null)
  const afterRemovalFocus = useRef<string | null>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [orderFeedback, setOrderFeedback] = useState('')
  useEffect(() => {
    if (!snapshot || previousRevision.current === snapshot.revision) return
    previousRevision.current = snapshot.revision
    setIdentities(savedPayloadIdentities(savedConfig, editorId))
    setExpanded({})
    setReviewedField(null)
    setPreviewTexts({})
    setRemovedRule(null)
    setRemoving(null)
    setOrderFeedback('')
  }, [snapshot, savedConfig, editorId])
  const totalRules = countPayloadRules(value)
  const totalDrafts = countPayloadConfigDrafts(value)
  const currentIntent = payloadRuleIntentGroups.find((intent) => intent.id === activeIntent)!
  const categoryCount = currentIntent.sectionKeys.reduce((sum, key) => sum + value[key].length, 0)
  const affectedTargets = getPayloadAffectedTargets(value)
  const targets =
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
  const updateSection = (sectionKey: PayloadSectionKey, rules: AnyPayloadRule[]) => {
    onChange({ ...value, [sectionKey]: rules })
  }
  const focusRule = (
    identity: PayloadRuleIdentity,
    sectionKey: PayloadSectionKey,
    focus: 'trigger' | 'model' | 'issue' = 'trigger',
  ) => {
    const intent = getPayloadRuleIntent(sectionKey)
    setActiveIntent(intent)
    setExpanded((current) => ({ ...current, [intent]: identity.id }))
    const focusField = (revealAdvanced = true) => {
      const row = document.getElementById(identity.id)
      if (!row) return
      const field =
        focus === 'issue'
          ? row.querySelector<HTMLElement>(
              '[aria-invalid="true"], [data-draft-missing], [data-reveal-error]',
            )
          : focus === 'model'
            ? row.querySelector<HTMLElement>('input')
            : null
      if (revealAdvanced && field?.hasAttribute('data-reveal-error')) {
        field.click()
        window.requestAnimationFrame(() => focusField(false))
        return
      }
      const target = field ?? document.getElementById(`${identity.id}-trigger`)
      if (!target) return
      if (focus === 'issue') setReviewedField(target.id)
      scrollToConfigTarget(field?.closest('label') ?? field ?? row)
      target.focus({ preventScroll: true })
    }
    // The destination tab and any newly expanded fields must be mounted before measuring.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => focusField()))
  }
  const nextRuleNumber = () => {
    const numbers = currentIntent.sectionKeys.flatMap((key) =>
      value[key].map((rule) => rule.displayNumber),
    )
    if (removedRule && getPayloadRuleIntent(removedRule.sectionKey) === activeIntent)
      numbers.push(removedRule.rule.displayNumber)
    return Math.max(0, ...numbers) + 1
  }
  const addRule = () => {
    const sectionKey = currentIntent.sectionKeys[0]
    const number = nextRuleNumber()
    const rule =
      sectionKey === 'replace'
        ? createPayloadReplaceRule(number)
        : sectionKey === 'filter'
          ? createPayloadFilterRule(number)
          : createPayloadRule(number)
    const identity = newIdentity()
    setIdentities((current) => ({ ...current, [sectionKey]: [...current[sectionKey], identity] }))
    updateSection(sectionKey, [...value[sectionKey], rule])
    focusRule(identity, sectionKey, 'model')
  }
  const findDraft = () => {
    const draft = findPayloadDraft(value)
    if (draft) focusRule(identities[draft.sectionKey][draft.index], draft.sectionKey, 'issue')
  }
  const updateRule = (sectionKey: PayloadSectionKey, index: number, rule: AnyPayloadRule) => {
    updateSection(
      sectionKey,
      value[sectionKey].map((current, i) => (i === index ? rule : current)),
    )
  }
  const duplicateRule = (sectionKey: PayloadSectionKey, index: number) => {
    const source = value[sectionKey][index]
    const rule =
      sectionKey === 'replace'
        ? clonePayloadReplaceRule(source as PayloadReplaceRule)
        : sectionKey === 'filter'
          ? clonePayloadFilterRule(source as PayloadFilterRule)
          : clonePayloadRule(source as PayloadRule)
    const identity = newIdentity()
    setIdentities((current) => ({
      ...current,
      [sectionKey]: insertAt(current[sectionKey], index + 1, identity),
    }))
    updateSection(
      sectionKey,
      insertAt<AnyPayloadRule>(value[sectionKey], index + 1, {
        ...rule,
        displayNumber: nextRuleNumber(),
      }),
    )
    focusRule(identity, sectionKey)
  }
  const moveRule = (index: number, direction: number) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= value.replace.length) return
    const rules = [...value.replace]
    ;[rules[index], rules[nextIndex]] = [rules[nextIndex], rules[index]]
    setIdentities((current) => {
      const next = [...current.replace]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return { ...current, replace: next }
    })
    updateSection('replace', rules)
    setOrderFeedback(t('configPage.payload.workspace.ruleMoved', { position: nextIndex + 1 }))
  }
  const changeValueMode = (sectionKey: PayloadRuleSection, index: number, raw: boolean) => {
    if (sectionKey.endsWith('-raw') === raw) return
    const nextKey =
      `${sectionKey.startsWith('default') ? 'default' : 'override'}${raw ? '-raw' : ''}` as PayloadRuleSection
    const identity = identities[sectionKey][index]
    const currentRule = value[sectionKey][index]
    const rule = {
      ...currentRule,
      params: currentRule.params.map((param) => ({
        ...param,
        ...convertPayloadParamValue(param, raw),
      })),
    }
    setIdentities((current) => ({
      ...current,
      [sectionKey]: current[sectionKey].filter((_, i) => i !== index),
      [nextKey]: [...current[nextKey], identity],
    }))
    onChange({
      ...value,
      [sectionKey]: value[sectionKey].filter((_, i) => i !== index),
      [nextKey]: [...value[nextKey], rule],
    })
    // A mode change can move the row in execution order. Keep keyboard focus on its selector.
    window.requestAnimationFrame(() => document.getElementById(`${identity.id}-mode`)?.focus())
  }
  const removeRule = () => {
    if (!removing) return
    const { sectionKey, index } = removing
    const rule = value[sectionKey][index]
    const identity = identities[sectionKey][index]
    const categoryRows = currentIntent.sectionKeys.flatMap((key) => identities[key])
    const position = categoryRows.findIndex((item) => item.id === identity.id)
    const remaining = categoryRows.filter((item) => item.id !== identity.id)
    const next = remaining[Math.min(position, remaining.length - 1)]
    afterRemovalFocus.current = next ? `${next.id}-trigger` : `payload-add-rule-${activeIntent}`
    const copy =
      sectionKey === 'replace'
        ? clonePayloadReplaceRule(rule as PayloadReplaceRule)
        : sectionKey === 'filter'
          ? clonePayloadFilterRule(rule as PayloadFilterRule)
          : clonePayloadRule(rule as PayloadRule)
    setRemovedRule({ sectionKey, index, rule: copy, identity } as RemovedPayloadRule & {
      identity: PayloadRuleIdentity
    })
    setIdentities((current) => ({
      ...current,
      [sectionKey]: current[sectionKey].filter((_, i) => i !== index),
    }))
    updateSection(
      sectionKey,
      value[sectionKey].filter((_, i) => i !== index),
    )
    setRemoving(null)
  }
  const restoreRemovedRule = () => {
    if (!removedRule) return
    const { sectionKey, index, rule, identity } = removedRule
    setIdentities((current) => ({
      ...current,
      [sectionKey]: insertAt(current[sectionKey], index, identity),
    }))
    updateSection(sectionKey, insertAt<AnyPayloadRule>(value[sectionKey], index, rule))
    setRemovedRule(null)
    focusRule(identity, sectionKey)
  }
  const removingIdentity = removing ? identities[removing.sectionKey][removing.index] : null

  const renderRule = (sectionKey: PayloadSectionKey, rule: AnyPayloadRule, index: number) => {
    const identity = identities[sectionKey][index]
    if (!identity) return null
    const isExpanded = expanded[activeIntent] === identity.id
    const issueCount = countPayloadRuleIssues(rule, sectionKey)
    const title = t('configPage.payload.ruleTitle', { index: rule.displayNumber })
    const model = getPayloadRuleModel(rule)
    const readOnly = 'original' in rule
    const replacement = 'replacements' in rule ? rule : null
    const first = readOnly ? rule.details.first : replacement?.replacements[0]
    const action = first?.from
      ? first.to
        ? t('configPage.payload.replace.actionSummary', {
            from: operandExcerpt(first.from),
            to: operandExcerpt(first.to),
          })
        : t('configPage.payload.replace.deleteSummary', { from: operandExcerpt(first.from) })
      : ''
    const firstPath =
      'params' in rule ? rule.params.map((param) => param.path.trim()).find(Boolean) : ''
    const rowTitle = [title, model].filter(Boolean).join(' · ')
    const canMove = (direction: number) => {
      const adjacent = value.replace[index + direction]
      return Boolean(replacement && adjacent && !('original' in adjacent))
    }
    const canMoveUp = canMove(-1)
    const canMoveDown = canMove(1)
    const showMove = canMoveUp || canMoveDown
    const summary = readOnly
      ? t('configPage.payload.workspace.readOnly')
      : replacement
        ? t('configPage.payload.replace.ruleSummary', {
            models: rule.models.filter((m) => m.name.trim()).length,
            count: replacement.replacements.length,
          })
        : t('configPage.payload.ruleSummary', {
            models: rule.models.filter((m) => m.name.trim()).length,
            params: (rule as PayloadRule | PayloadFilterRule).params.length,
          })
    return (
      <div
        key={identity.id}
        id={identity.id}
        role="group"
        aria-label={title}
        className="grid min-w-0 gap-4 border-t py-4"
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Button
              id={`${identity.id}-trigger`}
              type="button"
              variant="text"
              size="md"
              className="text-foreground max-w-full justify-start"
              aria-expanded={isExpanded}
              aria-controls={isExpanded ? `${identity.id}-body` : undefined}
              onClick={() =>
                setExpanded((current) => ({
                  ...current,
                  [activeIntent]: isExpanded ? undefined : identity.id,
                }))
              }
            >
              <ChevronDown aria-hidden="true" className={isExpanded ? 'rotate-180' : undefined} />
              <span className="truncate" title={rowTitle}>
                {rowTitle}
              </span>
            </Button>
            <p className="text-muted-foreground text-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {!isExpanded && (action || firstPath) ? (
                <code className="text-code max-w-full truncate" title={action || firstPath}>
                  {action || firstPath}
                </code>
              ) : null}
              {!isExpanded && currentIntent.sectionKeys.length > 1 ? (
                <span>
                  {t(
                    sectionKey.endsWith('-raw')
                      ? 'configPage.payload.workspace.rawMode'
                      : 'configPage.payload.workspace.typedMode',
                  )}
                </span>
              ) : null}
              <span>{summary}</span>
              {readOnly && rule.details.scope ? (
                <code className="text-code max-w-full truncate" title={rule.details.scope}>
                  {rule.details.scope}
                </code>
              ) : null}
              {first?.kind === 'regex' ? <code className="text-code">RE2</code> : null}
              {sectionKey === 'replace' && value.replace.length > 1 ? (
                <span>
                  {t('configPage.payload.workspace.executionPosition', { position: index + 1 })}
                </span>
              ) : null}
              {replacement ? (
                <span>
                  {replacement.target.mode === 'paths'
                    ? t('configPage.payload.replace.pathSummary', {
                        count: replacement.target.paths.length,
                      })
                    : t(
                        replacement.target.all
                          ? 'configPage.payload.replace.allRoleMessages'
                          : 'configPage.payload.replace.rolePositions',
                        {
                          role: replacement.target.mode,
                          positions: replacement.target.positions,
                        },
                      )}
                </span>
              ) : null}
              {issueCount > 0 ? <span>{t('configPage.payload.workspace.incomplete')}</span> : null}
              {identity.isNew ? <span>{t('configPage.payload.workspace.unsavedRule')}</span> : null}
            </p>
          </div>
          {!readOnly ? (
            <RowActions
              menuLabel={title}
              className="shrink-0"
              actions={[
                showMove && {
                  id: 'up',
                  label: t('configPage.payload.replace.moveUp'),
                  ariaLabel: t('configPage.payload.replace.moveRuleUp', {
                    index: rule.displayNumber,
                  }),
                  icon: ArrowUp,
                  disabled: disabled || !canMoveUp,
                  onSelect: () => moveRule(index, -1),
                },
                showMove && {
                  id: 'down',
                  label: t('configPage.payload.replace.moveDown'),
                  ariaLabel: t('configPage.payload.replace.moveRuleDown', {
                    index: rule.displayNumber,
                  }),
                  icon: ArrowDown,
                  disabled: disabled || !canMoveDown,
                  onSelect: () => moveRule(index, 1),
                },
                {
                  id: 'copy',
                  label: t('configPage.payload.duplicateRule'),
                  icon: Copy,
                  disabled: disabled || issueCount > 0,
                  onSelect: () => duplicateRule(sectionKey, index),
                },
                {
                  id: 'delete',
                  label: t(
                    identity.isNew
                      ? 'configPage.payload.workspace.discardNew'
                      : 'configPage.payload.removeRule',
                  ),
                  icon: Trash2,
                  tone: 'destructive',
                  disabled,
                  onSelect: () => setRemoving({ sectionKey, index }),
                },
              ]}
            />
          ) : null}
        </div>
        {isExpanded && readOnly ? (
          <div id={`${identity.id}-body`} className="grid min-w-0 gap-2">
            <p className="text-muted-foreground text-meta">
              {t('configPage.payload.workspace.readOnlyHint')}
            </p>
            <pre className="bg-muted/20 text-code max-h-80 overflow-auto rounded-md border p-3">
              {JSON.stringify(rule.original, null, 2)}
            </pre>
          </div>
        ) : isExpanded ? (
          <div id={`${identity.id}-body`} className="grid min-w-0 gap-5">
            <PayloadModelRows
              models={rule.models}
              disabled={disabled}
              onChange={(models) =>
                updateRule(
                  sectionKey,
                  index,
                  replacement
                    ? { ...replacement, models, savedModels: undefined }
                    : { ...rule, models },
                )
              }
            />
            {sectionKey === 'replace' ? (
              replacement && (
                <>
                  <PayloadReplaceTargetFields
                    target={replacement.target}
                    disabled={disabled}
                    onChange={(target) =>
                      updateRule(sectionKey, index, {
                        ...replacement,
                        target,
                        savedTarget: undefined,
                      })
                    }
                  />
                  <PayloadReplacementSteps
                    value={replacement.replacements}
                    disabled={disabled}
                    onChange={(replacements) =>
                      updateRule(sectionKey, index, { ...replacement, replacements })
                    }
                  />
                  <PayloadReplacePreview
                    rule={replacement}
                    disabled={disabled}
                    text={previewTexts[identity.id] ?? ''}
                    onTextChange={(text) =>
                      setPreviewTexts((current) => ({ ...current, [identity.id]: text }))
                    }
                  />
                </>
              )
            ) : sectionKey === 'filter' ? (
              <PayloadFilterParamRows
                params={(rule as PayloadFilterRule).params}
                disabled={disabled}
                onChange={(params) => updateRule(sectionKey, index, { ...rule, params })}
              />
            ) : (
              <>
                <div className="grid min-w-0 gap-1.5">
                  <label htmlFor={`${identity.id}-mode`} className="text-label">
                    {t('configPage.payload.workspace.valueMode')}
                  </label>
                  <Select
                    value={sectionKey.endsWith('-raw') ? 'raw' : 'typed'}
                    disabled={disabled}
                    onValueChange={(mode) => changeValueMode(sectionKey, index, mode === 'raw')}
                  >
                    <SelectTrigger
                      id={`${identity.id}-mode`}
                      data-payload-mode
                      aria-describedby={`${identity.id}-mode-help`}
                      className="sm:max-w-sm"
                      aria-label={t('configPage.payload.workspace.valueMode')}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent data-payload-mode>
                      <SelectItem value="typed">
                        {t('configPage.payload.workspace.typedMode')}
                      </SelectItem>
                      <SelectItem value="raw">
                        {t('configPage.payload.workspace.rawMode')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p id={`${identity.id}-mode-help`} className="text-muted-foreground text-meta">
                    {t('configPage.payload.workspace.valueModeHelp')}
                    {currentIntent.sectionKeys.some(
                      (key) => key !== sectionKey && value[key].length > 0,
                    ) && ` ${t('configPage.payload.workspace.modeMovesLast')}`}
                  </p>
                </div>
                <PayloadParamRows
                  params={(rule as PayloadRule).params}
                  disabled={disabled}
                  rawValues={sectionKey.endsWith('-raw')}
                  onChange={(params) => updateRule(sectionKey, index, { ...rule, params })}
                />
              </>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <PayloadReviewFieldContext.Provider value={reviewedField}>
      <div className="grid min-w-0 gap-4">
        {totalRules > 0 ? (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-meta min-w-0 break-words">
              <Trans
                i18nKey="configPage.payload.impactSummary"
                values={{ targets }}
                components={{
                  models: (
                    <bdi className="text-foreground text-body font-mono [overflow-wrap:anywhere]" />
                  ),
                }}
              />
            </p>
            <Button
              type="button"
              variant="text"
              size="md"
              aria-expanded={jsonOpen}
              aria-controls="payload-json-preview"
              onClick={() => setJsonOpen((open) => !open)}
            >
              <Code2 aria-hidden="true" />
              {t('configPage.payload.preview')}
            </Button>
          </div>
        ) : null}
        {jsonOpen && totalRules > 0 ? (
          <pre
            id="payload-json-preview"
            className="bg-muted/20 text-code max-h-80 overflow-auto rounded-md border p-3"
          >
            {JSON.stringify(serializePayloadConfig(value), null, 2)}
          </pre>
        ) : null}
        {totalDrafts > 0 ? (
          <div
            className="bg-muted/50 text-muted-foreground flex flex-col gap-2 rounded-md px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <p className="text-meta">
              {t('configPage.payload.workspace.draftNotice', { count: totalDrafts })}
            </p>
            <Button type="button" variant="text" size="md" onClick={findDraft}>
              {t('configPage.payload.workspace.goToDraft')}
            </Button>
          </div>
        ) : null}
        {removedRule ? (
          <div
            className="bg-warning/10 flex flex-col gap-2 rounded-md p-3 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <p className="text-meta">
              {t('configPage.payload.removedRuleNotice', {
                section: t(
                  `configPage.payload.intentOptions.${getPayloadRuleIntent(removedRule.sectionKey)}.title`,
                ),
              })}
            </p>
            <Button
              type="button"
              variant="text"
              size="md"
              disabled={disabled}
              onClick={restoreRemovedRule}
            >
              <Undo2 aria-hidden="true" />
              {t('configPage.payload.restoreRule')}
            </Button>
          </div>
        ) : null}
        {totalRules === 0 && countPayloadRules(savedConfig) > 0 ? (
          <p className="text-meta text-amber-700 dark:text-amber-300">
            {t('configPage.payload.emptyRootWarning')}
          </p>
        ) : null}
        <Tabs
          value={activeIntent}
          onValueChange={(intent) => {
            setActiveIntent(intent as PayloadRuleIntentId)
            setOrderFeedback('')
          }}
        >
          <TabsList
            aria-label={t('configPage.payload.workspace.categories')}
            className="grid w-full grid-cols-2 sm:flex sm:flex-wrap"
          >
            {payloadRuleIntentGroups.map((intent) => {
              const count = intent.sectionKeys.reduce((sum, key) => sum + value[key].length, 0)
              const drafts = intent.sectionKeys.reduce(
                (sum, key) => sum + countPayloadSectionDrafts(value, key),
                0,
              )
              return (
                <TabsTrigger
                  key={intent.id}
                  value={intent.id}
                  className="min-w-0 justify-start"
                  title={t(`configPage.payload.intentOptions.${intent.id}.title`)}
                  aria-label={[
                    t(`configPage.payload.intentOptions.${intent.id}.title`),
                    t('configPage.payload.totalRules', { count }),
                    drafts ? t('configPage.payload.draftCount', { count: drafts }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  <span className="min-w-0 truncate">
                    {t(`configPage.payload.workspace.categoryLabels.${intent.id}`)}
                  </span>
                  <span className="tabular-nums">{count}</span>
                  {drafts ? (
                    <span
                      className="bg-muted-foreground size-1.5 shrink-0 rounded-full"
                      role="img"
                      aria-label={t('configPage.payload.draftCount', { count: drafts })}
                    />
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>
          {payloadRuleIntentGroups.map((intent) => (
            <TabsContent key={intent.id} value={intent.id} className="pt-4">
              {activeIntent === intent.id ? (
                <>
                  <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    {categoryCount === 0 ? (
                      <p className="text-muted-foreground text-meta">
                        {t(`configPage.payload.workspace.emptyHints.${intent.id}`)}
                      </p>
                    ) : categoryCount > 1 ? (
                      <p className="text-muted-foreground text-meta">
                        {intent.sectionKeys.length > 1 &&
                          intent.sectionKeys.every((key) => value[key].length > 0) &&
                          `${t('configPage.payload.workspace.modeOrder')} `}
                        {t(`configPage.payload.workspace.orderHints.${intent.id}`)}
                      </p>
                    ) : null}
                    <Button
                      id={`payload-add-rule-${intent.id}`}
                      className="sm:ms-auto sm:shrink-0"
                      type="button"
                      size="md"
                      disabled={disabled}
                      onClick={addRule}
                    >
                      <Plus aria-hidden="true" />
                      {t('configPage.payload.workspace.addRule')}
                    </Button>
                  </div>
                  <p
                    className={orderFeedback ? 'text-meta text-muted-foreground mt-1' : 'sr-only'}
                    role="status"
                  >
                    {orderFeedback}
                  </p>
                  {intent.sectionKeys.flatMap((sectionKey) =>
                    value[sectionKey].map((rule, index) => renderRule(sectionKey, rule, index)),
                  )}
                </>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
        <AlertDialog
          open={removing !== null}
          onOpenChange={(open) => {
            if (!open) setRemoving(null)
          }}
        >
          <AlertDialogContent
            className="max-h-[90dvh] overflow-y-auto"
            onCloseAutoFocus={(event) => {
              const targetId = afterRemovalFocus.current
              if (!targetId) return
              event.preventDefault()
              afterRemovalFocus.current = null
              window.requestAnimationFrame(() =>
                document.getElementById(targetId)?.focus({ preventScroll: true }),
              )
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(
                  removingIdentity?.isNew
                    ? 'configPage.payload.workspace.discardTitle'
                    : 'configPage.payload.replace.removeRuleTitle',
                  {
                    index: removing ? value[removing.sectionKey][removing.index]?.displayNumber : 1,
                  },
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  removingIdentity?.isNew
                    ? 'configPage.payload.workspace.discardDescription'
                    : 'configPage.payload.replace.deleteDescription',
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: 'destructive' })}
                disabled={disabled}
                onClick={removeRule}
              >
                {t(
                  removingIdentity?.isNew
                    ? 'configPage.payload.workspace.discardNew'
                    : 'configPage.payload.replace.confirmDelete',
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PayloadReviewFieldContext.Provider>
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
  const payload = useContext(PayloadSnapshotContext)

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
    case 'oauthModelSettingsJson':
      return (
        <OAuthModelSettingsEditor
          value={value as Record<string, unknown>}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case 'oauthModelAliasJson':
      return (
        <ModelAliasEditor
          availableChannels={modelDefinitionChannels}
          value={value as Record<string, unknown>}
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
    case 'payloadRulesJson':
      return (
        <PayloadRulesEditor
          value={payload?.draft ?? normalizePayloadConfig(value)}
          disabled={disabled}
          onChange={(nextValue) => {
            payload?.setDraft(nextValue)
            onChange(serializePayloadConfig(nextValue))
          }}
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
  saveError,
  onDiscardField,
  changes,
  validationErrors,
  onEditingIntegerChange,
  disabled,
  oauthModelCatalog,
  onChange,
}: {
  draft: ConfigStructuredValues
  saveError: ConfigFieldSaveError | null
  onDiscardField: (key: WritableConfigFieldKey) => void
  changes: ConfigChange[]
  validationErrors: ConfigFieldKey[]
  onEditingIntegerChange: (key: ConfigFieldKey | null) => void
  disabled: boolean
  oauthModelCatalog: OAuthModelCatalogState | null
  onChange: (key: ConfigFieldKey, value: ConfigFieldValue) => void
}) {
  const { t } = useTranslation()
  const [networkPanel, setNetworkPanel] = useState<NetworkProxyPanel>('current')

  const renderField = (field: ConfigFieldDefinition) => {
    const fieldError = saveError?.key === field.key ? saveError : null
    const fieldId = `config-field-${field.key}`
    return (
      <div
        key={field.key}
        id={fieldId}
        className="min-w-0"
        role="group"
        aria-label={t(`configPage.fields.${field.key}.label`)}
        aria-describedby={fieldError ? fieldId + '-feedback' : undefined}
      >
        {field.kind === 'literalReplacements' || field.kind === 'patternReplacements' ? (
          <SensitiveReplacementEditor
            kind={field.kind}
            title={t(`configPage.fields.${field.key}.label`)}
            rows={parseReplacementDraft(draft[field.key])}
            disabled={disabled}
            onChange={(rows) => onChange(field.key, stringifyJson(rows))}
          />
        ) : isJsonConfigFieldKey(field.key) ? (
          <JsonConfigField
            field={field as ConfigFieldDefinition & { key: JsonConfigFieldKey }}
            value={String(draft[field.key])}
            disabled={disabled}
            invalid={validationErrors.includes(field.key)}
            oauthModelCatalog={oauthModelCatalog}
            onChange={onChange}
          />
        ) : (
          <ConfigField
            field={field}
            value={draft[field.key]}
            disabled={disabled}
            invalid={validationErrors.includes(field.key)}
            onEditingIntegerChange={onEditingIntegerChange}
            onChange={onChange}
          />
        )}
        {fieldError ? (
          <div id={fieldId + '-feedback'} className="mt-1 flex flex-wrap items-center gap-x-2">
            <p role="alert" className="text-destructive text-sm">
              {fieldError.reason === 'conflict'
                ? t('configPage.validation.editConflict')
                : t(`configPage.compatibility.${fieldError.reason}`)}
            </p>
            {fieldError.status ? (
              <span className="text-meta text-muted-foreground">HTTP {fieldError.status}</span>
            ) : null}
            {changes.some((change) => change.key === fieldError.key) ? (
              <Button
                type="button"
                size="sm"
                variant="text"
                disabled={disabled}
                onClick={() => onDiscardField(fieldError.key)}
              >
                {t('configPage.compatibility.discardField')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <SectionNavigation changes={changes} validationErrors={validationErrors} />
      <div className="grid min-w-0 gap-4">
        {sectionDefinitions.map((section) => (
          <section
            key={section.id}
            id={`config-section-${section.id}`}
            className="bg-card min-w-0 scroll-mt-24 rounded-lg border p-4 shadow-sm"
          >
            {(() => {
              const SectionIcon = sectionIcons[section.id]

              return (
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
                    <SectionIcon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-section-title">
                      {t(`configPage.sections.${section.id}.title`)}
                    </h2>
                    <p
                      className={
                        section.id === 'payload'
                          ? 'text-meta text-muted-foreground mt-1'
                          : 'text-muted-foreground mt-1 text-sm leading-6'
                      }
                    >
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
                  <div className="grid gap-3">{section.fields.map(renderField)}</div>
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
  hasConflictingChanges,
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
  hasConflictingChanges: boolean
  onOpenChanges: () => void
  onReload: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const dirty = changeCount > 0
  const barRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const bar = barRef.current
    const workspace = bar?.closest<HTMLElement>('[data-config-workbench]')
    if (!bar || !workspace) return
    // Localized badges can add rows; the outline must follow the whole bar.
    const syncHeight = () =>
      workspace.style.setProperty(
        '--config-action-height',
        `${bar.getBoundingClientRect().height}px`,
      )
    syncHeight()
    const observer = new ResizeObserver(syncHeight)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={barRef}
      data-config-sticky
      className="bg-background/95 sticky -top-4 z-[var(--z-page-sticky)] -mx-4 px-4 py-3 backdrop-blur md:-top-6 md:-mx-6 md:px-6"
    >
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
            {hasConflictingChanges && (
              <span role="alert" className="text-destructive text-meta">
                {t('configPage.validation.runtimeChanged')}
              </span>
            )}
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

function ConfigChangePreview({
  change,
  payloadDraft,
}: {
  change: ConfigChange
  payloadDraft: PayloadRulesConfig | null
}) {
  const { t } = useTranslation()
  if (change.key === 'payloadRulesJson') {
    const parsed = parseJsonDraft(fieldDefinitionByKey[change.key], String(change.nextValue))
    if (!parsed.ok || !canEditPayloadConfig(parsed.value)) {
      return <span className="text-meta">{t('configPage.json.unsupportedStructure')}</span>
    }
    const draft = findPayloadDraft(payloadDraft ?? normalizePayloadConfig(parsed.value))
    if (draft) {
      const [issue] = getPayloadRuleIssueKeys(draft.rule, draft.sectionKey)
      return (
        <span className="text-meta">
          {t(`configPage.payload.intentOptions.${getPayloadRuleIntent(draft.sectionKey)}.title`)}
          {' · '}
          {t('configPage.payload.ruleTitle', { index: draft.rule.displayNumber })}
          {getPayloadRuleModel(draft.rule) && ` · ${getPayloadRuleModel(draft.rule)}`}
          {' · '}
          {issue
            ? t(`configPage.payload.ruleIssues.${issue}`)
            : t('configPage.payload.workspace.incomplete')}
        </span>
      )
    }
    const before = parseJsonDraft(fieldDefinitionByKey[change.key], String(change.previousValue))
    if (before.ok && isRecord(before.value) && isRecord(parsed.value)) {
      const previous = before.value
      const next = parsed.value
      const sections = payloadSectionKeys.filter(
        (key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
      )
      return (
        <span className="grid min-w-0 gap-2">
          {(
            [
              ['savedConfig', previous],
              ['pendingConfig', next],
            ] as const
          ).map(([label, config]) => (
            <span key={label} className="grid min-w-0 gap-1">
              <span className="text-label">{t(`configPage.payload.replace.${label}`)}</span>
              <code className="bg-muted/30 text-code block rounded p-2 break-words whitespace-pre-wrap">
                {JSON.stringify(
                  Object.fromEntries(sections.map((key) => [key, config[key] ?? []])),
                  null,
                  2,
                )}
              </code>
            </span>
          ))}
        </span>
      )
    }
  }
  function formatValue(value: ConfigFieldValue) {
    if (change.key === 'antigravityTosPauseWindow' && value === '')
      return t('configPage.fields.antigravityTosPauseWindow.placeholder')
    const kind = fieldDefinitionByKey[change.key].kind
    if (kind === 'optionalInteger' && value === null)
      return t(`configPage.fields.${change.key}.placeholder`)
    if (kind === 'literalReplacements' || kind === 'patternReplacements') {
      const rows = parseReplacementDraft(value)
      if (!rows) return t('sensitiveReplacements.unsupported')
      if (replacementIssues(kind, rows).some(Boolean)) return t('sensitiveReplacements.incomplete')
      return JSON.stringify(serializeReplacementRows(kind, rows))
    }
    if (fieldDefinitionByKey[change.key].kind === 'defaultOnBoolean') {
      if (value === null) return t('configPage.nullableBoolean.defaultOn')
      return t(`configPage.nullableBoolean.${nullableBooleanOptionFromValue(value)}`)
    }
    return value === '' || value === null ? t('configPage.status.emptyValue') : String(value)
  }

  return (
    <span className="text-muted-foreground text-code min-w-0 break-all whitespace-normal">
      {formatValue(change.previousValue)}
      {' → '}
      <span className="text-foreground">{formatValue(change.nextValue)}</span>
    </span>
  )
}

function ChangeDetailSheet({
  payloadDraft,
  open,
  changes,
  onOpenChange,
  onJumpToField,
}: {
  payloadDraft: PayloadRulesConfig | null
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
                    <ConfigChangePreview change={change} payloadDraft={payloadDraft} />
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
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  return <ConfigWorkbenchSession key={JSON.stringify([baseUrl, connectedAt])} />
}

type ConfigDraft = { baseline: ConfigSnapshot; values: ConfigStructuredValues }

export function reconcileSavedConfigFields(
  current: ConfigDraft | null,
  keys: readonly WritableConfigFieldKey[],
  reported?: ConfigStructuredValues,
): ConfigDraft | null {
  if (!current) return null
  const structured = { ...current.baseline.structured }
  const values = { ...current.values }
  for (const key of keys) {
    const savedValue = reported ? reported[key] : current.values[key]
    structured[key] = savedValue
    values[key] = savedValue
  }
  return { values, baseline: { ...current.baseline, structured } }
}

function ConfigWorkbenchSession() {
  const { t } = useTranslation()
  const [oauthModelChannel, setOauthModelChannel] = useState<ProviderModelChannel>('claude')
  const [oauthModelFilter, setOauthModelFilter] = useState('')
  const workbench = useConfigWorkbench(oauthModelChannel)
  const [edits, setEdits] = useState<ConfigDraft | null>(null)
  const baseline = edits?.baseline ?? workbench.snapshot
  const structuredDraft = edits?.values ?? baseline?.structured
  // An operator can temporarily enter the same JSON path in two rows before completing the second path.
  const [payloadDraft, setPayloadDraft] = useState<PayloadRulesConfig | null>(null)
  const [editingInteger, setEditingInteger] = useState<ConfigFieldKey | null>(null)
  const modelSettingFeedback = useState<ModelSettingIssue[]>([])
  const [modelSettingIssues, setModelSettingIssues] = modelSettingFeedback
  const [changeSheetOpen, setChangeSheetOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<PendingConfigConfirmation | null>(null)
  const [saveError, setSaveError] = useState<ConfigFieldSaveError | null>(null)

  const draftCount = useMemo(() => {
    if (payloadDraft) return countPayloadConfigDrafts(payloadDraft)
    if (!structuredDraft) return 0

    try {
      return countPayloadDrafts(
        JSON.parse(String(structuredDraft.payloadRulesJson || '{}')) as unknown,
      )
    } catch {
      return 0
    }
  }, [structuredDraft, payloadDraft])
  const hasPayloadDrafts = payloadDraft ? draftCount > 0 : null
  const changes = useMemo(() => {
    if (!baseline || !structuredDraft) return []
    return getStructuredChanges(baseline.structured, structuredDraft, hasPayloadDrafts === true)
  }, [structuredDraft, baseline, hasPayloadDrafts])
  const latest = workbench.snapshot
  const hasConflictingChanges = Boolean(
    edits &&
    latest &&
    latest !== baseline &&
    changes.some((change) => {
      const current = getConfigChangeValue(change.key, latest.structured[change.key])
      if (change.key === 'oauthModelAliasJson' || change.key === 'oauthModelSettingsJson')
        return hasOAuthChannelConflict(change, current)
      return (
        !areConfigValuesEqual(current, change.previousValue) &&
        !areConfigValuesEqual(current, change.nextValue)
      )
    }),
  )
  const saved = baseline?.structured
  const validationErrors = useMemo(
    () => (structuredDraft ? getValidationErrors(structuredDraft, saved, hasPayloadDrafts) : []),
    [structuredDraft, saved, hasPayloadDrafts],
  )
  // Editable payload rules report unfinished fields inline and in the draft indicator.
  const visibleValidationErrors = validationErrors.filter(
    (key) =>
      key !== editingInteger &&
      (key !== 'payloadRulesJson' || !payloadDraft) &&
      (key !== 'oauthModelSettingsJson' || modelSettingIssues.length > 0),
  )
  const isDirty = changes.length > 0
  const saveDisabled =
    !isDirty || workbench.mutating || validationErrors.length > 0 || hasConflictingChanges
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

  if (workbench.isError && !latest) {
    return <ConfigErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
  }

  if (workbench.isPending || !structuredDraft || !baseline || !latest) {
    return <ConfigLoadingState />
  }

  const handleStructuredChange = (key: ConfigFieldKey, value: ConfigFieldValue) => {
    setSaveError((current) => (current?.key === key ? null : current))
    setEdits((current) => ({
      baseline: current?.baseline ?? latest,
      values: { ...(current?.values ?? latest.structured), [key]: value },
    }))
  }

  const reloadFromRuntime = () => {
    setSaveError(null)
    setPayloadDraft(null)
    setModelSettingIssues([])
    setEdits(null)
    workbench.refetch()
  }
  const handleReload = () => {
    if (isDirty) {
      setConfirmation({ type: 'reload' })
      return
    }
    reloadFromRuntime()
  }

  const handleSave = async () => {
    try {
      if (hasConflictingChanges) return
      if (validationErrors.length > 0) {
        toast.error(t('configPage.toast.validationFailed'))
        return
      }
      await workbench.saveStructured(changes)
      setSaveError(null)
      setEdits(null)
      setPayloadDraft(null)
      setModelSettingIssues([])
      toast.success(t('configPage.toast.saved'))
    } catch (error) {
      if (!(error instanceof ConfigFieldSaveError)) {
        toast.error(error instanceof Error ? error.message : String(error))
        return
      }
      setSaveError(error)
      // Keep failed and unattempted edits. A retry must not resend completed fields.
      if (error.savedKeys.length) {
        const refreshed = workbench.getCachedSnapshot()
        const reported = refreshed && refreshed !== latest ? refreshed.structured : undefined
        setEdits((current) => reconcileSavedConfigFields(current, error.savedKeys, reported))
      }
      toast.error(
        t('configPage.compatibility.saveFailed', {
          field: t(`configPage.fields.${error.key}.label`),
        }),
      )
      window.requestAnimationFrame(() => scrollToConfigTarget(`config-field-${error.key}`))
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
    <section data-config-workbench className="grid w-full gap-4">
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
        fetchedAt={latest.fetchedAt}
        saveDisabled={saveDisabled}
        hasConflictingChanges={hasConflictingChanges}
        onOpenChanges={() => setChangeSheetOpen(true)}
        onReload={handleReload}
        onSave={() => void handleSave()}
      />

      <ChangeDetailSheet
        payloadDraft={payloadDraft}
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

      <PayloadSnapshotContext.Provider
        value={{
          revision: baseline.fetchedAt,
          value: baseline.structured.payloadRulesJson,
          draft: payloadDraft,
          setDraft: setPayloadDraft,
        }}
      >
        <ModelSettingFeedbackContext.Provider value={modelSettingFeedback}>
          <StructuredWorkspace
            draft={structuredDraft}
            saveError={saveError}
            onDiscardField={(key) => {
              if (key === 'payloadRulesJson') setPayloadDraft(null)
              if (key === 'oauthModelSettingsJson') setModelSettingIssues([])
              setEdits((current) => reconcileSavedConfigFields(current, [key], latest.structured))
              setSaveError(null)
            }}
            changes={changes}
            validationErrors={visibleValidationErrors}
            onEditingIntegerChange={setEditingInteger}
            disabled={workbench.mutating}
            oauthModelCatalog={oauthModelCatalog}
            onChange={handleStructuredChange}
          />
        </ModelSettingFeedbackContext.Provider>
      </PayloadSnapshotContext.Provider>
    </section>
  )
}
