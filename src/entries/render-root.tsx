import type { ReactNode } from 'react'

import { createRoot } from 'react-dom/client'

export function renderRoot(children: ReactNode) {
  const mount = () => {
    const rootElement = document.getElementById('root')
    if (!rootElement) {
      throw new Error('Missing root element')
    }
    createRoot(rootElement).render(children)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
    return
  }

  mount()
}
