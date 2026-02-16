import { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import { apiFetch } from '../api'
import { fileToResizedDataUrl, getProfilePhoto, initialsFromName, notifyProfilePhotoUpdated, removeProfilePhoto, setProfilePhoto } from '../profilePhoto'

type User = { id: string; name: string; email: string; rootAdmin?: boolean }

export default function ProfilePage() {
  const [me, setMe] = useState<User | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<User>('/auth/me').then(setMe).catch(() => setMe(null))
  }, [])

  useEffect(() => {
    if (!me) return
    setPhoto(getProfilePhoto(me.id))
  }, [me])

  return (
    <div className="app-shell">
      <NavBar />
      <div className="app-container py-8">
        <div>
          <div className="badge">Account</div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-slate-400">Your identity as seen by the services.</p>
        </div>

        <div className="mt-6 card card-pad">
          {me ? (
            <>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  {photo ? (
                    <img
                      src={photo}
                      alt="Profile"
                      className="h-24 w-24 rounded-full object-cover"
                      style={{ border: '1px solid var(--border)' }}
                    />
                  ) : (
                    <div
                      className="flex h-24 w-24 items-center justify-center rounded-full text-xl font-semibold"
                      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--badge-bg)', color: 'var(--text)' }}
                    >
                      {initialsFromName(me.name, me.email)}
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-slate-500">Profile photo</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="btn btn-secondary cursor-pointer">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0]
                            e.currentTarget.value = ''
                            if (!f) return
                            setPhotoError(null)
                            try {
                              const dataUrl = await fileToResizedDataUrl(f, 256)
                              setProfilePhoto(me.id, dataUrl)
                              setPhoto(dataUrl)
                              notifyProfilePhotoUpdated()
                            } catch {
                              setPhotoError('Could not load that image.')
                            }
                          }}
                        />
                      </label>

                      {photo && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            try {
                              removeProfilePhoto(me.id)
                            } finally {
                              setPhoto(null)
                              notifyProfilePhotoUpdated()
                            }
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {photoError && <div className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{photoError}</div>}
                    <div className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                      Saved on this device for your account.
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-10">
                  <div>
                    <div className="text-xs text-slate-500">Name</div>
                    <div className="mt-1 font-medium">{me.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Email</div>
                    <div className="mt-1 font-medium">{me.email}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs text-slate-500">User ID</div>
                <div className="mt-1 break-all rounded-xl border border-slate-800/60 bg-slate-950/30 p-3 font-mono text-xs text-slate-200">{me.id}</div>
              </div>
            </>
          ) : (
            <div className="muted">Loading…</div>
          )}
        </div>
      </div>
    </div>
  )
}
