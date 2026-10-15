import { useQuery } from '@tanstack/react-query'
import { Check, Minus, Rocket } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useEntitlements } from './useEntitlements'
import { Badge, Button, Card } from '../../components/ui'
import { useUpgradeStore } from '../../lib/stores'
import { formatDate } from '../../lib/format'

const ROWS = [
  ['Record sales, receipts, offline mode', 'Unlimited', 'Unlimited'],
  ['Stock tracking and low-stock alerts', true, true],
  ['Customers, debts, WhatsApp reminders', true, true],
  ['CSV export of your own data', 'Always', 'Always'],
  ['Products', 'Up to 50', 'Unlimited'],
  ['Staff accounts', 'Owner only', 'Up to 5'],
  ['Reports', 'Sales totals, 7-day range', 'All ranges, profit, top and slow products'],
  ['Receipts', '"Made with BizOs" footer', 'Your logo and note, no footer'],
]

function Cell({ v }) {
  if (v === true) return <Check className="mx-auto h-5 w-5 text-emerald-600" />
  if (v === false) return <Minus className="mx-auto h-5 w-5 text-slate-400" />
  return <span>{v}</span>
}

function Meter({ label, used, max }) {
  const unlimited = max === null || max === undefined
  const pct = unlimited ? 12 : max === 0 ? 100 : Math.min(100, Math.round((used / max) * 100))
  const warn = !unlimited && max > 0 && pct >= 80
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="tabular text-slate-500">
          {used} of {unlimited ? 'unlimited' : max}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${warn ? 'bg-amber-500' : 'bg-primary-container'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function PlanPage() {
  const { businessId, business } = useAuth()
  const { launchAccess, launchEndsAt, tier, limits } = useEntitlements()
  const show = useUpgradeStore((s) => s.show)

  const usage = useQuery({
    queryKey: ['plan-usage', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const [p, s] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('is_archived', false),
        supabase.from('business_members').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('role', 'staff'),
      ])
      return { products: p.count ?? 0, staff: s.count ?? 0 }
    },
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">Plan and billing</h1>
        <p className="mt-1 text-slate-600">See what is free forever, and what Pro adds.</p>
      </div>

      {launchAccess ? (
        <div className="flex items-start gap-4 rounded-lg bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <Rocket className="mt-0.5 h-6 w-6 text-emerald-700" />
          <div>
            <p className="font-headline text-lg font-bold text-emerald-900">You have full access. It's free while we launch.</p>
            <p className="mt-1 text-sm text-emerald-800">
              {launchEndsAt
                ? `Launch access ends on ${formatDate(launchEndsAt)}. Your data is never deleted.`
                : "We'll tell you well before this changes. Your data is never deleted."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="label-caps">Current plan</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="font-headline text-2xl font-bold capitalize text-slate-900">{tier}</p>
              <Badge tone={tier === 'pro' ? 'success' : 'neutral'}>{tier === 'pro' ? 'Active' : 'Free forever'}</Badge>
            </div>
            {business?.plan_expires_at && tier === 'pro' && (
              <p className="mt-1 text-sm text-slate-500">Renews {formatDate(business.plan_expires_at)}</p>
            )}
            {tier !== 'pro' && (
              <Button className="mt-5" onClick={() => show('pro')}>Upgrade to Pro</Button>
            )}
          </Card>
          <Card className="space-y-4">
            <p className="label-caps">Usage</p>
            <Meter label="Products" used={usage.data?.products ?? 0} max={limits.max_products} />
            <Meter label="Staff" used={usage.data?.staff ?? 0} max={limits.max_staff} />
          </Card>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-headline text-lg font-bold text-slate-900">
            {launchAccess ? 'What becomes Pro later' : 'Free vs Pro'}
          </h2>
          <p className="text-sm text-slate-500">Core features stay free. Limits only stop new additions, never your existing work.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-5 py-3 font-semibold text-slate-500">Feature</th>
                <th className="w-40 px-3 py-3 text-center font-semibold text-slate-700">Free</th>
                <th className="w-48 bg-teal-50 px-3 py-3 text-center font-semibold text-teal-800">Pro</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, free, pro]) => (
                <tr key={label} className="border-t border-slate-100">
                  <td className="px-5 py-3 text-slate-700">{label}</td>
                  <td className="px-3 py-3 text-center text-slate-600"><Cell v={free} /></td>
                  <td className="bg-teal-50/50 px-3 py-3 text-center font-medium text-slate-800"><Cell v={pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
