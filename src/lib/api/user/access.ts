export type UserAccessAvailability = {
  status: 'available'
  reason: 'user-api'
}

export function getUserAccessAvailability(): UserAccessAvailability {
  return {
    status: 'available',
    reason: 'user-api',
  }
}
