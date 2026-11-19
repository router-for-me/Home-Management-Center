import axios from 'axios'
import { afterEach, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  deleteAccessGroupDetail,
  fetchAccessGroupsSnapshot,
  fetchBoundChannelCredentials,
} from '@/lib/api/management/access-groups'
import { probeManagementRuntime } from '@/lib/api/management/probe'

const session = { baseUrl: 'http://scope.test', managementKey: 'fixture' }
const savedAdapter = axios.defaults.adapter
afterEach(() => {
  axios.defaults.adapter = savedAdapter
})

test('binding metadata distinguishes unresolved, absent, and mismatched identities', async () => {
  axios.defaults.adapter = async (config) => {
    expect(config.url).toBe('/channel-group-details')
    expect(config.params).toEqual({ include: 'credential' })
    return {
      config,
      headers: {},
      status: 200,
      statusText: 'OK',
      data: {
        channel_group_details: [
          {
            auth_id: 'found',
            credential: {
              auth_id: 'found',
              display_name: 'Team',
              provider: 'codex',
              state: 'disabled',
            },
          },
          { auth_id: 'orphan', credential: null },
          { auth_id: 'old' },
          { auth_id: 'conflict', credential: { auth_id: 'other', display_name: 'Wrong team' } },
        ],
      },
    }
  }
  const metadata = await fetchBoundChannelCredentials(session)
  expect(metadata.byAuthId.get('found')).toEqual({
    authId: 'found',
    displayName: 'Team',
    provider: 'codex',
    state: 'disabled',
  })
  expect(metadata.byAuthId.get('orphan')).toBeNull()
  expect(metadata.byAuthId.has('old')).toBe(false)
  expect(metadata.byAuthId.has('conflict')).toBe(false)
  expect(metadata.unavailable).toBe(false)
})

test('removal uses only a persisted binding row ID', async () => {
  const deletes: string[] = []
  axios.defaults.adapter = async (config) => {
    if (config.method === 'delete') deletes.push(config.url!)
    return {
      config,
      headers: {},
      status: 200,
      statusText: 'OK',
      data: {
        channel_group_details: [
          { id: 41, channel_group_id: 7, auth_id: 'credential' },
          { channel_group_id: 7, auth_id: 'legacy' },
        ],
      },
    }
  }
  const { channelGroupDetails } = await fetchAccessGroupsSnapshot(session)
  await deleteAccessGroupDetail(session, channelGroupDetails[0]!)
  await expect(deleteAccessGroupDetail(session, channelGroupDetails[1]!)).rejects.toThrow()
  expect(deletes).toEqual(['/channel-group-details/41'])
})

test('candidate support comes only from the capability declaration', async () => {
  let flag: boolean | undefined
  const reads: string[] = []
  axios.defaults.adapter = async (config) => {
    reads.push(config.url!)
    return {
      config,
      headers: {},
      status: 200,
      statusText: 'OK',
      data:
        config.url === '/capabilities'
          ? { capabilities: { access_groups: true, channel_group_credential_candidates: flag } }
          : { 'config-version': 8 },
    }
  }
  for (const value of [undefined, false, true]) {
    flag = value
    expect(
      (await probeManagementRuntime(session)).capabilities.channelGroupCredentialCandidates,
    ).toBe(value === true)
  }
  expect(reads).not.toContain('/channel-group-credential-candidates')
})

test('binding lookups follow the active view, candidate capability and connection', () => {
  const fixture = fileURLToPath(
    new URL('./fixtures/channel-credential-bindings.tsx', import.meta.url),
  )
  const result = spawnSync(process.execPath, [fixture], { encoding: 'utf8', timeout: 15000 })
  expect(result.error, result.stderr).toBeUndefined()
  expect(result.status, result.stdout + result.stderr).toBe(0)
})
