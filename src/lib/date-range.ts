export type DateRange = { from: string; to: string }
export type DateRangeBoundary = keyof DateRange
export type DateRangePrecision = 'date' | 'datetime'

export const minimumCalendarDate = '1970-01-01'
export const maximumCalendarDate = '9999-12-31'

function formatCalendarDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(12, 0, 0, 0)
  return year >= 1 && formatCalendarDate(date) === value ? date : null
}

export function splitDateRangeValue(value: string) {
  const [date = '', time = ''] = value.split('T')
  return { date, time }
}

export function sanitizeCalendarDateInput(value: string) {
  return value
    .replace(/[^\d-]/g, '')
    .split('-')
    .slice(0, 3)
    .map((part, index) => part.slice(0, index === 0 ? 4 : 2))
    .join('-')
}

export function isCalendarDateInBounds(
  value: string,
  min = minimumCalendarDate,
  max = maximumCalendarDate,
) {
  return Boolean(parseCalendarDate(value)) && value >= min && value <= max
}

export function isDateRangeValueValid(value: string, precision: DateRangePrecision) {
  if (!value) return true
  const { date, time } = splitDateRangeValue(value)
  return (
    isCalendarDateInBounds(date) &&
    (precision === 'date'
      ? value === date
      : value === `${date}T${time}` && /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
  )
}

export function isDateRangeValid(range: DateRange, precision: DateRangePrecision) {
  return (
    isDateRangeValueValid(range.from, precision) &&
    isDateRangeValueValid(range.to, precision) &&
    (!range.from || !range.to || range.from <= range.to)
  )
}

export function createDateRangeDraft(range: DateRange, precision: DateRangePrecision): DateRange {
  const normalize = (value: string, boundary: DateRangeBoundary) => {
    if (!value) return ''
    const { date, time } = splitDateRangeValue(value)
    return precision === 'date'
      ? date
      : `${date}T${time.slice(0, 5) || (boundary === 'from' ? '00:00' : '23:59')}`
  }
  return { from: normalize(range.from, 'from'), to: normalize(range.to, 'to') }
}

export function updateDateRangeBoundary(
  range: DateRange,
  boundary: DateRangeBoundary,
  value: string,
  precision: DateRangePrecision,
): DateRange {
  const next = { ...range, [boundary]: value }
  // Only complete values can move the other endpoint. Typing a year must not
  // rewrite the range while the date is still an incomplete draft.
  if (
    next.from &&
    next.to &&
    isDateRangeValueValid(next.from, precision) &&
    isDateRangeValueValid(next.to, precision) &&
    next.from > next.to
  ) {
    next[boundary === 'from' ? 'to' : 'from'] = value
  }
  return next
}

export function shiftCalendarDate(value: string, days: number) {
  const date = parseCalendarDate(value)!
  date.setDate(date.getDate() + days)
  if (date.getFullYear() > 9999) return maximumCalendarDate
  if (date.getFullYear() < 1970) return minimumCalendarDate
  return formatCalendarDate(date)
}

export function shiftCalendarMonth(value: string, months: number) {
  const date = parseCalendarDate(value)!
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  if (date.getFullYear() > 9999) return maximumCalendarDate
  if (date.getFullYear() < 1970) return minimumCalendarDate
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return formatCalendarDate(date)
}

export function calendarMonth(value: string) {
  return `${value.slice(0, 7)}-01`
}

export function clampCalendarDate(value: string, min: string, max: string) {
  return value < min ? min : value > max ? max : value
}

export function todayCalendarDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-')
}
