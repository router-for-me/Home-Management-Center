type UnknownRecord = Record<string, unknown>

export type ManagementRoutingStrategy = 'round-robin' | 'fill-first' | 'unknown'

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeManagementRoutingStrategy(value: unknown): ManagementRoutingStrategy {
  if (value === undefined) return 'round-robin'
  if (typeof value !== 'string') return 'unknown'

  switch (value.trim().toLowerCase()) {
    case '':
    case 'round-robin':
    case 'roundrobin':
    case 'rr':
      return 'round-robin'
    case 'fill-first':
    case 'fillfirst':
    case 'ff':
      return 'fill-first'
    default:
      return 'unknown'
  }
}

export function readManagementRoutingStrategy(config: UnknownRecord): ManagementRoutingStrategy {
  const routing = config.routing
  if (routing === undefined) return 'round-robin'
  if (!isRecord(routing)) return 'unknown'

  return normalizeManagementRoutingStrategy(routing.strategy)
}
