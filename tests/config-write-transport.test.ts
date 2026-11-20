import { beforeAll, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import type { ConfigFieldValue, WritableConfigFieldKey } from '../src/lib/api/management/config'

type Case = {
  name: string
  key: WritableConfigFieldKey
  value: ConfigFieldValue
  path: string
  method: 'PUT' | 'PATCH' | 'DELETE'
  previousValue?: ConfigFieldValue
  expected?: unknown
}

function put(
  name: string,
  key: WritableConfigFieldKey,
  value: ConfigFieldValue,
  path: string,
  expected: unknown = value,
): Case {
  return { name, key, value, path, method: 'PUT', expected }
}

const cache = 'client/codex/web-search-result-cache'
const cases: Case[] = [
  ...['on', 'passthrough', 'off'].map((mode) =>
    put(
      `writes Claude request ID mode ${mode} as text`,
      'upstreamClaudeClientRequestId',
      mode,
      'upstream/claude/header-defaults/client-request-id',
    ),
  ),
  {
    name: 'restores only the client request ID policy',
    key: 'upstreamClaudeClientRequestId',
    path: 'upstream/claude/header-defaults/client-request-id',
    method: 'DELETE',
    value: null,
  },
  ...['0', '-1', '7'].map((days) =>
    put(
      `writes session date pin ${days} as an integer`,
      'upstreamClaudeSessionDatePinDays',
      days,
      'upstream/claude/session-date-pin-days',
      Number(days),
    ),
  ),
  {
    name: 'removes only the session date pin',
    key: 'upstreamClaudeSessionDatePinDays',
    value: null,
    path: 'upstream/claude/session-date-pin-days',
    method: 'DELETE',
  },
  ...(
    [
      ['clientCodexEnableApplyPatch', 'client/codex/enable-apply-patch'],
      ['clientClaudeShowCodexCommentary', 'client/claude/show-codex-commentary'],
      ['upstreamClaudeServerSideFallback', 'upstream/claude/server-side-fallback'],
      ['upstreamClaudeInjectDiagnostics', 'upstream/claude/header-defaults/inject-diagnostics'],
      ['upstreamCodexRequestCompression', 'upstream/codex/upstream-request-compression'],
      ['upstreamCodexWebsocketCompression', 'upstream/codex/websocket-compression'],
    ] as const
  ).flatMap(([key, path]) => [
    put(`preserves the explicit false override at ${path}`, key, false, path),
    { name: `removes only ${path}`, key, path, value: null, method: 'DELETE' as const },
  ]),
  put(
    'saves zero as the Codex request compression threshold',
    'upstreamCodexRequestCompressionMinBytes',
    '0',
    'upstream/codex/upstream-request-compression-min-bytes',
    0,
  ),
  put(
    'saves a JSON-looking Codex sign-in identifier as a string',
    'oauthCodexSigninIdentifier',
    ' false ',
    'oauth/providers/codex/signin-with-chatgpt-identifier',
    'false',
  ),
  {
    name: 'clears the sign-in identifier without writing OAuth siblings',
    key: 'oauthCodexSigninIdentifier',
    value: null,
    path: 'oauth/providers/codex/signin-with-chatgpt-identifier',
    method: 'DELETE',
  },
  {
    name: 'merges an explicit false into a nullable web search cache',
    key: 'clientCodexWebSearchCacheEnabled',
    value: false,
    path: cache,
    method: 'PATCH',
    expected: { enabled: false },
  },
  {
    name: 'merges a zero entry limit independently of cache enablement',
    key: 'clientCodexWebSearchCacheLimit',
    value: '0',
    path: cache,
    method: 'PATCH',
    expected: { limit: 0 },
  },
  {
    name: 'stores new cache seconds as a bare integer including zero',
    key: 'clientCodexWebSearchCacheTtl',
    value: '0',
    path: cache,
    method: 'PATCH',
    expected: { ttl: 0 },
  },
  {
    name: 'keeps a previously quoted seconds value quoted when edited',
    key: 'clientCodexWebSearchCacheTtl',
    previousValue: '1800',
    value: '7200',
    path: cache,
    method: 'PATCH',
    expected: { ttl: '7200' },
  },
  {
    name: 'stores a unit-bearing cache duration as text',
    key: 'clientCodexWebSearchCacheTtl',
    previousValue: 60,
    value: '1h30m',
    path: cache,
    method: 'PATCH',
    expected: { ttl: '1h30m' },
  },
  ...(
    [
      ['clientCodexWebSearchCacheEnabled', 'enabled'],
      ['clientCodexWebSearchCacheTtl', 'ttl'],
      ['clientCodexWebSearchCacheLimit', 'limit'],
    ] as const
  ).map(([key, member]) => ({
    name: `restores just the cache ${member} default`,
    key,
    value: null,
    path: cache + '/' + member,
    method: 'DELETE' as const,
  })),
  ...(
    [
      ['serverMaxRequestBodyBytes', 'server/max-request-body-bytes'],
      ['serverResponseCompressionMinBytes', 'server/response-compression/min-bytes'],
      ['serverShutdownTimeout', 'server/shutdown-timeout'],
    ] as const
  ).flatMap(([key, path]) => [
    put(`preserves explicit zero at ${path}`, key, '0', path, 0),
    put(`writes a positive integer at ${path}`, key, '2048', path, 2048),
    { name: `restores the default at ${path}`, key, value: null, path, method: 'DELETE' as const },
  ]),
  put(
    'disables only the CPA compression switch',
    'serverResponseCompressionEnabled',
    false,
    'server/response-compression/enabled',
  ),
  {
    name: 'restores the default without removing the CPA compression threshold',
    key: 'serverResponseCompressionEnabled',
    value: null,
    path: 'server/response-compression/enabled',
    method: 'DELETE',
  },
  ...['3', '0', '-2', '+016'].map((text) =>
    put(
      `writes OAuth refresh concurrency ${text} as a JSON integer`,
      'oauthAutoRefreshWorkers',
      text,
      'oauth/auth-auto-refresh-workers',
      Number(text),
    ),
  ),
  {
    name: 'restores the default OAuth refresh concurrency by deleting its override',
    key: 'oauthAutoRefreshWorkers',
    value: null,
    path: 'oauth/auth-auto-refresh-workers',
    method: 'DELETE',
  },
  ...['0', 'false', 'off', 'none', 'disabled', '1h30m'].map((value) =>
    put(
      `writes the Antigravity TOS pause window ${value} as a JSON string`,
      'antigravityTosPauseWindow',
      value,
      'oauth/providers/antigravity/tos-pause-window',
    ),
  ),
  {
    name: 'restores the default TOS pause window by deleting only that field',
    key: 'antigravityTosPauseWindow',
    value: '  ',
    path: 'oauth/providers/antigravity/tos-pause-window',
    method: 'DELETE',
  },
  put(
    'writes a quoted public IP',
    'liveMediaRelayPublicIp',
    '203.0.113.1',
    'oauth/providers/codex/live-media-relay/public-ip',
  ),
  put(
    'writes a quoted duration',
    'antigravityConnPoolIdleTimeout',
    '30s',
    'oauth/providers/antigravity/connection-pool/idle-conn-timeout',
  ),
  ...['false', '0', 'null', '[1,2]', '{"agent":"cli"}', 'quoted "agent"\nnext line'].map((value) =>
    put(
      `preserves string type and escaping for ${JSON.stringify(value)}`,
      'oauthCodexHeaderUserAgent',
      value,
      'oauth/providers/codex/header-defaults/user-agent',
    ),
  ),
  put(
    'retains string trimming',
    'oauthCodexHeaderUserAgent',
    '  agent  ',
    'oauth/providers/codex/header-defaults/user-agent',
    'agent',
  ),
  put(
    'sends false instead of an empty body',
    'liveMediaRelayEnabled',
    false,
    'oauth/providers/codex/live-media-relay/enabled',
  ),
  put(
    'sends true as JSON',
    'liveMediaRelayEnabled',
    true,
    'oauth/providers/codex/live-media-relay/enabled',
  ),
  put(
    'sends zero instead of an empty body',
    'liveMediaRelayMaxSessions',
    0,
    'oauth/providers/codex/live-media-relay/max-sessions',
  ),
  put(
    'sends nonzero numbers as JSON',
    'liveMediaRelayMaxSessions',
    7,
    'oauth/providers/codex/live-media-relay/max-sessions',
  ),
  put(
    'preserves explicit null for inheritance',
    'antigravitySignatureCacheEnabled',
    null,
    'oauth/providers/antigravity/signature-cache-enabled',
  ),
  ...[false, true].map((value) =>
    put(
      `writes an explicit subagent session affinity override of ${value}`,
      'sessionAffinitySubagents',
      value,
      'routing/session-affinity-subagents',
    ),
  ),
  ...['any', 'quota', 'never'].map((value) =>
    put(
      `writes the ${value} session rebinding policy as a single routing field`,
      'sessionAffinityRebindOn',
      value,
      'routing/session-affinity-rebind-on',
    ),
  ),
  {
    name: 'restores default subagent affinity by deleting only its override',
    key: 'sessionAffinitySubagents',
    value: null,
    path: 'routing/session-affinity-subagents',
    method: 'DELETE',
  },
  ...[false, true].map((value) =>
    put(
      `writes only the discovery auth flag when explicitly set to ${value}`,
      'discoveryAuthRequired',
      value,
      'server/discovery/auth-required',
    ),
  ),
  {
    name: 'restores the default discovery auth flag without replacing the discovery subtree',
    key: 'discoveryAuthRequired',
    value: null,
    path: 'server/discovery/auth-required',
    method: 'DELETE',
  },
  put(
    'preserves nullable false',
    'antigravitySignatureBypassStrict',
    false,
    'oauth/providers/antigravity/signature-bypass-strict',
  ),
  put(
    'preserves nullable true',
    'antigravitySignatureCacheEnabled',
    true,
    'oauth/providers/antigravity/signature-cache-enabled',
  ),
  ...([false, true, 'chat', 'passthrough'] as const).map((value) =>
    put(
      `encodes the image-generation mode ${value}`,
      'multimediaDisableImageGeneration',
      value,
      'multimedia/disable-image-generation',
    ),
  ),
  put(
    'writes bare JSON arrays',
    'liveMediaRelayIceServersJson',
    '[{"urls":["stun:example.invalid"]}]',
    'oauth/providers/codex/live-media-relay/ice-servers',
    [{ urls: ['stun:example.invalid'] }],
  ),
  put(
    'writes empty arrays without deleting the setting',
    'liveMediaRelayIceServersJson',
    '[]',
    'oauth/providers/codex/live-media-relay/ice-servers',
    [],
  ),
  put(
    'retains string-list normalization',
    'antigravitySensitiveWordsJson',
    '[" alpha ","",2,"beta"]',
    'oauth/providers/antigravity/sensitive-words',
    ['alpha', 'beta'],
  ),
  put(
    'writes bare JSON objects',
    'oauthExcludedModelsJson',
    '{"claude":["model-a"]}',
    'oauth/excluded-models',
    { claude: ['model-a'] },
  ),
  put(
    'writes empty objects without deleting the setting',
    'oauthExcludedModelsJson',
    '{}',
    'oauth/excluded-models',
    {},
  ),
  put(
    'retains payload sanitization',
    'payloadRulesJson',
    '{"override":[{"models":[" model-a "],"params":{" temperature ":0}}]}',
    'requests/payload',
    {
      default: [],
      'default-raw': [],
      override: [{ models: [{ name: 'model-a' }], params: { temperature: 0 } }],
      'override-raw': [],
      filter: [],
    },
  ),
  {
    name: 'clears blank strings with DELETE',
    key: 'liveMediaRelayPublicIp',
    value: '   ',
    path: 'oauth/providers/codex/live-media-relay/public-ip',
    method: 'DELETE',
  },
  {
    name: 'clears a blank image-generation mode with DELETE',
    key: 'multimediaDisableImageGeneration',
    value: '',
    path: 'multimedia/disable-image-generation',
    method: 'DELETE',
  },
  {
    name: 'clears empty payload rules with DELETE',
    key: 'payloadRulesJson',
    value: '{}',
    path: 'requests/payload',
    method: 'DELETE',
  },
]

let results: Array<{
  error: string | null
  requests: Array<{ method: string; path: string; body: string; contentType: string }>
}>

beforeAll(() => {
  const fixture = fileURLToPath(new URL('./fixtures/config-xhr-transport.ts', import.meta.url))
  const child = spawnSync(process.execPath, [fixture], {
    input: JSON.stringify(
      cases.map(({ key, value, previousValue = null }) => ({
        key,
        nextValue: value,
        previousValue,
      })),
    ),
    encoding: 'utf8',
    timeout: 10_000,
  })
  expect(child.error).toBeUndefined()
  expect(child.stderr).toBe('')
  expect(child.status).toBe(0)
  results = JSON.parse(child.stdout)
  expect(results).toHaveLength(cases.length)
})

for (const [index, sample] of cases.entries()) {
  test(`config XHR transport ${sample.name}`, () => {
    const result = results[index]!
    expect(result.error).toBeNull()
    expect(result.requests).toHaveLength(1)
    const request = result.requests[0]!
    expect(request.method).toBe(sample.method)
    expect(request.path).toBe(`/v8/management/config/${sample.path}`)
    if (sample.method === 'DELETE') {
      expect(request.body).toBe('')
    } else {
      expect(request.contentType).toBe('application/json')
      expect(request.body).toBe(JSON.stringify(sample.expected))
      expect(JSON.parse(request.body)).toEqual(sample.expected)
    }
  })
}
