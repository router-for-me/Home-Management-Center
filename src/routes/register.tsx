import { createFileRoute } from '@tanstack/react-router'

import { UserAuthPage } from '@/features/access/user-auth-page'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  return <UserAuthPage mode="register" />
}
