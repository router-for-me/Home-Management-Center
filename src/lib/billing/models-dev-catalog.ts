const MODELS_DEV_API_URL = 'https://models.dev/api.json'

export type ModelsDevCost = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  request: number
}

export type ModelsDevModelEntry = {
  providerId: string
  modelId: string
  name: string
  cost: ModelsDevCost | null
  invalidPriceFields: string[]
  unsupportedPriceDimensions: string[]
  raw: unknown
}

export type ModelsDevCatalog = {
  fetchedAt: string
  sourceUrl: string
  providers: string[]
  models: ModelsDevModelEntry[]
  byProviderModel: Map<string, ModelsDevModelEntry>
  byModelId: Map<string, ModelsDevModelEntry[]>
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function readNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function normalizeCost(value: unknown): ModelsDevCost | null {
  if (!isRecord(value)) return null

  const input = readNumber(value, ['input', 'input_price', 'inputPrice'])
  const output = readNumber(value, ['output', 'output_price', 'outputPrice'])
  const cacheRead = readNumber(value, ['cache_read', 'cacheRead', 'cache_read_price'])
  const cacheWrite = readNumber(value, ['cache_write', 'cacheWrite', 'cache_write_price'])
  const request = readNumber(value, ['request', 'request_price', 'requestPrice'])
  if ([input, output, cacheRead, cacheWrite, request].every((item) => item === null)) return null

  return {
    input: input ?? 0,
    output: output ?? 0,
    cacheRead: cacheRead ?? 0,
    cacheWrite: cacheWrite ?? 0,
    request: request ?? 0,
  }
}

function findUnsupportedPriceDimensions(value: unknown) {
  if (!isRecord(value)) return []

  const scalarDimensions = [
    'image',
    'input_image',
    'output_image',
    'audio',
    'input_audio',
    'output_audio',
    'video',
    'reasoning',
  ]
  const unsupported = scalarDimensions.filter((dimension) => {
    const price = readNumber(value, [dimension])
    return price !== null && price !== 0
  })

  for (const dimension of ['tiers', 'context_over_200k']) {
    const nested = value[dimension]
    if (
      (Array.isArray(nested) && nested.length > 0) ||
      (isRecord(nested) && Object.keys(nested).length > 0)
    ) {
      unsupported.push(dimension)
    }
  }

  return unsupported
}

function findInvalidPriceFields(value: unknown) {
  if (!isRecord(value)) return []

  const fields = [
    ['input', ['input', 'input_price', 'inputPrice']],
    ['output', ['output', 'output_price', 'outputPrice']],
    ['cache_read', ['cache_read', 'cacheRead', 'cache_read_price']],
    ['cache_write', ['cache_write', 'cacheWrite', 'cache_write_price']],
    ['request', ['request', 'request_price', 'requestPrice']],
  ] as const
  return fields
    .filter(([, aliases]) => {
      const price = readNumber(value, [...aliases])
      return price !== null && price < 0
    })
    .map(([field]) => field)
}

function providerModelKey(providerId: string, modelId: string) {
  return `${providerId.trim().toLowerCase()}::${modelId.trim().toLowerCase()}`
}

function bareModelId(modelId: string) {
  const trimmed = modelId.trim()
  const slash = trimmed.lastIndexOf('/')
  return (slash >= 0 ? trimmed.slice(slash + 1) : trimmed).trim()
}

export function parseModelsDevCatalog(
  payload: unknown,
  sourceUrl = MODELS_DEV_API_URL,
): ModelsDevCatalog {
  const root = toRecord(payload)
  const models: ModelsDevModelEntry[] = []
  const byProviderModel = new Map<string, ModelsDevModelEntry>()
  const byModelId = new Map<string, ModelsDevModelEntry[]>()
  const providers: string[] = []

  for (const [providerId, providerValue] of Object.entries(root)) {
    if (!providerId.trim() || !isRecord(providerValue)) continue
    providers.push(providerId)
    const providerModels = toRecord(providerValue.models)
    for (const [modelId, modelValue] of Object.entries(providerModels)) {
      if (!modelId.trim() || !isRecord(modelValue)) continue
      const entry: ModelsDevModelEntry = {
        providerId,
        modelId: readString(modelValue, ['id']) || modelId,
        name: readString(modelValue, ['name']) || modelId,
        cost: normalizeCost(modelValue.cost ?? modelValue.pricing),
        invalidPriceFields: findInvalidPriceFields(modelValue.cost ?? modelValue.pricing),
        unsupportedPriceDimensions: findUnsupportedPriceDimensions(
          modelValue.cost ?? modelValue.pricing,
        ),
        raw: modelValue,
      }
      models.push(entry)
      byProviderModel.set(providerModelKey(entry.providerId, bareModelId(entry.modelId)), entry)
      byProviderModel.set(providerModelKey(entry.providerId, entry.modelId), entry)

      const bare = bareModelId(entry.modelId).toLowerCase()
      const list = byModelId.get(bare) ?? []
      list.push(entry)
      byModelId.set(bare, list)
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    sourceUrl,
    providers: providers.sort((a, b) => a.localeCompare(b)),
    models,
    byProviderModel,
    byModelId,
  }
}

export async function fetchModelsDevCatalog(
  sourceUrl = MODELS_DEV_API_URL,
  init?: RequestInit,
): Promise<ModelsDevCatalog> {
  const response = await fetch(sourceUrl, {
    method: 'GET',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    throw new Error(`models.dev fetch failed: HTTP ${response.status}`)
  }
  const payload = (await response.json()) as unknown
  return parseModelsDevCatalog(payload, sourceUrl)
}

export function modelsDevProviderModelKey(providerId: string, modelId: string) {
  return providerModelKey(providerId, modelId)
}

export function modelsDevBareModelId(modelId: string) {
  return bareModelId(modelId)
}
