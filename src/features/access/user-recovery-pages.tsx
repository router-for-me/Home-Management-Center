import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Link } from '@tanstack/react-router'

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Loader2,
  MailCheck,
  MailQuestion,
  RefreshCcw,
  RotateCcwKey,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchUserMe } from '@/lib/api/user/auth'
import { verifyUserEmail } from '@/lib/api/user/email'
import { requestUserPasswordReset, resetUserPassword } from '@/lib/api/user/password-recovery'
import { useUserSessionStore } from '@/stores/user-session-store'

import { useUserCapabilities } from './use-user-capabilities'
import { userSecurityErrorMessage } from './user-security-errors'

type HashTokenState = {
  ready: boolean
  token: string | null
}

export function consumeUserTokenFromHash(hash: string) {
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
  const queryIndex = rawHash.indexOf('?')
  const pathname = queryIndex >= 0 ? rawHash.slice(0, queryIndex) : rawHash
  const search = queryIndex >= 0 ? rawHash.slice(queryIndex + 1) : ''
  const params = new URLSearchParams(search)
  const sensitiveParamPresent = params.has('token')
  const token = params.get('token')
  params.delete('token')
  const remaining = params.toString()

  return {
    token: token?.trim() || null,
    sensitiveParamPresent,
    cleanHash: `#${pathname}${remaining ? `?${remaining}` : ''}`,
  }
}

function useCapturedHashToken(): HashTokenState {
  const capturedRef = useRef(false)
  const [state, setState] = useState<HashTokenState>({ ready: false, token: null })

  useLayoutEffect(() => {
    if (capturedRef.current) return
    capturedRef.current = true

    if (typeof window === 'undefined') {
      setState({ ready: true, token: null })
      return
    }

    const captured = consumeUserTokenFromHash(window.location.hash)
    if (captured.sensitiveParamPresent) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}${captured.cleanHash}`,
      )
    }
    setState({ ready: true, token: captured.token })
  }, [])

  return state
}

function RecoveryPageFrame({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()

  return (
    <PublicAccessShell>
      <section className="mx-auto grid max-w-xl gap-6">
        <Button asChild variant="text" size="md" className="w-fit px-0">
          <Link to="/user/login">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('userRecovery.backToLogin')}
          </Link>
        </Button>
        <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
          <div className="border-b p-5 md:p-6">
            <span className="bg-info/10 text-info flex size-11 items-center justify-center rounded-md">
              {icon}
            </span>
            <h1 className="mt-5 text-xl font-semibold">{title}</h1>
            <p className="text-muted-foreground mt-2 max-w-[65ch] text-sm leading-6">
              {description}
            </p>
          </div>
          <div className="p-5 md:p-6">{children}</div>
        </div>
      </section>
    </PublicAccessShell>
  )
}

function InlineError({ message }: { message: string }) {
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    errorRef.current?.focus()
  }, [message])

  return (
    <div
      ref={errorRef}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm outline-none"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export function UserForgotPasswordPage() {
  const { t } = useTranslation()
  const capabilities = useUserCapabilities()
  const baseUrl = useUserSessionStore((state) => state.baseUrl)
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim()) {
      setError(t('userRecovery.forgot.validation.emailRequired'))
      return
    }

    try {
      setPending(true)
      setError(null)
      await requestUserPasswordReset(email, { baseUrl })
      setEmail('')
      setSubmitted(true)
    } catch (requestError) {
      setError(userSecurityErrorMessage(t, requestError))
    } finally {
      setPending(false)
    }
  }

  return (
    <RecoveryPageFrame
      icon={<MailQuestion className="size-5" aria-hidden="true" />}
      title={t('userRecovery.forgot.title')}
      description={t('userRecovery.forgot.description')}
    >
      {capabilities.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('userRecovery.capabilities.loading')}
        </div>
      ) : capabilities.error ? (
        <div className="grid gap-4">
          <InlineError message={t('userRecovery.capabilities.loadError')} />
          <Button variant="outline" className="w-fit" onClick={() => void capabilities.refetch()}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            {t('userRecovery.actions.retry')}
          </Button>
        </div>
      ) : !capabilities.data?.passwordRecovery ? (
        <div className="grid gap-4">
          <div className="border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {capabilities.data?.endpointSupported
                ? t('userRecovery.capabilities.disabled')
                : t('userRecovery.capabilities.legacy')}
            </span>
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link to="/user/login">{t('userRecovery.actions.returnToLogin')}</Link>
          </Button>
        </div>
      ) : submitted ? (
        <div className="grid gap-5">
          <div className="border-success/30 bg-success/10 text-success-foreground flex items-start gap-3 rounded-md border px-3 py-3 text-sm">
            <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{t('userRecovery.forgot.acceptedTitle')}</p>
              <p className="mt-1 leading-6">{t('userRecovery.forgot.acceptedDescription')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/user/login">{t('userRecovery.actions.returnToLogin')}</Link>
            </Button>
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              {t('userRecovery.actions.tryAnother')}
            </Button>
          </div>
        </div>
      ) : (
        <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('userRecovery.forgot.email')}</span>
            <Input
              type="email"
              value={email}
              autoComplete="email"
              disabled={pending}
              placeholder={t('userRecovery.forgot.emailPlaceholder')}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {error ? <InlineError message={error} /> : null}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('userRecovery.forgot.action')}
          </Button>
        </form>
      )}
    </RecoveryPageFrame>
  )
}

export function UserResetPasswordPage() {
  const { t } = useTranslation()
  const tokenState = useCapturedHashToken()
  const baseUrl = useUserSessionStore((state) => state.baseUrl)
  const logout = useUserSessionStore((state) => state.logout)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tokenState.token) {
      setInvalid(true)
      return
    }
    if (!newPassword) {
      setError(t('userRecovery.reset.validation.passwordRequired'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('userRecovery.reset.validation.passwordMismatch'))
      return
    }

    try {
      setPending(true)
      setError(null)
      await resetUserPassword({ token: tokenState.token, newPassword }, { baseUrl })
      logout()
      setNewPassword('')
      setConfirmPassword('')
      setCompleted(true)
    } catch (requestError) {
      if (
        typeof requestError === 'object' &&
        requestError !== null &&
        'code' in requestError &&
        requestError.code === 'invalid_or_expired_token'
      ) {
        setInvalid(true)
      } else {
        setError(userSecurityErrorMessage(t, requestError))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <RecoveryPageFrame
      icon={<RotateCcwKey className="size-5" aria-hidden="true" />}
      title={t('userRecovery.reset.title')}
      description={t('userRecovery.reset.description')}
    >
      {!tokenState.ready ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('userRecovery.token.capturing')}
        </div>
      ) : completed ? (
        <div className="grid gap-5">
          <div className="border-success/30 bg-success/10 text-success-foreground flex items-start gap-3 rounded-md border px-3 py-3 text-sm">
            <BadgeCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{t('userRecovery.reset.successTitle')}</p>
              <p className="mt-1 leading-6">{t('userRecovery.reset.successDescription')}</p>
            </div>
          </div>
          <Button asChild className="w-fit">
            <Link to="/user/login">{t('userRecovery.actions.returnToLogin')}</Link>
          </Button>
        </div>
      ) : invalid || !tokenState.token ? (
        <div className="grid gap-4">
          <InlineError message={t('userRecovery.token.invalidReset')} />
          <Button asChild variant="outline" className="w-fit">
            <Link to="/user/forgot-password">{t('userRecovery.actions.requestNewLink')}</Link>
          </Button>
        </div>
      ) : (
        <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('userRecovery.reset.newPassword')}</span>
            <Input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              disabled={pending}
              placeholder={t('userRecovery.reset.newPasswordPlaceholder')}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('userRecovery.reset.confirmPassword')}</span>
            <Input
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              disabled={pending}
              placeholder={t('userRecovery.reset.confirmPasswordPlaceholder')}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {error ? <InlineError message={error} /> : null}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('userRecovery.reset.action')}
          </Button>
        </form>
      )}
    </RecoveryPageFrame>
  )
}

export function UserVerifyEmailPage() {
  const { t } = useTranslation()
  const tokenState = useCapturedHashToken()
  const baseUrl = useUserSessionStore((state) => state.baseUrl)
  const bearerToken = useUserSessionStore((state) => state.token)
  const updateUser = useUserSessionStore((state) => state.updateUser)
  const authenticated = useUserSessionStore((state) => state.status === 'authenticated')
  const [pending, setPending] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async () => {
    if (!tokenState.token) {
      setInvalid(true)
      return
    }

    try {
      setPending(true)
      setError(null)
      await verifyUserEmail(tokenState.token, { baseUrl })
      if (bearerToken) {
        try {
          updateUser(await fetchUserMe({ baseUrl, token: bearerToken }))
        } catch {
          // Verification succeeded even if the optional local profile refresh fails.
        }
      }
      setCompleted(true)
    } catch (requestError) {
      if (
        typeof requestError === 'object' &&
        requestError !== null &&
        'code' in requestError &&
        requestError.code === 'invalid_or_expired_token'
      ) {
        setInvalid(true)
      } else {
        setError(userSecurityErrorMessage(t, requestError))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <RecoveryPageFrame
      icon={<MailCheck className="size-5" aria-hidden="true" />}
      title={t('userRecovery.verify.title')}
      description={t('userRecovery.verify.description')}
    >
      {!tokenState.ready ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('userRecovery.token.capturing')}
        </div>
      ) : completed ? (
        <div className="grid gap-5">
          <div className="border-success/30 bg-success/10 text-success-foreground flex items-start gap-3 rounded-md border px-3 py-3 text-sm">
            <BadgeCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{t('userRecovery.verify.successTitle')}</p>
              <p className="mt-1 leading-6">{t('userRecovery.verify.successDescription')}</p>
            </div>
          </div>
          <Button asChild className="w-fit">
            <Link to={authenticated ? '/user/workspace' : '/user/login'}>
              {authenticated
                ? t('userRecovery.actions.returnToWorkspace')
                : t('userRecovery.actions.returnToLogin')}
            </Link>
          </Button>
        </div>
      ) : invalid || !tokenState.token ? (
        <div className="grid gap-4">
          <InlineError message={t('userRecovery.token.invalidVerify')} />
          <Button asChild variant="outline" className="w-fit">
            <Link to={authenticated ? '/user/workspace' : '/user/login'}>
              {authenticated
                ? t('userRecovery.actions.returnToWorkspace')
                : t('userRecovery.actions.returnToLogin')}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="border-info/25 bg-info/10 text-info flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t('userRecovery.verify.confirmation')}</span>
          </div>
          {error ? <InlineError message={error} /> : null}
          <Button
            type="button"
            disabled={pending}
            className="w-fit"
            onClick={() => void handleVerify()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('userRecovery.verify.action')}
          </Button>
        </div>
      )}
    </RecoveryPageFrame>
  )
}
