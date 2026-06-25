import { StrictMode } from 'react'

import '@fontsource-variable/inter'

import { BridgeAppProviders } from '@/app/providers/app-providers'
import { renderRoot } from '@/entries/render-root'
import { EmbeddedEntryPage } from '@/features/access/embedded-entry-page'
import '@/lib/i18n/i18n'
import '@/styles/globals.css'

renderRoot(
  <StrictMode>
    <BridgeAppProviders>
      <EmbeddedEntryPage />
    </BridgeAppProviders>
  </StrictMode>,
)
