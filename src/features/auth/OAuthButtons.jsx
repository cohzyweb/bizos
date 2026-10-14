import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth, OAUTH_RETURN_TO_KEY } from './AuthProvider'
import { Button } from '../../components/ui'

// Brand marks (lucide has no third-party logos).
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

const PROVIDERS = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
  { id: 'apple', label: 'Apple', Icon: AppleIcon },
]

// "Continue with Google / Apple" buttons, shared by the login and signup pages.
// Supabase redirects to the provider and back to `/`; if the provider
// bounces back with an error, AuthProvider stashes it in `authError` and
// returns the user here so the reason is visible.
export default function OAuthButtons() {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const { authError, clearAuthError } = useAuth()
  const message = error || authError

  async function onClick(provider) {
    setError('')
    clearAuthError()
    setBusy(provider)
    try {
      // Remember this page: a failed callback comes back to `/`, and that's
      // where we want to show the reason (and drop the user off) afterwards.
      try {
        if (['/login', '/signup'].includes(window.location.pathname)) {
          window.sessionStorage.setItem(OAUTH_RETURN_TO_KEY, window.location.pathname)
        }
      } catch {
        /* storage can be unavailable; the default return page is fine */
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + '/' },
      })
      // On success the backend navigates away to the provider; AuthProvider
      // picks the session up if the round-trip resolves in place.
      if (error) {
        setError(error.message)
        setBusy('')
      }
    } catch (err) {
      setError(err?.message || 'Could not start sign-in with this provider. Please try again.')
      setBusy('')
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map(({ id, label, Icon }) => (
          <Button
            key={id}
            type="button"
            variant="secondary"
            loading={busy === id}
            disabled={Boolean(busy)}
            onClick={() => onClick(id)}
          >
            {busy !== id && <Icon />}
            {label}
          </Button>
        ))}
      </div>

      {message && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {message}
        </p>
      )}

      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or continue with email
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  )
}
