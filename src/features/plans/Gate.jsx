import { Lock } from 'lucide-react'
import { useEntitlements } from './useEntitlements'
import { useUpgradeStore } from '../../lib/stores'
import { Badge } from '../../components/ui'

// Wrap content that needs a feature. If the plan does not allow it, show the
// fallback (default: a locked card that opens the upgrade prompt).
export default function Gate({ feature, reason, fallback, children }) {
  const { can, ready } = useEntitlements()
  const show = useUpgradeStore((s) => s.show)
  if (!ready || can(feature)) return children
  if (fallback !== undefined) return fallback
  return (
    <button
      type="button"
      onClick={() => show(reason || feature)}
      className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Lock className="h-4 w-4" /> Available on Pro
      </span>
      <Badge tone="primary">Pro</Badge>
    </button>
  )
}
