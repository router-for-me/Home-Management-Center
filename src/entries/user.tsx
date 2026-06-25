import { StrictMode } from 'react'

import '@fontsource-variable/inter'

import { UserAppProviders } from '@/app/providers/app-providers'
import { EmbeddedRouterApp, ensureInitialHashPath } from '@/app/router/embedded-router'
import { userRouteTree } from '@/app/router/user-route-tree'
import { renderRoot } from '@/entries/render-root'
import '@/lib/i18n/i18n'
import '@/styles/globals.css'

ensureInitialHashPath('/user/login')

renderRoot(
  <StrictMode>
    <EmbeddedRouterApp routeTree={userRouteTree} Shell={UserAppProviders} />
  </StrictMode>,
)
