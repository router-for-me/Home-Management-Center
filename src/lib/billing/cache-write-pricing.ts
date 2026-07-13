export function hasSeparateCacheWriteRate(value: number) {
  return Number.isFinite(value) && value > 0
}
