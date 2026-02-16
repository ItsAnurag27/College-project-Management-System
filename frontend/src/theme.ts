export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'theme'

export function getStoredTheme(): ThemeMode | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === 'dark' || raw === 'light') return raw
  return null
}

export function getInitialTheme(): ThemeMode {
  const stored = getStoredTheme()
  if (stored) return stored
  return 'dark'
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
  localStorage.setItem(STORAGE_KEY, mode)
}

export function toggleTheme(): ThemeMode {
  const current = (document.documentElement.dataset.theme as ThemeMode | undefined) ?? getInitialTheme()
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

export function initTheme() {
  applyTheme(getInitialTheme())
}
