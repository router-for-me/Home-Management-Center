import { createFileRoute } from '@tanstack/react-router'

import { UserVerifyEmailPage } from '@/features/access/user-recovery-pages'

export const Route = createFileRoute('/user/verify-email')({
  component: UserVerifyEmailPage,
})
