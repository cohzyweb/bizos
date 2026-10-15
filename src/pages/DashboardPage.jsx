import { Link, useNavigate } from 'react-router-dom'
import { Plus, PackagePlus, Wallet, ShoppingBag, TrendingUp, AlertTriangle, Lock, MessageCircle, Receipt } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { useEntitlements } from '../features/plans/useEntitlements'
import LaunchBanner from '../features/plans/LaunchBanner'
import { useDashboardData } from '../features/dashboard/useDashboardData'
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui'
import { greeting, lagosDayKey } from '../lib/dates'
import { formatDate, formatTime, initials, naira } from '../lib/format'
import { useUpgradeStore } from '../lib/stores'
import { daysOwingSince, hasWhatsApp, reminderTemplates, whatsappHref } from '../lib/whatsapp'

function statusBadge(s) {
  if (s.is_voided) return <Badge tone="neutral">Voided</Badge>
  if (s.payment_type === 'credit') return <Badge tone="danger">Credit</Badge>
  if (s.payment_type === 'part') return <Badge tone="warn">Part-paid</Badge>
  return <Badge tone="success">Paid</Badge>
}

function daysSince(value) {
  if (!value) return ''
  const d = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  return d <= 0 ? 'today' : `${d} day${d === 1 ? '' : 's'}`
}

function whatsappLink(phone, name, amount, business, oldestDebtAt) {
  const text = reminderTemplates({
    customerName: name,
    balance: amount,
    shop: business,
    daysOwing: daysOwingSince(oldestDebtAt),
  }).polite
  return whatsappHref(phone, text)
}

function TrendChart({ data }) {
  const max = Math.max(...data.map((d) => d.total), 1)
  const todayKey = lagosDayKey(new Date())
  return (
    <div className="flex h-56 items-end gap-2 sm:gap-4">
      {data.map((d) => {
        const h = Math.max(4, Math.round((d.total / max) * 100))
        const isToday = d.day === todayKey
        return (
          <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className="tabular text-[10px] font-semibold text-slate-500 sm:text-xs">
              {d.total >= 1000 ? `${Math.round(d.total / 100) / 10}k` : d.total || ''}
            </span>
            <div className={`w-full rounded-t-md ${isToday ? 'bg-primary-container' : 'bg-teal-200'}`} style={{ height: `${h}%` }} />
            <span className={`text-[11px] font-semibold ${isToday ? 'text-primary-container' : 'text-slate-400'}`}>
              {isToday ? 'Today' : formatDate(d.day, { day: undefined, month: undefined, year: undefined, weekday: 'short' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { business, user, businessId, isOwner } = useAuth()
  const { can } = useEntitlements()
  const showUpgrade = useUpgradeStore((s) => s.show)
  const canProfit = can('profit_report')
  const { data, isLoading, error } = useDashboardData(businessId, { isOwner, canProfit })

  const firstName = (user?.user_metadata?.full_name || '').split(' ')[0] || 'there'

  if (isLoading) {
    return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>
  }
  if (error) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState icon={AlertTriangle} title="Could not load your dashboard" hint={error.message} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
      </Card>
    )
  }

  const { today, trend, owingTotal, owingCount, topDebtors, lowStock, recent, profitToday } = data
  const avg = trend.reduce((s, d) => s + d.total, 0) / 7

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <LaunchBanner />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-600">Here is what is happening at <span className="font-semibold">{business?.name}</span> today.</p>
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Button onClick={() => navigate('/sale/new')}><Plus className="h-4 w-4" /> New Sale</Button>
          {isOwner && <Button variant="secondary" onClick={() => navigate('/products')}><PackagePlus className="h-4 w-4" /> Add product</Button>}
          <Button variant="secondary" onClick={() => navigate('/customers')}><Wallet className="h-4 w-4" /> Record payment</Button>
        </div>
      </div>

      {/* ===== Stat cards ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-brand-gradient p-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-200">Today's sales</p>
          <p className="tabular mt-2 font-headline text-4xl font-extrabold">{naira(today.total)}</p>
          <p className="mt-1 text-sm text-teal-200">{today.count} sale{today.count === 1 ? '' : 's'} recorded</p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded bg-white/10 p-3 text-xs">
            <div><p className="text-teal-200">Cash</p><p className="tabular font-bold">{naira(today.cash)}</p></div>
            <div><p className="text-teal-200">Transfer/POS</p><p className="tabular font-bold">{naira(today.transfer + today.pos)}</p></div>
            <div><p className="text-teal-200">Credit</p><p className="tabular font-bold">{naira(today.credit)}</p></div>
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <p className="label-caps">Profit today</p>
            {isOwner ? <Badge tone="neutral">Owner only</Badge> : <Lock className="h-4 w-4 text-slate-400" />}
          </div>
          {!isOwner ? (
            <p className="mt-3 text-sm text-slate-500">Only the shop owner can see profit.</p>
          ) : profitToday === null ? (
            <>
              <p className="mt-2 flex items-center gap-2 font-headline text-2xl font-bold text-white/70"><Lock className="h-6 w-6" /> Pro</p>
              <button onClick={() => showUpgrade('profit_report')} className="mt-3 text-sm font-semibold text-teal-700 hover:underline">See how to unlock</button>
            </>
          ) : (
            <p className="tabular mt-2 font-headline text-3xl font-extrabold text-slate-900">{naira(profitToday)}</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="label-caps">Who owes me</p>
            {owingCount > 0 && <Badge tone="danger">{owingCount} debtor{owingCount === 1 ? '' : 's'}</Badge>}
          </div>
          <p className="tabular mt-2 font-headline text-3xl font-extrabold text-red-600">{naira(owingTotal)}</p>
          <Link to="/customers" className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline">Debtor ledger →</Link>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="label-caps">Running low</p>
            {lowStock.length > 0 && <Badge tone="warn">Restock soon</Badge>}
          </div>
          <p className={`mt-2 font-headline text-3xl font-extrabold ${lowStock.length ? 'text-amber-700' : 'text-slate-900'}`}>
            {lowStock.length} item{lowStock.length === 1 ? '' : 's'}
          </p>
          <Link to="/products" className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline">View products →</Link>
        </Card>
      </div>

      {/* ===== Trend + debtors ===== */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-headline text-lg font-bold text-slate-900">7-day sales</h2>
              <p className="text-sm text-slate-500">Daily sales across the last week.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Average daily</p>
              <p className="tabular font-headline text-lg font-bold text-slate-900">{naira(Math.round(avg))}</p>
            </div>
          </div>
          <div className="mt-6"><TrendChart data={trend} /></div>
        </Card>

        <Card className="lg:col-span-4">
          <h2 className="font-headline text-lg font-bold text-slate-900">Who owes me</h2>
          {topDebtors.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No one owes you" hint="Credit sales will show up here." />
          ) : (
            <ul className="mt-3 space-y-2">
              {topDebtors.map((c) => (
                <li key={c.customer_id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">{initials(c.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{c.name}</span>
                    <span className="block text-xs text-slate-500">{daysSince(c.oldest_debt_at)} owing</span>
                  </span>
                  <span className="tabular text-sm font-bold text-red-600">{naira(c.balance)}</span>
                  {hasWhatsApp(c.phone) && (
                    <a href={whatsappLink(c.phone, c.name, c.balance, business?.name, c.oldest_debt_at)} target="_blank" rel="noreferrer" aria-label={`Remind ${c.name} on WhatsApp`} className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ===== Recent sales + low stock ===== */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="overflow-hidden p-0 lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-headline text-lg font-bold text-slate-900">Recent sales</h2>
            <Link to="/sales" className="text-sm font-semibold text-teal-700 hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={Receipt} title="No sales yet" hint="Record your first sale and it will show up here." action={<Button onClick={() => navigate('/sale/new')}>New sale</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Time</th>
                    <th className="px-3 py-3">Receipt</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-600">{formatTime(s.created_at)}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{s.receipt_no}</td>
                      <td className="px-3 py-3 text-slate-600">{s.customers?.name || 'Walk-in customer'}</td>
                      <td className="tabular px-3 py-3 text-right font-semibold text-slate-900">{naira(s.total)}</td>
                      <td className="px-5 py-3 text-center">{statusBadge(s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-4">
          <h2 className="font-headline text-lg font-bold text-slate-900">Running low</h2>
          {lowStock.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Stock looks healthy" hint="Products below their alert level appear here." />
          ) : (
            <ul className="mt-3 space-y-3">
              {lowStock.map((p) => {
                const out = Number(p.stock_qty) <= 0
                return (
                  <li key={p.id} className={`rounded-lg p-3 ${out ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{p.name}</span>
                      <Badge tone={out ? 'danger' : 'warn'}>{out ? 'Out of stock' : `${Number(p.stock_qty)} left`}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Alert level: {Number(p.low_stock_level)}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
