import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../api'
import { setSession } from '../auth'

type AuthResponse = {
  accessToken: string
  user: { id: string; name: string; email: string; rootAdmin?: boolean }
}

export default function RegisterPage() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registerAsRoot, setRegisterAsRoot] = useState(false)
  const [rootAdminKey, setRootAdminKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

          <form
        className="card card-pad space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
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
            nav('/dashboard')
          } catch (e: any) {
            const err = e as ApiError
            setError(err.error ?? 'Registration failed')
          } finally {
            setLoading(false)
          }
        }}
      >
        <div>
          <label className="text-sm text-slate-300" htmlFor="name">Name</label>
          <input id="name" className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm text-slate-300" htmlFor="email">Email</label>
          <input id="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label className="text-sm text-slate-300" htmlFor="password">Password</label>
          <input id="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>

        <div className="divider" />

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <input
            type="checkbox"
            checked={registerAsRoot}
            onChange={(e) => setRegisterAsRoot(e.target.checked)}
          />
          Register as root admin (read-only)
        </label>

        {registerAsRoot ? (
          <div>
            <label className="text-sm text-slate-300" htmlFor="rootAdminKey">Root admin key</label>
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
        </div>
      </div>
    </div>
  )
}
