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

export function parseGoDurationNanos(input: string): bigint | null {
  const value = input.trim()
  const negative = value.startsWith('-')
  const start = negative || value.startsWith('+') ? 1 : 0
  if (value.slice(start) === '0') return 0n
  if (value.length === start) return null
  const limit = negative ? maxDurationNanos + 1n : maxDurationNanos

  const part = /(\d*)(?:\.(\d*))?(ns|us|µs|μs|ms|s|m|h)/y
  part.lastIndex = start
  let nanos = 0n
  while (part.lastIndex < value.length) {
    const match = part.exec(value)
    if (!match || (!match[1] && !match[2])) return null
    const whole = match[1].replace(/^0+/, '')
    if (whole.length > 19) return null
    const unit = nanosPerUnit[match[3]]
    nanos += BigInt(whole || '0') * BigInt(unit) + fractionalNanos(match[2] ?? '', unit)
    if (nanos > limit) return null
  }
  return negative ? -nanos : nanos
}
