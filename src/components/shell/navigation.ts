import {
  Activity,
  BarChart3,
  FileText,
  Gauge,
  KeyRound,
  type LucideIcon,
  Network,
  Plug,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  WalletCards,
} from 'lucide-react'

type NavigationGroupId = 'operate' | 'gateway' | 'finance' | 'observe' | 'control'

type NavigationRoute =
  | '/admin/dashboard'
  | '/admin/providers'
  | '/admin/credentials'
  | '/admin/access-keys'
  | '/admin/users'
  | '/admin/billing'
  | '/admin/config'
  | '/admin/plugins'
  | '/admin/usage'
  | '/admin/diagnostics'
  | '/admin/logs'
  | '/admin/system-nodes'

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
        to: '/admin/dashboard',
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
        to: '/admin/providers',
        labelKey: 'navigation.providers',
        metaKey: 'navigationMeta.providers',
        icon: Network,
      },
      {
        to: '/admin/credentials',
        labelKey: 'navigation.credentials',
        metaKey: 'navigationMeta.credentials',
        icon: ShieldCheck,
      },
      {
        to: '/admin/access-keys',
        labelKey: 'navigation.accessKeys',
        metaKey: 'navigationMeta.accessKeys',
        icon: KeyRound,
      },
      {
        to: '/admin/users',
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
        to: '/admin/usage',
        labelKey: 'navigation.usage',
        metaKey: 'navigationMeta.usage',
        icon: BarChart3,
      },
      {
        to: '/admin/diagnostics',
        labelKey: 'navigation.diagnostics',
        metaKey: 'navigationMeta.diagnostics',
        icon: Activity,
      },
      {
        to: '/admin/logs',
        labelKey: 'navigation.logs',
        metaKey: 'navigationMeta.logs',
        icon: FileText,
      },
    ],
  },
  {
    id: 'finance',
    labelKey: 'navigationGroups.finance',
    items: [
      {
        to: '/admin/billing',
        labelKey: 'navigation.billing',
        metaKey: 'navigationMeta.billing',
        icon: WalletCards,
      },
    ],
  },
  {
    id: 'control',
    labelKey: 'navigationGroups.control',
    items: [
      {
        to: '/admin/config',
        labelKey: 'navigation.config',
        metaKey: 'navigationMeta.config',
        icon: SlidersHorizontal,
      },
      {
        to: '/admin/plugins',
        labelKey: 'navigation.plugins',
        metaKey: 'navigationMeta.plugins',
        icon: Plug,
      },
      {
        to: '/admin/system-nodes',
        labelKey: 'navigation.systemNodes',
        metaKey: 'navigationMeta.systemNodes',
        icon: ServerCog,
      },
    ],
  },
]

export const navigationItems = navigationGroups.flatMap((group) => group.items)
