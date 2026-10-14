// Naira formatting: ₦12,500 (decimals only when needed)
export function naira(value) {
  const n = Number(value ?? 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return (
    sign +
    '₦' +
    abs.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  )
}

export function formatDate(value, opts = {}) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
    ...opts,
  })
}

export function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  })
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  )
}
