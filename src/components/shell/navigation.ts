import {
  BarChart3,
  Gauge,
  KeyRound,
  type LucideIcon,
  Network,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-react'

type NavigationGroupId = 'operate' | 'gateway' | 'observe' | 'control'

type NavigationRoute =
  | '/dashboard'
  | '/providers'
  | '/credentials'
  | '/access-keys'
  | '/users'
  | '/config'
  | '/usage-logs'
  | '/system-nodes'

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
      {
        to: '/users',
        labelKey: 'navigation.users',
        metaKey: 'navigationMeta.users',
        icon: UsersRound,
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
      {
        to: '/system-nodes',
        labelKey: 'navigation.systemNodes',
        metaKey: 'navigationMeta.systemNodes',
        icon: ServerCog,
      },
    ],
  },
]

export const navigationItems = navigationGroups.flatMap((group) => group.items)
