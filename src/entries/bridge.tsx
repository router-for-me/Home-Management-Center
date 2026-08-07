import { StrictMode } from 'react'

import '@fontsource-variable/inter'

import { BridgeAppProviders } from '@/app/providers/app-providers'
import { renderRoot } from '@/entries/render-root'
import { EmbeddedEntryPage } from '@/features/access/embedded-entry-page'
import { initI18n } from '@/lib/i18n/i18n'
import '@/styles/globals.css'

// The active locale is an async chunk now, so the first paint has to wait for
// it rather than render a screen full of translation keys.
void initI18n().then(() => {
  renderRoot(
    <StrictMode>
      <BridgeAppProviders>
        <EmbeddedEntryPage />
      </BridgeAppProviders>
    </StrictMode>,
  )
})
