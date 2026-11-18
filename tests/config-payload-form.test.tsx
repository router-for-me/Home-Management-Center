import { act } from 'react'

import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { createRoot } from 'react-dom/client'

import { PayloadFormField, PayloadReviewFieldContext } from '@/features/config/payload-form-field'
import {
  type PayloadParamEntry,
  convertPayloadParamValue,
  getPayloadParamPathIssues,
  getPayloadParamValidationError,
  parsePayloadParamValue,
  serializePayloadParamValue,
} from '@/features/config/payload-param-value'
import { getPayloadReplacePreview } from '@/features/config/payload-replace-preview'

test('changing entry mode preserves every JSON value and leaves an appended row empty', () => {
  for (const value of ['001', '', 0, false, null, { nested: [1, 'two'] }]) {
    const typed = { path: 'setting', ...parsePayloadParamValue(value) }
    const raw = { ...typed, ...convertPayloadParamValue(typed, true) }
    expect(JSON.parse(raw.value)).toEqual(value)
    expect(serializePayloadParamValue({ ...raw, ...convertPayloadParamValue(raw, false) })).toEqual(
      value,
    )
  }
  const blank: PayloadParamEntry = { path: '', valueType: 'string', value: '' }
  expect(convertPayloadParamValue(blank, true)).toEqual({ valueType: 'json', value: '' })
  expect(convertPayloadParamValue({ ...blank, valueType: 'json' }, false)).toEqual({
    valueType: 'string',
    value: '',
  })
})

test('switching modes preserves incomplete JSON and the formatting of complex values', () => {
  for (const source of ['{"a":', '{  "a" : 1 }', '[1,\n2]']) {
    const raw: PayloadParamEntry = { path: 'options', valueType: 'json', value: source }
    const typed = { ...raw, ...convertPayloadParamValue(raw, false) }
    expect(typed.value).toBe(source)
    expect(convertPayloadParamValue(typed, true).value).toBe(source)
    expect(getPayloadParamValidationError(typed)).toBe(source.endsWith(':') ? 'json' : null)
  }
})

test('a shared prefix remains two editable parameter rows until both paths are unique', () => {
  const params = ['config', '', 'config '].map((path) => ({
    path,
    valueType: 'string' as const,
    value: '',
  }))
  expect(getPayloadParamPathIssues(params)).toEqual([
    null,
    'paramPathRequired',
    'paramPathDuplicate',
  ])
  params[1].path = 'config.a'
  params[2].path = 'config.b'
  expect(getPayloadParamPathIssues(params)).toEqual([null, null, null])
})

test('raw numbers survive mode changes and typed entries cannot silently lose precision', () => {
  for (const source of [
    '9007199254740993',
    '1.0000000000000001',
    '1e400',
    '1e-500',
    '{"n":[9007199254740993]}',
  ]) {
    const raw: PayloadParamEntry = { path: 'n', valueType: 'json', value: source }
    const typed = { ...raw, ...convertPayloadParamValue(raw, false) }
    expect(typed.value).toBe(source)
    expect(getPayloadParamValidationError(typed)).toBe('precision')
    expect(convertPayloadParamValue(typed, true).value).toBe(source)
    expect(getPayloadParamValidationError(raw, true)).toBeNull()
  }
  for (const source of ['-0', '0.1', '12.3000', '1e2', '1e-100', '[1e+21, "9007199254740993"]']) {
    expect(
      getPayloadParamValidationError({ path: 'n', valueType: 'json', value: source }),
    ).toBeNull()
  }
  expect(getPayloadParamValidationError({ path: 'n', valueType: 'json', value: '[1,' }, true)).toBe(
    'json',
  )
})

test('the local preview applies literal steps in order and bounds all intermediate output', () => {
  const entries = [
    { from: 'aa', to: '$&' },
    { from: '$&', to: '' },
  ]
  expect(getPayloadReplacePreview('aaaa b', entries)).toEqual({
    status: 'ready',
    result: ' b',
    steps: [
      { result: '$&$& b', changed: true },
      { result: ' b', changed: true },
    ],
  })
  expect(getPayloadReplacePreview('', entries).status).toBe('empty')
  expect(getPayloadReplacePreview('a', [{ from: '', to: 'b' }]).status).toBe('incomplete')
  expect(getPayloadReplacePreview('a'.repeat(40000), [{ from: 'a', to: 'aa' }]).status).toBe(
    'tooLarge',
  )
  expect(
    getPayloadReplacePreview('a'.repeat(40000), [
      { from: 'x', to: 'y' },
      { from: 'x', to: 'y' },
    ]).status,
  ).toBe('tooLarge')
  expect(
    getPayloadReplacePreview('a'.repeat(40000), [
      { from: 'x', to: 'y' },
      { from: 'a', to: '' },
    ]).status,
  ).toBe('ready')
})

test('an untouched field stays quiet until blur or explicit review and clears its accessible error when fixed', async () => {
  const browser = new Window()
  const globals = {
    window: browser,
    document: browser.document,
    Element: browser.Element,
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const previous = Object.fromEntries(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  )
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  const node = browser.document.createElement('div')
  browser.document.body.append(node)
  const root = createRoot(node as unknown as HTMLElement)
  const render = (review: string | null, error: string | null, key = 'first') =>
    act(async () => {
      root.render(
        <PayloadReviewFieldContext.Provider value={review}>
          <PayloadFormField key={key} controlId={key} label="JSON path" error={error}>
            {(control) => <input {...control} />}
          </PayloadFormField>
        </PayloadReviewFieldContext.Provider>,
      )
    })
  try {
    await render(null, 'Enter a path')
    const input = node.querySelector('input')!
    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(node.querySelector('[role="alert"]')).toBeNull()
    await act(async () =>
      input.dispatchEvent(new browser.FocusEvent('focusout', { bubbles: true })),
    )
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(
      browser.document.getElementById(input.getAttribute('aria-describedby')!)?.textContent,
    ).toBe('Enter a path')
    await render(null, null)
    expect(node.querySelector('[role="alert"]')).toBeNull()
    await render('second', 'Enter a path', 'second')
    expect(node.querySelector('input')?.getAttribute('aria-invalid')).toBe('true')
  } finally {
    await act(async () => root.unmount())
    await browser.happyDOM.close()
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
