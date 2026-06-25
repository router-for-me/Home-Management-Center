import { StrictMode } from 'react'

import '@fontsource-variable/inter'

import { ManagementAppProviders } from '@/app/providers/app-providers'
import { EmbeddedRouterApp, ensureInitialHashPath } from '@/app/router/embedded-router'
import { managementRouteTree } from '@/app/router/management-route-tree'
import { renderRoot } from '@/entries/render-root'
import '@/lib/i18n/i18n'
import '@/styles/globals.css'

ensureInitialHashPath('/admin/dashboard')

renderRoot(
  <StrictMode>
    <EmbeddedRouterApp routeTree={managementRouteTree} Shell={ManagementAppProviders} />
  </StrictMode>,
)
