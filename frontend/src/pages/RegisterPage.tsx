import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../api'
import { setSession } from '../auth'

type AuthResponse = {
  accessToken: string
  user: { id: string; name: string; email: string; rootAdmin?: boolean; emailVerified?: boolean }
}

type OtpPurpose = 'VERIFY_EMAIL' | 'LOGIN'

type OtpRequestResponse = { expiresInSeconds: number }
type OtpVerifyResponse = { verified: boolean; accessToken?: string | null; userId?: string | null }

export default function RegisterPage() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registerAsRoot, setRegisterAsRoot] = useState(false)
  const [rootAdminKey, setRootAdminKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [showOtpStep, setShowOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpExpiresInSeconds, setOtpExpiresInSeconds] = useState<number | null>(null)
  const [otpLoading, setOtpLoading] = useState(false)

  const canResendOtp = useMemo(() => !otpLoading && !loading, [otpLoading, loading])

  return (
    <div className="app-shell">
      <div className="app-container flex min-h-[calc(100vh-1px)] items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <div className="badge">Get started</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create account</h1>
            <p className="mt-2 text-sm text-slate-400">
              Already have an account?{' '}
              <Link className="text-indigo-300 hover:text-indigo-200" to="/login">
                Login
              </Link>
            </p>
          </div>

          {!showOtpStep ? (
            <form
              className="card card-pad space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setError(null)
                setOtpError(null)
                setLoading(true)
                try {
                  const res = await apiFetch<AuthResponse>('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                      name,
                      email,
                      password,
                      rootAdminKey: registerAsRoot ? rootAdminKey : undefined
                    })
                  })

                  setSession(res.accessToken, res.user)

                  try {
                    sessionStorage.setItem('postLoginSplashUntil', String(Date.now() + 800))
                  } catch {
                    // ignore
                  }

                  // Auto-send email verification OTP
                  const otpRes = await apiFetch<OtpRequestResponse>('/auth/otp/request', {
                    method: 'POST',
                    body: JSON.stringify({
                      purpose: 'VERIFY_EMAIL' satisfies OtpPurpose,
                      email
                    })
                  })

                  setOtpExpiresInSeconds(otpRes.expiresInSeconds)
                  setShowOtpStep(true)
                } catch (e: any) {
                  const err = e as ApiError
                  setError(err.error ?? 'Registration failed')
                } finally {
                  setLoading(false)
                }
              }}
            >
              <div>
                <label className="text-sm text-slate-300" htmlFor="name">
                  Name
                </label>
                <input id="name" className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm text-slate-300" htmlFor="email">
                  Email
                </label>
                <input id="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
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

              <div className="divider" />

              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={registerAsRoot} onChange={(e) => setRegisterAsRoot(e.target.checked)} />
                Register as root admin (read-only)
              </label>

              {registerAsRoot ? (
                <div>
                  <label className="text-sm text-slate-300" htmlFor="rootAdminKey">
                    Root admin key
                  </label>
                  <input
                    id="rootAdminKey"
                    className="input mt-1"
                    value={rootAdminKey}
                    onChange={(e) => setRootAdminKey(e.target.value)}
                    placeholder="Enter root admin key"
                    required
                  />
                </div>
              ) : null}

              {error && <div className="error-box">{error}</div>}

              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Creating…' : 'Create account'}
              </button>
            </form>
          ) : (
            <form
              className="card card-pad space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setOtpError(null)
                setOtpLoading(true)
                try {
                  const res = await apiFetch<OtpVerifyResponse>('/auth/otp/verify', {
                    method: 'POST',
                    body: JSON.stringify({
                      purpose: 'VERIFY_EMAIL' satisfies OtpPurpose,
                      email,
                      code: otpCode
                    })
                  })

                  if (!res.verified) {
                    setOtpError('Invalid or expired code')
                    return
                  }

                  // Update local user session with verified flag.
                  const rawUser = localStorage.getItem('user')
                  if (rawUser) {
                    try {
                      const u = JSON.parse(rawUser)
                      localStorage.setItem('user', JSON.stringify({ ...u, emailVerified: true }))
                    } catch {
                      // ignore
                    }
                  }

                  nav('/dashboard')
                } catch (e: any) {
                  const err = e as ApiError
                  setOtpError(err.error ?? 'Verification failed')
                } finally {
                  setOtpLoading(false)
                }
              }}
            >
              <div>
                <div className="badge">Verify email</div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">Enter the code we sent</h2>
                <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                  We sent a 6-digit code to <span className="text-slate-200">{email}</span>
                  {otpExpiresInSeconds ? ` (expires in ~${Math.ceil(otpExpiresInSeconds / 60)} min).` : '.'}
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-300" htmlFor="otpCode">
                  Verification code
                </label>
                <input
                  id="otpCode"
                  className="input mt-1"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  required
                />
              </div>

              {otpError && <div className="error-box">{otpError}</div>}

              <button className="btn btn-primary w-full" disabled={otpLoading}>
                {otpLoading ? 'Verifying…' : 'Verify email'}
              </button>

              <button
                type="button"
                className="btn btn-secondary w-full"
                disabled={!canResendOtp}
                onClick={async () => {
                  setOtpError(null)
                  setOtpLoading(true)
                  try {
                    const otpRes = await apiFetch<OtpRequestResponse>('/auth/otp/request', {
                      method: 'POST',
                      body: JSON.stringify({
                        purpose: 'VERIFY_EMAIL' satisfies OtpPurpose,
                        email
                      })
                    })
                    setOtpExpiresInSeconds(otpRes.expiresInSeconds)
                  } catch (e: any) {
                    const err = e as ApiError
                    setOtpError(err.error ?? 'Could not resend code')
                  } finally {
                    setOtpLoading(false)
                  }
                }}
              >
                Resend code
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
