import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from 'react'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useIsCompactViewport } from '@/hooks/use-compact-viewport'
import {
  calendarMonth,
  clampCalendarDate,
  parseCalendarDate,
  shiftCalendarDate,
  shiftCalendarMonth,
} from '@/lib/date-range'
import { cn } from '@/lib/utils'

function monthWeeks(month: string) {
  const first = parseCalendarDate(month)!
  const offset = (first.getDay() + 6) % 7
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1
    return day > 0 && day <= count ? `${month.slice(0, 8)}${String(day).padStart(2, '0')}` : null
  })
  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  )
}

export function DateRangeCalendar({
  from,
  to,
  month,
  today,
  min,
  max,
  locale,
  onMonthChange,
  onSelect,
}: {
  from: string
  to: string
  month: string
  today: string
  min: string
  max: string
  locale: string
  onMonthChange: (month: string) => void
  onSelect: (date: string) => void
}) {
  const { t } = useTranslation()
  const compact = useIsCompactViewport()
  const headingId = useId()
  const calendarRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)
  const [focusedDay, setFocusedDay] = useState(from || to || today)
  const lastMonth = compact ? month : calendarMonth(shiftCalendarMonth(month, 1))
  const months = compact || lastMonth === month ? [month] : [month, lastMonth]
  const firstVisible = month < min ? min : month
  const tabStop =
    focusedDay >= firstVisible && focusedDay <= max && calendarMonth(focusedDay) <= lastMonth
      ? focusedDay
      : clampCalendarDate(firstVisible, min, max)
  const monthFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' })
  const dayFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'full' })
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(2024, 0, 1 + index)
    return {
      short: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day),
      full: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(day),
    }
  })

  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    const day = calendarRef.current?.querySelector<HTMLButtonElement>(
      `[data-calendar-day="${pendingFocus.current}"]`,
    )
    if (day) {
      day.focus()
      pendingFocus.current = null
    }
  }, [month, focusedDay, compact])

  const moveFocus = (next: string) => {
    const date = clampCalendarDate(next, min, max)
    pendingFocus.current = date
    setFocusedDay(date)
    if (calendarMonth(date) < month || calendarMonth(date) > lastMonth) {
      onMonthChange(calendarMonth(date))
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const weekday = (parseCalendarDate(date)!.getDay() + 6) % 7
    let next: string
    switch (event.key) {
      case 'ArrowLeft':
        next = shiftCalendarDate(date, -1)
        break
      case 'ArrowRight':
        next = shiftCalendarDate(date, 1)
        break
      case 'ArrowUp':
        next = shiftCalendarDate(date, -7)
        break
      case 'ArrowDown':
        next = shiftCalendarDate(date, 7)
        break
      case 'Home':
        next = shiftCalendarDate(date, -weekday)
        break
      case 'End':
        next = shiftCalendarDate(date, 6 - weekday)
        break
      case 'PageUp':
        next = shiftCalendarMonth(date, event.shiftKey ? -12 : -1)
        break
      case 'PageDown':
        next = shiftCalendarMonth(date, event.shiftKey ? 12 : 1)
        break
      default:
        return
    }
    event.preventDefault()
    moveFocus(next)
  }

  return (
    <div ref={calendarRef} className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-md"
          aria-label={t('dateRangePicker.previousMonth')}
          disabled={month <= calendarMonth(min)}
          onClick={() => onMonthChange(calendarMonth(shiftCalendarMonth(month, -1)))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p className="text-label text-center" aria-live="polite" aria-atomic="true">
          {months.map((value) => monthFormatter.format(parseCalendarDate(value)!)).join(' · ')}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-md"
          aria-label={t('dateRangePicker.nextMonth')}
          disabled={lastMonth >= calendarMonth(max)}
          onClick={() => onMonthChange(calendarMonth(shiftCalendarMonth(month, 1)))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {months.map((value, monthIndex) => (
          <table
            key={value}
            role="grid"
            aria-labelledby={`${headingId}-${monthIndex}`}
            className="w-full table-fixed border-separate border-spacing-0 self-start"
          >
            <caption id={`${headingId}-${monthIndex}`} className="sr-only">
              {monthFormatter.format(parseCalendarDate(value)!)}
            </caption>
            <thead>
              <tr>
                {weekDays.map((day) => (
                  <th
                    key={day.full}
                    scope="col"
                    className="text-muted-foreground text-meta pb-1 font-normal"
                  >
                    <abbr title={day.full} className="no-underline">
                      {day.short}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthWeeks(value).map((week, index) => (
                <tr key={index}>
                  {week.map((date, dayIndex) => {
                    if (!date) return <td key={dayIndex} />
                    const selected = date === from || date === to
                    const inRange = Boolean(from && to && date > from && date < to)
                    return (
                      <td
                        key={date}
                        aria-selected={selected || inRange}
                        className={cn('text-center', inRange && 'bg-primary/10')}
                      >
                        <Button
                          type="button"
                          size="icon-md"
                          variant={selected ? 'default' : 'ghost'}
                          className={cn(
                            'tabular-nums',
                            date === today && 'ring-primary/40 ring-1 ring-inset',
                          )}
                          data-calendar-day={date}
                          aria-label={dayFormatter.format(parseCalendarDate(date)!)}
                          aria-current={date === today ? 'date' : undefined}
                          disabled={date < min || date > max}
                          tabIndex={date === tabStop ? 0 : -1}
                          onFocus={() => setFocusedDay(date)}
                          onKeyDown={(event) => handleKeyDown(event, date)}
                          onClick={() => onSelect(date)}
                        >
                          {Number(date.slice(-2))}
                        </Button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}
