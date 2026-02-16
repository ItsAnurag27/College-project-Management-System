import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clearSession, getUser } from '../auth'
import { ThemeMode, toggleTheme } from '../theme'
import { getProfilePhoto } from '../profilePhoto'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.64 5.64 4.22 4.22M19.78 19.78l-1.42-1.42M18.36 5.64l1.42-1.42M4.22 19.78l1.42-1.42"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function NavBar() {
  const nav = useNavigate()
  const user = getUser()
  const [showPostLoginSplash, setShowPostLoginSplash] = useState(false)
  const [photo, setPhoto] = useState<string | null>(() => (user?.id ? getProfilePhoto(user.id) : null))
  const [mode, setMode] = useState<ThemeMode>(() => {
    const raw = document.documentElement.dataset.theme
    return raw === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    if (!user?.id) return
    const onUpdate = () => setPhoto(getProfilePhoto(user.id))
    window.addEventListener('profilePhotoUpdated', onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      window.removeEventListener('profilePhotoUpdated', onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [user?.id])

  useEffect(() => {
    try {
      const rawUntil = sessionStorage.getItem('postLoginSplashUntil')
      if (!rawUntil) return
      const until = Number(rawUntil)
      if (!Number.isFinite(until)) {
        sessionStorage.removeItem('postLoginSplashUntil')
        return
      }

      const remaining = Math.max(0, until - Date.now())
      if (remaining <= 0) {
        sessionStorage.removeItem('postLoginSplashUntil')
        return
      }

      setShowPostLoginSplash(true)
      const t = window.setTimeout(() => {
        setShowPostLoginSplash(false)
        try {
          sessionStorage.removeItem('postLoginSplashUntil')
        } catch {
          // ignore
        }
      }, remaining)

      // Failsafe: never allow it to get stuck.
      const t2 = window.setTimeout(() => setShowPostLoginSplash(false), Math.max(remaining + 250, 1200))

      return () => {
        window.clearTimeout(t)
        window.clearTimeout(t2)
      }
    } catch {
      return
    }
  }, [])

  return (
    <>
      {showPostLoginSplash && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
        >
          <div className="flex flex-col items-center gap-3">
            <img src="/logo.png" alt="Unitify" className="unitify-splash-logo h-[150px] w-[150px] object-contain" />
            <div className="text-[44px] font-semibold tracking-tight opacity-90">Unitify</div>
          </div>
        </div>
      )}

      <div className="topbar backdrop-blur">
        <div className="app-container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-3 font-semibold tracking-tight">
              <img src="/logo.png" alt="Unitify" className="h-[70px] w-[120px]" />
              <span className="text-[26px] leading-none">Unitify</span>
            </Link>
            <span className="badge">MVP</span>
            {user?.rootAdmin ? (
              <span className="badge border-indigo-500/30 bg-indigo-500/10 text-indigo-200">Root Admin</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <button
              className="btn btn-secondary px-2"
              onClick={() => {
                const next = toggleTheme()
                setMode(next)
              }}
              aria-label="Toggle dark/light mode"
              title="Toggle dark/light mode"
            >
              {mode === 'dark' ? <MoonIcon /> : <SunIcon />}
            </button>
            <Link to="/notifications" className="btn btn-ghost px-2 py-2 sm:px-3">
              Notifications
            </Link>
            {user?.rootAdmin ? (
              <Link to="/analytics" className="btn btn-ghost px-2 py-2 sm:px-3">
                Analytics
              </Link>
            ) : null}
            <Link to="/profile" className="btn btn-ghost px-2 py-2 sm:px-3">
              Profile
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              {photo ? (
                <img
                  src={photo}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover"
                  style={{ border: '1px solid var(--border)' }}
                />
              ) : null}
              <span className="badge">{user?.email ?? ''}</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                clearSession()
                nav('/login')
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
