import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProjectPage from './pages/ProjectPage'
import KanbanPage from './pages/KanbanPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import AnalyticsPage from './pages/AnalyticsPage'

export default function App() {
  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reduceMotion?.matches) return

    const root = document.documentElement
    let rafId = 0
    let latestX = 0.5
    let latestY = 0.4

    const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

    const apply = () => {
      rafId = 0
      const x = clamp01(latestX)
      const y = clamp01(latestY)
      const dx = x - 0.5
      const dy = y - 0.5

      root.style.setProperty('--cursor-x', `${(x * 100).toFixed(2)}%`)
      root.style.setProperty('--cursor-y', `${(y * 100).toFixed(2)}%`)

      // Subtle parallax contribution to the existing aurora animation.
      root.style.setProperty('--mx-shift', `${(dx * 1.2).toFixed(3)}%`)
      root.style.setProperty('--my-shift', `${(dy * 1.2).toFixed(3)}%`)

      // Dynamic anchor shifts for left/right aurora blobs.
      root.style.setProperty('--bg-left-x', `${(20 + dx * 10).toFixed(2)}%`)
      root.style.setProperty('--bg-left-y', `${(15 + dy * 8).toFixed(2)}%`)
      root.style.setProperty('--bg-right-x', `${(85 - dx * 10).toFixed(2)}%`)
      root.style.setProperty('--bg-right-y', `${(30 + dy * 6).toFixed(2)}%`)
      root.style.setProperty('--bg-mid-x', `${(55 + dx * 6).toFixed(2)}%`)
      root.style.setProperty('--bg-mid-y', `${(95 + dy * 4).toFixed(2)}%`)

      // Gentle grid drift (depth cue).
      root.style.setProperty('--grid-x', `${(-dx * 18).toFixed(2)}px`)
      root.style.setProperty('--grid-y', `${(-dy * 18).toFixed(2)}px`)
    }

    const scheduleApply = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(apply)
    }

    const onPointerMove = (event: PointerEvent) => {
      const width = window.innerWidth || 1
      const height = window.innerHeight || 1
      latestX = event.clientX / width
      latestY = event.clientY / height
      scheduleApply()
    }

    const onPointerLeave = () => {
      latestX = 0.5
      latestY = 0.4
      scheduleApply()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)

    // Initialize once so values are set even before first move.
    scheduleApply()

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <ProjectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/board"
        element={
          <ProtectedRoute>
            <KanbanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
