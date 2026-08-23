import { describe, expect, test } from 'bun:test'

import { resolveModelVendorId, resolveProviderLogoId } from '@/components/shared/provider-logo'

describe('model vendor resolution', () => {
  test('reads the vendor off the model ID, not off the provider that serves it', () => {
    // The two shapes that made this necessary: a GLM coding plan wired through
    // `codex-api-key` reports `providers: ["codex"]`, and a DeepSeek endpoint
    // wired through `claude-api-key` reports `providers: ["claude"]`. Neither
    // identifier is consulted here, so neither can mislabel the card.
    expect(resolveModelVendorId('glm-4.6')).toBe('glm')
    expect(resolveModelVendorId('deepseek-chat')).toBe('deepseek')
    expect(resolveModelVendorId('deepseek-reasoner')).toBe('deepseek')
  })

  test('names the first-party vendors from their own IDs', () => {
    expect(resolveModelVendorId('claude-sonnet-4-6')).toBe('claude')
    expect(resolveModelVendorId('gemini-2.5-pro')).toBe('gemini')
    expect(resolveModelVendorId('gpt-5-codex')).toBe('openai')
    expect(resolveModelVendorId('gpt-oss-120b')).toBe('openai')
    expect(resolveModelVendorId('o3')).toBe('openai')
    expect(resolveModelVendorId('o4-mini')).toBe('openai')
    expect(resolveModelVendorId('grok-4')).toBe('xai')
    expect(resolveModelVendorId('kimi-k2-0905-preview')).toBe('kimi')
    expect(resolveModelVendorId('qwen3-max')).toBe('qwen')
    expect(resolveModelVendorId('MiniMax-M2')).toBe('minimax')
  })

  test('reads through a namespace prefix', () => {
    expect(resolveModelVendorId('anthropic/claude-sonnet-4.6')).toBe('claude')
    expect(resolveModelVendorId('deepseek/deepseek-v3.1')).toBe('deepseek')
    expect(resolveModelVendorId('teamA/gpt-5-codex')).toBe('openai')
  })

  test('answers null rather than guessing when the ID says nothing', () => {
    // An operator alias is the common case, and the honest answer is that this
    // catalog does not know who built the model. Callers render a neutral mark;
    // falling back to the provider logo is what this whole function replaces.
    expect(resolveModelVendorId('my-alias')).toBeNull()
    expect(resolveModelVendorId('internal-model-1')).toBeNull()
    expect(resolveModelVendorId(null)).toBeNull()
    expect(resolveModelVendorId('')).toBeNull()
  })

  test('matches on token boundaries so a substring cannot claim a model', () => {
    expect(resolveModelVendorId('example-model')).toBeNull()
    expect(resolveModelVendorId('sonar-pro')).toBeNull()
    expect(resolveModelVendorId('command-r-plus')).toBeNull()
  })

  test('falls back to the display name when the ID is an opaque alias', () => {
    // `models: [{ name: glm-4.6, alias: house-fast }]` publishes the alias as
    // the ID and the upstream name as the display name, so the second string is
    // the only evidence left.
    expect(resolveModelVendorId('house-fast', 'GLM-4.6')).toBe('glm')
    expect(resolveModelVendorId('house-fast', null)).toBeNull()
  })
})

describe('provider logo resolution', () => {
  test('lands both spellings of the compatibility provider on one mark', () => {
    // The server emits `openai-compatibility`; this app's own provider
    // descriptors spell it `openaiCompatibility`. Keying a table on one of them
    // left the other rendering a two-letter fallback.
    expect(resolveProviderLogoId('openai-compatibility')).toBe('openai')
    expect(resolveProviderLogoId('openaiCompatibility')).toBe('openai')
    expect(resolveProviderLogoId('openai')).toBe('openai')
  })

  test('keeps a provider that is not a vendor as itself', () => {
    // Codex is a product of OpenAI's, but a `codex` provider row must keep the
    // Codex mark: the usage and billing pages are reporting on the provider.
    expect(resolveProviderLogoId('codex')).toBe('codex')
    expect(resolveProviderLogoId('vertex')).toBe('vertex')
    expect(resolveProviderLogoId('antigravity')).toBe('antigravity')
  })

  test('folds the protocol-family spellings onto their provider', () => {
    expect(resolveProviderLogoId('anthropic')).toBe('claude')
    expect(resolveProviderLogoId('google')).toBe('gemini')
    expect(resolveProviderLogoId('interactions')).toBe('gemini')
    expect(resolveProviderLogoId('gemini-interactions')).toBe('gemini')
    expect(resolveProviderLogoId('grok')).toBe('xai')
    expect(resolveProviderLogoId('x-ai')).toBe('xai')
    expect(resolveProviderLogoId('moonshot')).toBe('kimi')
  })

  test('recognizes a compatibility entry named after its vendor', () => {
    expect(resolveProviderLogoId('glm')).toBe('glm')
    expect(resolveProviderLogoId('deepseek')).toBe('deepseek')
    expect(resolveProviderLogoId('iflow')).toBe('iflow')
  })

  test('recognizes a model ID, because usage reporting groups by model too', () => {
    expect(resolveProviderLogoId('deepseek-chat')).toBe('deepseek')
    expect(resolveProviderLogoId('glm-4.6')).toBe('glm')
  })

  test('returns an unknown provider unchanged so it still gets a stable mark', () => {
    expect(resolveProviderLogoId('siliconflow')).toBe('siliconflow')
    expect(resolveProviderLogoId('  SiliconFlow ')).toBe('siliconflow')
    expect(resolveProviderLogoId(null)).toBeNull()
    expect(resolveProviderLogoId('   ')).toBeNull()
  })
})
