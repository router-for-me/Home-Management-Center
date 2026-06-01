import { createFileRoute } from '@tanstack/react-router'

import { UserAuthPage } from '@/features/access/user-auth-page'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  return <UserAuthPage mode="login" />
}
