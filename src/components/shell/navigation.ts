import {
  BarChart3,
  Gauge,
  KeyRound,
  type LucideIcon,
  Network,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'

type NavigationGroupId = 'operate' | 'gateway' | 'observe' | 'control'

type NavigationRoute =
  | '/dashboard'
  | '/providers'
  | '/credentials'
  | '/access-keys'
  | '/config'
  | '/usage-logs'

type NavigationItem = {
  to: NavigationRoute
  labelKey: string
  metaKey: string
  icon: LucideIcon
}

type NavigationGroup = {
  id: NavigationGroupId
  labelKey: string
  items: NavigationItem[]
}

export const navigationGroups: NavigationGroup[] = [
  {
    id: 'operate',
    labelKey: 'navigationGroups.operate',
    items: [
      {
        to: '/dashboard',
        labelKey: 'navigation.dashboard',
        metaKey: 'navigationMeta.dashboard',
        icon: Gauge,
      },
    ],
  },
  {
    id: 'gateway',
    labelKey: 'navigationGroups.gateway',
    items: [
      {
        to: '/providers',
        labelKey: 'navigation.providers',
        metaKey: 'navigationMeta.providers',
        icon: Network,
      },
      {
        to: '/credentials',
        labelKey: 'navigation.credentials',
        metaKey: 'navigationMeta.credentials',
        icon: ShieldCheck,
      },
      {
        to: '/access-keys',
        labelKey: 'navigation.accessKeys',
        metaKey: 'navigationMeta.accessKeys',
        icon: KeyRound,
      },
    ],
  },
  {
    id: 'observe',
    labelKey: 'navigationGroups.observe',
    items: [
      {
        to: '/usage-logs',
        labelKey: 'navigation.usageLogs',
        metaKey: 'navigationMeta.usageLogs',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'control',
    labelKey: 'navigationGroups.control',
    items: [
      {
        to: '/config',
        labelKey: 'navigation.config',
        metaKey: 'navigationMeta.config',
        icon: SlidersHorizontal,
      },
    ],
  },
]

export const navigationItems = navigationGroups.flatMap((group) => group.items)
