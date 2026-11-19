import {
  type ProviderApiKeyEntryInput,
  type ProviderDescriptor,
  type ProviderEntryFormInput,
  type ProviderHeaderEntryInput,
  type ProviderModelEntryInput,
  type ProviderRequestScopedErrorRule,
  type ProviderResource,
} from './providers'

export const PROVIDER_ERROR_RULE_ACTIONS = [
  'stop',
  'stop-and-cooldown',
  'continue',
  'continue-and-cooldown',
] as const

export type ProviderErrorRuleAction = (typeof PROVIDER_ERROR_RULE_ACTIONS)[number]

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

export function emptyApiKeyEntry(): ProviderApiKeyEntryInput {
  return {
    apiKey: '',
    proxyUrl: '',
    weight: undefined,
  }
}

export function emptyCloakInput() {
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

export function readProviderModels(raw: UnknownRecord): ProviderModelEntryInput[] {
  const models = raw.models
  if (!Array.isArray(models)) return []

  return models.filter(isRecord).map((model) => {
    const thinking = isRecord(model.thinking) ? model.thinking : null
    const rawLevels = Array.isArray(thinking?.levels) ? thinking.levels : []
    const thinkingLevels = rawLevels
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
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

export function readRequestScopedErrors(raw: UnknownRecord): ProviderRequestScopedErrorRule[] {
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
        raw: rule,
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
    original: key,
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

export function createFormState(
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
    excludedModelsText: providerId === 'openaiCompatibility' ? '' : readExcludedModelsText(raw),
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
