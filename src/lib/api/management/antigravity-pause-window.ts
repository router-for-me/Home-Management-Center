import { parseGoDurationNanos } from '@/lib/go-duration'

export function isValidAntigravityPauseWindow(input: string) {
  const value = input.trim()
  if (['', '0', 'off', 'false', 'none', 'disabled'].includes(value.toLowerCase())) return true
  return (parseGoDurationNanos(value) ?? 0n) > 0n
}
