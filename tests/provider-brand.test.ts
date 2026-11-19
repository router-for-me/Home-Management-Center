import { createElement } from 'react'

import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  ModelLogo,
  ProviderLogo,
  resolveModelLogoId,
  resolveProviderLogoId,
} from '@/components/shared/provider-logo'

describe('model logo resolution', () => {
  test('recognizes the Muse and Imagen families across versions and routing prefixes', () => {
    for (const value of [
      'muse-spark-1.3',
      'muse-spark1.3',
      'team/muse-spark-1.3-contributor',
      'muse-wonder-1.0',
      'muse-wonder-full-1.0-contributor',
      'gemini/muse-wonder-1.0-contributor',
    ]) {
      expect(resolveModelLogoId(value)).toBe('muse')
    }
    expect(resolveModelLogoId('house-fast', 'Muse Wonder Full 1.0 Contributor')).toBe('muse')
    expect(resolveModelLogoId('team/private', 'Muse Wonder / Preview')).toBe('muse')
    expect(resolveModelLogoId('imagen-3.0-fast-generate-001')).toBe('gemini')
    expect(resolveModelLogoId('openai/models/imagen-4.0-ultra-generate-001')).toBe('gemini')
    expect(resolveModelLogoId('house-image', 'Imagen 3.0 Fast Generate')).toBe('gemini')
    expect(resolveModelLogoId('muse-spark-1.3-contributor', 'Imagen 3.0')).toBe('muse')
  })

  test('recognizes Llama and keeps unrelated names neutral', () => {
    for (const value of [
      'Llama3.1-8B',
      'llama-3.1-8b',
      'Meta-Llama-3.1-8B',
      'team/Meta-Llama-3.1-8B',
      'meta-llama/Llama-3.1-8B',
    ]) {
      expect(resolveModelLogoId(value)).toBe('meta')
    }
    for (const value of [
      'metadata-search',
      'metamath',
      'amusement',
      'llamaindex',
      'meta-llamaindex',
      'muse-sparkle',
      'muse-wonderland',
      'muse-private',
      'amuse-wonder-1',
      'imagenet-3',
      'vertex/private/imagenerator',
      'team/metadata-search',
    ]) {
      expect(resolveModelLogoId(value)).toBeNull()
    }
  })
  test('reads the vendor off the model ID, not off the provider that serves it', () => {
    // The two shapes that made this necessary: a GLM coding plan wired through
    // `codex-api-key` reports `providers: ["codex"]`, and a DeepSeek endpoint
    // wired through `claude-api-key` reports `providers: ["claude"]`. Neither
    // identifier is consulted here, so neither can mislabel the card.
    expect(resolveModelLogoId('glm-4.6')).toBe('glm')
    expect(resolveModelLogoId('deepseek-chat')).toBe('deepseek')
    expect(resolveModelLogoId('deepseek-reasoner')).toBe('deepseek')
  })

  test('names the first-party vendors from their own IDs', () => {
    expect(resolveModelLogoId('claude-sonnet-4-6')).toBe('claude')
    expect(resolveModelLogoId('gemini-2.5-pro')).toBe('gemini')
    expect(resolveModelLogoId('gpt-5-codex')).toBe('openai')
    expect(resolveModelLogoId('gpt-oss-120b')).toBe('openai')
    expect(resolveModelLogoId('o3')).toBe('openai')
    expect(resolveModelLogoId('o4-mini')).toBe('openai')
    expect(resolveModelLogoId('grok-4')).toBe('xai')
    expect(resolveModelLogoId('kimi-k2-0905-preview')).toBe('kimi')
    expect(resolveModelLogoId('qwen3-max')).toBe('qwen')
    expect(resolveModelLogoId('MiniMax-M2')).toBe('minimax')
  })

  test('reads through a namespace prefix', () => {
    expect(resolveModelLogoId('anthropic/claude-sonnet-4.6')).toBe('claude')
    expect(resolveModelLogoId('deepseek/deepseek-v3.1')).toBe('deepseek')
    expect(resolveModelLogoId('teamA/gpt-5-codex')).toBe('openai')
  })

  test('answers null rather than guessing when the ID says nothing', () => {
    // An operator alias is the common case, and the honest answer is that this
    // catalog does not know who built the model. Callers render a neutral mark;
    // falling back to the provider logo is what this whole function replaces.
    expect(resolveModelLogoId('my-alias')).toBeNull()
    expect(resolveModelLogoId('internal-model-1')).toBeNull()
    expect(resolveModelLogoId(null)).toBeNull()
    expect(resolveModelLogoId('')).toBeNull()
  })

  test('matches on token boundaries so a substring cannot claim a model', () => {
    expect(resolveModelLogoId('example-model')).toBeNull()
    expect(resolveModelLogoId('sonar-pro')).toBeNull()
    expect(resolveModelLogoId('command-r-plus')).toBeNull()
  })

  test('falls back to the display name when the ID is an opaque alias', () => {
    // `models: [{ name: glm-4.6, alias: house-fast }]` publishes the alias as
    // the ID and the upstream name as the display name, so the second string is
    // the only evidence left.
    expect(resolveModelLogoId('house-fast', 'GLM-4.6')).toBe('glm')
    expect(resolveModelLogoId('house-fast', null)).toBeNull()
    expect(resolveModelLogoId('codex/house-fast', 'Muse Spark 1.3 Contributor')).toBe('muse')
    expect(resolveModelLogoId('gemini/house-fast')).toBeNull()
    expect(resolveModelLogoId('gemini/house-fast', 'gemini/house-fast')).toBeNull()
  })

  test.each([
    ['muse-spark-1.3-contributor', 'muse', 'meta', 'meta'],
    ['muse-wonder-full-1.0-contributor', 'muse', 'muse', 'meta'],
    ['imagen-3.0-fast-generate-001', 'gemini', 'vertex', 'vertex'],
  ])(
    '%s uses its model artwork alongside its serving provider',
    (modelId, modelMark, providerId, providerMark) => {
      const model = renderToStaticMarkup(createElement(ModelLogo, { modelId }))
      const provider = renderToStaticMarkup(createElement(ProviderLogo, { providerId }))
      expect(model).toContain(`data-provider-icon="${modelMark}"`)
      expect(model).toContain(`@lobehub/icons-static-svg/icons/${modelMark}-color.svg`)
      expect(provider).toContain(`data-provider-icon="${providerMark}"`)
    },
  )
})

describe('provider logo resolution', () => {
  test.each(['devin', 'groq'])(
    'uses the installed community collection for %s instead of a monogram',
    (providerId) => {
      const directory = join(
        dirname(fileURLToPath(import.meta.resolve('@lobehub/icons-static-svg/package.json'))),
        'icons',
      )
      expect(
        existsSync(join(directory, `${providerId}-color.svg`)) ||
          existsSync(join(directory, `${providerId}.svg`)),
      ).toBe(true)
      const markup = renderToStaticMarkup(createElement(ProviderLogo, { providerId }))
      expect(markup).toContain(`data-provider-icon="${providerId}"`)
      expect(markup).toContain(`@lobehub/icons-static-svg/icons/${providerId}`)
    },
  )

  test('resolves exact Meta aliases and preserves unrelated provider names', () => {
    for (const value of ['meta', 'muse', ' Meta ', 'MUSE']) {
      expect(resolveProviderLogoId(value)).toBe('meta')
    }
    for (const value of ['metadata-search', 'metamath', 'amusement', 'llamaindex']) {
      expect(resolveProviderLogoId(value)).toBe(value)
    }
    expect(resolveProviderLogoId('openai-metadata-proxy')).toBe('openai')
  })
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

  test('recognizes provider identifiers named after a model family', () => {
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
