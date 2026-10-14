// Nigeria (Africa/Lagos) is UTC+1 all year, with no daylight saving.
const LAGOS_OFFSET_MS = 60 * 60 * 1000

// Start of a Lagos calendar day as a Date (UTC instant). offsetDays=-1 is yesterday.
export function lagosDayStart(offsetDays = 0, now = new Date()) {
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET_MS)
  const startUtcMs =
    Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate() + offsetDays) - LAGOS_OFFSET_MS
  return new Date(startUtcMs)
}

// "YYYY-MM-DD" key of the Lagos day an instant falls in
export function lagosDayKey(value) {
  const d = new Date(new Date(value).getTime() + LAGOS_OFFSET_MS)
  return d.toISOString().slice(0, 10)
}

export function greeting(now = new Date()) {
  const h = new Date(now.getTime() + LAGOS_OFFSET_MS).getUTCHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
