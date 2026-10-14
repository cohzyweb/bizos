import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// True when real Supabase credentials are present in .env. Without them the
// app renders the "Connect Supabase to start" screen instead of booting.
export const isSupabaseConfigured = Boolean(url && anonKey)

// Null until credentials exist — main.jsx never mounts <App /> in that state,
// so nothing in the app may touch this module at import time.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
