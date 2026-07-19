type BillingDateRange = {
  from: string
  to: string
}

type CalendarDate = {
  year: number
  month: number
  day: number
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

function calendarDateInTimeZone(date: Date, timezone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  }
}

function shiftCalendarDate(value: CalendarDate, days: number): CalendarDate {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day))
  date.setUTCDate(date.getUTCDate() + days)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function formatCalendarDate(value: CalendarDate) {
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
}

export function createDateRangeInTimeZone(
  daysAgo: number,
  timezone: string,
  now = new Date(),
): BillingDateRange {
  const to = calendarDateInTimeZone(now, timezone)
  return {
    from: formatCalendarDate(shiftCalendarDate(to, -daysAgo)),
    to: formatCalendarDate(to),
  }
}

export function createMonthToDateRangeInTimeZone(
  timezone: string,
  now = new Date(),
): BillingDateRange {
  const to = calendarDateInTimeZone(now, timezone)
  return {
    from: formatCalendarDate({ ...to, day: 1 }),
    to: formatCalendarDate(to),
  }
}

function parseLocalDateBoundary(value: string, boundary: 'start' | 'endExclusive') {
  const match = dateOnlyPattern.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(0)
  date.setFullYear(year, month, day)
  date.setHours(0, 0, 0, 0)

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null
  }

  if (boundary === 'endExclusive') {
    date.setDate(date.getDate() + 1)
  }

  return date.toISOString()
}

function toRangeBoundary(value: string, boundary: 'start' | 'endExclusive') {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  return parseLocalDateBoundary(trimmed, boundary) ?? trimmed
}

export function toBillingDateRangeParams(range: BillingDateRange) {
  return {
    from: toRangeBoundary(range.from, 'start'),
    to: toRangeBoundary(range.to, 'endExclusive'),
  }
}
