import { afterEach, expect, test } from 'bun:test'

import { scrollToField } from '../src/features/config/config-workbench-page'
import type { ConfigFieldKey } from '../src/lib/api/management/config'

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')

afterEach(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
})

const cases: Array<[ConfigFieldKey, string]> = [
  ['liveMediaRelayEnabled', 'liveMediaRelay'],
  ['liveMediaRelayIceServersJson', 'liveMediaRelay'],
  ['antigravityCredits', 'antigravity'],
  ['antigravityConnPoolMaxIdleConnsPerHost', 'antigravity'],
  ['oauthAuthDir', 'oauthProviders'],
  ['port', 'server'],
  ['proxyUrl', 'network'],
]

for (const [key, anchor] of cases) {
  test(`a change to ${key} scrolls the shell to its ${anchor} group`, () => {
    const requestedIds: string[] = []
    const scrolls: ScrollToOptions[] = []
    const container = {
      scrollTop: 100,
      getBoundingClientRect: () => ({ top: 64 }),
      scrollTo: (options: ScrollToOptions) => scrolls.push(options),
    }
    const target = {
      closest: () => container,
      getBoundingClientRect: () => ({ top: 300 }),
    }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        getElementById: (id: string) => {
          requestedIds.push(id)
          return id === `config-section-${anchor}` ? target : null
        },
      },
    })

    scrollToField(key)

    expect(requestedIds).toEqual([`config-section-${anchor}`])
    expect(scrolls).toEqual([{ top: 320, behavior: 'smooth' }])
  })
}
