type BillingDateRange = {
  from: string
  to: string
}

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatLocalDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function createLocalDateRange(daysAgo: number, now = new Date()): BillingDateRange {
  const from = new Date(now)
  from.setDate(from.getDate() - daysAgo)

  return {
    from: formatLocalDateInput(from),
    to: formatLocalDateInput(now),
  }
}

export function createLocalMonthToDateRange(now = new Date()): BillingDateRange {
  return {
    from: formatLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatLocalDateInput(now),
  }
}

export function getBillingTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function parseLocalDateBoundary(value: string, boundary: 'start' | 'end') {
  const match = dateOnlyPattern.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(0)
  date.setFullYear(year, month, day)
  date.setHours(
    boundary === 'start' ? 0 : 23,
    boundary === 'start' ? 0 : 59,
    boundary === 'start' ? 0 : 59,
    boundary === 'start' ? 0 : 999,
  )

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null
  }

  return date.toISOString()
}

function toRangeBoundary(value: string, boundary: 'start' | 'end') {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  return parseLocalDateBoundary(trimmed, boundary) ?? trimmed
}

export function toBillingDateRangeParams(range: BillingDateRange) {
  return {
    from: toRangeBoundary(range.from, 'start'),
    to: toRangeBoundary(range.to, 'end'),
  }
}
