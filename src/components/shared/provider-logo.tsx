import { useEffect, useState } from 'react'

import iflowLogo from '@/assets/icons/iflow.svg'
import { cn } from '@/lib/utils'

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
  ['gemini', /gemini|google|interaction/],
  ['kimi', /kimi|moonshot/],
  ['meta', /^(meta|muse)$/],
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
  ['meta', /(^|\/)(meta-llama|muse-spark|llama)(?=$|[-/\d])/],
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

type IconSource = { src: string; monochrome: boolean }

const iconSources = new Map<string, IconSource | null>()
const libraryAliases: Record<string, string> = { vertex: 'vertexai', glm: 'zai' }

function getLibraryIcon(brandId: string): IconSource | null {
  const iconId = libraryAliases[brandId] ?? brandId
  const cached = iconSources.get(iconId)
  if (cached !== undefined) return cached

  let icon: IconSource | null = null
  // Asset contexts pick up new library slugs without a per-brand import list.
  try {
    // Kimi's colored SVG mixes currentColor with blue; an img cannot inherit the theme.
    if (iconId !== 'kimi') {
      icon = {
        src: String(
          new URL(`@lobehub/icons-static-svg/icons/${iconId}-color.svg?url`, import.meta.url),
        ),
        monochrome: false,
      }
    }
  } catch {
    // Not every brand provides a color variant.
  }
  if (!icon) {
    try {
      icon = {
        src: String(new URL(`@lobehub/icons-static-svg/icons/${iconId}.svg?url`, import.meta.url)),
        monochrome: true,
      }
    } catch {
      // Unknown private providers keep the console's neutral monogram fallback.
    }
  }
  iconSources.set(iconId, icon)
  return icon
}

export function ProviderLogo({
  providerId,
  size = 'md',
  className,
}: {
  providerId: string
  size?: ProviderLogoSize
  className?: string
}) {
  const brandId = resolveProviderLogoId(providerId) ?? providerId
  // Keep the existing iFlow mark until the community collection includes it.
  const icon =
    getLibraryIcon(brandId) ?? (brandId === 'iflow' ? { src: iflowLogo, monochrome: false } : null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [providerId, icon?.src])

  if (icon && !failed) {
    return (
      <img
        src={icon.src}
        alt=""
        data-provider-icon={brandId}
        className={cn(
          'shrink-0 object-contain',
          icon.monochrome && 'dark:invert',
          sizeClassNames[size],
          className,
        )}
        aria-hidden="true"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span
      className={cn(
        'border-border bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-md border font-semibold',
        sizeClassNames[size],
        className,
      )}
      aria-hidden="true"
    >
      {brandId.slice(0, 2).toUpperCase()}
    </span>
  )
}
