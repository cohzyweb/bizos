import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button, Field, Input } from '../../components/ui'
import AuthLayout from './AuthLayout'
import OAuthButtons from './OAuthButtons'

export default function SignupPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin + '/setup' },
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    // If email confirmation is switched on in Supabase, there is no session yet.
    if (!data.session) setConfirmSent(true)
    // With a session, go to "/": the router sends new shop owners to setup,
    // but workers invited by a boss land straight in their shop.
    else navigate('/', { replace: true })
  }

  if (confirmSent) {
    return (
      <AuthLayout>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">Check your email</h2>
        <p className="mt-3 text-slate-600">
          We sent a confirmation link to <span className="font-semibold text-slate-900">{email}</span>. Open it to verify your email and start setting up your shop.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Already confirmed? <Link to="/login" className="font-semibold text-teal-700 hover:underline">Log in</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">Create your account</h2>
      <p className="mt-2 text-slate-600">Full access is free while we launch.</p>

      <OAuthButtons />

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Full name">
          <Input required autoComplete="name" placeholder="e.g. Adaeze Okonkwo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email address">
          <Input type="email" required autoComplete="email" inputMode="email" placeholder="e.g. adaeze@myshop.ng" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </Field>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-teal-700 hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  )
}
