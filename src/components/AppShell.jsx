import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Receipt, BarChart3, Settings,
  Plus, Search, Bell, LogOut, Cloud, CloudOff, Menu, ChevronsUpDown,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { useOnlineStore } from '../lib/stores'
import { Logo, Badge, cx } from './ui'
import { initials, formatDate } from '../lib/format'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/sale/new', label: 'New Sale (POS)', icon: ShoppingCart, kbd: "/" },
  { to: '/products', label: 'Products & Inventory', icon: Package },
  { to: '/customers', label: 'Customers & Debts', icon: Users },
  { to: '/sales', label: 'Sales History', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3, ownerOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, ownerOnly: true },
]

function SyncChip() {
  const online = useOnlineStore((s) => s.online)
  return online ? (
    <Badge tone="success" dot>Synced</Badge>
  ) : (
    <Badge tone="warn" dot>Offline</Badge>
  )
}

export default function AppShell() {
  const navigate = useNavigate()
  const { business, user, isOwner, signOut } = useAuth()
  const online = useOnlineStore((s) => s.online)

  // F2 = New Sale from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2') {
        e.preventDefault()
        navigate('/sale/new')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const items = NAV.filter((n) => isOwner || !n.ownerOnly)
  const displayName = user?.user_metadata?.full_name || user?.email || 'You'

  return (
    <div className="min-h-screen bg-background">
      {/* ===== Sidebar: full on laptop, icon rail on tablet, hidden on phone ===== */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-slate-200 bg-white md:flex lg:w-64">
        <div className="flex h-16 items-center justify-center px-4 lg:justify-start">
          <Logo className="[&>span]:hidden lg:[&>span]:inline" />
        </div>

        <div className="mx-3 mb-3 hidden items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2.5 lg:flex">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{business?.name}</p>
            <p className="truncate text-xs text-slate-500">{isOwner ? 'Owner' : 'Staff'}</p>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-slate-400" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map(({ to, label, icon: Icon, end, kbd }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                cx(
                  'focus-ring flex items-center justify-center gap-3 rounded px-3 py-2.5 text-sm font-semibold transition-colors lg:justify-start',
                  isActive ? 'bg-primary-container text-white' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden flex-1 lg:inline">{label}</span>
              {kbd && <span className="hidden rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold lg:inline">{kbd}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-slate-200 p-3">
          <div className={cx('hidden items-center gap-2 rounded-lg px-3 py-2.5 text-xs lg:flex', online ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800')}>
            {online ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
            <span className="font-semibold">{online ? 'Synced · offline-ready' : 'Offline · saving locally'}</span>
          </div>
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
              {initials(displayName)}
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500">{isOwner ? 'Shop owner' : 'Attendant'}</p>
            </div>
            <button onClick={signOut} aria-label="Log out" title="Log out" className="hidden text-slate-400 hover:text-slate-700 lg:block">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Main column ===== */}
      <div className="md:pl-20 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6 lg:px-8">
          <div className="md:hidden"><Logo /></div>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search products, sales, customers…"
              className="focus-ring h-10 w-full rounded-full border border-slate-200 bg-surface-container-low pl-9 pr-10 text-sm"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-400">/</kbd>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <SyncChip />
            <span className="hidden text-right text-xs leading-tight text-slate-500 xl:block">
              <span className="block font-semibold text-slate-700">{formatDate(new Date(), { weekday: 'short' })}</span>
            </span>
            <button aria-label="Notifications" className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 md:flex">
              <Bell className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/sale/new')}
              className="focus-ring hidden h-10 items-center gap-2 rounded bg-primary-container px-4 text-sm font-semibold text-white hover:bg-teal-600 md:inline-flex"
            >
              <Plus className="h-4 w-4" /> New Sale
            </button>
          </div>
        </header>

        <main className="px-4 pb-28 pt-5 md:px-6 md:pb-10 lg:px-8 lg:pt-7">
          <Outlet />
        </main>
      </div>

      {/* ===== Bottom nav: phone only ===== */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5 items-end">
          <BottomLink to="/" icon={LayoutDashboard} label="Home" end />
          <BottomLink to="/products" icon={Package} label="Products" />
          <div className="flex justify-center">
            <button
              onClick={() => navigate('/sale/new')}
              aria-label="New sale"
              className="focus-ring -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-white shadow-lift"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>
          <BottomLink to="/customers" icon={Users} label="Customers" />
          <BottomLink to="/more" icon={Menu} label="More" />
        </div>
      </nav>
    </div>
  )
}

function BottomLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', isActive ? 'text-primary-container' : 'text-slate-500')
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  )
}
