const PREFIX = 'profilePhoto:'

export function getProfilePhoto(userId: string): string | null {
  try {
    return localStorage.getItem(PREFIX + userId)
  } catch {
    return null
  }
}

export function setProfilePhoto(userId: string, dataUrl: string) {
  localStorage.setItem(PREFIX + userId, dataUrl)
}

export function removeProfilePhoto(userId: string) {
  localStorage.removeItem(PREFIX + userId)
}

export async function fileToResizedDataUrl(file: File, maxSize = 256): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  return await resizeDataUrl(dataUrl, maxSize)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

function resizeDataUrl(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * ratio))
      const h = Math.max(1, Math.round(img.height * ratio))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }

      ctx.drawImage(img, 0, 0, w, h)

      // Prefer JPEG to keep localStorage usage smaller.
      const out = canvas.toDataURL('image/jpeg', 0.88)
      resolve(out)
    }
    img.onerror = () => reject(new Error('Invalid image'))
    img.src = dataUrl
  })
}

export function initialsFromName(name: string | null | undefined, fallback: string | null | undefined) {
  const base = (name ?? '').trim() || (fallback ?? '').trim()
  if (!base) return 'U'

  const parts = base
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const first = parts[0]?.[0] ?? 'U'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function notifyProfilePhotoUpdated() {
  window.dispatchEvent(new Event('profilePhotoUpdated'))
}
