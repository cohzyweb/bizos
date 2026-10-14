import { Loader2 } from 'lucide-react'

export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

const buttonVariants = {
  primary: 'bg-primary-container text-white hover:bg-teal-600 active:bg-teal-800 disabled:bg-slate-300',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:bg-teal-50 hover:border-primary-container disabled:text-slate-400',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60',
  solidDanger: 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-60',
  soft: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-60',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:opacity-60',
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...props }) {
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-12 px-5 text-base' }
  return (
    <button
      className={cx(
        'focus-ring inline-flex items-center justify-center gap-2 rounded font-semibold transition-colors disabled:cursor-not-allowed',
        buttonVariants[variant],
        sizes[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

const badgeTones = {
  success: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
  primary: 'bg-teal-50 text-teal-700',
}

export function Badge({ tone = 'neutral', dot, className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
        badgeTones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-lg border border-slate-200 bg-white p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function Spinner({ className }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-primary-container', className)} />
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-primary-container">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="font-headline text-base font-semibold text-slate-800">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

export const inputClass =
  'focus-ring h-12 w-full rounded border border-slate-200 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary-container'

export function Input({ className, ...props }) {
  return <input className={cx(inputClass, className)} {...props} />
}

export function Logo({ className, light }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <div className={cx('flex h-9 w-9 items-center justify-center rounded-lg', light ? 'bg-emerald-200 text-teal-800' : 'bg-primary-container text-white')}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M4 9v11h16V9" />
          <path d="M9 20v-6h6v6" />
          <path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3" />
        </svg>
      </div>
      <span className={cx('font-headline text-xl font-extrabold', light ? 'text-white' : 'text-slate-900')}>BizOs</span>
    </div>
  )
}
