export type CredentialUploadItemStatus = 'queued' | 'uploading' | 'success' | 'error'

export type CredentialUploadErrorCode =
  | 'notJson'
  | 'emptyFile'
  | 'invalidJson'
  | 'unsupported'
  | 'unauthorized'
  | 'network'
  | 'server'

export type CredentialUploadItem = {
  id: string
  file: File
  status: CredentialUploadItemStatus
  progress: number
  resultName: string | null
  errorCode: CredentialUploadErrorCode | null
}

let nextUploadItemId = 0

export function createCredentialUploadItem(file: File): CredentialUploadItem {
  nextUploadItemId += 1

  return {
    id: `${Date.now()}-${nextUploadItemId}`,
    file,
    status: 'queued',
    progress: 0,
    resultName: null,
    errorCode: null,
  }
}

export async function validateCredentialUploadFile(
  file: File,
): Promise<CredentialUploadErrorCode | null> {
  if (!file.name.toLowerCase().endsWith('.json')) return 'notJson'
  if (file.size === 0) return 'emptyFile'

  try {
    JSON.parse(await file.text())
    return null
  } catch {
    return 'invalidJson'
  }
}

export function isCredentialUploadRetryable(errorCode: CredentialUploadErrorCode | null) {
  return errorCode === 'network' || errorCode === 'server'
}

export function classifyCredentialUploadError(error: unknown): CredentialUploadErrorCode {
  const requestError = error as { status?: number; code?: string; message?: string }
  const message = requestError.message?.toLowerCase() ?? ''

  if (requestError.status === 401 || requestError.status === 403 || requestError.code === 'auth') {
    return 'unauthorized'
  }
  if (requestError.code === 'network') return 'network'
  if (requestError.status === 400 && message.includes('unsupported credential json')) {
    return 'unsupported'
  }
  if (requestError.status === 400) return 'unsupported'

  return 'server'
}
