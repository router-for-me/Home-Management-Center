import { Window } from 'happy-dom'
import assert from 'node:assert/strict'

// Initialize the DOM before React/Radix feature detection, isolated from other tests.
const browser = new Window({ url: 'http://forms.test' })
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'MutationObserver',
  'ResizeObserver',
  'CustomEvent',
  'Event',
  'DocumentFragment',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'NodeFilter',
  'HTMLButtonElement',
  'KeyboardEvent',
  'MouseEvent',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: key === 'window' ? browser : (browser as any)[key],
  })
}
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: browser.getComputedStyle.bind(browser),
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
})
const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { en } = await import('../../src/lib/i18n/locales/en')
const { DateTimeRangePicker } = await import('../../src/components/shared/date-time-range-picker')
const i18n = createInstance()
await i18n
  .use(initReactI18next)
  .init({ resources: { en }, lng: 'en', defaultNS: 'common', react: { useSuspense: false } })
const container = browser.document.createElement('div')
browser.document.body.append(container)
const errors: unknown[] = []
const root = createRoot(container as any, { onUncaughtError: (error) => errors.push(error) })
const scenario = process.argv[2]
const precision = scenario === 'typing' ? 'date' : 'datetime'
const initial =
  precision === 'date'
    ? { from: '2026-10-14', to: '2026-10-15' }
    : {
        from: '2026-10-14T18:00',
        to: scenario === 'keyboard' ? '2026-11-20T09:00' : '2026-10-15T09:00',
      }
const changes: unknown[] = []
const presetChanges: string[] = []
function Harness() {
  const [range, setRange] = React.useState(initial)
  const [preset, setPreset] = React.useState(scenario === 'transaction' ? '7d' : 'custom')
  return React.createElement(DateTimeRangePicker, {
    ...range,
    precision,
    preset,
    presets: [
      { value: 'today', label: 'Today' },
      { value: '7d', label: 'Last 7 days' },
    ],
    onPresetChange: (value: string) => {
      presetChanges.push(value)
      setPreset(value)
    },
    onChange: (value: typeof initial) => {
      changes.push(value)
      setRange(value)
      setPreset('custom')
    },
  })
}
await React.act(async () =>
  root.render(React.createElement(I18nextProvider, { i18n }, React.createElement(Harness))),
)
function button(text: string) {
  const node = [...browser.document.querySelectorAll('button')].find(
    (node) => node.textContent.trim() === text || node.getAttribute('aria-label') === text,
  )
  assert.ok(node, `Missing button: ${text}`)
  return node
}
function input(label: string) {
  const node = [...browser.document.querySelectorAll('label')]
    .find((node) => node.textContent.trim() === label)
    ?.querySelector('input')
  assert.ok(node, `Missing input: ${label}`)
  return node
}
function day(date: string) {
  const node = browser.document.querySelector<HTMLButtonElement>(`[data-calendar-day="${date}"]`)
  assert.ok(node, `Missing day: ${date}`)
  return node
}
async function frame() {
  await React.act(
    async () => new Promise<void>((resolve) => browser.requestAnimationFrame(() => resolve())),
  )
}
async function click(node: any) {
  await React.act(async () => node.click())
  await frame()
}
async function edit(label: string, value: string) {
  const node = input(label)
  await React.act(async () => {
    node.focus()
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(
      node,
      value,
    )
    node.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}
async function key(node: any, value: string, shiftKey = false) {
  await React.act(async () =>
    node.dispatchEvent(
      new browser.KeyboardEvent('keydown', {
        key: value,
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    ),
  )
  await frame()
}
async function open() {
  await click(container.querySelector('button'))
  if (browser.document.querySelector('[role=dialog] input') === null)
    await click(button('Custom range'))
}
await open()
if (scenario === 'transaction') {
  await edit('Start date', '2026-10-20')
  assert.equal(input('End date').value, '2026-10-20')
  assert.deepEqual(changes, [])
  await click(button('Cancel'))
  await open()
  assert.equal(input('Start date').value, '2026-10-14')
  await edit('Start date', '2026-10-20')
  await click(button('Apply'))
  assert.deepEqual(changes, [{ from: '2026-10-20T18:00', to: '2026-10-20T18:00' }])
  await open()
  await click(button('Back to presets'))
  await click(button('Today'))
  assert.deepEqual(presetChanges, ['today'])
  assert.equal(Boolean(browser.document.querySelector('[role=dialog]')), false, 'Dialog closes')
} else if (scenario === 'calendar-and-time') {
  await click(day('2026-10-15'))
  assert.equal(
    browser.document.activeElement === input('End date'),
    true,
    'Focus moves to end date',
  )
  assert.equal(input('End time').value, '18:00')
  assert.equal(day('2026-10-14').disabled, true)
  await click(day('2026-10-15'))
  await edit('Start time', '19:00')
  assert.equal(input('End time').value, '19:00')
  await edit('End time', '08:00')
  assert.equal(input('Start time').value, '08:00')
  assert.deepEqual(changes, [])
  await click(button('Apply'))
  assert.deepEqual(changes, [{ from: '2026-10-15T08:00', to: '2026-10-15T08:00' }])
} else if (scenario === 'clear-reopen') {
  await click(button('Clear'))
  assert.equal(input('Start date').value, '')
  assert.equal(input('End date').value, '')
  const first = browser.document.querySelector<HTMLButtonElement>(
    '[data-calendar-day]:not([disabled])',
  )!
  await click(first)
  assert.equal(input('Start date').value, first.getAttribute('data-calendar-day'))
  assert.equal(input('End date').value, '')
  await click(button('Clear'))
  await click(button('Apply'))
  assert.deepEqual(changes, [{ from: '', to: '' }])
  await open()
  await click(browser.document.querySelector('[data-calendar-day]:not([disabled])'))
  assert.notEqual(input('Start date').value, '')
  assert.equal(input('End date').value, '')
} else if (scenario === 'typing') {
  await edit('Start date', '202666-10-16')
  assert.equal(input('Start date').value, '2026-10-16')
  assert.equal(input('End date').value, '2026-10-16')
  await edit('Start date', '2026-02-30')
  assert.equal(button('Apply').disabled, true)
  assert.equal(input('Start date').getAttribute('aria-invalid'), 'true')
  await edit('Start date', '202')
  assert.equal(input('End date').value, '2026-10-16')
  await edit('Start date', '9999-12-31')
  assert.equal(button('Next month').disabled, true)
  assert.equal(button('Apply').disabled, false)
  assert.equal(browser.document.querySelectorAll('[role=grid]').length, 1)
  await edit('End date', '1970-01-01')
  assert.equal(input('Start date').value, '1970-01-01')
  assert.equal(button('Previous month').disabled, true)
} else if (scenario === 'keyboard') {
  await React.act(async () => day('2026-10-14').focus())
  await key(day('2026-10-14'), 'ArrowRight')
  assert.equal(browser.document.activeElement?.getAttribute('data-calendar-day'), '2026-10-15')
  await key(day('2026-10-15'), 'PageDown')
  assert.equal(browser.document.activeElement?.getAttribute('data-calendar-day'), '2026-11-15')
  await key(day('2026-11-15'), 'Home')
  assert.equal(browser.document.activeElement?.getAttribute('data-calendar-day'), '2026-11-09')
  await key(day('2026-11-09'), 'PageUp', true)
  assert.equal(browser.document.activeElement?.getAttribute('data-calendar-day'), '2025-11-09')
  await key(day('2025-11-09'), 'Escape')
  await React.act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  assert.equal(Boolean(browser.document.querySelector('[role=dialog]')), false, 'Dialog closes')
  assert.deepEqual(changes, [])
  assert.equal(
    browser.document.activeElement === container.querySelector('button'),
    true,
    'Focus returns to trigger',
  )
} else throw new Error(`Unknown scenario: ${scenario}`)
assert.deepEqual(errors, [])
await React.act(async () => root.unmount())
await browser.happyDOM.close()
console.log(`Passed: ${scenario}`)
