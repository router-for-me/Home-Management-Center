import { describe, expect, test } from 'bun:test'

import {
  normalizeBillingOverview,
  normalizeBillingSettingsResponse,
  toBillingQueryParams,
} from '../../src/lib/api/management/billing'
import type { BillingFilters } from '../../src/lib/api/management/billing-types'

function createFilters(overrides: Partial<BillingFilters> = {}): BillingFilters {
  return {
    from: '2026-07-19',
    to: '2026-07-19',
    timezone: 'Asia/Shanghai',
    user: '',
    provider: '',
    model: '',
    ...overrides,
  }
}

function createOverviewResponse() {
  return {
    overview: {
      range: {
        from: '2026-07-19',
        to: '2026-07-19',
        from_at: '2026-07-18T16:00:00Z',
        to_at_exclusive: '2026-07-19T16:00:00Z',
        timezone: 'Asia/Shanghai',
      },
      total_charge_amount: 3,
      total_recharge_amount: 10,
      total_deduct_amount: 1,
      total_balance: 20,
      request_count: 2,
      input_tokens: 100,
      output_tokens: 50,
      cache_tokens: 25,
      active_user_count: 1,
      daily_trend: [],
      top_users: [],
      top_models: [],
      top_providers: [],
    },
  }
}

describe('Management Billing API contract', () => {
  test('sends calendar dates with the configured report timezone', () => {
    expect(
      toBillingQueryParams(
        createFilters({ user: ' 42 ', provider: ' openai ', model: ' gpt-4.1-mini ' }),
        { limit: 25, offset: 50 },
      ),
    ).toEqual({
      from: '2026-07-19',
      to: '2026-07-19',
      timezone: 'Asia/Shanghai',
      user: '42',
      user_id: '42',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      limit: 25,
      offset: 50,
    })
  })

  test('requires the documented nested range contract', () => {
    expect(normalizeBillingOverview(createOverviewResponse()).range).toEqual({
      from: '2026-07-19',
      to: '2026-07-19',
      fromAt: '2026-07-18T16:00:00Z',
      toAtExclusive: '2026-07-19T16:00:00Z',
      timezone: 'Asia/Shanghai',
    })

    const missingTimezone = createOverviewResponse()
    delete (missingTimezone.overview.range as Partial<typeof missingTimezone.overview.range>)
      .timezone
    expect(() => normalizeBillingOverview(missingTimezone)).toThrow(
      'billing_overview_contract_invalid',
    )

    expect(() =>
      normalizeBillingOverview({
        from: '2026-07-19',
        to: '2026-07-19',
        timezone: 'Asia/Shanghai',
      }),
    ).toThrow('billing_overview_contract_invalid')
  })

  test('requires report_timezone in Billing settings responses', () => {
    expect(
      normalizeBillingSettingsResponse({
        service_tier_source: 'response',
        report_timezone: 'America/Los_Angeles',
      }),
    ).toMatchObject({
      serviceTierSource: 'response',
      reportTimezone: 'America/Los_Angeles',
      supported: true,
    })

    expect(() => normalizeBillingSettingsResponse({ service_tier_source: 'request' })).toThrow(
      'billing_settings_contract_invalid',
    )
  })
})
