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

// OAuth sign-in is switched off for now: neither Google nor Apple is enabled
// on the Supabase project (Authentication → Providers). Re-enable by adding
// entries back — the button grid adapts to however many are listed.
const PROVIDERS = [
  // { id: 'google', label: 'Google', Icon: GoogleIcon },
]

// "Continue with Google" button, shared by the login and signup pages.
// Supabase redirects to the provider and back to `/`; if the provider
// bounces back with an error, AuthProvider stashes it in `authError` and
// returns the user here so the reason is visible.
// (Apple is not enabled on the Supabase project yet — re-add it to PROVIDERS
// along with an AppleIcon once Authentication → Providers → Apple is live.)
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

  // OAuth is off and there is nothing to report — render nothing at all, so no
  // orphaned gap is left above the email form.
  if (!PROVIDERS.length && !message) return null

  return (
    <div className="mt-8">
      {PROVIDERS.length > 0 && (
        <div className={`grid gap-3 ${PROVIDERS.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
      )}

      {message && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {message}
        </p>
      )}

      {PROVIDERS.length > 0 && (
        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or continue with email
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      )}
    </div>
  )
}
