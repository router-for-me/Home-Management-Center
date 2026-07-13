export type BillingDateRange = {
  from: string
  to: string
}

export type BillingTrendPoint = {
  date: string
  chargeAmount: number
  requestCount: number
}

export type BillingRankItem = {
  id: string
  label: string
  amount: number
  requestCount: number
}

export type BillingOverview = {
  range: BillingDateRange
  totalChargeAmount: number
  totalRechargeAmount: number
  totalDeductAmount: number
  totalBalance: number
  requestCount: number
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  activeUserCount: number
  dailyTrend: BillingTrendPoint[]
  topUsers: BillingRankItem[]
  topModels: BillingRankItem[]
  topProviders: BillingRankItem[]
}

export type ModelPriceSnapshot = {
  schemaVersion: number | null
  provider: string
  model: string
  serviceTier: string
  minInputTokens: number
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheReadPricePerMillion: number
  cacheWritePricePerMillion: number
  requestPrice: number
  requestedServiceTier: string | null
  responseServiceTier: string | null
  serviceTierSource: BillingServiceTierSource | null
  effectiveServiceTier: string | null
  responseServiceTierFallback: boolean | null
  inputTokensForBand: number
  uncachedInputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  tokenBuckets: BillingTokenBuckets | null
  cacheWriteSource: string | null
  raw: unknown
}

export type BillingTokenBuckets = {
  uncachedInput: number
  cacheRead: number
  cacheWrite: number
  output: number
}

export type ChargeRecord = {
  id: string
  createdAt: string
  userId: number | null
  username: string
  apiKeyLabel: string
  apiKeyMasked: string
  provider: string
  model: string
  originalModel: string | null
  actualModel: string | null
  requestId: string
  endpoint: string | null
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  amount: number
  balanceBefore: number
  balanceAfter: number
  matchedPriceRule: string | null
  priceSnapshot: ModelPriceSnapshot
  requestSummary: string | null
  raw: unknown
}

export type BalanceRecordType = 'recharge' | 'deduct'

export type BalanceRecord = {
  id: string
  createdAt: string
  userId: number | null
  username: string
  type: BalanceRecordType
  amount: number
  balanceBefore: number
  balanceAfter: number
  operator: string
  note: string
  raw: unknown
}

export type ModelPriceSource = 'manual' | 'default' | 'sync'

export type ModelPrice = {
  id: string
  provider: string
  model: string
  serviceTier: string
  minInputTokens: number
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheReadPricePerMillion: number
  cacheWritePricePerMillion: number
  requestPrice: number
  source: ModelPriceSource
  enabled: boolean
  note: string | null
  updatedAt: string
  raw: unknown
}

export type BillingFilters = {
  from: string
  to: string
  user: string
  provider: string
  model: string
}

export type BillingServiceTierSource = 'request' | 'response'

export type BillingSettings = {
  serviceTierSource: BillingServiceTierSource
  supported: boolean
  raw: unknown
}

export type BillingTierDiagnostics = {
  supported: boolean
  windowStart: string | null
  windowEnd: string | null
  eligibleRequests: number
  responseTierRequests: number
  fallbackRequests: number
  lastResponseTierAt: string | null
}

export type ModelPriceList = {
  items: ModelPrice[]
  schemaVersion: number | null
  fetchedAt: string
}

export type BillingPagination = {
  limit: number
  offset: number
}

export type BillingPage<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
  fetchedAt: string
}

export type BalanceOperationInput = {
  userId: number
  amount: number
  note: string
}

export type ModelPriceInput = {
  provider: string
  model: string
  serviceTier?: string
  minInputTokens?: number
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheReadPricePerMillion: number
  cacheWritePricePerMillion: number
  requestPrice: number
  enabled: boolean
  note?: string
  source?: ModelPriceSource
}
