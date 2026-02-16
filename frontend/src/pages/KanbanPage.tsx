import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { apiFetch } from '../api'

type Project = { id: string; orgId: string; name: string; description?: string | null }
type Task = { id: string; projectId: string; title: string; description?: string | null; status: 'TODO' | 'IN_PROGRESS' | 'DONE'; deadline?: string | null; assignedToUserId?: string | null }

type ColumnStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

function statusLabel(s: ColumnStatus): string {
  switch (s) {
    case 'TODO':
      return 'To Do'
    case 'IN_PROGRESS':
      return 'In Progress'
    case 'DONE':
      return 'Done'
  }
}

export default function KanbanPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)

  const columns = useMemo(() => {
    const list: { status: ColumnStatus; title: string }[] = [
      { status: 'TODO', title: 'To Do' },
      { status: 'IN_PROGRESS', title: 'In Progress' },
      { status: 'DONE', title: 'Done' }
    ]
    return list
  }, [])

  const tasksByStatus = useMemo(() => {
    const map: Record<ColumnStatus, Task[]> = { TODO: [], IN_PROGRESS: [], DONE: [] }
    tasks.forEach((t) => {
      map[t.status].push(t)
    })
    return map
  }, [tasks])

  async function refresh(pid: string) {
    const p = await apiFetch<Project>(`/projects/${pid}`)
    const t = await apiFetch<Task[]>(`/projects/${pid}/tasks`)
    setProject(p)
    setTasks(t)
  }

  useEffect(() => {
    setError(null)
    if (!projectId) return
    refresh(projectId).catch((e: any) => setError(e?.error ?? 'Failed to load board'))
  }, [projectId])

  function onDragStart(taskId: string) {
    setMovingTaskId(taskId)
  }

  async function moveTask(taskId: string, newStatus: ColumnStatus) {
    const prev = tasks
    const current = tasks.find((t) => t.id === taskId)
    if (!current) return
    if (current.status === newStatus) return

    setError(null)
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
    try {
      await apiFetch<Task>(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      })
    } catch (e: any) {
      setTasks(prev)
      setError(e?.error ?? 'Failed to move task')
    }
  }

  if (!projectId) return null

  return (
    <div className="app-shell">
      <NavBar />
      <div className="app-container py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link className="btn btn-ghost -ml-2" to={`/projects/${projectId}`}>
                ← Project
              </Link>
              <span className="badge">Kanban</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{project?.name ?? 'Loading…'}</h1>
            {project?.description ? (
              <p className="mt-1 text-sm text-slate-400">{project.description}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Drag cards between columns to update status.</p>
            )}
          </div>
          <div className="hidden sm:flex sm:gap-3">
            <div className="card px-4 py-3">
              <div className="text-xs text-slate-400">Tasks</div>
              <div className="text-lg font-semibold">{tasks.length}</div>
            </div>
          </div>
        </div>

        {error ? <div className="mt-5 error-box">{error}</div> : null}

        <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
          {columns.map((col) => (
            <div
              key={col.status}
              className="min-w-[280px] flex-1"
              onDragOver={(e) => {
                e.preventDefault()
              }}
              onDrop={async (e) => {
                e.preventDefault()
                const taskId = e.dataTransfer.getData('text/plain')
                if (!taskId) return
                await moveTask(taskId, col.status)
                setMovingTaskId(null)
              }}
            >
              <div className="card card-pad">
                <div className="flex items-center justify-between">
                  <h2 className="card-title">{statusLabel(col.status)}</h2>
                  <span className="badge">{tasksByStatus[col.status].length}</span>
                </div>

                <div className="mt-4 space-y-2">
                  {tasksByStatus[col.status].length === 0 ? (
                    <div className="muted">No tasks.</div>
                  ) : (
                    tasksByStatus[col.status].map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', t.id)
                          onDragStart(t.id)
                        }}
                        onDragEnd={() => setMovingTaskId(null)}
                        className={`card p-3 text-sm ${movingTaskId === t.id ? 'opacity-60' : ''}`}
                        title={t.title}
                      >
                        <div className="truncate font-medium">{t.title}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
