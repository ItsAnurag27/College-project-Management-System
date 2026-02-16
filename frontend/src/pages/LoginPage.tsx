import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../api'
import { setSession } from '../auth'

type AuthResponse = {
  accessToken: string
  user: { id: string; name: string; email: string; rootAdmin?: boolean }
}

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="app-shell">
      <div className="app-container flex min-h-[calc(100vh-1px)] items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <div className="badge">Welcome back</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Login</h1>
            <p className="mt-2 text-sm text-slate-400">
              Don&apos;t have an account?{' '}
              <Link className="text-indigo-300 hover:text-indigo-200" to="/register">
                Register
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
          <label className="text-sm text-slate-300" htmlFor="email">Email</label>
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
          <label className="text-sm text-slate-300" htmlFor="password">Password</label>
          <input
            id="password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>

        {error && <div className="error-box">{error}</div>}

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>

          <div className="mt-6 text-xs text-slate-500">
            Tip: The API gateway should be up at <span className="font-mono">http://localhost:8090</span>.
          </div>
        </div>
      </div>
    </div>
  )
}
