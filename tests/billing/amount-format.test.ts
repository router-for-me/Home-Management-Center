import { describe, expect, test } from 'bun:test'

import {
  formatCreditAmount,
  formatDetailedCreditAmount,
  formatModelPrice,
  formatSignedCreditAmount,
  formatSignedDetailedCreditAmount,
  formatUsageAmount,
} from '../../src/lib/billing/amount-format'

const locale = 'en-US'

describe('billing amount formatting', () => {
  test('uses fixed two-decimal disclosure for balances and aggregate amounts', () => {
    expect(formatCreditAmount(123.456789, locale)).toBe('123.46')
    expect(formatCreditAmount(18.75, locale)).toBe('18.75')
    expect(formatCreditAmount(12, locale)).toBe('12.00')
    expect(formatCreditAmount(0, locale)).toBe('0.00')
    expect(formatCreditAmount(-0, locale)).toBe('0.00')
  })

  test('does not present a non-zero summary amount as zero', () => {
    expect(formatCreditAmount(0.0049, locale)).toBe('<0.01')
    expect(formatCreditAmount(-0.0049, locale)).toBe('-<0.01')
    expect(formatSignedCreditAmount(0.0049, locale)).toBe('+<0.01')
    expect(formatSignedCreditAmount(-0.0049, locale)).toBe('-<0.01')
  })

  test('keeps higher precision in transaction and audit details', () => {
    expect(formatDetailedCreditAmount(123.456789, locale)).toBe('123.456789')
    expect(formatDetailedCreditAmount(0.0049, locale)).toBe('0.0049')
    expect(formatSignedDetailedCreditAmount(-0.0049, locale)).toBe('-0.0049')
    expect(formatDetailedCreditAmount(0.0000004, locale)).toBe('<0.000001')
  })

  test('keeps model prices and per-request usage costs on the precise scale', () => {
    expect(formatModelPrice(2.5, locale)).toBe('2.50')
    expect(formatModelPrice(0.000001, locale)).toBe('0.000001')
    expect(formatUsageAmount(0.0049, locale)).toBe('0.0049')
  })
})
