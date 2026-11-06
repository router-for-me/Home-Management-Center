import type { QuotaPlan } from '@/lib/api/management/quota'

type QuotaPlanTier = 'standard' | 'silver' | 'gold' | 'flagship'

const knownPlanTiers: Record<string, Record<string, QuotaPlanTier>> = {
  antigravity: { free: 'standard', pro: 'silver', 'ultra lite': 'gold', ultra: 'flagship' },
  codex: {
    free: 'standard',
    plus: 'silver',
    go: 'silver',
    team: 'silver',
    business: 'silver',
    pro: 'gold',
    'pro 5x': 'gold',
    'pro 20x': 'flagship',
    'pro 100': 'gold',
    'pro 200': 'gold',
    'pro 500': 'flagship',
    'business premium': 'silver',
  },
  claude: {
    free: 'standard',
    pro: 'silver',
    team: 'silver',
    enterprise: 'gold',
    max: 'gold',
    'max 5x': 'gold',
    'max 20x': 'flagship',
  },
  xai: { supergrok: 'gold', 'supergrok heavy': 'flagship' },
  devin: { free: 'standard', pro: 'silver', teams: 'silver', enterprise: 'gold' },
  grok: { supergrok: 'gold', 'supergrok heavy': 'flagship' },
  kimi: { moderato: 'silver', andante: 'silver', allegretto: 'gold', allegro: 'flagship' },
}

export function resolveQuotaPlanTier(provider: string, plan: QuotaPlan): QuotaPlanTier {
  const name = plan.name
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ')
  return (
    knownPlanTiers[provider.trim().toLowerCase()]?.[name] ?? (plan.premium ? 'gold' : 'standard')
  )
}
