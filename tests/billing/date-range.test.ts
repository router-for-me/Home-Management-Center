import { describe, expect, test } from 'bun:test'

import {
  createDateRangeInTimeZone,
  createLocalDateRange,
  createLocalMonthToDateRange,
  createMonthToDateRangeInTimeZone,
  formatLocalDateInput,
  toBillingDateRangeParams,
} from '../../src/lib/billing/date-range'

describe('billing local calendar ranges', () => {
  test('formats early-morning dates from local calendar fields', () => {
    const earlyMorning = new Date(2026, 6, 10, 7, 30)
    earlyMorning.toISOString = () => '2026-07-09T23:30:00.000Z'

    expect(formatLocalDateInput(earlyMorning)).toBe('2026-07-10')
  })

  test('creates today, seven-day, and thirty-day ranges by calendar date', () => {
    const now = new Date(2026, 6, 10, 7, 30)

    expect(createLocalDateRange(0, now)).toEqual({ from: '2026-07-10', to: '2026-07-10' })
    expect(createLocalDateRange(6, now)).toEqual({ from: '2026-07-04', to: '2026-07-10' })
    expect(createLocalDateRange(29, now)).toEqual({ from: '2026-06-11', to: '2026-07-10' })
  })

  test('creates the current month range from local calendar dates', () => {
    expect(createLocalMonthToDateRange(new Date(2026, 6, 10, 7, 30))).toEqual({
      from: '2026-07-01',
      to: '2026-07-10',
    })
  })

  test('uses the selected IANA timezone instead of the browser timezone', () => {
    const instant = new Date('2026-07-19T00:30:00Z')

    expect(createDateRangeInTimeZone(0, 'Asia/Tokyo', instant)).toEqual({
      from: '2026-07-19',
      to: '2026-07-19',
    })
    expect(createDateRangeInTimeZone(0, 'America/Los_Angeles', instant)).toEqual({
      from: '2026-07-18',
      to: '2026-07-18',
    })
  })

  test('subtracts calendar dates across DST changes instead of fixed 24-hour durations', () => {
    expect(
      createDateRangeInTimeZone(1, 'America/Los_Angeles', new Date('2026-03-09T06:30:00Z')),
    ).toEqual({ from: '2026-03-07', to: '2026-03-08' })

    expect(
      createDateRangeInTimeZone(1, 'America/Los_Angeles', new Date('2026-11-02T07:30:00Z')),
    ).toEqual({ from: '2026-10-31', to: '2026-11-01' })
  })

  test('creates month-to-date ranges in the selected timezone', () => {
    expect(
      createMonthToDateRangeInTimeZone('Asia/Shanghai', new Date('2026-07-31T16:30:00Z')),
    ).toEqual({ from: '2026-08-01', to: '2026-08-01' })
  })

  test('converts date inputs to a half-open local calendar range', () => {
    expect(toBillingDateRangeParams({ from: '2026-07-10', to: '2026-07-10' })).toEqual({
      from: new Date(2026, 6, 10, 0, 0, 0, 0).toISOString(),
      to: new Date(2026, 6, 11, 0, 0, 0, 0).toISOString(),
    })
  })

  test('preserves explicit timestamps and invalid date text for backend validation', () => {
    expect(
      toBillingDateRangeParams({
        from: '2026-07-10T00:00:00+08:00',
        to: '2026-07-10T23:59:59.999+08:00',
      }),
    ).toEqual({
      from: '2026-07-10T00:00:00+08:00',
      to: '2026-07-10T23:59:59.999+08:00',
    })
    expect(toBillingDateRangeParams({ from: '2026-02-30', to: '' })).toEqual({
      from: '2026-02-30',
      to: undefined,
    })
  })
})
