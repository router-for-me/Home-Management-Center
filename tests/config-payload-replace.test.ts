import { describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { canEditPayloadConfig, normalizeConfigValues } from '../src/lib/api/management/config'
import {
  canEditPayloadReplaceRule,
  getPayloadReplaceIssues,
  normalizePayloadReplaceContent,
  serializePayloadReplaceContent,
} from '../src/lib/api/management/payload-replace'
import { en } from '../src/lib/i18n/locales/en'
import { ru } from '../src/lib/i18n/locales/ru'
import { zhCN } from '../src/lib/i18n/locales/zh-CN'
import { zhTW } from '../src/lib/i18n/locales/zh-TW'

const rule = {
  models: [
    {
      name: '*',
      protocol: 'claude',
      'from-protocol': 'openai',
      headers: { 'X-Client': 'test-*' },
      match: [{ 'metadata.client': 'test' }],
      'not-match': [{ 'metadata.skip': true }],
      exist: ['messages'],
      'not-exist': ['metadata.bypass'],
    },
  ],
  target: { role: 'user', positions: [1, 2] },
  replacements: [{ ' project\n': ' 项目\n' }, { project: '' }, { project: 'duplicate source' }],
}

function writePayloads(payloads: unknown[], previous: unknown = {}) {
  const fixture = fileURLToPath(new URL('./fixtures/config-xhr-transport.ts', import.meta.url))
  const child = spawnSync(process.execPath, [fixture], {
    input: JSON.stringify(
      payloads.map((payload) => ({
        key: 'payloadRulesJson',
        previousValue: JSON.stringify(previous),
        nextValue: JSON.stringify(payload),
      })),
    ),
    encoding: 'utf8',
    timeout: 10_000,
  })
  expect(child.status, child.stderr).toBe(0)
  return JSON.parse(child.stdout) as Array<{
    error: string | null
    requests: Array<{ method: string; path: string; body: string }>
  }>
}

describe('payload text replacement', () => {
  test('existing payload edits omit an empty replace field for older Home SDKs', () => {
    const override = [{ models: [{ name: '*' }], params: { temperature: 0.2 } }]
    for (const result of writePayloads([{ override }, { override, replace: [] }])) {
      expect(result.error).toBeNull()
      expect(result.requests[0]!.method).toBe('PUT')
      const payload = JSON.parse(result.requests[0]!.body)
      expect(payload).not.toHaveProperty('replace')
      expect(payload.override).toEqual(override)
    }
  })

  test('editing a sibling rule round-trips replacement operands, order and matching conditions', () => {
    const values = normalizeConfigValues({
      requests: {
        payload: {
          replace: [rule],
          override: [{ models: [{ name: '*' }], params: { temperature: 0.2 } }],
          filter: [{ models: [{ name: '*' }], params: ['metadata.debug'] }],
        },
      },
    })
    const payload = JSON.parse(String(values.payloadRulesJson))
    expect(payload.replace).toEqual([rule])
    payload.override[0].params.temperature = 0.4
    const [result] = writePayloads([payload])
    expect(result!.error).toBeNull()
    expect(result!.requests).toHaveLength(1)
    const request = result!.requests[0]!
    expect(request.method).toBe('PUT')
    expect(request.path).toBe('/v8/management/config/requests/payload')
    expect(JSON.parse(request.body)).toEqual({ ...payload, replace: [rule] })
  })

  test('a replace-only payload remains a PUT and does not delete the payload root', () => {
    const [result] = writePayloads([{ replace: [rule] }])
    expect(result!.error).toBeNull()
    expect(result!.requests[0]!.method).toBe('PUT')
    expect(JSON.parse(result!.requests[0]!.body).replace).toEqual([rule])
  })

  test('creates and edits every role and path target with mixed, ordered replacement steps', () => {
    const paths = [
      'tools.#(type=="function")#.description',
      'metadata.description',
      'metadata.description',
    ]
    const replacements = [
      { pattern: 'literal text for the key named pattern' },
      { pattern: '(?i)(user)-(\\d+)', replacement: 'account-${2}' },
      { replacement: '' },
      { pattern: '(?s)<debug>.*?</debug>', replacement: '' },
      { pattern: '(', replacement: '$1' },
      { pattern: '', replacement: 'skipped by CPA' },
    ]
    const models = [
      {
        ...rule.models[0],
        match: [{ 'metadata.label': 'alpha', 'metadata.count': 0 }],
        'not-match': [{ hidden: false }],
      },
    ]
    const targets = [
      ...['user', 'system', 'developer'].flatMap((role) => [
        { role, all: true },
        { role, positions: [3, 1, 3] },
      ]),
      { paths },
    ]
    const rules = targets.map((target) => ({ models, target, replacements }))
    for (const item of rules) {
      expect(canEditPayloadReplaceRule(item)).toBe(true)
      const draft = normalizePayloadReplaceContent(item)
      expect(draft.replacements.map((entry) => entry.kind)).toEqual([
        'literal',
        'regex',
        'literal',
        'regex',
        'regex',
        'regex',
      ])
      expect(serializePayloadReplaceContent(draft)).toEqual({ target: item.target, replacements })
    }
    const edited = [...rules]
      .reverse()
      .map((item) => ({ ...item, replacements: [...item.replacements].reverse() }))
    for (const [result, expected] of [
      [writePayloads([{ replace: rules }])[0]!, rules],
      [writePayloads([{ replace: edited }], { replace: rules })[0]!, edited],
    ] as const) {
      expect(result.error).toBeNull()
      expect(JSON.parse(result.requests[0]!.body).replace).toEqual(expected)
    }
  })

  test('editing replacement steps preserves explicit target defaults and empty model conditions', () => {
    const saved = {
      models: [
        {
          name: 'm',
          headers: {},
          match: [{}, { 'metadata.enabled': false, 'metadata.count': 0 }],
          'not-match': [],
          'not-exist': [],
        },
      ],
      target: { role: 'system', all: false, positions: [1] },
      replacements: [{ before: 'after' }],
    }
    const sibling = { ...saved, target: { role: 'developer', all: true, positions: [] } }
    const edited = { ...saved, replacements: [{ pattern: '(a)', replacement: '$1' }] }
    const [result] = writePayloads([{ replace: [edited, sibling] }], { replace: [saved, sibling] })
    expect(result!.error).toBeNull()
    expect(JSON.parse(result!.requests[0]!.body).replace).toEqual([edited, sibling])
  })

  test('future rules survive sibling edits in order, and cannot be added, changed or dropped by the form', () => {
    const future = {
      ...rule,
      target: { role: 'future-role', all: true },
      'new-field': { flag: false },
    }
    const futureEntry = {
      ...rule,
      replacements: [{ pattern: 'abc', replacement: '$1', flags: 'new' }],
    }
    const opaque = [future, null, futureEntry, future]
    const previous = { replace: [rule, ...opaque] }
    const edited = { ...rule, target: { role: 'system', all: true } }
    const [saved] = writePayloads([{ replace: [edited, ...opaque] }], previous)
    expect(saved!.error).toBeNull()
    expect(JSON.parse(saved!.requests[0]!.body).replace).toEqual([edited, ...opaque])
    for (const bad of [
      opaque.slice(1),
      [...opaque, future],
      [...opaque].reverse(),
      [{ ...future, extra: true }, ...opaque.slice(1)],
    ]) {
      const [blocked] = writePayloads([{ replace: [edited, ...bad] }], previous)
      expect(blocked!.error).not.toBeNull()
      expect(blocked!.requests).toEqual([])
    }
  })

  test('switching target modes serializes only active fields and retains the other draft', () => {
    const base = normalizePayloadReplaceContent(rule)
    const paths = ['metadata.name', 'tools.#(type=="function")#.description']
    const pathDraft = {
      ...base,
      target: { ...base.target, mode: 'paths' as const, paths, positions: '2, 4' },
    }
    expect(serializePayloadReplaceContent(pathDraft).target).toEqual({ paths })
    const roleDraft = { ...pathDraft, target: { ...pathDraft.target, mode: 'developer' as const } }
    expect(serializePayloadReplaceContent(roleDraft).target).toEqual({
      role: 'developer',
      positions: [2, 4],
    })
    expect(roleDraft.target.paths).toEqual(paths)
  })

  test('the wire representation uses only the selected target and leaves the editor draft intact', () => {
    const content = normalizePayloadReplaceContent(rule)
    content.target.positions = '1, 2,'
    const selected = { models: rule.models, ...serializePayloadReplaceContent(content) }
    const all = {
      models: rule.models,
      ...serializePayloadReplaceContent({ ...content, target: { ...content.target, all: true } }),
    }
    expect(content.target.positions).toBe('1, 2,')
    const [result] = writePayloads([{ replace: [selected, all] }])
    expect(result!.error).toBeNull()
    expect(
      JSON.parse(result!.requests[0]!.body).replace.map((item: typeof rule) => item.target),
    ).toEqual([
      { role: 'user', positions: [1, 2] },
      { role: 'user', all: true },
    ])
  })

  test('unrepresented sections stay visible on read and block the entire subtree write', () => {
    const editableRule = { models: ['*'], params: { temperature: 1 } }
    const shapes = [
      { future: [] },
      { override: 'unknown' },
      { replace: {} },
      { filter: [{ models: ['*'], params: [10] }] },
      { default: [{ ...editableRule, future: true }] },
      { override: [{ models: [{ name: '*', future: true }], params: {} }] },
    ]
    for (const source of shapes) {
      const normalized = JSON.parse(
        String(normalizeConfigValues({ requests: { payload: source } }).payloadRulesJson),
      )
      expect(normalized).toMatchObject(source)
      expect(canEditPayloadConfig(normalized)).toBe(false)
      for (const result of writePayloads([{}, { override: [editableRule] }], source)) {
        expect(result.error).not.toBeNull()
        expect(result.requests).toEqual([])
      }
    }
    for (const result of writePayloads(shapes)) expect(result.requests).toEqual([])
    const malformed = normalizeConfigValues({ requests: { payload: 'future-format' } })
    expect(JSON.parse(String(malformed.payloadRulesJson))).toBe('future-format')
    expect(
      canEditPayloadConfig(
        JSON.parse(
          String(
            normalizeConfigValues({ requests: { payload: { default: null } } }).payloadRulesJson,
          ),
        ),
      ),
    ).toBe(true)
  })

  test('partial model and parameter rows cannot turn into a smaller write or a DELETE', () => {
    for (const result of writePayloads([
      { default: [{ models: ['*', { protocol: 'claude' }], params: { limit: 2 } }] },
      { override: [{ models: ['*'], params: { ' a': 1, a: 2 } }] },
      { filter: [{ models: ['*'], params: [''] }] },
    ])) {
      expect(result.error).not.toBeNull()
      expect(result.requests).toEqual([])
    }
  })

  test('invalid target and replacement shapes fail before making any request', () => {
    const invalidRules = [
      { ...rule, target: { role: 'assistant', positions: [1] } },
      ...[[], ['  '], ['a', ''], [null]].map((paths) => ({ ...rule, target: { paths } })),
      { ...rule, target: { paths: ['a'], role: 'system', all: true } },
      { ...rule, target: { paths: ['a'], positions: [1] } },
      { ...rule, replacements: [{ pattern: 'abc', replacement: null }] },
      { ...rule, target: { role: 'user', all: true, positions: [1] } },
      ...[[], [0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1]].map((positions) => ({
        ...rule,
        target: { role: 'user', positions },
      })),
      { ...rule, replacements: [] },
      { ...rule, replacements: [{ '': 'destination' }] },
      { ...rule, replacements: [{ a: 'b', c: 'd' }] },
      { ...rule, replacements: [{ a: null }] },
      { ...rule, models: [] },
    ]
    for (const result of writePayloads(invalidRules.map((sample) => ({ replace: [sample] })))) {
      expect(result.error).not.toBeNull()
      expect(result.requests).toEqual([])
    }
  })

  test('invalid position drafts block save; whitespace sources and empty destinations remain valid', () => {
    const content = normalizePayloadReplaceContent(rule)
    for (const positions of ['0', '-1', '1.5', '1e2', '1, invalid']) {
      expect(
        getPayloadReplaceIssues({
          ...content,
          target: { ...content.target, all: false, positions },
        }),
      ).toContain('replacePositionsInvalid')
    }
    expect(
      getPayloadReplaceIssues({
        ...content,
        target: { ...content.target, all: false, positions: '' },
      }),
    ).toContain('replacePositionsRequired')
    expect(
      getPayloadReplaceIssues({
        ...content,
        replacements: [{ kind: 'literal', from: ' \n', to: '' }],
      }),
    ).toEqual([])
    expect(
      getPayloadReplaceIssues({
        ...content,
        replacements: [{ kind: 'literal', from: '', to: 'text' }],
      }),
    ).toContain('replaceSourceRequired')
    const invalidDraft = {
      models: rule.models,
      ...serializePayloadReplaceContent({
        ...content,
        target: { ...content.target, all: false, positions: '1.5' },
      }),
    }
    expect(writePayloads([{ replace: [invalidDraft] }])[0]!.requests).toEqual([])
  })

  test('new interaction and validation copy is available in every supported language', () => {
    const keys = (value: object) => Object.keys(value).sort()
    for (const locale of [zhCN, zhTW, ru]) {
      expect(keys(locale.common.configPage.payload.replace)).toEqual(
        keys(en.common.configPage.payload.replace),
      )
      expect(keys(locale.common.configPage.payload.validation)).toEqual(
        keys(en.common.configPage.payload.validation),
      )
      expect(keys(locale.common.configPage.payload.ruleIssues)).toEqual(
        keys(en.common.configPage.payload.ruleIssues),
      )
      expect(keys(locale.common.configPage.payload.workspace)).toEqual(
        keys(en.common.configPage.payload.workspace),
      )
      expect(keys(locale.common.configPage.payload.workspace.orderHints)).toEqual(
        keys(en.common.configPage.payload.workspace.orderHints),
      )
      expect(keys(locale.common.configPage.payload.workspace.emptyHints)).toEqual(
        keys(en.common.configPage.payload.workspace.emptyHints),
      )
      expect(keys(locale.common.configPage.payload.workspace.categoryLabels)).toEqual(
        keys(en.common.configPage.payload.workspace.categoryLabels),
      )
      expect(locale.common.configPage.payload.intentOptions.replace.title).toBeTruthy()
      expect(locale.common.configPage.payload.sections.replace.description).toBeTruthy()
    }
  })

  test('the overview names matched models in every locale without repeating category counts', async () => {
    for (const locale of [en, zhCN, zhTW, ru]) {
      const i18n = createInstance()
      await i18n.init({ lng: 'test', resources: { test: locale }, defaultNS: 'common' })
      for (const key of [
        'configPage.validation.runtimeChanged',
        'configPage.payload.validation.precision',
        'configPage.payload.replace.previewTooLarge',
      ])
        expect(i18n.exists(key)).toBe(true)
      const summary = i18n.t('configPage.payload.impactSummary', {
        targets: 'example-model-*',
      })
      expect(summary).toContain('example-model-*')
      expect(summary).not.toContain('{{')
    }
  })
})
