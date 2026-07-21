import { createFileRoute } from '@tanstack/react-router'

import { UserResetPasswordPage } from '@/features/access/user-recovery-pages'

export const Route = createFileRoute('/user/reset-password')({
  component: UserResetPasswordPage,
})
