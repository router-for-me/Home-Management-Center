import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { appShellScrollRestorationId, scrollElementIntoShell } from '../src/lib/shell-scroll'

type MockElement = {
  id: string
  scrollTop: number
  tagName: string
  attributes: Record<string, string>
  parent: MockElement | null
  children: MockElement[]
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  closest: (selector: string) => MockElement | null
  getBoundingClientRect: () => DOMRect
  scrollTo?: (options?: ScrollToOptions | number, y?: number) => void
  scrollIntoView?: (arg?: boolean | ScrollIntoViewOptions) => void
}

function createMockElement(tagName: string, id = ''): MockElement {
  const attributes: Record<string, string> = {}
  const children: MockElement[] = []
  const element: MockElement = {
    id,
    tagName: tagName.toUpperCase(),
    scrollTop: 0,
    attributes,
    parent: null,
    children,
    getAttribute: (name: string) => attributes[name] ?? null,
    setAttribute: (name: string, value: string) => {
      attributes[name] = value
    },
    closest: (selector: string) => {
      let current: MockElement | null = element
      while (current) {
        if (
          selector.includes(`data-scroll-restoration-id="${appShellScrollRestorationId}"`) &&
          current.getAttribute('data-scroll-restoration-id') === appShellScrollRestorationId
        ) {
          return current
        }
        current = current.parent
      }
      return null
    },
    getBoundingClientRect: () =>
      ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  }
  return element
}

const originalDocument = globalThis.document

describe('shell-scroll', () => {
  let elementsById: Map<string, MockElement>

  beforeEach(() => {
    elementsById = new Map()
    // @ts-expect-error Mock minimal document
    globalThis.document = {
      getElementById: (id: string) => elementsById.get(id) ?? null,
    }
  })

  afterEach(() => {
    globalThis.document = originalDocument
  })

  test('scrollElementIntoShell scrolls the inner main container directly without calling scrollIntoView', () => {
    const mainContainer = createMockElement('main')
    mainContainer.setAttribute('data-scroll-restoration-id', appShellScrollRestorationId)
    mainContainer.scrollTop = 100

    let scrolledToOptions: ScrollToOptions | undefined
    mainContainer.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object') {
        scrolledToOptions = options
      }
    }

    mainContainer.getBoundingClientRect = () =>
      ({
        top: 64,
        bottom: 800,
        left: 0,
        right: 1200,
        width: 1200,
        height: 736,
        x: 0,
        y: 64,
        toJSON: () => ({}),
      }) as DOMRect

    const section = createMockElement('section', 'config-section-antigravity')
    section.parent = mainContainer

    let scrollIntoViewCalled = false
    section.scrollIntoView = () => {
      scrollIntoViewCalled = true
    }

    section.getBoundingClientRect = () =>
      ({
        top: 300,
        bottom: 500,
        left: 260,
        right: 1200,
        width: 940,
        height: 200,
        x: 260,
        y: 300,
        toJSON: () => ({}),
      }) as DOMRect

    elementsById.set('config-section-antigravity', section)

    scrollElementIntoShell('config-section-antigravity', 16)

    expect(scrollIntoViewCalled).toBe(false)
    expect(scrolledToOptions).toBeDefined()
    // targetTop (300) - containerTop (64) = 236
    // container.scrollTop (100) + 236 - topOffset (16) = 320
    expect(scrolledToOptions?.top).toBe(320)
    expect(scrolledToOptions?.behavior).toBe('smooth')
  })

  test('scrollElementIntoShell clamps negative top values to 0', () => {
    const mainContainer = createMockElement('main')
    mainContainer.setAttribute('data-scroll-restoration-id', appShellScrollRestorationId)
    mainContainer.scrollTop = 0

    let scrolledToOptions: ScrollToOptions | undefined
    mainContainer.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object') {
        scrolledToOptions = options
      }
    }

    mainContainer.getBoundingClientRect = () =>
      ({
        top: 64,
        bottom: 800,
        left: 0,
        right: 1200,
        width: 1200,
        height: 736,
        x: 0,
        y: 64,
        toJSON: () => ({}),
      }) as DOMRect

    const section = createMockElement('section', 'config-section-server')
    section.parent = mainContainer

    section.getBoundingClientRect = () =>
      ({
        top: 70,
        bottom: 270,
        left: 260,
        right: 1200,
        width: 940,
        height: 200,
        x: 260,
        y: 70,
        toJSON: () => ({}),
      }) as DOMRect

    elementsById.set('config-section-server', section)

    // targetTop (70) - containerTop (64) = 6. With offset 16, 0 + 6 - 16 = -10, clamped to 0.
    scrollElementIntoShell('config-section-server', 16)
    expect(scrolledToOptions?.top).toBe(0)
  })

  test('scrollElementIntoShell falls back to scrollIntoView when container is absent', () => {
    const section = createMockElement('section', 'orphan-section')
    let scrollIntoViewCalled = false
    let scrollIntoViewArg: unknown
    section.scrollIntoView = (arg?: boolean | ScrollIntoViewOptions) => {
      scrollIntoViewCalled = true
      scrollIntoViewArg = arg
    }

    elementsById.set('orphan-section', section)

    scrollElementIntoShell('orphan-section')
    expect(scrollIntoViewCalled).toBe(true)
    expect(scrollIntoViewArg).toEqual({ block: 'start', behavior: 'smooth' })
  })
})
