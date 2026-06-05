import {
  type UserAuthSession,
  type UserPasskeyResource,
  normalizeUserAccount,
  normalizeUserPasskeys,
} from '@/lib/api/user/auth'
import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

type UnknownRecord = Record<string, unknown>

type PasskeyBeginResult = {
  challengeId: string
  publicKey: UnknownRecord
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function normalizePasskeyBegin(value: unknown): PasskeyBeginResult {
  const record = isRecord(value) ? value : {}
  const challengeId = readString(record, ['challenge_id', 'challengeId', 'state'])
  const publicKey = isRecord(record.publicKey)
    ? record.publicKey
    : isRecord(record.options) && isRecord(record.options.publicKey)
      ? record.options.publicKey
      : null

  if (!challengeId || !publicKey) {
    throw new Error('invalid passkey challenge response')
  }

  return {
    challengeId,
    publicKey,
  }
}

function base64UrlToArrayBuffer(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = window.atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

function arrayBufferToBase64Url(value: ArrayBuffer | null) {
  if (!value) return null

  const bytes = new Uint8Array(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeCredentialDescriptor(value: unknown): PublicKeyCredentialDescriptor {
  const record = isRecord(value) ? value : {}
  const id = readString(record, ['id'])

  return {
    ...record,
    id: id ? base64UrlToArrayBuffer(id) : new ArrayBuffer(0),
    type: 'public-key',
  } as PublicKeyCredentialDescriptor
}

function decodeCreationOptions(value: UnknownRecord): PublicKeyCredentialCreationOptions {
  const user = isRecord(value.user) ? value.user : {}
  const challenge = readString(value, ['challenge'])
  const userId = readString(user, ['id'])

  if (!challenge || !userId) {
    throw new Error('invalid passkey creation options')
  }

  return {
    ...value,
    challenge: base64UrlToArrayBuffer(challenge),
    user: {
      ...user,
      id: base64UrlToArrayBuffer(userId),
      name: readString(user, ['name']) ?? '',
      displayName:
        readString(user, ['displayName', 'display_name']) ?? readString(user, ['name']) ?? '',
    },
    excludeCredentials: Array.isArray(value.excludeCredentials)
      ? value.excludeCredentials.map(decodeCredentialDescriptor)
      : undefined,
  } as PublicKeyCredentialCreationOptions
}

function decodeRequestOptions(value: UnknownRecord): PublicKeyCredentialRequestOptions {
  const challenge = readString(value, ['challenge'])

  if (!challenge) {
    throw new Error('invalid passkey request options')
  }

  return {
    ...value,
    challenge: base64UrlToArrayBuffer(challenge),
    allowCredentials: Array.isArray(value.allowCredentials)
      ? value.allowCredentials.map(decodeCredentialDescriptor)
      : undefined,
  } as PublicKeyCredentialRequestOptions
}

function credentialToJSON(credential: PublicKeyCredential) {
  const response = credential.response
  const responseJSON: Record<string, string | null> = {
    clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
  }

  if ('attestationObject' in response) {
    const attestationResponse = response as AuthenticatorAttestationResponse
    responseJSON.attestationObject = arrayBufferToBase64Url(attestationResponse.attestationObject)
  }

  if ('authenticatorData' in response) {
    const assertionResponse = response as AuthenticatorAssertionResponse
    responseJSON.authenticatorData = arrayBufferToBase64Url(assertionResponse.authenticatorData)
  }

  if ('signature' in response) {
    const assertionResponse = response as AuthenticatorAssertionResponse
    responseJSON.signature = arrayBufferToBase64Url(assertionResponse.signature)
  }

  if ('userHandle' in response) {
    const assertionResponse = response as AuthenticatorAssertionResponse
    responseJSON.userHandle = arrayBufferToBase64Url(assertionResponse.userHandle)
  }

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: responseJSON,
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

function assertWebAuthnSupport() {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error('passkey is not supported by this browser')
  }
}

async function beginPasskeyLogin(username: string, session: UserSessionInput = {}) {
  const client = createUserClient(session)

  try {
    const response = await client.post<unknown>('/login/passkey/begin', {
      username: username.trim(),
    })

    return normalizePasskeyBegin(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

async function finishPasskeyLogin(
  username: string,
  challengeId: string,
  credential: PublicKeyCredential,
  session: UserSessionInput = {},
): Promise<UserAuthSession> {
  const client = createUserClient(session)

  try {
    const response = await client.post<unknown>('/login/passkey', {
      username: username.trim(),
      challenge_id: challengeId,
      credential: credentialToJSON(credential),
    })
    const record = isRecord(response.data) ? response.data : {}
    const token = readString(record, ['token'])
    const expiresAt = readString(record, ['expires_at', 'expiresAt'])

    if (!token || !expiresAt) {
      throw new Error('invalid user auth response')
    }

    return {
      token,
      expiresAt,
      user: normalizeUserAccount(record.user),
    }
  } catch (error) {
    throw toUserApiError(error)
  }
}

async function beginPasskeyRegistration(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
) {
  const client = createUserClient(session)

  try {
    const response = await client.post<unknown>('/passkeys/begin', {})
    return normalizePasskeyBegin(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

async function finishPasskeyRegistration(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  challengeId: string,
  credential: PublicKeyCredential,
  name?: string,
) {
  const client = createUserClient(session)

  try {
    const response = await client.post<unknown>('/passkeys', {
      challenge_id: challengeId,
      credential: credentialToJSON(credential),
      name: name?.trim() || undefined,
    })
    const record = isRecord(response.data) ? response.data : {}
    const passkey = normalizeUserPasskeys(record.passkey)[0] ?? normalizeUserPasskeys(record)[0]

    if (!passkey) {
      throw new Error('invalid passkey response')
    }

    return passkey
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function deleteUserPasskey(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  passkey: Pick<UserPasskeyResource, 'id'>,
) {
  const client = createUserClient(session)

  try {
    await client.delete(`/passkeys/${encodeURIComponent(passkey.id)}`)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function loginUserWithBrowserPasskey(
  username: string,
  session: UserSessionInput = {},
) {
  assertWebAuthnSupport()

  const challenge = await beginPasskeyLogin(username, session)
  const credential = await navigator.credentials.get({
    publicKey: decodeRequestOptions(challenge.publicKey),
  })

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('passkey login was cancelled')
  }

  return finishPasskeyLogin(username, challenge.challengeId, credential, session)
}

export async function createUserPasskeyWithBrowser(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  input: { name?: string } = {},
) {
  assertWebAuthnSupport()

  const challenge = await beginPasskeyRegistration(session)
  const credential = await navigator.credentials.create({
    publicKey: decodeCreationOptions(challenge.publicKey),
  })

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('passkey registration was cancelled')
  }

  return finishPasskeyRegistration(session, challenge.challengeId, credential, input.name)
}
