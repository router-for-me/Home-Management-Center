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
  provider: string
  model: string
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheReadPricePerMillion: number
  cacheWritePricePerMillion: number
  requestPrice: number
  raw: unknown
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
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheReadPricePerMillion: number
  cacheWritePricePerMillion: number
  requestPrice: number
  enabled: boolean
  note?: string
}
