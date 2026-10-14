import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const AuthContext = createContext(null)

// Session key the OAuth buttons use to remember which page started the sign-in,
// so a failed round-trip drops the user back on that same page.
export const OAUTH_RETURN_TO_KEY = 'bizos.oauth.return_to'
const OAUTH_PAGES = ['/login', '/signup']

// How long the full-screen spinner may block the app while the initial session
// is resolved. Guards against a session lookup that never settles (e.g. a
// request stalled by the network): the app must never hang on the spinner.
const SESSION_LOOKUP_TIMEOUT_MS = 10000

// A failed provider round-trip (consent denied, redirect URL missing from the
// Supabase allow list, provider not enabled, ...) comes back to the app as
// error parameters on the callback URL — in the query string or the hash.
// Pull them off before they are lost, then clean the address bar so a refresh
// can't replay the failed attempt.
function takeOAuthErrorFromUrl() {
  if (typeof window === 'undefined') return null
  let url
  try {
    url = new URL(window.location.href)
  } catch {
    return null
  }
  const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : '')
  const searchParams = new URLSearchParams(url.search)
  // Search params win over hash params, matching the Supabase client.
  const pick = (name) => searchParams.get(name) ?? hashParams.get(name)
  const code = pick('error')
  const description = pick('error_description')
  const errorCode = pick('error_code')
  if (!code && !description && !errorCode) return null

  for (const params of [searchParams, hashParams]) {
    params.delete('error')
    params.delete('error_description')
    params.delete('error_code')
  }
  const hash = hashParams.toString()
  const cleaned =
    url.pathname +
    (searchParams.toString() ? `?${searchParams.toString()}` : '') +
    (hash ? `#${hash}` : '')
  window.history.replaceState(window.history.state, '', cleaned)

  return description || errorCode || code
}

function storedReturnTo() {
  try {
    const stored = window.sessionStorage.getItem(OAUTH_RETURN_TO_KEY)
    window.sessionStorage.removeItem(OAUTH_RETURN_TO_KEY)
    return OAUTH_PAGES.includes(stored) ? stored : '/login'
  } catch {
    return '/login'
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [membership, setMembership] = useState(null)
  const [membershipChecked, setMembershipChecked] = useState(false)

  const clearAuthError = useCallback(() => setAuthError(null), [])

  const loadMembership = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('business_members')
      .select(
        'role, business_id, businesses(id, name, phone, address, logo_url, receipt_note, plan, plan_expires_at, founding_member)',
      )
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
    setMembership(!error && data?.length ? data[0] : null)
    setMembershipChecked(true)
  }, [])

  useEffect(() => {
    // Failed OAuth callback: surface the reason on the page the sign-in was
    // started from, before guards redirect anywhere.
    const callbackError = takeOAuthErrorFromUrl()
    if (callbackError) {
      setAuthError(callbackError)
      navigate(storedReturnTo(), { replace: true })
    }

    let cancelled = false
    // Safety net: if the session lookup never settles (hung request), stop the
    // full-screen spinner instead of blocking the app forever.
    const spinnerGuard = setTimeout(() => setSessionLoading(false), SESSION_LOOKUP_TIMEOUT_MS)

    // getSession() reports a bad callback as a resolved error and can reject
    // outright (e.g. blocked storage). Either way the spinner must stop.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (data?.session) setAuthError(null)
        else if (error?.message) setAuthError((prev) => prev || error.message)
        setSession(data?.session ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        setSession(null)
        setAuthError(
          (prev) => prev || (err?.message ? `Sign-in failed: ${err.message}` : 'Sign-in failed. Please try again.'),
        )
      })
      .finally(() => {
        clearTimeout(spinnerGuard)
        if (!cancelled) setSessionLoading(false)
      })

    // Keep this callback synchronous (no awaited Supabase calls inside it).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      // A successful sign-in supersedes any failure we were showing.
      if (next) setAuthError(null)
    })
    return () => {
      cancelled = true
      clearTimeout(spinnerGuard)
      sub.subscription.unsubscribe()
    }
  }, [navigate])

  const userId = session?.user?.id
  const userEmail = session?.user?.email ?? null
  useEffect(() => {
    if (userId) {
      setMembershipChecked(false)
      // Claim any pending staff invite addressed to this email (best-effort:
      // a failure here must never block sign-in, e.g. migration not applied).
      const claim = userEmail ? supabase.rpc('claim_invites') : Promise.resolve(null)
      Promise.resolve(claim)
        .catch(() => null)
        .then(() => loadMembership(userId))
    } else {
      setMembership(null)
      setMembershipChecked(false)
    }
  }, [userId, userEmail, loadMembership])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading: sessionLoading || (Boolean(userId) && !membershipChecked),
      membership,
      business: membership?.businesses ?? null,
      businessId: membership?.business_id ?? null,
      role: membership?.role ?? null,
      isOwner: membership?.role === 'owner',
      refresh: () => (userId ? loadMembership(userId) : Promise.resolve()),
      signOut: () => supabase.auth.signOut(),
      // Provider (OAuth) failure text recovered from the callback URL or from
      // getSession(); shown next to the Google/Apple buttons.
      authError,
      clearAuthError,
    }),
    [session, sessionLoading, userId, membershipChecked, membership, loadMembership, authError, clearAuthError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
