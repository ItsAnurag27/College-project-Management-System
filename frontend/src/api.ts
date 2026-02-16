const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8090'

export type ApiError = { status: number; error: string }

function getToken(): string | null {
  return localStorage.getItem('accessToken')
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  })

  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let body: any = null
    try {
      body = raw ? JSON.parse(raw) : null
    } catch {
      body = null
    }
    const err: ApiError = {
      status: res.status,
      error: (body?.error ?? raw) || res.statusText
    }
    throw err
  }

  if (res.status === 204) {
    return undefined as T
  }

  const raw = await res.text().catch(() => '')
  if (!raw) {
    return undefined as T
  }

  return JSON.parse(raw) as T
}
