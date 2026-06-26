import { useEffect, useState } from 'react'

import antigravityLogo from '@/assets/icons/antigravity.svg'
import claudeLogo from '@/assets/icons/claude.svg'
import codexLogo from '@/assets/icons/codex.svg'
import geminiLogo from '@/assets/icons/gemini.svg'
import grokLogo from '@/assets/icons/grok.svg'
import kimiDarkLogo from '@/assets/icons/kimi-dark.svg'
import kimiLightLogo from '@/assets/icons/kimi-light.svg'
import openaiLogo from '@/assets/icons/openai-light.svg'
import vertexLogo from '@/assets/icons/vertex.svg'
import { cn } from '@/lib/utils'

const providerLogoUrls: Record<string, { src: string; darkSrc?: string; className?: string }> = {
  gemini: { src: geminiLogo },
  claude: { src: claudeLogo },
  codex: { src: codexLogo },
  vertex: { src: vertexLogo },
  antigravity: { src: antigravityLogo },
  kimi: { src: kimiLightLogo, darkSrc: kimiDarkLogo },
  openaiCompatibility: { src: openaiLogo, className: 'dark:invert' },
  xai: { src: grokLogo, className: 'p-0.5 dark:invert' },
}

const providerMarks: Record<
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
  openaiCompatibility: {
    label: 'AI',
    className: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  },
  xai: {
    label: 'xAI',
    className: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  },
}

const sizeClassNames = {
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
  const logo = providerLogoUrls[providerId]
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

  const mark = providerMarks[providerId] ?? {
    label: providerId.slice(0, 2).toUpperCase(),
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
