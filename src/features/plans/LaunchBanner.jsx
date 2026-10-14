import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Rocket, X } from 'lucide-react'
import { useEntitlements } from './useEntitlements'

export default function LaunchBanner() {
  const { launchAccess, launchEndsAt } = useEntitlements()
  const [hidden, setHidden] = useState(false)
  if (!launchAccess || hidden) return null

  let message = 'Full access is free while we launch.'
  if (launchEndsAt) {
    const days = Math.ceil((new Date(launchEndsAt).getTime() - Date.now()) / 86_400_000)
    if (days <= 30 && days > 0) message = `Full access ends in ${days} day${days === 1 ? '' : 's'}.`
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-primary-container px-4 py-3 text-white">
      <Rocket className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">
        {message}{' '}
        <Link to="/settings/plan" className="font-bold underline underline-offset-2">See what changes</Link>
      </p>
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="text-white/80 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
