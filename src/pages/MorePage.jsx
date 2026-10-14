import { Link } from 'react-router-dom'
import { Receipt, BarChart3, Settings, Sparkles, LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { Card } from '../components/ui'

export default function MorePage() {
  const { isOwner, signOut, business } = useAuth()
  const items = [
    { to: '/sales', label: 'Sales history', icon: Receipt },
    ...(isOwner
      ? [
          { to: '/reports', label: 'Reports', icon: BarChart3 },
          { to: '/settings', label: 'Settings', icon: Settings },
          { to: '/settings/plan', label: 'Plan and billing', icon: Sparkles },
        ]
      : []),
  ]
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-headline text-2xl font-bold text-slate-900">More</h1>
        <p className="text-sm text-slate-500">{business?.name}</p>
      </div>
      <Card className="divide-y divide-slate-100 p-0">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-4 py-4 text-slate-800">
            <Icon className="h-5 w-5 text-slate-500" />
            <span className="flex-1 font-semibold">{label}</span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        ))}
        <button onClick={signOut} className="flex w-full items-center gap-3 px-4 py-4 text-left text-red-600">
          <LogOut className="h-5 w-5" />
          <span className="flex-1 font-semibold">Log out</span>
        </button>
      </Card>
    </div>
  )
}
