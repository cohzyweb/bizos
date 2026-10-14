import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useUpgradeStore } from '../../lib/stores'
import { Button } from '../../components/ui'

const REASONS = {
  max_products: 'Free plans hold up to 50 products.',
  max_staff: 'Staff accounts are part of Pro.',
  staff: 'Staff accounts are part of Pro.',
  report_range: 'Free reports cover up to 7 days at a time.',
  long_reports: 'Free reports cover up to 7 days at a time.',
  profit_report: 'Profit reports are part of Pro.',
  receipt_branding: 'Your own logo and note on receipts is part of Pro.',
}

const PRO_LIST = [
  'Unlimited products',
  'Up to 20 staff accounts',
  'Profit reports and long date ranges',
  'Your own logo on receipts',
]

export default function UpgradePrompt() {
  const { open, reason, hide } = useUpgradeStore()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={hide}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-xl bg-white p-6 shadow-lift sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-headline text-xl font-bold text-slate-900">Upgrade to Pro</h3>
            <p className="mt-1 text-sm text-slate-600">{REASONS[reason] || 'This feature is part of Pro.'}</p>
          </div>
          <button onClick={hide} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="mt-5 space-y-2.5">
          {PRO_LIST.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
              <Check className="h-4 w-4 text-emerald-600" /> {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">Your data is never deleted, and recording sales always stays free.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={hide}>Not now</Button>
          <Link to="/settings/plan" onClick={hide} className="flex-1">
            <Button className="w-full">See plans</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
