import { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import { apiFetch } from '../api'

type Notification = {
  id: string
  userId: string
  type: string
  message: string
  refType?: string | null
  refId?: string | null
  read: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<Notification[]>([])

  async function refresh() {
    const data = await apiFetch<Notification[]>('/notifications')
    setRows(data)
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="app-shell">
      <NavBar />
      <div className="app-container py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="badge">Inbox</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-slate-400">Activity updates from assignments and comments.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="card px-4 py-3">
              <div className="text-xs text-slate-400">Unread</div>
              <div className="text-lg font-semibold">{rows.filter((r) => !r.read).length}</div>
            </div>
            <button className="btn btn-secondary" onClick={refresh}>
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 divide-y divide-slate-800/60 rounded-2xl border border-slate-800/60">
          {rows.length === 0 ? (
            <div className="p-4 muted">No notifications.</div>
          ) : (
            rows.map((n) => (
              <div key={n.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">{n.type}</div>
                    <div className="mt-1 text-sm text-slate-100">{n.message}</div>
                    <div className="mt-1 text-xs text-slate-500">{n.createdAt}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${n.read ? '' : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'}`}>{n.read ? 'Read' : 'Unread'}</span>
                    {n.read ? null : (
                      <button
                        className="btn btn-primary"
                        onClick={async () => {
                          await apiFetch<Notification>(`/notifications/${n.id}/read`, { method: 'PATCH' })
                          await refresh()
                        }}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
