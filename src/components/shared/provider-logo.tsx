import { type ReactNode, useState } from 'react'

import { Boxes } from 'lucide-react'

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

// Model families can have their own artwork even when they share a provider.
const modelLogoRules: Array<[brandId: string, matches: RegExp]> = [
  ['claude', /(^|[/-])(claude|anthropic)/],
  ['gemini', /(^|[/-])(gemini|gemma)/],
  ['gemini', /(^|\/)imagen(?=$|[-/\d])/],
  ['deepseek', /(^|[/-])deepseek/],
  ['glm', /(^|[/-])(glm|chatglm|zhipu|bigmodel)/],
  ['qwen', /(^|[/-])(qwen|qwq|qvq)/],
  ['minimax', /(^|[/-])(minimax|abab)/],
  ['kimi', /(^|[/-])(kimi|moonshot)/],
  ['muse', /(^|\/)muse-(spark|wonder)(?=$|[-/\d])/],
  ['meta', /(^|\/)(meta-llama|llama)(?=$|[-/\d])/],
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

  return resolveModelLogoId(normalized) ?? normalized
}

export function resolveModelLogoId(
  modelId: string | null | undefined,
  displayName?: string | null,
) {
  const id = normalizeBrandToken(modelId)
  const label = normalizeBrandToken(displayName)
  // A routing prefix such as "codex/" can serve another company's model.
  const modelName = id?.slice(id.lastIndexOf('/') + 1)
  for (const source of [modelName, label === id ? null : label]) {
    if (!source) continue
    for (const [brandId, matches] of modelLogoRules) {
      if (matches.test(source)) return brandId
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

type LogoStyleProps = { size?: keyof typeof sizeClassNames; className?: string }

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

function BrandLogo({ brandId, size = 'md', className }: LogoStyleProps & { brandId: string }) {
  // Keep the existing iFlow mark until the community collection includes it.
  const icon =
    getLibraryIcon(brandId) ?? (brandId === 'iflow' ? { src: iflowLogo, monochrome: false } : null)
  const [failed, setFailed] = useState(false)

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

export function ProviderLogo({ providerId, ...style }: LogoStyleProps & { providerId: string }) {
  return (
    <BrandLogo
      key={providerId}
      brandId={resolveProviderLogoId(providerId) ?? providerId}
      {...style}
    />
  )
}

export function ModelLogo({
  modelId,
  displayName,
  size = 'md',
  className,
  fallback,
}: LogoStyleProps & { modelId: string | null; displayName?: string | null; fallback?: ReactNode }) {
  const brandId = resolveModelLogoId(modelId, displayName)
  if (brandId) {
    return <BrandLogo key={brandId} brandId={brandId} size={size} className={className} />
  }
  return (
    fallback ?? (
      <Boxes
        aria-hidden="true"
        className={cn('text-muted-foreground shrink-0', sizeClassNames[size], className)}
      />
    )
  )
}
