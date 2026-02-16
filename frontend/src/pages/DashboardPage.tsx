import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { apiFetch } from '../api'
import { getUser } from '../auth'

type Org = { id: string; name: string }
type Project = { id: string; orgId: string; name: string; description?: string | null }
type Member = { orgId: string; userId: string; role: string }
type UserLookup = { id: string; name: string; email: string }
type Task = { id: string; projectId: string; title: string; status: 'TODO' | 'IN_PROGRESS' | 'DONE' }

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function shortId(value: string): string {
  const v = value.trim()
  if (v.length <= 12) return v
  return `${v.slice(0, 8)}…${v.slice(-4)}`
}

function twoDigit(n: number): string {
  return String(n).padStart(2, '0')
}

export default function DashboardPage() {
  const currentUser = useMemo(() => getUser(), [])
  const isRoot = !!currentUser?.rootAdmin
  const [orgs, setOrgs] = useState<Org[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [memberUsers, setMemberUsers] = useState<Record<string, UserLookup>>({})
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')

  const [error, setError] = useState<string | null>(null)

  const [newOrgName, setNewOrgName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')

  const [newMemberUserId, setNewMemberUserId] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER')

  const selectedOrg = useMemo(() => orgs.find((o) => o.id === selectedOrgId) ?? null, [orgs, selectedOrgId])

  const isCurrentUserAdmin = useMemo(() => {
    if (!currentUser?.id) return false
    const self = members.find((m) => m.userId === currentUser.id)
    return !!self && self.role.toUpperCase() === 'ADMIN'
  }, [currentUser?.id, members])

  const [teamStatusCounts, setTeamStatusCounts] = useState<{ todo: number; inProgress: number; done: number } | null>(null)
  const [myStatusCounts, setMyStatusCounts] = useState<{ todo: number; inProgress: number; done: number } | null>(null)

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const r = a.role.localeCompare(b.role)
      if (r !== 0) return r
      return a.userId.localeCompare(b.userId)
    })
  }, [members])

  const memberLabelByUserId = useMemo(() => {
    const map: Record<string, string> = {}
    sortedMembers.forEach((m, idx) => {
      const u = memberUsers[m.userId]
      const name = u?.name || u?.email || shortId(m.userId)
      map[m.userId] = `${twoDigit(idx + 1)} • ${name}`
    })
    return map
  }, [memberUsers, sortedMembers])

  async function hydrateUsersForMembers(list: Member[]) {
    const missing = list.map((m) => m.userId).filter((id) => !memberUsers[id])
    if (missing.length === 0) return

    const results = await Promise.allSettled(
      missing.map(async (id) => {
        const u = await apiFetch<UserLookup>(`/auth/users/${id}`)
        return u
      })
    )

    setMemberUsers((prev) => {
      const next = { ...prev }
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          next[r.value.id] = r.value
        }
      })
      return next
    })
  }

  async function refreshOrgs() {
    try {
      const data = await apiFetch<Org[]>('/orgs')
      setOrgs(data)
      if (!selectedOrgId && data.length > 0) {
        setSelectedOrgId(data[0].id)
      }
    } catch (e: any) {
      setError(e?.error ?? 'Failed to load teams')
      setOrgs([])
    }
  }

  async function refreshProjects(orgId: string) {
    try {
      const data = await apiFetch<Project[]>(`/orgs/${orgId}/projects`)
      setProjects(data)
    } catch (e: any) {
      setError(e?.error ?? 'Failed to load projects')
      setProjects([])
    }
  }

  async function refreshMembers(orgId: string) {
    try {
      const data = await apiFetch<Member[]>(`/orgs/${orgId}/members`)
      setMembers(data)
      await hydrateUsersForMembers(data)
    } catch (e: any) {
      setError(e?.error ?? 'Failed to load members')
      setMembers([])
    }
  }

  async function refreshAnalytics(orgId: string, orgProjects: Project[], admin: boolean) {
    setTeamStatusCounts(null)
    setMyStatusCounts(null)
    if (!orgId) return
    if (orgProjects.length === 0) return

    try {
      const projectIds = new Set(orgProjects.map((p) => p.id))

      if (admin) {
        const taskLists = await Promise.all(orgProjects.map((p) => apiFetch<Task[]>(`/projects/${p.id}/tasks`)))
        const all = taskLists.flat()
        const next = {
          todo: all.filter((t) => t.status === 'TODO').length,
          inProgress: all.filter((t) => t.status === 'IN_PROGRESS').length,
          done: all.filter((t) => t.status === 'DONE').length,
        }
        setTeamStatusCounts(next)
        return
      }

      if (!currentUser?.id) return
      const mine = await apiFetch<Task[]>(`/tasks?assignedToUserId=${encodeURIComponent(currentUser.id)}`)
      const inTeam = mine.filter((t) => projectIds.has(t.projectId))
      const next = {
        todo: inTeam.filter((t) => t.status === 'TODO').length,
        inProgress: inTeam.filter((t) => t.status === 'IN_PROGRESS').length,
        done: inTeam.filter((t) => t.status === 'DONE').length,
      }
      setMyStatusCounts(next)
    } catch (e: any) {
      setError(e?.error ?? 'Failed to load analytics')
    }
  }

  useEffect(() => {
    refreshOrgs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedOrgId) {
      refreshProjects(selectedOrgId)
      refreshMembers(selectedOrgId)
    } else {
      setProjects([])
      setMembers([])
    }
  }, [selectedOrgId])

  useEffect(() => {
    if (!selectedOrgId) return
    refreshAnalytics(selectedOrgId, projects, isCurrentUserAdmin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, isCurrentUserAdmin, projects.length])

  return (
    <div className="app-shell">
      <NavBar />
      <div className="app-container py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="badge">Workspace</div>
              {isRoot ? <div className="badge border-indigo-500/30 bg-indigo-500/10 text-indigo-200">Root Admin Mode</div> : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Student Progress</h1>
            <p className="mt-1 text-sm text-slate-400">Create teams, then add projects under them.</p>

            {isRoot ? (
              <div className="mt-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
                <div className="text-sm font-semibold text-indigo-200">Read-only overview</div>
                <div className="mt-1 text-sm text-slate-300">
                  Root admin can view all teams and projects, but can’t create, edit, or delete.
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="card px-4 py-3">
              <div className="text-xs text-slate-400">Teams</div>
              <div className="text-lg font-semibold">{orgs.length}</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-xs text-slate-400">Projects</div>
              <div className="text-lg font-semibold">{projects.length}</div>
            </div>
            {selectedOrgId ? (
              isCurrentUserAdmin ? (
                <div className="card px-4 py-3">
                  <div className="text-xs text-slate-400">Team tasks</div>
                  <div className="text-sm">
                    <span className="badge mr-2">To Do: {teamStatusCounts?.todo ?? '—'}</span>
                    <span className="badge mr-2">In Progress: {teamStatusCounts?.inProgress ?? '—'}</span>
                    <span className="badge">Done: {teamStatusCounts?.done ?? '—'}</span>
                  </div>
                </div>
              ) : (
                <div className="card px-4 py-3">
                  <div className="text-xs text-slate-400">My tasks (team)</div>
                  <div className="text-sm">
                    <span className="badge mr-2">To Do: {myStatusCounts?.todo ?? '—'}</span>
                    <span className="badge mr-2">In Progress: {myStatusCounts?.inProgress ?? '—'}</span>
                    <span className="badge">Done: {myStatusCounts?.done ?? '—'}</span>
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>

        {error ? <div className="mt-5 error-box">{error}</div> : null}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card card-pad">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Teams</h2>
            {selectedOrg ? <span className="badge">Selected: {selectedOrg.name}</span> : <span className="badge">No team</span>}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {isRoot ? (
              <div className="muted">Root admin is read-only.</div>
            ) : (
              <>
                <input
                  className="input flex-1"
                  placeholder="New team name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
                <button
                  className="btn btn-primary w-full sm:w-auto"
                  onClick={async () => {
                    setError(null)
                    if (!newOrgName.trim()) return
                    try {
                      await apiFetch<Org>('/orgs', {
                        method: 'POST',
                        body: JSON.stringify({ name: newOrgName })
                      })
                      setNewOrgName('')
                      await refreshOrgs()
                    } catch (e: any) {
                      setError(e?.error ?? 'Failed to create org')
                    }
                  }}
                >
                  Create
                </button>
              </>
            )}
          </div>

          <div className="mt-4">
            <label className="text-sm text-slate-300" htmlFor="selectedOrg">Select team</label>
            <select
              id="selectedOrg"
              className="select mt-1"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              <option value="">(none)</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {selectedOrg ? (
            <>
              <div className="mt-6 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Members</div>
                  <div className="mt-1 text-xs text-slate-400">Admin can add members by email (recommended).</div>
                </div>
                <span className="badge">{members.length} total</span>
              </div>

              {isCurrentUserAdmin ? (
                <div className="mt-3 grid gap-2">
                  <input
                    className="input"
                    placeholder="User email or UUID"
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value)}
                  />
                  <select
                    className="select"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value === 'ADMIN' ? 'ADMIN' : 'MEMBER')}
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      setError(null)
                      const raw = newMemberUserId.trim()
                      if (!raw) return
                      try {
                        let userIdToAdd = raw
                        if (!isUuid(raw)) {
                          if (!raw.includes('@')) {
                            setError('Enter a valid user UUID or an email address')
                            return
                          }
                          const u = await apiFetch<UserLookup>(`/auth/users/lookup?email=${encodeURIComponent(raw)}`)
                          userIdToAdd = u.id
                        }

                        await apiFetch<Member>(`/orgs/${selectedOrg.id}/members`, {
                          method: 'POST',
                          body: JSON.stringify({ userId: userIdToAdd, role: newMemberRole })
                        })
                        setNewMemberUserId('')
                        await refreshMembers(selectedOrg.id)
                      } catch (e: any) {
                        setError(e?.error ?? 'Failed to add member')
                      }
                    }}
                  >
                    Add member
                  </button>
                </div>
              ) : (
                <div className="mt-3 muted">Only admins can add or remove members.</div>
              )}

              <div className="mt-4 divide-y divide-slate-800/60 rounded-2xl border border-slate-800/60">
                {members.length === 0 ? (
                  <div className="p-4 muted">No members found.</div>
                ) : (
                  sortedMembers.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-100" title={m.userId}>
                          {memberLabelByUserId[m.userId] ?? shortId(m.userId)}
                        </div>
                        {memberUsers[m.userId]?.email ? (
                          <div className="mt-1 truncate text-xs text-slate-400" title={memberUsers[m.userId]?.email}>
                            {memberUsers[m.userId]?.email}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge">{m.role}</span>
                        {selectedOrg && isCurrentUserAdmin && currentUser?.id && m.userId !== currentUser.id ? (
                          <button
                            className="btn btn-ghost px-2 py-1 text-xs"
                            onClick={async () => {
                              setError(null)
                              const ok = window.confirm('Remove this member from the team?')
                              if (!ok) return
                              try {
                                await apiFetch<void>(`/orgs/${selectedOrg.id}/members/${m.userId}`, { method: 'DELETE' })
                                await refreshMembers(selectedOrg.id)
                              } catch (e: any) {
                                setError(e?.error ?? 'Failed to remove member')
                              }
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>

          <div className="card card-pad">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Projects</h2>
            <span className="badge">{selectedOrg ? 'Active team' : 'Pick a team'}</span>
          </div>
          {selectedOrg ? (
            <>
              {isCurrentUserAdmin ? (
                <div className="mt-4 space-y-2">
                  <input
                    className="input"
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Description (optional)"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                  />
                  <button
                    className="btn btn-primary w-full"
                    onClick={async () => {
                      setError(null)
                      if (!newProjectName.trim()) return
                      try {
                        await apiFetch<Project>(`/orgs/${selectedOrg.id}/projects`, {
                          method: 'POST',
                          body: JSON.stringify({ name: newProjectName, description: newProjectDesc || null })
                        })
                        setNewProjectName('')
                        setNewProjectDesc('')
                        await refreshProjects(selectedOrg.id)
                      } catch (e: any) {
                        setError(e?.error ?? 'Failed to create project')
                      }
                    }}
                  >
                    Create project
                  </button>
                </div>
              ) : (
                <div className="mt-3 muted">Only admins can create or delete projects.</div>
              )}

              <div className="mt-5 divide-y divide-slate-800/60 rounded-2xl border border-slate-800/60">
                {projects.length === 0 ? (
                  <div className="p-4 muted">No projects yet.</div>
                ) : (
                  projects.map((p) => (
                    <div key={p.id} className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          {p.description ? <div className="mt-1 text-sm text-slate-400">{p.description}</div> : null}
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                          <Link className="btn btn-secondary w-full sm:w-auto" to={`/projects/${p.id}`}>
                            Open
                          </Link>
                          <button
                            className="btn btn-secondary w-full sm:w-auto"
                            disabled={!isCurrentUserAdmin}
                            onClick={async () => {
                              setError(null)
                              if (!selectedOrg) return
                              const ok = window.confirm('Delete this project? This will also delete its tasks.')
                              if (!ok) return
                              try {
                                await apiFetch<void>(`/projects/${p.id}/tasks`, { method: 'DELETE' })
                                await apiFetch<void>(`/projects/${p.id}`, { method: 'DELETE' })
                                await refreshProjects(selectedOrg.id)
                              } catch (e: any) {
                                setError(e?.error ?? 'Failed to delete project')
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 muted">Create/select a team to add projects.</p>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
