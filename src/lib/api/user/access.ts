export type UserAccessAvailability = {
  status: 'unsupported'
  reason: 'missing-user-auth-api'
}

// The current Home API exposes administrator-owned user records only.
// Keep user-facing auth unavailable until the backend publishes a dedicated contract.
export function getUserAccessAvailability(): UserAccessAvailability {
  return {
    status: 'unsupported',
    reason: 'missing-user-auth-api',
  }
}
