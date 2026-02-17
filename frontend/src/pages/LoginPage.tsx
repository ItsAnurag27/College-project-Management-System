import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../api'
import { setSession } from '../auth'

type AuthResponse = {
  accessToken: string
  user: { id: string; name: string; email: string; rootAdmin?: boolean }
}

type OtpPurpose = 'VERIFY_EMAIL' | 'LOGIN' | 'RESET_PASSWORD'

type OtpRequestResponse = { expiresInSeconds: number }
type ResetPasswordResponse = { reset: boolean }

export default function LoginPage() {
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'reset'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetExpiresInSeconds, setResetExpiresInSeconds] = useState<number | null>(null)

  return (
    <div className="app-shell">
      <div className="app-container flex min-h-[calc(100vh-1px)] items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <div className="badge">Welcome back</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{mode === 'login' ? 'Login' : 'Reset password'}</h1>
            <p className="mt-2 text-sm text-slate-400">
              Don&apos;t have an account?{' '}
              <Link className="text-indigo-300 hover:text-indigo-200" to="/register">
                Register
              </Link>
            </p>
          </div>

          {mode === 'login' ? (
            <form
              className="card card-pad space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setError(null)
                setLoading(true)
                try {
                  const res = await apiFetch<AuthResponse>('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                  })
                  setSession(res.accessToken, res.user)
                  try {
                    sessionStorage.setItem('postLoginSplashUntil', String(Date.now() + 1200))
                  } catch {
                    // ignore
                  }
                  nav('/dashboard')
                } catch (e: any) {
                  const err = e as ApiError
                  setError(err.error ?? 'Login failed')
                } finally {
                  setLoading(false)
                }
              }}
            >
              <div>
                <label className="text-sm text-slate-300" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="input mt-1"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-300" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  className="input mt-1"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>

              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setError(null)
                  setResetError(null)
                  setResetNotice(null)
                  setResetExpiresInSeconds(null)
                  setResetEmail(email)
                  setMode('reset')
                }}
              >
                Forgot password?
              </button>

              {error && <div className="error-box">{error}</div>}

              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Logging in…' : 'Login'}
              </button>
            </form>
          ) : (
            <form
              className="card card-pad space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setResetError(null)
                setResetNotice(null)

                if (!resetEmail.trim()) return
                if (!resetCode.trim()) {
                  setResetError('Enter the code we emailed you')
                  return
                }
                if (!resetNewPassword) {
                  setResetError('Enter a new password')
                  return
                }
                if (resetNewPassword !== resetConfirmPassword) {
                  setResetError('Passwords do not match')
                  return
                }

                setResetLoading(true)
                try {
                  const res = await apiFetch<ResetPasswordResponse>('/auth/password/reset', {
                    method: 'POST',
                    body: JSON.stringify({
                      email: resetEmail,
                      code: resetCode,
                      newPassword: resetNewPassword
                    })
                  })

                  if (!res.reset) {
                    setResetError('Could not reset password')
                    return
                  }

                  setResetNotice('Password updated. You can login now.')
                  setEmail(resetEmail)
                  setPassword('')
                  setMode('login')
                  setResetCode('')
                  setResetNewPassword('')
                  setResetConfirmPassword('')
                } catch (e: any) {
                  const err = e as ApiError
                  setResetError(err.error ?? 'Reset failed')
                } finally {
                  setResetLoading(false)
                }
              }}
            >
              <div>
                <div className="badge">Reset password</div>
                <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                  Enter your email to receive a 6-digit code.
                  {resetExpiresInSeconds ? ` (expires in ~${Math.ceil(resetExpiresInSeconds / 60)} min)` : ''}
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-300" htmlFor="resetEmail">
                  Email
                </label>
                <input
                  id="resetEmail"
                  className="input mt-1"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  type="email"
                  required
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary w-full"
                disabled={resetLoading}
                onClick={async () => {
                  setResetError(null)
                  setResetNotice(null)
                  setResetExpiresInSeconds(null)
                  if (!resetEmail.trim()) return
                  setResetLoading(true)
                  try {
                    const res = await apiFetch<OtpRequestResponse>('/auth/otp/request', {
                      method: 'POST',
                      body: JSON.stringify({
                        purpose: 'RESET_PASSWORD' satisfies OtpPurpose,
                        email: resetEmail
                      })
                    })
                    setResetExpiresInSeconds(res.expiresInSeconds)
                    setResetNotice('We sent a reset code to your email.')
                  } catch (e: any) {
                    const err = e as ApiError
                    setResetError(err.error ?? 'Could not send code')
                  } finally {
                    setResetLoading(false)
                  }
                }}
              >
                {resetLoading ? 'Sending…' : 'Send code'}
              </button>

              <div>
                <label className="text-sm text-slate-300" htmlFor="resetCode">
                  Code
                </label>
                <input
                  id="resetCode"
                  className="input mt-1"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-slate-300" htmlFor="resetNewPassword">
                  New password
                </label>
                <input
                  id="resetNewPassword"
                  className="input mt-1"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-slate-300" htmlFor="resetConfirmPassword">
                  Confirm password
                </label>
                <input
                  id="resetConfirmPassword"
                  className="input mt-1"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>

              {resetNotice && <div className="card" style={{ padding: 12, borderColor: 'rgba(148,163,184,0.22)' }}>{resetNotice}</div>}
              {resetError && <div className="error-box">{resetError}</div>}

              <button className="btn btn-primary w-full" disabled={resetLoading}>
                {resetLoading ? 'Resetting…' : 'Reset password'}
              </button>

              <button
                type="button"
                className="btn btn-ghost w-full"
                disabled={resetLoading}
                onClick={() => {
                  setResetError(null)
                  setResetNotice(null)
                  setResetExpiresInSeconds(null)
                  setMode('login')
                }}
              >
                Back to login
              </button>
            </form>
          )}

          <div className="mt-6 text-xs text-slate-500">
            Tip: The API gateway should be up at <span className="font-mono">http://localhost:8090</span>.
          </div>
        </div>
      </div>
    </div>
  )
}
