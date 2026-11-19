const nanosPerUnit: Record<string, number> = {
  ns: 1,
  us: 1e3,
  µs: 1e3,
  μs: 1e3,
  ms: 1e6,
  s: 1e9,
  m: 60e9,
  h: 3600e9,
}
const maxDurationNanos = (1n << 63n) - 1n

function fractionalNanos(digits: string, unit: number) {
  // Go keeps the fractional digits that fit its accumulator, then truncates each part to nanoseconds.
  let numerator = 0n
  let scale = 1
  for (const digit of digits) {
    const next = numerator * 10n + BigInt(digit)
    if (next > maxDurationNanos + 1n) break
    numerator = next
    scale *= 10
  }
  return BigInt(Math.trunc(Number(numerator) * (unit / scale)))
}

export function isValidAntigravityPauseWindow(input: string) {
  const value = input.trim()
  if (['', '0', 'off', 'false', 'none', 'disabled'].includes(value.toLowerCase())) return true

  const part = /(\d*)(?:\.(\d*))?(ns|us|µs|μs|ms|s|m|h)/y
  part.lastIndex = value.startsWith('+') ? 1 : 0
  let nanos = 0n
  while (part.lastIndex < value.length) {
    const match = part.exec(value)
    if (!match || (!match[1] && !match[2])) return false
    const whole = match[1].replace(/^0+/, '')
    if (whole.length > 19) return false
    const unit = nanosPerUnit[match[3]]
    nanos += BigInt(whole || '0') * BigInt(unit) + fractionalNanos(match[2] ?? '', unit)
    if (nanos > maxDurationNanos) return false
  }
  return nanos > 0n
}
