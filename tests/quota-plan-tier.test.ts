import { describe, expect, test } from 'bun:test'

import { resolveQuotaPlanTier } from '@/features/upstream/quota-plan-tier'

describe('quota plan presentation', () => {
  test.each([
    ['antigravity', 'Free', 'standard'],
    ['antigravity', 'Pro', 'silver'],
    ['antigravity', 'Ultra Lite', 'gold'],
    ['antigravity', 'Ultra', 'flagship'],
    ['codex', 'Plus', 'silver'],
    ['codex', 'Pro 5x', 'gold'],
    ['codex', 'Pro 20x', 'flagship'],
    ['claude', 'Pro', 'silver'],
    ['claude', 'Max 5x', 'gold'],
    ['claude', 'Max 20x', 'flagship'],
    ['xai', 'SuperGrok', 'gold'],
    ['xai', 'SuperGrok Heavy', 'flagship'],
    ['kimi', 'Allegretto', 'gold'],
    ['kimi', 'Allegro', 'flagship'],
  ])('recognizes the confirmed %s %s tier', (provider, name, expected) => {
    expect(resolveQuotaPlanTier(provider, { name, premium: false })).toBe(expected)
  })

  test('normalizes case and separators without using ambiguous partial name matches', () => {
    expect(resolveQuotaPlanTier(' CODEX ', { name: ' PRO_20X ', premium: false })).toBe('flagship')
    expect(resolveQuotaPlanTier('claude', { name: 'Max 200x Preview', premium: false })).toBe(
      'standard',
    )
    expect(resolveQuotaPlanTier('unknown', { name: 'Ultra', premium: false })).toBe('standard')
  })

  test('uses the backend premium indication conservatively for unrecognized plans', () => {
    expect(resolveQuotaPlanTier('custom', { name: 'Enterprise X', premium: true })).toBe('gold')
    expect(resolveQuotaPlanTier('custom', { name: 'Enterprise X', premium: false })).toBe(
      'standard',
    )
    expect(resolveQuotaPlanTier('antigravity', { name: 'Pro', premium: true })).toBe('silver')
  })
})
