import { useEffect, useState } from 'react'

import ampLogo from '@/assets/icons/amp.svg'
import antigravityLogo from '@/assets/icons/antigravity.svg'
import claudeLogo from '@/assets/icons/claude.svg'
import codexLogo from '@/assets/icons/codex.svg'
import deepseekLogo from '@/assets/icons/deepseek.svg'
import geminiLogo from '@/assets/icons/gemini.svg'
import glmLogo from '@/assets/icons/glm.svg'
import grokLogo from '@/assets/icons/grok.svg'
import iflowLogo from '@/assets/icons/iflow.svg'
import kimiDarkLogo from '@/assets/icons/kimi-dark.svg'
import kimiLightLogo from '@/assets/icons/kimi-light.svg'
import minimaxLogo from '@/assets/icons/minimax.svg'
import openaiDarkLogo from '@/assets/icons/openai-dark.svg'
import openaiLightLogo from '@/assets/icons/openai-light.svg'
import qwenLogo from '@/assets/icons/qwen.svg'
import vertexLogo from '@/assets/icons/vertex.svg'
import { cn } from '@/lib/utils'

/**
 * Brand marks, keyed by a resolved brand id.
 *
 * The table serves two different questions — "which provider served this?" and
 * "who built this model?" — which is why some keys name a product (`codex`,
 * `vertex`, `antigravity`) and others name a company (`openai`, `glm`). The two
 * are resolved by `resolveProviderLogoId` and `resolveModelVendorId`
 * respectively and must not be substituted for one another.
 */
const brandLogos: Record<string, { src: string; darkSrc?: string; className?: string }> = {
  gemini: { src: geminiLogo },
  claude: { src: claudeLogo },
  codex: { src: codexLogo },
  vertex: { src: vertexLogo },
  antigravity: { src: antigravityLogo },
  kimi: { src: kimiLightLogo, darkSrc: kimiDarkLogo },
  openai: { src: openaiLightLogo, darkSrc: openaiDarkLogo },
  xai: { src: grokLogo, className: 'p-0.5 dark:invert' },
  deepseek: { src: deepseekLogo },
  glm: { src: glmLogo },
  qwen: { src: qwenLogo },
  minimax: { src: minimaxLogo },
  iflow: { src: iflowLogo },
  amp: { src: ampLogo },
}

const brandMarks: Record<
  string,
  {
    label: string
    className: string
  }
> = {
  gemini: {
    label: 'G',
    className: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  claude: {
    label: 'C',
    className: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  },
  codex: {
    label: 'Cx',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  vertex: {
    label: 'V',
    className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  openai: {
    label: 'AI',
    className: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  },
  xai: {
    label: 'xAI',
    className: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  },
}

/**
 * Provider aliases, tried in order.
 *
 * `providers[]`, `usage.provider` and Billing price rules all name the upstream
 * provider that served a request, and the same one arrives under several
 * spellings: the canonical registry key (`codex`), the protocol family its
 * executor speaks (`anthropic`), an operator-chosen compatibility name, or this
 * app's own descriptor id. The last one is why `openai-compatibility` and
 * `openaiCompatibility` both have to land on the same mark. Specific entries
 * come before general ones so a `codex` provider is never claimed by the OpenAI
 * rule.
 */
const providerAliases: Array<[brandId: string, matches: RegExp]> = [
  ['antigravity', /antigravity/],
  ['vertex', /vertex/],
  ['codex', /codex/],
  ['claude', /claude|anthropic/],
  ['gemini', /gemini|google/],
  ['kimi', /kimi|moonshot/],
  ['xai', /xai|x-ai|grok/],
  ['openai', /openai|chatgpt|^gpt|^o\d/],
]

/**
 * Model-ID vendor rules, tried in order.
 *
 * Nothing in the catalog payload names the company that built a model. A
 * third-party model reaches the registry as a string an operator typed into a
 * first-party provider's `models:` list, so `providers[]` reports `codex` for a
 * GLM model and `owned_by` reports `anthropic` for a DeepSeek one. The
 * identifier is the only evidence there is.
 *
 * Rules anchor to a token boundary rather than testing for a bare substring,
 * which would hand `example-model` to Amp and claim every ID containing `o3`.
 */
const vendorRules: Array<[brandId: string, matches: RegExp]> = [
  ['claude', /(^|[/-])(claude|anthropic)/],
  ['gemini', /(^|[/-])(gemini|gemma)/],
  ['deepseek', /(^|[/-])deepseek/],
  ['glm', /(^|[/-])(glm|chatglm|zhipu|bigmodel)/],
  ['qwen', /(^|[/-])(qwen|qwq|qvq)/],
  ['minimax', /(^|[/-])(minimax|abab)/],
  ['kimi', /(^|[/-])(kimi|moonshot)/],
  ['xai', /(^|[/-])grok/],
  ['openai', /(^|[/-])(gpt|chatgpt|openai|codex|o[1-4]([/-]|$))/],
]

function normalizeBrandToken(value: string | null | undefined) {
  if (!value) return null
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[\s_.]+/g, '-') || null
  )
}

/**
 * Resolves a provider identifier to a brand id.
 *
 * Returns the normalized identifier when no rule matches, so an unrecognized
 * provider still renders a stable two-letter mark instead of vanishing, and
 * `null` only when there was no identifier to resolve.
 */
export function resolveProviderLogoId(value: string | null | undefined) {
  const normalized = normalizeBrandToken(value)
  if (!normalized) return null

  for (const [brandId, matches] of providerAliases) {
    if (matches.test(normalized)) return brandId
  }
  if (Object.hasOwn(brandLogos, normalized)) return normalized

  // Usage reporting groups by model as readily as by provider, so a model ID
  // reaches this function too. Falling through to the vendor rules puts a
  // DeepSeek mark on a DeepSeek row rather than the letters "DE".
  return resolveModelVendorId(normalized) ?? normalized
}

/**
 * Resolves the company that built a model from the strings the catalog carries.
 *
 * Returns `null` when nothing matches, and callers must render something
 * neutral rather than falling back to the provider logo: a model reached
 * through the `codex` provider is not an OpenAI model, and refusing to guess is
 * the whole point of this function.
 */
export function resolveModelVendorId(...sources: Array<string | null | undefined>) {
  for (const source of sources) {
    const normalized = normalizeBrandToken(source)
    if (!normalized) continue

    for (const [brandId, matches] of vendorRules) {
      if (matches.test(normalized)) return brandId
    }
  }

  return null
}

const sizeClassNames = {
  xs: 'size-4 text-[8px]',
  sm: 'size-5 text-[9px]',
  md: 'size-6 text-[10px]',
  lg: 'size-7 text-[10px]',
} as const

type ProviderLogoSize = keyof typeof sizeClassNames

export function ProviderLogo({
  providerId,
  size = 'md',
  className,
}: {
  providerId: string
  size?: ProviderLogoSize
  className?: string
}) {
  // Resolution happens here rather than at the call site so every surface that
  // shows a provider agrees on what `openai-compatibility` looks like.
  const brandId = resolveProviderLogoId(providerId) ?? providerId
  const logo = brandLogos[brandId]
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [providerId])

  if (logo && !failed) {
    if (logo.darkSrc) {
      return (
        <>
          <img
            src={logo.src}
            alt=""
            className={cn(
              'shrink-0 rounded-md object-contain dark:hidden',
              sizeClassNames[size],
              className,
            )}
            aria-hidden="true"
            onError={() => setFailed(true)}
          />
          <img
            src={logo.darkSrc}
            alt=""
            className={cn(
              'hidden shrink-0 rounded-md object-contain dark:block',
              sizeClassNames[size],
              className,
            )}
            aria-hidden="true"
            onError={() => setFailed(true)}
          />
        </>
      )
    }

    return (
      <img
        src={logo.src}
        alt=""
        className={cn(
          'shrink-0 rounded-md object-contain',
          sizeClassNames[size],
          logo.className,
          className,
        )}
        aria-hidden="true"
        onError={() => setFailed(true)}
      />
    )
  }

  const mark = brandMarks[brandId] ?? {
    label: brandId.slice(0, 2).toUpperCase(),
    className: 'border-border bg-muted text-muted-foreground',
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border font-semibold',
        sizeClassNames[size],
        mark.className,
        className,
      )}
      aria-hidden="true"
    >
      {mark.label}
    </span>
  )
}
