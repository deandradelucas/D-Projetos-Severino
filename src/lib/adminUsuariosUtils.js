export const ROLE_OPTIONS = [
  { value: 'USER', label: 'Usuário' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'READONLY', label: 'Somente leitura' },
]

export function normalizeRoleKey(role) {
  return String(role || 'USER').trim().toUpperCase()
}

/** Rótulo amigável: Admin, Usuário ou Somente leitura (não o código cru USER/ADMIN). */
export function roleDisplayLabel(role) {
  const key = normalizeRoleKey(role)
  const opt = ROLE_OPTIONS.find((o) => o.value === key)
  return opt ? opt.label : key
}

export function rolePillClassName(role) {
  const k = normalizeRoleKey(role)
  if (k === 'ADMIN') return 'page-admin-role-pill page-admin-role-pill--admin'
  if (k === 'READONLY') return 'page-admin-role-pill page-admin-role-pill--readonly'
  return 'page-admin-role-pill page-admin-role-pill--user'
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function formatRelativeAgo(date) {
  const diffMin = (Date.now() - date.getTime()) / 60000
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${Math.floor(diffMin)} min`
  if (diffMin < 1440) return `há ${Math.floor(diffMin / 60)} h`
  return `há ${Math.floor(diffMin / 1440)} d`
}
