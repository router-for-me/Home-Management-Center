import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  classifyCredentialUploadError,
  validateCredentialUploadFile,
} from '../src/features/credentials/credential-upload'
import { uploadCredentialFile } from '../src/lib/api/management/credentials'

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

describe('credential JSON upload', () => {
  test('validates local file shape before upload', async () => {
    expect(
      await validateCredentialUploadFile(
        new File(['{"type":"codex"}'], 'credential.json', { type: 'application/json' }),
      ),
    ).toBeNull()
    expect(await validateCredentialUploadFile(new File(['{}'], 'credential.txt'))).toBe('notJson')
    expect(await validateCredentialUploadFile(new File([], 'credential.json'))).toBe('emptyFile')
    expect(await validateCredentialUploadFile(new File(['{'], 'credential.json'))).toBe(
      'invalidJson',
    )
  })

  test('classifies recoverable Management API failures', () => {
    expect(
      classifyCredentialUploadError(Object.assign(new Error('forbidden'), { status: 403 })),
    ).toBe('unauthorized')
    expect(
      classifyCredentialUploadError(Object.assign(new Error('network'), { code: 'network' })),
    ).toBe('network')
    expect(
      classifyCredentialUploadError(
        Object.assign(new Error('unsupported credential json'), { status: 400 }),
      ),
    ).toBe('unsupported')
    expect(
      classifyCredentialUploadError(
        Object.assign(new Error('invalid credential'), { status: 400 }),
      ),
    ).toBe('unsupported')
    expect(
      classifyCredentialUploadError(Object.assign(new Error('write failed'), { status: 500 })),
    ).toBe('server')
  })

  test('uploads one file per request and preserves the backend result', async () => {
    let uploadedFile: File | null = null
    const adapter: AxiosAdapter = async (config) => {
      const formData = config.data as FormData
      uploadedFile = formData.get('file') as File

      return {
        data: { status: 'ok', uploaded: 1, files: ['stored-credential.json'] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    axios.defaults.adapter = adapter

    const result = await uploadCredentialFile(
      { baseUrl: 'http://management.test', managementKey: 'test-key' },
      new File(['{"type":"codex"}'], 'credential.json', { type: 'application/json' }),
    )

    expect(uploadedFile?.name).toBe('credential.json')
    expect(result).toEqual({
      status: 'ok',
      uploaded: 1,
      files: ['stored-credential.json'],
    })
  })
})
