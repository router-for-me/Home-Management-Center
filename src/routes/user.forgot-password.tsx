import { createFileRoute } from '@tanstack/react-router'

import { UserForgotPasswordPage } from '@/features/access/user-recovery-pages'

export const Route = createFileRoute('/user/forgot-password')({
  component: UserForgotPasswordPage,
})
