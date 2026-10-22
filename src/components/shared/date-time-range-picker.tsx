import { useId, useRef, useState } from 'react'

import { ArrowLeft, CalendarDays, Check, ChevronDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DateRangeCalendar } from '@/components/shared/date-range-calendar'
import { fieldClassName, formGridClassName } from '@/components/shared/form-layout'
import { Button } from '@/components/ui/button'
import type { ControlSize } from '@/components/ui/control-size'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  type DateRange,
  type DateRangeBoundary,
  type DateRangePrecision,
  calendarMonth,
  createDateRangeDraft,
  isCalendarDateInBounds,
  isDateRangeValid,
  isDateRangeValueValid,
  maximumCalendarDate,
  minimumCalendarDate,
  sanitizeCalendarDateInput,
  splitDateRangeValue,
  todayCalendarDate,
  updateDateRangeBoundary,
} from '@/lib/date-range'
import { cn } from '@/lib/utils'

export function DateTimeRangePicker<Preset extends string = string>({
  from,
  to,
  precision = 'datetime',
  preset,
  presets = [],
  onPresetChange,
  timeZone,
  disabled,
  size = 'md',
  className,
  onChange,
}: {
  from: string
  to: string
  precision?: DateRangePrecision
  preset?: Preset | 'custom'
  presets?: readonly { value: Preset; label: string }[]
  onPresetChange?: (preset: Preset) => void
  timeZone?: string
  disabled?: boolean
  size?: ControlSize
  className?: string
  onChange: (range: DateRange) => void
}) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const fromInput = useRef<HTMLInputElement>(null)
  const toInput = useRef<HTMLInputElement>(null)
  const presetList = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [draft, setDraft] = useState<DateRange>({ from, to })
  const [activeBoundary, setActiveBoundary] = useState<DateRangeBoundary>('from')
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = todayCalendarDate(zone)
  const [month, setMonth] = useState(() => calendarMonth(today))
  const hasPresets = presets.length > 0 && Boolean(onPresetChange)
  const appliedPreset = presets.find((option) => option.value === preset)
  const label = t(precision === 'date' ? 'dateRangePicker.dateLabel' : 'dateRangePicker.timeLabel')
  const fromParts = splitDateRangeValue(draft.from)
  const toParts = splitDateRangeValue(draft.to)
  const min =
    activeBoundary === 'to' && isCalendarDateInBounds(fromParts.date)
      ? fromParts.date
      : minimumCalendarDate
  const max =
    activeBoundary === 'from' && isCalendarDateInBounds(toParts.date)
      ? toParts.date
      : maximumCalendarDate
  const valid = isDateRangeValid(draft, precision)
  const hasInvalidDate = [fromParts.date, toParts.date].some(
    (value) => value && !isCalendarDateInBounds(value),
  )
  const error = !valid
    ? t(hasInvalidDate ? 'dateRangePicker.invalidDate' : 'dateRangePicker.invalidRange')
    : ''
  const formatValue = (value: string) => value.replace('T', ' ')
  const rangeText =
    appliedPreset?.label ||
    (from && to
      ? `${formatValue(from)} ${t('dateRangePicker.separator')} ${formatValue(to)}`
      : from
        ? t('dateRangePicker.fromOnly', { date: formatValue(from) })
        : to
          ? t('dateRangePicker.toOnly', { date: formatValue(to) })
          : t('dateRangePicker.placeholder'))

  const focusBoundary = (boundary: DateRangeBoundary) => {
    requestAnimationFrame(() => (boundary === 'from' ? fromInput : toInput).current?.focus())
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const next = createDateRangeDraft({ from, to }, precision)
      const start = splitDateRangeValue(next.from || next.to).date
      setDraft(next)
      setActiveBoundary('from')
      setMonth(calendarMonth(isCalendarDateInBounds(start) ? start : today))
      setCustom(!hasPresets || preset === 'custom')
    }
    setOpen(nextOpen)
  }

  const updateDate = (boundary: DateRangeBoundary, date: string) => {
    setDraft((current) => {
      const { time } = splitDateRangeValue(current[boundary])
      const value = !date
        ? ''
        : precision === 'date'
          ? date
          : `${date}T${time || (boundary === 'from' ? '00:00' : '23:59')}`
      return updateDateRangeBoundary(current, boundary, value, precision)
    })
    if (isCalendarDateInBounds(date)) setMonth(calendarMonth(date))
  }

  const selectDate = (date: string) => {
    updateDate(activeBoundary, date)
    if (activeBoundary === 'from') {
      setActiveBoundary('to')
      focusBoundary('to')
    }
  }

  const clearDraft = () => {
    setDraft({ from: '', to: '' })
    setActiveBoundary('from')
    setMonth(calendarMonth(today))
    focusBoundary('from')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={disabled}
          className={cn('w-full max-w-full min-w-0 justify-start', className)}
          aria-label={`${label}: ${rangeText}`}
          title={rangeText}
        >
          <CalendarDays aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">{rangeText}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        aria-labelledby={`${id}-heading`}
        aria-describedby={`${id}-timezone`}
        className={cn(
          'flex max-h-[min(calc(100dvh-1rem),var(--radix-popover-content-available-height))] flex-col overflow-hidden p-0',
          custom
            ? 'w-[min(calc(100vw-1rem),42rem)]'
            : 'w-max max-w-[calc(100vw-1rem)] min-w-(--radix-popover-trigger-width)',
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (custom) fromInput.current?.focus()
          else {
            const selected =
              presetList.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
            const first = presetList.current?.querySelector<HTMLButtonElement>('button')
            ;(selected || first)?.focus()
          }
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
          {custom && hasPresets ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-md"
              aria-label={t('dateRangePicker.presets')}
              onClick={() => {
                setCustom(false)
                requestAnimationFrame(() =>
                  presetList.current?.querySelector<HTMLButtonElement>('button')?.focus(),
                )
              }}
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
          ) : null}
          <h2 id={`${id}-heading`} className="text-label flex-1">
            {custom ? t('dateRangePicker.custom') : label}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            aria-label={t('close')}
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-2 sm:p-3">
          {custom ? (
            <div className="space-y-3">
              <div className={formGridClassName}>
                {(['from', 'to'] as const).map((boundary) => {
                  const parts = boundary === 'from' ? fromParts : toParts
                  return (
                    <label key={boundary} className={fieldClassName}>
                      <span>
                        {t(
                          boundary === 'from'
                            ? 'dateRangePicker.fromDate'
                            : 'dateRangePicker.toDate',
                        )}
                      </span>
                      <Input
                        ref={boundary === 'from' ? fromInput : toInput}
                        size="md"
                        type="text"
                        autoComplete="off"
                        placeholder={t('dateRangePicker.datePlaceholder')}
                        value={parts.date}
                        aria-invalid={
                          (Boolean(parts.date) && !isCalendarDateInBounds(parts.date)) || undefined
                        }
                        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
                        className={cn(activeBoundary === boundary && 'border-primary')}
                        onFocus={() => {
                          setActiveBoundary(boundary)
                          if (isCalendarDateInBounds(parts.date))
                            setMonth(calendarMonth(parts.date))
                        }}
                        onChange={(event) =>
                          updateDate(boundary, sanitizeCalendarDateInput(event.target.value))
                        }
                      />
                    </label>
                  )
                })}
              </div>
              <p id={`${id}-hint`} className="text-muted-foreground text-meta">
                {t('dateRangePicker.dateHint')}
              </p>
              <p className="text-label" aria-live="polite">
                {t(
                  activeBoundary === 'from'
                    ? 'dateRangePicker.selectStart'
                    : 'dateRangePicker.selectEnd',
                )}
              </p>
              <DateRangeCalendar
                from={isCalendarDateInBounds(fromParts.date) ? fromParts.date : ''}
                to={isCalendarDateInBounds(toParts.date) ? toParts.date : ''}
                month={month}
                today={today}
                min={min}
                max={max}
                locale={i18n.resolvedLanguage || i18n.language}
                onMonthChange={setMonth}
                onSelect={selectDate}
              />
              {precision === 'datetime' ? (
                <div className={formGridClassName}>
                  {(['from', 'to'] as const).map((boundary) => {
                    const parts = boundary === 'from' ? fromParts : toParts
                    return (
                      <label key={boundary} className={fieldClassName}>
                        <span>
                          {t(
                            boundary === 'from'
                              ? 'dateRangePicker.fromTime'
                              : 'dateRangePicker.toTime',
                          )}
                        </span>
                        <Input
                          size="md"
                          type="time"
                          step={60}
                          value={parts.time}
                          disabled={!isCalendarDateInBounds(parts.date)}
                          aria-invalid={
                            !isDateRangeValueValid(draft[boundary], precision) || undefined
                          }
                          aria-describedby={error ? `${id}-error` : undefined}
                          onChange={(event) => {
                            const value = `${parts.date}T${event.target.value}`
                            setDraft((current) =>
                              updateDateRangeBoundary(current, boundary, value, precision),
                            )
                          }}
                        />
                      </label>
                    )
                  })}
                </div>
              ) : null}
              {error ? (
                <p id={`${id}-error`} className="text-destructive text-meta" role="status">
                  {error}
                </p>
              ) : null}
            </div>
          ) : (
            <div ref={presetList} className="flex flex-col gap-1">
              {presets.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  size="md"
                  className="justify-between"
                  aria-pressed={preset === option.value}
                  onClick={() => {
                    onPresetChange?.(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                  {preset === option.value ? <Check aria-hidden="true" /> : null}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="md"
                className="justify-start"
                onClick={() => {
                  setCustom(true)
                  focusBoundary('from')
                }}
              >
                <CalendarDays aria-hidden="true" />
                {t('dateRangePicker.custom')}
              </Button>
            </div>
          )}
          <p id={`${id}-timezone`} className="text-muted-foreground text-meta mt-3 break-words">
            {t('dateRangePicker.timezone', { timezone: zone })}
          </p>
        </div>
        {custom ? (
          <div className="flex shrink-0 flex-col gap-2 border-t p-2 sm:flex-row sm:justify-end sm:p-3">
            <Button
              type="button"
              size="md"
              variant="text"
              className="sm:mr-auto"
              onClick={clearDraft}
            >
              {t('dateRangePicker.clear')}
            </Button>
            <Button type="button" size="md" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="md"
              disabled={!valid}
              onClick={() => {
                onChange(draft)
                setOpen(false)
              }}
            >
              {t('dateRangePicker.apply')}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
