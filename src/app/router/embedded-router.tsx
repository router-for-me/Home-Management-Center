import { useState } from 'react'
import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  type AnyRoute,
  RouterProvider,
  createHashHistory,
  createRouter,
} from '@tanstack/react-router'

import { RoutePending } from '@/components/shell/route-pending'
import { shellScrollToTopSelectors } from '@/lib/shell-scroll'

type RouterShellProps = {
  children: ReactNode
}

type EmbeddedRouterAppProps<TRouteTree extends AnyRoute> = {
  routeTree: TRouteTree
  Shell: (props: RouterShellProps) => ReactNode
}

function createEmbeddedQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

export function ensureInitialHashPath(defaultPath: string) {
  if (typeof window === 'undefined') return

  const hashPath = window.location.hash.slice(1)
  if (hashPath.startsWith('/')) return

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}#${defaultPath}`,
  )
}

export function EmbeddedRouterApp<TRouteTree extends AnyRoute>({
  routeTree,
  Shell,
}: EmbeddedRouterAppProps<TRouteTree>) {
  const [queryClient] = useState(createEmbeddedQueryClient)
  const [router] = useState(() =>
    createRouter({
      routeTree,
      history: createHashHistory(),
      context: {
        queryClient,
      },
      defaultPreload: 'intent',
      // Route components are code-split, so a navigation can wait on a chunk.
      // 'intent' preloading hides that on hover, but a direct hash change or a
      // cold link still needs something on screen.
      defaultPendingComponent: RoutePending,
      scrollRestoration: true,
      // The shells scroll an inner <main>, not the window; a fresh navigation
      // has to rewind that container the way the window is rewound.
      scrollToTopSelectors: shellScrollToTopSelectors,
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        <RouterProvider router={router} />
      </Shell>
    </QueryClientProvider>
  )
}
