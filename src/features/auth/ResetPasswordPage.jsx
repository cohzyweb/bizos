import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/stores'
import { Button, Field, Input, Spinner } from '../../components/ui'
import AuthLayout from './AuthLayout'

// How long we wait for the emailed link's session to materialise before
// telling the user the link is dead. Covers the async URL-token detection
// in supabase-js (and a PKCE code exchange when one is ever enabled).
const LINK_GRACE_MS = 3000

function PasswordField({ label, hint, value, onChange, autoComplete, show, onToggleShow }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          required
          minLength={8}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-12"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </Field>
  )
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('checking') // checking | ready | expired
  const [email, setEmail] = useState('')

  // The recovery link lands here with a session already minted from the URL
  // token. Wait for it — supabase-js detects it asynchronously on load.
  // (No "already started" guard: React StrictMode mounts, unmounts and mounts
  // again in dev, and a guard would skip re-arming the timeout on the second
  // pass, leaving the page stuck on "Checking your link…".)
  useEffect(() => {
    let settled = false

    const ready = (userEmail) => {
      if (settled) return
      settled = true
      if (userEmail) setEmail(userEmail)
      setStatus('ready')
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        ready(session?.user?.email ?? '')
      }
    })

    ;(async () => {
      // PKCE-style links carry ?code= instead of hash tokens; exchange it so
      // the flow works whether the project uses PKCE or the implicit grant.
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) await supabase.auth.exchangeCodeForSession(code).catch(() => null)
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (data?.session) ready(data.session.user?.email ?? '')
    })()

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      setStatus('expired')
    }, LINK_GRACE_MS)

    return () => {
      clearTimeout(timer)
      settled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Both passwords must match.')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    toast.success('Password updated. You are logged in.')
    navigate('/', { replace: true })
  }

  if (status === 'checking') {
    return (
      <AuthLayout>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">Checking your link…</h2>
        <p className="mt-3 text-slate-600">One moment while we verify your password reset link.</p>
        <div className="mt-8 flex justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </AuthLayout>
    )
  }

  if (status === 'expired') {
    return (
      <AuthLayout>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">Link expired</h2>
        <p className="mt-3 text-slate-600">
          This password reset link is invalid, already used, or has expired. Reset links only work once and time out
          quickly for your security.
        </p>
        <div className="mt-8 rounded-lg bg-teal-50 px-4 py-4 text-center text-sm text-slate-700">
          Need a new one?{' '}
          <Link to="/login" className="font-semibold text-teal-700 hover:underline">
            Back to log in →
          </Link>
          <span className="mt-1 block text-slate-500">Enter your email there and tap &ldquo;Forgot password?&rdquo;</span>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">Set a new password</h2>
      <p className="mt-2 text-slate-600">
        {email ? (
          <>
            Choose a new password for <span className="font-semibold text-slate-900">{email}</span>.
          </>
        ) : (
          <>Choose a new password for your BizOs account. It takes effect immediately.</>
        )}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <PasswordField
          label="New password"
          hint="At least 8 characters."
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          show={show}
          onToggleShow={() => setShow((s) => !s)}
        />
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          show={show}
          onToggleShow={() => setShow((s) => !s)}
        />

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Save new password <KeyRound className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-teal-700 hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  )
}
