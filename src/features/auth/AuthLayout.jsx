import { Link } from 'react-router-dom'
import { Zap, MessageSquare, TrendingUp, WifiOff } from 'lucide-react'
import { Logo } from '../../components/ui'

const points = [
  { icon: Zap, title: 'Record sales in under 10 seconds', body: 'Runs even when the network is down.' },
  { icon: MessageSquare, title: 'WhatsApp payment reminders', body: 'Get back money from customers who took goods on credit.' },
  { icon: TrendingUp, title: 'Daily profit and low-stock alerts', body: 'Know what is selling before the rush hour.' },
]

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[45fr_55fr]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col">
        <Logo light />
        <div className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Made for Nigerian retail shops
        </div>
        <h1 className="mt-8 max-w-md font-headline text-4xl font-extrabold leading-tight tracking-tight">
          Know your sales, your stock, and who owes you.
        </h1>
        <ul className="mt-10 space-y-6">
          {points.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-sm text-teal-200">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center gap-2 pt-10 text-sm text-teal-200">
          <WifiOff className="h-4 w-4" /> Works offline. Your sales sync when you are back online.
        </div>
      </aside>

      <main className="flex min-h-screen flex-col px-5 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center animate-fade-up">
          <Logo className="mb-8 lg:hidden" />
          {children}
        </div>
        <p className="mx-auto mt-8 max-w-[420px] text-center text-xs text-slate-500">
          By continuing you agree to the BizOs{' '}
          <Link to="/login" className="font-semibold text-teal-700">Terms of Service</Link> and{' '}
          <Link to="/login" className="font-semibold text-teal-700">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  )
}
