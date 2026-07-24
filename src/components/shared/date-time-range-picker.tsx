import { useId, useMemo, useState } from 'react'

import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { responsiveCompactControlClassName } from '@/components/ui/control-size'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type DateTimeParts = {
  date: string
  time: string
}

type DateBoundary = 'from' | 'to'

function splitDateTime(value: string): DateTimeParts {
  const [date = '', time = ''] = value.split('T')
  return {
    date,
    time: time.slice(0, 5),
  }
}

function getTodayDateKey() {
  return toDateKey(new Date())
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value: string) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function compareDateKeys(a: string, b: string) {
  return a.localeCompare(b)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function getCalendarMonth(value: string) {
  return parseDateKey(value) ?? new Date()
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const dayOffset = (firstDay.getDay() + 6) % 7
  const totalDays = new Date(year, month + 1, 0).getDate()
  const cells: Array<string | null> = Array.from({ length: dayOffset }, () => null)

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(toDateKey(new Date(year, month, day)))
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

function formatDateTimeValue(value: string, fallback: string) {
  return value ? value.replace('T', ' ') : fallback
}

function joinDateTime(parts: DateTimeParts) {
  if (!parts.date && !parts.time) return ''
  return `${parts.date || ''}${parts.time ? `T${parts.time}` : ''}`
}

function DateTimeRangeCalendarMonth({
  monthDate,
  locale,
  fromDate,
  toDate,
  today,
  onSelectDate,
}: {
  monthDate: Date
  locale?: string
  fromDate: string
  toDate: string
  today: string
  onSelectDate: (date: string) => void
}) {
  const monthLabel = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
  }).format(monthDate)
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const base = new Date(2024, 0, 1 + index)
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(base)
  })
  const days = getMonthDays(monthDate)

  return (
    <div className="min-w-0">
      <p className="text-center text-sm font-medium">{monthLabel}</p>
      <div className="text-muted-foreground mt-3 grid grid-cols-7 gap-1 text-center text-[11px]">
        {weekDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <span key={`empty-${index}`} className="size-8" aria-hidden="true" />
          }

          const isStart = date === fromDate
          const isEnd = date === toDate
          const inRange =
            Boolean(fromDate && toDate) &&
            compareDateKeys(date, fromDate) > 0 &&
            compareDateKeys(date, toDate) < 0
          const isToday = date === today

          return (
            <button
              key={date}
              type="button"
              className={cn(
                'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-md text-xs tabular-nums transition-colors outline-none focus-visible:ring-[3px]',
                inRange && 'bg-primary/10 text-primary',
                isToday && 'border-primary/40 border',
                (isStart || isEnd) && 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
              onClick={() => onSelectDate(date)}
            >
              {Number(date.slice(-2))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateTimeRangePicker({
  from,
  to,
  label,
  fromLabel,
  toLabel,
  separatorLabel,
  placeholder,
  clearLabel,
  disabled,
  className,
  locale,
  onChange,
}: {
  from: string
  to: string
  label: string
  fromLabel: string
  toLabel: string
  separatorLabel: string
  placeholder: string
  clearLabel: string
  disabled?: boolean
  className?: string
  locale?: string
  onChange: (nextRange: { from: string; to: string }) => void
}) {
  const fromTimeId = useId()
  const toTimeId = useId()
  const fromParts = useMemo(() => splitDateTime(from), [from])
  const toParts = useMemo(() => splitDateTime(to), [to])
  const [activeBoundary, setActiveBoundary] = useState<DateBoundary>(() =>
    fromParts.date && !toParts.date ? 'to' : 'from',
  )
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getCalendarMonth(fromParts.date || toParts.date),
  )
  const hasValue = Boolean(from || to)
  const rangeText = hasValue
    ? `${formatDateTimeValue(from, fromLabel)} ${separatorLabel} ${formatDateTimeValue(to, toLabel)}`
    : placeholder
  const today = useMemo(getTodayDateKey, [])

  const updateFrom = (nextParts: Partial<DateTimeParts>) => {
    onChange({
      from: joinDateTime({ ...fromParts, ...nextParts }),
      to,
    })
  }

  const updateTo = (nextParts: Partial<DateTimeParts>) => {
    onChange({
      from,
      to: joinDateTime({ ...toParts, ...nextParts }),
    })
  }

  const handleSelectDate = (date: string) => {
    if (activeBoundary === 'from') {
      onChange({
        from: joinDateTime({ date, time: fromParts.time || '00:00' }),
        to: toParts.date && compareDateKeys(date, toParts.date) <= 0 ? to : '',
      })
      setActiveBoundary('to')
      return
    }

    if (fromParts.date && compareDateKeys(date, fromParts.date) < 0) {
      onChange({
        from: joinDateTime({ date, time: fromParts.time || '00:00' }),
        to: '',
      })
      setActiveBoundary('to')
      return
    }

    onChange({
      from,
      to: joinDateTime({ date, time: toParts.time || '23:59' }),
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            responsiveCompactControlClassName,
            'w-full justify-start gap-2 px-3 font-normal sm:w-[21rem]',
            !hasValue && 'text-muted-foreground',
            className,
          )}
          disabled={disabled}
          aria-label={label}
        >
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate text-left">{rangeText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(calc(100vw-2rem),40rem)] p-3" align="start">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{label}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={!hasValue}
              onClick={() => onChange({ from: '', to: '' })}
            >
              <X className="size-3.5" aria-hidden="true" />
              {clearLabel}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['from', fromLabel, formatDateTimeValue(from, fromLabel)],
                ['to', toLabel, formatDateTimeValue(to, toLabel)],
              ] as const
            ).map(([boundary, boundaryLabel, value]) => (
              <button
                key={boundary}
                type="button"
                className={cn(
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  activeBoundary === boundary
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-accent/60',
                )}
                onClick={() => setActiveBoundary(boundary)}
              >
                <span className="text-muted-foreground block text-xs font-medium">
                  {boundaryLabel}
                </span>
                <span className="mt-1 block truncate text-sm">{value}</span>
              </button>
            ))}
          </div>
          <div className="border-input rounded-md border p-3">
            <div className="mb-3 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <div className="text-muted-foreground text-xs">
                {fromLabel} {separatorLabel} {toLabel}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimeRangeCalendarMonth
                monthDate={visibleMonth}
                locale={locale}
                fromDate={fromParts.date}
                toDate={toParts.date}
                today={today}
                onSelectDate={handleSelectDate}
              />
              <DateTimeRangeCalendarMonth
                monthDate={addMonths(visibleMonth, 1)}
                locale={locale}
                fromDate={fromParts.date}
                toDate={toParts.date}
                today={today}
                onSelectDate={handleSelectDate}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">{fromLabel}</span>
              <Input
                id={fromTimeId}
                type="time"
                value={fromParts.time}
                disabled={!fromParts.date}
                aria-label={`${fromLabel} time`}
                onChange={(event) => updateFrom({ time: event.target.value })}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">{toLabel}</span>
              <Input
                id={toTimeId}
                type="time"
                value={toParts.time}
                disabled={!toParts.date}
                aria-label={`${toLabel} time`}
                onChange={(event) => updateTo({ time: event.target.value })}
              />
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
