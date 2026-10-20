import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('model exclusion picker, connection isolation, and mutation invalidation', () => {
  const fixture = fileURLToPath(new URL('./fixtures/credential-models.tsx', import.meta.url))
  const result = spawnSync(process.execPath, [fixture], {
    encoding: 'utf8',
    timeout: 15_000,
  })
  expect(result.error, result.stderr).toBeUndefined()
  expect(result.status, result.stdout + result.stderr).toBe(0)
})
