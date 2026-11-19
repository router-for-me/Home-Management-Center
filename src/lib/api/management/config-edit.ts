type ConfigRecord = Record<string, unknown>

const isRecord = (value: unknown): value is ConfigRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function sameConfigValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((value, i) => sameConfigValue(value, right[i]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false
  const keys = Object.keys(left)
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameConfigValue(left[key], right[key]))
  )
}

export class ConfigEditConflict extends Error {
  constructor(
    message = 'The configuration changed or the selected record is ambiguous. Reload before saving.',
  ) {
    super(message)
  }
}

/** Apply the difference between two form projections to the persisted record. */
export function mergeConfigEdits(
  raw: ConfigRecord,
  before: ConfigRecord,
  after: ConfigRecord,
): ConfigRecord {
  const result = { ...raw }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (sameConfigValue(before[key], after[key])) continue
    if (!Object.hasOwn(after, key)) {
      delete result[key]
      continue
    }
    const current = raw[key]
    const previous = before[key]
    const desired = after[key]
    const value =
      isRecord(previous) && isRecord(desired)
        ? mergeConfigEdits(isRecord(current) ? current : {}, previous, desired)
        : desired
    // Config maps include user-defined header names.
    Object.defineProperty(result, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }
  return result
}
