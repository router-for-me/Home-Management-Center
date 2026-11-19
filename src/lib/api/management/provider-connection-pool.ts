import { parseGoDurationNanos } from '@/lib/go-duration'

import { mergeConfigEdits } from './config-edit'

export type ProviderConnectionPool = {
  mode: 'absent' | 'configured' | 'enabled' | 'disabled' | 'unsupported'
  idleTimeout: string
  maxIdle: string
}

export function connectionPoolIssues(pool?: ProviderConnectionPool) {
  if (!pool || pool.mode === 'absent' || pool.mode === 'unsupported') return {}
  const timeout = pool.idleTimeout.trim()
  const count = pool.maxIdle.trim()
  return {
    idleTimeout: Boolean(timeout && parseGoDurationNanos(timeout) === null),
    maxIdle: Boolean(count && (!/^[+-]?\d+$/.test(count) || !Number.isSafeInteger(Number(count)))),
  }
}

export function readConnectionPool(raw?: unknown): ProviderConnectionPool {
  const empty = { idleTimeout: '', maxIdle: '' }
  if (raw == null) return { ...empty, mode: 'absent' }
  const unsupported = { ...empty, mode: 'unsupported' } as const
  if (typeof raw !== 'object' || Array.isArray(raw)) return unsupported
  const pool = raw as Record<string, unknown>
  const timeout = pool['idle-conn-timeout']
  const count = pool['max-idle-conns-per-host']
  if (
    (pool.enabled != null && typeof pool.enabled !== 'boolean') ||
    (timeout != null && typeof timeout !== 'string') ||
    (count != null && !Number.isSafeInteger(count))
  )
    return unsupported
  const draft: ProviderConnectionPool = {
    mode: pool.enabled === false ? 'disabled' : pool.enabled === true ? 'enabled' : 'configured',
    idleTimeout: typeof timeout === 'string' ? timeout : '',
    maxIdle: typeof count === 'number' ? String(count) : '',
  }
  return Object.values(connectionPoolIssues(draft)).some(Boolean) ? unsupported : draft
}

function projectPool(draft: ProviderConnectionPool): Record<string, unknown> {
  if (draft.mode === 'absent' || draft.mode === 'unsupported') return {}
  const pool: Record<string, unknown> = {}
  if (draft.mode === 'enabled' || draft.mode === 'disabled') pool.enabled = draft.mode === 'enabled'
  if (draft.idleTimeout.trim()) pool['idle-conn-timeout'] = draft.idleTimeout.trim()
  if (draft.maxIdle.trim()) pool['max-idle-conns-per-host'] = Number(draft.maxIdle)
  return { 'connection-pool': pool }
}

export function withConnectionPool(
  record: Record<string, unknown>,
  draft?: ProviderConnectionPool,
) {
  if (!draft) return { ...record }
  const opened = readConnectionPool(record['connection-pool'])
  if (opened.mode === 'unsupported' || draft.mode === 'unsupported') return { ...record }
  if (Object.values(connectionPoolIssues(draft)).some(Boolean))
    throw new Error('Invalid connection pool settings')
  // Diff the two projections so untouched nulls, empty blocks and extension fields survive.
  return mergeConfigEdits(record, projectPool(opened), projectPool(draft))
}
