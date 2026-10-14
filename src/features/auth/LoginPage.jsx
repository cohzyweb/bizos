import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button, Field, Input } from '../../components/ui'
import AuthLayout from './AuthLayout'
import OAuthButtons from './OAuthButtons'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Wrong email or password. Please try again.' : error.message)
      return
    }
    navigate('/', { replace: true })
  }

  async function onForgot() {
    if (!email.trim()) {
      setError('Type your email above first, then tap "Forgot password?".')
      return
    }
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/login',
    })
    if (error) setError(error.message)
    else setResetSent(true)
  }

  return (
    <AuthLayout>
      <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h2>
      <p className="mt-2 text-slate-600">Log in to manage your shop's sales, stock, and debts.</p>

      <div className="mt-8">
        <OAuthButtons />
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Email address">
          <Input type="email" required autoComplete="email" inputMode="email" placeholder="e.g. adaeze@myshop.ng" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="text-sm font-semibold text-teal-700 hover:underline">
            Forgot password?
          </button>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        {resetSent && <p role="alert" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Password reset link sent. Check your email.</p>}

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in <LogIn className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-8 rounded-lg bg-teal-50 px-4 py-4 text-center text-sm text-slate-700">
        New to BizOs?{' '}
        <Link to="/signup" className="font-semibold text-teal-700 hover:underline">Create an account →</Link>
      </div>
    </AuthLayout>
  )
}
