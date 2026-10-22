import { describe, expect, test } from 'bun:test'

import {
  createDateRangeDraft,
  isDateRangeValid,
  parseCalendarDate,
  sanitizeCalendarDateInput,
  shiftCalendarDate,
  shiftCalendarMonth,
  updateDateRangeBoundary,
} from '@/lib/date-range'

// The edited endpoint wins, whether the edit came from a calendar or the keyboard.
describe('date range editing', () => {
  test('aligns the opposite date in both directions', () => {
    const range = { from: '2026-10-15', to: '2026-10-20' }
    expect(updateDateRangeBoundary(range, 'from', '2026-10-22', 'date')).toEqual({
      from: '2026-10-22',
      to: '2026-10-22',
    })
    expect(updateDateRangeBoundary(range, 'to', '2026-10-10', 'date')).toEqual({
      from: '2026-10-10',
      to: '2026-10-10',
    })
  })

  test('clamps times in both directions, including when reselecting a date', () => {
    const range = { from: '2026-10-14T18:00', to: '2026-10-15T09:00' }
    expect(updateDateRangeBoundary(range, 'from', '2026-10-15T18:00', 'datetime')).toEqual({
      from: '2026-10-15T18:00',
      to: '2026-10-15T18:00',
    })
    expect(updateDateRangeBoundary(range, 'to', '2026-10-14T09:00', 'datetime')).toEqual({
      from: '2026-10-14T09:00',
      to: '2026-10-14T09:00',
    })
  })

  test('leaves the other endpoint untouched during partial or invalid typing', () => {
    const range = { from: '2026-10-15', to: '2026-10-20' }
    for (const value of ['202', '2026-02-30', '', '202666-10-15']) {
      expect(updateDateRangeBoundary(range, 'from', value, 'date')).toEqual({
        ...range,
        from: value,
      })
    }
  })

  test('caps typed and pasted years without changing the month and day', () => {
    expect(sanitizeCalendarDateInput('202666-10-15')).toBe('2026-10-15')
    expect(sanitizeCalendarDateInput('20266-10-15')).toBe('2026-10-15')
    expect(sanitizeCalendarDateInput('2026-10-')).toBe('2026-10-')
  })

  test('rejects nonexistent dates, incomplete times and inverted ranges', () => {
    expect(parseCalendarDate('2024-02-29')).not.toBeNull()
    for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '202666-10-15']) {
      expect(parseCalendarDate(date)).toBeNull()
    }
    for (const from of [
      '2026-10-15T',
      '2026-10-15T24:00',
      '2026-10-15T09:60',
      '2026-10-15T09:00Tx',
    ]) {
      expect(isDateRangeValid({ from, to: '' }, 'datetime')).toBe(false)
    }
    expect(isDateRangeValid({ from: '2026-10-16', to: '2026-10-15' }, 'date')).toBe(false)
    expect(isDateRangeValid({ from: '1969-12-31', to: '' }, 'date')).toBe(false)
    expect(isDateRangeValid({ from: '9999-12-31', to: '' }, 'date')).toBe(true)
    expect(isDateRangeValid({ from: '', to: '' }, 'date')).toBe(true)
    expect(isDateRangeValid({ from: '', to: '2026-10-15' }, 'date')).toBe(true)
  })

  test('opens legacy date-only ranges as editable minute-precision drafts', () => {
    expect(createDateRangeDraft({ from: '2026-10-15', to: '2026-10-15' }, 'datetime')).toEqual({
      from: '2026-10-15T00:00',
      to: '2026-10-15T23:59',
    })
  })

  test('navigates month ends and leap years without escaping four-digit years', () => {
    expect(shiftCalendarMonth('2024-01-31', 1)).toBe('2024-02-29')
    expect(shiftCalendarMonth('2024-02-29', 12)).toBe('2025-02-28')
    expect(shiftCalendarDate('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftCalendarDate('1970-01-01', -1)).toBe('1970-01-01')
    expect(shiftCalendarMonth('1970-01-01', -1)).toBe('1970-01-01')
    expect(shiftCalendarDate('9999-12-31', 1)).toBe('9999-12-31')
    expect(shiftCalendarMonth('9999-12-31', 1)).toBe('9999-12-31')
  })
})
