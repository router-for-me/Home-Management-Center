import { StrictMode } from 'react'

import '@fontsource-variable/inter'

import { UserAppProviders } from '@/app/providers/app-providers'
import { EmbeddedRouterApp, ensureInitialHashPath } from '@/app/router/embedded-router'
import { userRouteTree } from '@/app/router/user-route-tree'
import { renderRoot } from '@/entries/render-root'
import { initI18n } from '@/lib/i18n/i18n'
import '@/styles/globals.css'

ensureInitialHashPath('/user/login')

// The active locale is an async chunk now, so the first paint has to wait for
// it rather than render a screen full of translation keys.
void initI18n().then(() => {
  renderRoot(
    <StrictMode>
      <EmbeddedRouterApp routeTree={userRouteTree} Shell={UserAppProviders} />
    </StrictMode>,
  )
})
