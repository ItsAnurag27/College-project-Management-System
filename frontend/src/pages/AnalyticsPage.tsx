import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { apiFetch } from '../api'
import { getUser } from '../auth'

type Org = { id: string; name: string }
type Member = { orgId: string; userId: string; role: string }
type Project = { id: string; orgId: string; name: string; description?: string | null }
type Task = { id: string; projectId: string; title: string; status: 'TODO' | 'IN_PROGRESS' | 'DONE'; deadline?: string | null }

type ChartPoint = { label: string; value: number }

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

export default function AnalyticsPage() {
  const user = useMemo(() => getUser(), [])
  const isRoot = !!user?.rootAdmin

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [orgCount, setOrgCount] = useState(0)
  const [memberCount, setMemberCount] = useState(0)
  const [projectCount, setProjectCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)

  const [todoCount, setTodoCount] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)

  const [overdueCount, setOverdueCount] = useState(0)
  const [dueSoonCount, setDueSoonCount] = useState(0)

  const [projectsPerTeam, setProjectsPerTeam] = useState<ChartPoint[]>([])
  const [openTasksByProject, setOpenTasksByProject] = useState<ChartPoint[]>([])
  const [teamProgressRates, setTeamProgressRates] = useState<ChartPoint[]>([])

  useEffect(() => {
    if (!isRoot) return

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const orgs = await apiFetch<Org[]>('/orgs')
        if (cancelled) return

        setOrgCount(orgs.length)

        const membersByOrg = await Promise.all(orgs.map((o) => apiFetch<Member[]>(`/orgs/${o.id}/members`)))
        if (cancelled) return

        const projectsByOrg = await Promise.all(orgs.map((o) => apiFetch<Project[]>(`/orgs/${o.id}/projects`)))
        if (cancelled) return

        const membersUnique = new Set(membersByOrg.flat().map((m) => m.userId))
        setMemberCount(membersUnique.size)

        const projects = projectsByOrg.flat()
        setProjectCount(projects.length)

        const projectsPerTeamSeries: ChartPoint[] = orgs
          .map((o) => {
            const count = projects.filter((p) => p.orgId === o.id).length
            return { label: o.name, value: count }
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
        setProjectsPerTeam(projectsPerTeamSeries)

        const taskLists = await Promise.all(projects.map((p) => apiFetch<Task[]>(`/projects/${p.id}/tasks`)))
        if (cancelled) return

        const tasks = taskLists.flat()
        setTaskCount(tasks.length)

        const projectOrgById = new Map(projects.map((p) => [p.id, p.orgId] as const))
        const orgNameById = new Map(orgs.map((o) => [o.id, o.name] as const))

        const totalsByOrg = new Map<string, { total: number; done: number }>()
        for (const t of tasks) {
          const orgId = projectOrgById.get(t.projectId)
          if (!orgId) continue
          const cur = totalsByOrg.get(orgId) ?? { total: 0, done: 0 }
          cur.total += 1
          if (t.status === 'DONE') cur.done += 1
          totalsByOrg.set(orgId, cur)
        }

        const teamProgressSeries: ChartPoint[] = Array.from(totalsByOrg.entries())
          .map(([orgId, v]) => {
            const pct = v.total ? Math.round((v.done / v.total) * 100) : 0
            return { label: orgNameById.get(orgId) ?? orgId, value: pct }
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
        setTeamProgressRates(teamProgressSeries)

        const openTasksByProjectSeries: ChartPoint[] = projects
          .map((p) => {
            const open = tasks.filter((t) => t.projectId === p.id && t.status !== 'DONE').length
            return { label: p.name, value: open }
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
        setOpenTasksByProject(openTasksByProjectSeries)

        const todo = tasks.filter((t) => t.status === 'TODO').length
        const inProg = tasks.filter((t) => t.status === 'IN_PROGRESS').length
        const done = tasks.filter((t) => t.status === 'DONE').length
        setTodoCount(todo)
        setInProgressCount(inProg)
        setDoneCount(done)

        const today = new Date()
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const in7 = new Date(startOfToday)
        in7.setDate(in7.getDate() + 7)

        const overdue = tasks.filter((t) => {
          if (t.status === 'DONE') return false
          const d = parseDate(t.deadline)
          return !!d && d < startOfToday
        }).length

        const soon = tasks.filter((t) => {
          if (t.status === 'DONE') return false
          const d = parseDate(t.deadline)
          return !!d && d >= startOfToday && d <= in7
        }).length

        setOverdueCount(overdue)
        setDueSoonCount(soon)
      } catch (e: any) {
        setError(e?.error ?? 'Failed to load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isRoot])

  if (!isRoot) {
    return <Navigate to="/dashboard" replace />
  }

  const totalForBar = Math.max(1, todoCount + inProgressCount + doneCount)
  const todoPct = Math.round((todoCount / totalForBar) * 100)
  const inProgPct = Math.round((inProgressCount / totalForBar) * 100)
  const donePct = Math.round((doneCount / totalForBar) * 100)
  const completionRate = Math.round((doneCount / totalForBar) * 100)

  const maxProjectsPerTeam = Math.max(1, ...projectsPerTeam.map((p) => p.value))
  const maxOpenTasksByProject = Math.max(1, ...openTasksByProject.map((p) => p.value))

  return (
    <div className="app-shell">
      <NavBar />
      <div className="app-container py-8">
        <div>
          <div className="flex items-center gap-2">
            <div className="badge border-indigo-500/30 bg-indigo-500/10 text-indigo-200">Root Admin</div>
            <div className="badge">Read-only</div>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Smart Productivity Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">Read-only overview across teams, members, projects, and tasks.</p>

          <div className="mt-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
            <div className="text-sm font-semibold text-indigo-200">Root admin insights</div>
            <div className="mt-1 text-sm text-slate-300">
              Visual summaries are computed live from read endpoints (no data is modified).
            </div>
          </div>
        </div>

        {error ? <div className="mt-5 error-box">{error}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="card px-4 py-4">
            <div className="text-xs text-slate-400">Teams</div>
            <div className="mt-1 text-2xl font-semibold">{loading ? '—' : orgCount}</div>
          </div>
          <div className="card px-4 py-4">
            <div className="text-xs text-slate-400">Members</div>
            <div className="mt-1 text-2xl font-semibold">{loading ? '—' : memberCount}</div>
          </div>
          <div className="card px-4 py-4">
            <div className="text-xs text-slate-400">Projects</div>
            <div className="mt-1 text-2xl font-semibold">{loading ? '—' : projectCount}</div>
          </div>
          <div className="card px-4 py-4">
            <div className="text-xs text-slate-400">Tasks</div>
            <div className="mt-1 text-2xl font-semibold">{loading ? '—' : taskCount}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card card-pad">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Status distribution</h2>
              <span className="badge">Completion: {loading ? '—' : completionRate + '%'}</span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="muted">To Do</span>
                  <span className="badge">{loading ? '—' : todoCount}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full" style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${loading ? 0 : todoPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="muted">In Progress</span>
                  <span className="badge">{loading ? '—' : inProgressCount}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full" style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <div className="h-2 rounded-full bg-indigo-500/70" style={{ width: `${loading ? 0 : inProgPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="muted">Done</span>
                  <span className="badge">{loading ? '—' : doneCount}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full" style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <div className="h-2 rounded-full bg-indigo-300" style={{ width: `${loading ? 0 : donePct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <h2 className="card-title">Deadlines</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="card px-4 py-4">
                <div className="text-xs text-slate-400">Overdue (not done)</div>
                <div className="mt-1 text-2xl font-semibold">{loading ? '—' : overdueCount}</div>
              </div>
              <div className="card px-4 py-4">
                <div className="text-xs text-slate-400">Due in 7 days</div>
                <div className="mt-1 text-2xl font-semibold">{loading ? '—' : dueSoonCount}</div>
              </div>
            </div>

            <div className="mt-4 muted">Tip: Root admin is read-only and can’t create/edit/delete.</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card card-pad">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Projects per team</h2>
              <span className="badge">Top 8</span>
            </div>

            {loading ? (
              <div className="mt-4 muted">Loading…</div>
            ) : projectsPerTeam.length === 0 ? (
              <div className="mt-4 muted">No teams found.</div>
            ) : (
              <div className="mt-5 flex h-40 items-end gap-2">
                {projectsPerTeam.map((p) => {
                  const pct = Math.round((p.value / maxProjectsPerTeam) * 100)
                  return (
                    <div key={p.label} className="flex w-full flex-col items-center gap-2">
                      <div className="w-full rounded-md" style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <div className="rounded-md bg-indigo-500" style={{ height: `${Math.max(6, pct)}%` }} />
                      </div>
                      <div className="w-full text-center">
                        <div className="truncate text-xs text-slate-400" title={p.label}>
                          {p.label}
                        </div>
                        <div className="text-xs font-semibold">{p.value}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Open tasks by project</h2>
              <span className="badge">Top 8</span>
            </div>

            {loading ? (
              <div className="mt-4 muted">Loading…</div>
            ) : openTasksByProject.length === 0 ? (
              <div className="mt-4 muted">No projects found.</div>
            ) : (
              <div className="mt-5 space-y-3">
                {openTasksByProject.map((p) => {
                  const pct = Math.round((p.value / maxOpenTasksByProject) * 100)
                  return (
                    <div key={p.label}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm" title={p.label}>
                          {p.label}
                        </div>
                        <span className="badge">{p.value}</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full" style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${loading ? 0 : pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card card-pad md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Team progress rate</h2>
              <span className="badge">Done / Total</span>
            </div>

            {loading ? (
              <div className="mt-4 muted">Loading…</div>
            ) : teamProgressRates.length === 0 ? (
              <div className="mt-4 muted">No team task data yet.</div>
            ) : (
              <div className="mt-5 space-y-3">
                {teamProgressRates.map((t) => (
                  <div key={t.label}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm" title={t.label}>
                        {t.label}
                      </div>
                      <span className="badge">{t.value}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full" style={{ backgroundColor: 'var(--surface-hover)' }}>
                      <div className="h-2 rounded-full bg-indigo-300" style={{ width: `${t.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
