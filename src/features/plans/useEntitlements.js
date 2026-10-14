import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

const CACHE_KEY = 'bizos:entitlements'

function readCache(businessId) {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.businessId === businessId ? parsed.data : undefined
  } catch {
    return undefined
  }
}

function writeCache(businessId, data) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ businessId, data }))
  } catch {
    /* storage can be unavailable; ignore */
  }
}

// Which limit key each feature depends on. Components call can('staff'),
// never `plan === 'pro'`.
const FEATURES = {
  staff: (l) => Number(l.max_staff ?? 0) > 0 || l.max_staff === null,
  profit_report: (l) => Boolean(l.profit_report),
  receipt_branding: (l) => Boolean(l.receipt_branding),
  unlimited_products: (l) => l.max_products === null || l.max_products === undefined,
  long_reports: (l) => l.report_max_days === null || l.report_max_days === undefined,
}

export function useEntitlements() {
  const { businessId } = useAuth()

  const query = useQuery({
    queryKey: ['entitlements', businessId],
    enabled: Boolean(businessId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_entitlements', { b: businessId })
      if (error) throw error
      writeCache(businessId, data)
      return data
    },
    // Last known values so gating still works offline
    placeholderData: () => (businessId ? readCache(businessId) : undefined),
  })

  const data = query.data
  const limits = data?.limits ?? {}

  return {
    ready: Boolean(data),
    tier: data?.tier ?? 'free',
    launchAccess: Boolean(data?.launch_access),
    launchEndsAt: data?.launch_ends_at ?? null,
    limits,
    limit: (key) => limits[key],
    can: (feature) => (FEATURES[feature] ? FEATURES[feature](limits) : false),
  }
}
