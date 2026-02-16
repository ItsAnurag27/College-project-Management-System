import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { apiFetch } from '../api'

type Project = { id: string; orgId: string; name: string; description?: string | null }

type OrgMember = { orgId: string; userId: string; role: string }
type UserView = { id: string; name: string; email: string }

type Task = {
  id: string
  projectId: string
  title: string
  description?: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  deadline?: string | null
  assignedToUserId?: string | null
}

type Comment = { id: string; taskId: string; authorUserId: string; body: string; createdAt: string }

type AutoSummary = {
  title: string
  overdue: boolean
  dueSoon: boolean
  badgeLabel: string
  badgeClass: string
  nextStep: string
  bullets: string[]
}

function truncateText(value: string, maxLen: number): string {
  const v = value.trim().replaceAll(/\s+/g, ' ')
  if (v.length <= maxLen) return v
  return v.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…'
}

function isLikelyIsoDate(value?: string | null): boolean {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function parseIsoDate(value?: string | null): Date | null {
  if (!isLikelyIsoDate(value)) return null
  const d = new Date(value + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function buildAutoSummary(args: {
  task: {
    title: string
    description?: string | null
    status: 'TODO' | 'IN_PROGRESS' | 'DONE'
    deadline?: string | null
    assignedToUserId?: string | null
  }
  comments: Comment[]
  statusLabel: (s: 'TODO' | 'IN_PROGRESS' | 'DONE') => string
  assigneeLabel: string
}): AutoSummary {
  const { task, comments, statusLabel, assigneeLabel } = args

  const deadlineDate = parseIsoDate(task.deadline)
  const today = startOfToday()
  const in7 = new Date(today)
  in7.setDate(in7.getDate() + 7)

  const overdue = task.status !== 'DONE' && !!deadlineDate && deadlineDate < today
  const dueSoon = task.status !== 'DONE' && !!deadlineDate && deadlineDate >= today && deadlineDate <= in7

  const latestComment = [...comments]
    .filter((c) => !!c.createdAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]

  let deadlineLine = 'Deadline: None'
  if (task.deadline) {
    let tag: string | null = null
    if (overdue) tag = 'Overdue'
    else if (dueSoon) tag = 'Due soon'
    const suffix = tag ? ` (${tag})` : ''
    deadlineLine = `Deadline: ${task.deadline}${suffix}`
  }

  const descriptionLine = task.description?.trim() ? `Key detail: ${truncateText(task.description, 140)}` : null

  const latestSnippet = latestComment?.body ? truncateText(latestComment.body, 110) : null
  let commentsLine = 'Comments: 0'
  if (comments.length > 0) {
    const latestPart = latestSnippet ? ` • Latest: “${latestSnippet}”` : ''
    commentsLine = `Comments: ${comments.length}${latestPart}`
  }

  const bullets = [
    `Status: ${statusLabel(task.status)}`,
    deadlineLine,
    `Assignee: ${assigneeLabel}`,
    descriptionLine,
    commentsLine
  ].filter((x): x is string => !!x)

  let nextStep = ''
  if (assigneeLabel === 'Unassigned') nextStep = 'Assign an owner.'
  else if (overdue) nextStep = 'Update the deadline or mark done.'
  else if (task.status === 'TODO') nextStep = 'Move to In Progress when started.'
  else if (task.status === 'IN_PROGRESS') nextStep = 'Add an update comment when a milestone is reached.'
  else nextStep = 'Optionally add a final note for documentation.'

  let badgeLabel = 'Live'
  let badgeClass = ''
  if (overdue) {
    badgeLabel = 'Overdue'
    badgeClass = 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  } else if (dueSoon) {
    badgeLabel = 'Due soon'
    badgeClass = 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  }

  return {
    title: 'Auto-generated summary',
    overdue,
    dueSoon,
    badgeLabel,
    badgeClass,
    nextStep,
    bullets
  }
}

export default function ProjectPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [memberUsers, setMemberUsers] = useState<Record<string, UserView>>({})

  const [mobilePane, setMobilePane] = useState<'list' | 'details'>('list')

  const [error, setError] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newAssignee, setNewAssignee] = useState('')

  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) ?? null, [tasks, selectedTaskId])

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')

  async function refreshAll(pid: string) {
    const p = await apiFetch<Project>(`/projects/${pid}`)
    setProject(p)
    const t = await apiFetch<Task[]>(`/projects/${pid}/tasks`)
    setTasks(t)
    const m = await apiFetch<OrgMember[]>(`/orgs/${p.orgId}/members`)
    setMembers(m)
    await hydrateUsersForMembers(m)
    if (!selectedTaskId && t.length > 0) {
      setSelectedTaskId(t[0].id)
    }
  }

  async function hydrateUsersForMembers(list: OrgMember[]) {
    const missing = list.map((m) => m.userId).filter((id) => !memberUsers[id])
    if (missing.length === 0) return

    const results = await Promise.allSettled(
      missing.map(async (id) => {
        const u = await apiFetch<UserView>(`/auth/users/${id}`)
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

  async function refreshComments(taskId: string) {
    const c = await apiFetch<Comment[]>(`/tasks/${taskId}/comments`)
    setComments(c)
  }

  useEffect(() => {
    if (!projectId) return
    refreshAll(projectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (selectedTaskId) {
      refreshComments(selectedTaskId)
    } else {
      setComments([])
    }
  }, [selectedTaskId])

  useEffect(() => {
    if (!selectedTask) {
      setMobilePane('list')
    }
  }, [selectedTask])

  const statusLabel = (status: Task['status']) => {
    switch (status) {
      case 'TODO':
        return 'To Do'
      case 'IN_PROGRESS':
        return 'In Progress'
      case 'DONE':
        return 'Done'
      default:
        return status
    }
  }

  const shortId = (value: string) => {
    const v = value.trim()
    if (v.length <= 12) return v
    return `${v.slice(0, 8)}…${v.slice(-4)}`
  }

  const twoDigit = (n: number) => String(n).padStart(2, '0')

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

  const statusBadgeClass = (status: Task['status']) => {
    switch (status) {
      case 'TODO':
        return 'border-slate-700/60 bg-slate-950/30 text-slate-200'
      case 'IN_PROGRESS':
        return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
      case 'DONE':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      default:
        return 'border-slate-700/60 bg-slate-950/30 text-slate-200'
    }
  }

  const autoSummary = useMemo(() => {
    if (!selectedTask) return null

    const assigneeLabel = selectedTask.assignedToUserId
      ? memberLabelByUserId[selectedTask.assignedToUserId] ?? shortId(selectedTask.assignedToUserId)
      : 'Unassigned'

    return buildAutoSummary({ task: selectedTask, comments, statusLabel, assigneeLabel })
  }, [comments, memberLabelByUserId, selectedTask])

  if (!projectId) return null

  return (
    <div className="app-shell">
      <NavBar />
      <div className="app-container py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link className="btn btn-ghost -ml-2" to="/dashboard">
                ← Student Progress
              </Link>
              <span className="badge">Project</span>
              <Link className="btn btn-ghost" to={`/projects/${projectId}/board`}>
                Board
              </Link>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{project?.name ?? 'Loading…'}</h1>
            {project?.description ? <p className="mt-1 text-sm text-slate-400">{project.description}</p> : <p className="mt-1 text-sm text-slate-500">No description</p>}
          </div>
          <div className="hidden sm:flex sm:gap-3">
            <div className="card px-4 py-3">
              <div className="text-xs text-slate-400">Tasks</div>
              <div className="text-lg font-semibold">{tasks.length}</div>
            </div>
          </div>
        </div>

        {error ? <div className="mt-5 error-box">{error}</div> : null}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className={`card card-pad ${mobilePane === 'details' ? 'hidden md:block' : ''}`}>
            <div className="flex items-center justify-between">
              <h2 className="card-title">Tasks</h2>
              <span className="badge">Select one to edit</span>
            </div>

            <div className="mt-4 space-y-2">
              <input className="input" placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <input className="input" placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  className="input"
                  placeholder="Deadline (YYYY-MM-DD)"
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                />
                <select className="select" value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {sortedMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {memberLabelByUserId[m.userId] ?? shortId(m.userId)} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary w-full"
                onClick={async () => {
                  setError(null)
                  if (!newTitle.trim()) return
                  try {
                    await apiFetch<Task>(`/projects/${projectId}/tasks`, {
                      method: 'POST',
                      body: JSON.stringify({
                        title: newTitle,
                        description: newDesc || null,
                        status: 'TODO',
                        deadline: newDeadline || null,
                        assignedToUserId: newAssignee || null
                      })
                    })
                    setNewTitle('')
                    setNewDesc('')
                    setNewDeadline('')
                    setNewAssignee('')
                    await refreshAll(projectId)
                  } catch (e: any) {
                    setError(e?.error ?? 'Failed to create task')
                  }
                }}
              >
                Create task
              </button>
            </div>

            <div className="mt-5 divide-y divide-slate-800/60 rounded-2xl border border-slate-800/60">
              {tasks.length === 0 ? (
                <div className="p-4 muted">No tasks yet.</div>
              ) : (
                tasks.map((t) => (
                  <button
                    key={t.id}
                    className={`w-full p-4 text-left transition ${
                      t.id === selectedTaskId ? 'bg-indigo-500/10' : 'hover:bg-slate-900/30'
                    }`}
                    onClick={() => {
                      setSelectedTaskId(t.id)
                      setMobilePane('details')
                      setTimeout(() => {
                        document.getElementById('task-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 0)
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate font-medium text-slate-100">{t.title}</div>
                      <span className={`badge shrink-0 ${statusBadgeClass(t.status)}`}>{statusLabel(t.status)}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {t.deadline ? `Deadline: ${t.deadline}` : 'No deadline'}
                      {t.assignedToUserId ? (
                        <span title={t.assignedToUserId}>{` • Assigned: ${memberLabelByUserId[t.assignedToUserId] ?? shortId(t.assignedToUserId)}`}</span>
                      ) : (
                        ''
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div id="task-details" className={`card card-pad ${mobilePane === 'list' ? 'hidden md:block' : ''}`}>
            <div className="flex items-center justify-between">
              <h2 className="card-title">Task Details</h2>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost md:hidden" onClick={() => setMobilePane('list')}>
                  ← Back
                </button>
                {selectedTask ? <span className="badge">Editing</span> : <span className="badge">None selected</span>}
              </div>
            </div>
            {selectedTask ? (
              <>
                <div className="mt-4 flex items-center justify-end">
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      setError(null)
                      const ok = globalThis.confirm('Delete this task?')
                      if (!ok) return
                      try {
                        await apiFetch<void>(`/tasks/${selectedTask.id}`, { method: 'DELETE' })
                        setSelectedTaskId('')
                        await refreshAll(projectId)
                      } catch (e: any) {
                        setError(e?.error ?? 'Failed to delete task')
                      }
                    }}
                  >
                    Delete task
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{selectedTask.title}</div>
                      {selectedTask.description ? <div className="mt-1 text-sm text-slate-400">{selectedTask.description}</div> : null}
                    </div>
                    <span className={`badge shrink-0 ${statusBadgeClass(selectedTask.status)}`}>{statusLabel(selectedTask.status)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select
                      className="select"
                      value={selectedTask.status}
                      onChange={async (e) => {
                        setError(null)
                        try {
                          await apiFetch<Task>(`/tasks/${selectedTask.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: e.target.value })
                          })
                          await refreshAll(projectId)
                        } catch (e: any) {
                          setError(e?.error ?? 'Failed to update status')
                        }
                      }}
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                    <input
                      className="input"
                      placeholder="Deadline"
                      type="date"
                      value={selectedTask.deadline ?? ''}
                      onChange={async (e) => {
                        setError(null)
                        try {
                          await apiFetch<Task>(`/tasks/${selectedTask.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ deadline: e.target.value })
                          })
                          await refreshAll(projectId)
                        } catch (e: any) {
                          setError(e?.error ?? 'Failed to update deadline')
                        }
                      }}
                    />
                    <select
                      className="select"
                      value={selectedTask.assignedToUserId ?? ''}
                      onChange={async (e) => {
                        setError(null)
                        try {
                          await apiFetch<Task>(`/tasks/${selectedTask.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ assignedToUserId: e.target.value })
                          })
                          await refreshAll(projectId)
                        } catch (e: any) {
                          setError(e?.error ?? 'Failed to update assignee')
                        }
                      }}
                    >
                      <option value="">Unassigned</option>
                      {sortedMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {memberLabelByUserId[m.userId] ?? shortId(m.userId)} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {autoSummary ? (
                  <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="card-title">{autoSummary.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className={autoSummary.badgeClass ? `badge ${autoSummary.badgeClass}` : 'badge'}>
                          {autoSummary.badgeLabel}
                        </span>
                      </div>
                    </div>

                    <ul className="mt-3 space-y-2 text-sm">
                      {autoSummary.bullets.map((b) => (
                        <li key={b} className="text-slate-200/90">
                          <span className="text-slate-500">•</span> {b}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 text-sm">
                      <span className="text-slate-400">Suggested next step:</span>{' '}
                      <span className="text-slate-200/90">{autoSummary.nextStep}</span>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="card-title">Comments</h3>
                    <span className="badge">{comments.length}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <textarea
                      className="textarea"
                      rows={3}
                      placeholder="Write a comment"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        setError(null)
                        if (!newComment.trim()) return
                        try {
                          await apiFetch<Comment>(`/tasks/${selectedTask.id}/comments`, {
                            method: 'POST',
                            body: JSON.stringify({ body: newComment })
                          })
                          setNewComment('')
                          await refreshComments(selectedTask.id)
                        } catch (e: any) {
                          setError(e?.error ?? 'Failed to add comment')
                        }
                      }}
                    >
                      Add comment
                    </button>
                  </div>

                  <div className="mt-4 divide-y divide-slate-800/60 rounded-2xl border border-slate-800/60">
                    {comments.length === 0 ? (
                      <div className="p-4 muted">No comments yet.</div>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-xs text-slate-500" title={c.authorUserId}>{shortId(c.authorUserId)}</div>
                            <button
                              className="btn btn-ghost px-2 py-1 text-xs"
                              onClick={async () => {
                                setError(null)
                                const ok = globalThis.confirm('Delete this comment?')
                                if (!ok) return
                                try {
                                  await apiFetch<void>(`/tasks/${selectedTask.id}/comments/${c.id}`, { method: 'DELETE' })
                                  await refreshComments(selectedTask.id)
                                } catch (e: any) {
                                  setError(e?.error ?? 'Failed to delete comment')
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                          <div className="mt-1 text-sm">{c.body}</div>
                          <div className="mt-1 text-xs text-slate-500">{c.createdAt}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 muted">Select a task.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
