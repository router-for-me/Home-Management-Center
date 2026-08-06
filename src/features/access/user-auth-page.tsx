import { useEffect, useRef, useState } from 'react'

import { Link, useNavigate } from '@tanstack/react-router'

import { ArrowLeft, CircleAlert, Loader2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { fieldClassName } from '@/components/shared/form-layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { loginUser, loginUserWithTotp, registerUser } from '@/lib/api/user/auth'
import { isUserApiError } from '@/lib/api/user/client'
import { loginUserWithBrowserPasskey } from '@/lib/api/user/passkeys'
import { embeddedEntryLinks } from '@/lib/embedded-entry-links'
import { useUserSessionStore } from '@/stores/user-session-store'

import { useUserCapabilities } from './use-user-capabilities'
import { userSecurityErrorMessage } from './user-security-errors'

type UserAuthPageProps = {
  mode: 'login' | 'register'
}

type AuthStep = 'password' | 'totp' | 'passkey'

export function UserAuthPage({ mode }: UserAuthPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const status = useUserSessionStore((state) => state.status)
  const baseUrl = useUserSessionStore((state) => state.baseUrl)
  const rememberSession = useUserSessionStore((state) => state.rememberSession)
  const setChecking = useUserSessionStore((state) => state.setChecking)
  const setAuthenticated = useUserSessionStore((state) => state.setAuthenticated)
  const setError = useUserSessionStore((state) => state.setError)
  const reset = useUserSessionStore((state) => state.reset)
  const user = useUserSessionStore((state) => state.user)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [remember, setRemember] = useState(rememberSession)
  const [step, setStep] = useState<AuthStep>('password')
  const [localError, setLocalError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const capabilities = useUserCapabilities()
  const checking = status === 'checking'

  useEffect(() => {
    if (localError) errorRef.current?.focus()
  }, [localError])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedUsername = username.trim()

    if (!trimmedUsername) {
      setLocalError(t('userAccess.validation.usernameRequired'))
      return
    }

    if (step !== 'passkey' && !password) {
      setLocalError(t('userAccess.validation.passwordRequired'))
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      setLocalError(t('userAccess.validation.passwordMismatch'))
      return
    }

    if (step === 'totp' && !totpCode.trim()) {
      setLocalError(t('userAccess.validation.totpRequired'))
      return
    }

    try {
      setLocalError(null)
      setChecking()
      const session =
        mode === 'register'
          ? await registerUser({ username: trimmedUsername, password, email }, { baseUrl })
          : step === 'passkey'
            ? await loginUserWithBrowserPasskey(trimmedUsername, { baseUrl })
            : step === 'totp'
              ? await loginUserWithTotp(
                  {
                    username: trimmedUsername,
                    password,
                    totpCode,
                  },
                  { baseUrl },
                )
              : await loginUser({ username: trimmedUsername, password }, { baseUrl })

      setAuthenticated(session, remember, baseUrl)
      await navigate({ to: '/user/workspace' })
    } catch (error) {
      if (isUserApiError(error) && mode === 'login') {
        if (error.code === 'totp_required') {
          setStep('totp')
          setLocalError(null)
          reset()
          return
        }

        if (error.code === 'passkey_required') {
          setStep('passkey')
          setLocalError(null)
          reset()
          return
        }
      }

      const emailErrorCodes = new Set([
        'invalid_email',
        'email_unavailable',
        'email_feature_unavailable',
      ])
      const message =
        isUserApiError(error) && emailErrorCodes.has(error.code)
          ? userSecurityErrorMessage(t, error)
          : isUserApiError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error)

      setError(message)
      setLocalError(message)
    }
  }

  return (
    <PublicAccessShell>
      <section className="mx-auto grid max-w-xl gap-6">
        <Button asChild variant="text" size="md" className="w-fit px-0">
          <a href={embeddedEntryLinks.bridge}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('userAccess.back')}
          </a>
        </Button>

        <div className="bg-card rounded-lg border shadow-sm">
          <div className="border-b p-5 md:p-6">
            <span className="bg-info/10 text-info flex size-11 items-center justify-center rounded-md">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">{t(`userAccess.${mode}.title`)}</h1>
            <p className="text-muted-foreground mt-2 max-w-[65ch] text-sm leading-6">
              {t(`userAccess.${mode}.description`)}
            </p>
          </div>

          <form className="grid gap-5 p-5 md:p-6" onSubmit={(event) => void handleSubmit(event)}>
            {status === 'authenticated' && user ? (
              <div className="border-success/30 bg-success/10 text-success-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t('userAccess.authenticated', { username: user.username })}</span>
              </div>
            ) : null}

            {step === 'passkey' ? (
              <div className="border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t('userAccess.passkey.description')}</span>
              </div>
            ) : null}

            <fieldset className="grid gap-4" disabled={checking} aria-disabled={checking}>
              <label className={fieldClassName}>
                <span>{t('userAccess.fields.username')}</span>
                <Input
                  value={username}
                  autoComplete="username"
                  placeholder={t('userAccess.fields.usernamePlaceholder')}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              {mode === 'register' && capabilities.data?.emailRegistration ? (
                <label className={fieldClassName}>
                  <span>{t('userAccess.fields.emailOptional')}</span>
                  <Input
                    type="email"
                    value={email}
                    autoComplete="email"
                    placeholder={t('userAccess.fields.emailPlaceholder')}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <span className="text-muted-foreground text-xs leading-5">
                    {t('userAccess.fields.emailHint')}
                  </span>
                </label>
              ) : null}
              {step !== 'passkey' ? (
                <label className={fieldClassName}>
                  <span className="flex items-center justify-between gap-3">
                    <span>{t('userAccess.fields.password')}</span>
                    {mode === 'login' && step === 'password' ? (
                      <Link
                        to="/user/forgot-password"
                        className="text-primary focus-visible:ring-ring/50 rounded-sm text-xs font-medium outline-none hover:underline focus-visible:ring-3"
                      >
                        {t('userAccess.login.forgotPassword')}
                      </Link>
                    ) : null}
                  </span>
                  <Input
                    type="password"
                    value={password}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder={t('userAccess.fields.passwordPlaceholder')}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              ) : null}
              {mode === 'register' ? (
                <label className={fieldClassName}>
                  <span>{t('userAccess.fields.confirmPassword')}</span>
                  <Input
                    type="password"
                    value={confirmPassword}
                    autoComplete="new-password"
                    placeholder={t('userAccess.fields.confirmPasswordPlaceholder')}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>
              ) : null}
              {mode === 'login' && step === 'totp' ? (
                <label className={fieldClassName}>
                  <span>{t('userAccess.fields.totpCode')}</span>
                  <Input
                    value={totpCode}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    placeholder={t('userAccess.fields.totpCodePlaceholder')}
                    onChange={(event) => setTotpCode(event.target.value)}
                  />
                </label>
              ) : null}
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  className="mt-1"
                  checked={remember}
                  disabled={checking}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                />
                <span className="grid gap-1">
                  <span className="font-medium">{t('userAccess.remember')}</span>
                  <span className="text-muted-foreground text-xs leading-5">
                    {t('userAccess.rememberHint')}
                  </span>
                </span>
              </label>
              {localError ? (
                <div
                  ref={errorRef}
                  role="alert"
                  aria-live="assertive"
                  tabIndex={-1}
                  className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm outline-none"
                >
                  {localError}
                </div>
              ) : null}
              <Button type="submit" disabled={checking}>
                {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                <LockKeyhole className="size-4" aria-hidden="true" />
                {checking
                  ? t('userAccess.processing')
                  : step === 'passkey'
                    ? t('userAccess.passkey.action')
                    : t(`userAccess.${mode}.action`)}
              </Button>
            </fieldset>

            <p className="text-muted-foreground text-center text-sm">
              {mode === 'login'
                ? t('userAccess.login.switchPrompt')
                : t('userAccess.register.switchPrompt')}{' '}
              <Link
                to={mode === 'login' ? '/user/register' : '/user/login'}
                className="text-primary focus-visible:ring-ring/50 rounded-sm font-medium outline-none hover:underline focus-visible:ring-3"
              >
                {mode === 'login'
                  ? t('userAccess.login.switchAction')
                  : t('userAccess.register.switchAction')}
              </Link>
            </p>
          </form>
        </div>
      </section>
    </PublicAccessShell>
  )
}
