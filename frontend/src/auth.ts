export type UserView = { id: string; name: string; email: string; rootAdmin?: boolean }

export function setSession(accessToken: string, user: UserView) {
  localStorage.setItem('accessToken', accessToken)
  localStorage.setItem('user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
}

export function getUser(): UserView | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserView
  } catch {
    return null
  }
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('accessToken')
}
