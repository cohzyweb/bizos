import { create } from 'zustand'

// Dark mode for the whole app. The preference is stored per device (same
// approach as lib/prefs.js) and applied as a `dark` class on <html>, which
// is what swaps the CSS custom properties defined in src/index.css.
//
// index.html repeats the first half of this logic inline so the right scheme
// is on screen before React boots (no light flash on reload).

export const THEME_KEY = 'bizos:theme'
const DARK_BG = '#0B121B'
const LIGHT_BG = '#0F766E'

function systemMode() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function readStoredTheme() {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    /* storage can be unavailable; fall back to the system setting */
  }
  return null
}

export function resolveTheme() {
  return readStoredTheme() ?? systemMode()
}

export function applyTheme(mode) {
  if (typeof document === 'undefined') return
  const dark = mode === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? DARK_BG : LIGHT_BG)
}

export const useThemeStore = create((set, get) => ({
  mode: typeof document === 'undefined' ? 'light' : resolveTheme(),
  setMode: (mode) => {
    const next = mode === 'dark' ? 'dark' : 'light'
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      /* storage can be unavailable; the choice just won't persist */
    }
    applyTheme(next)
    set({ mode: next })
  },
  toggle: () => get().setMode(get().mode === 'dark' ? 'light' : 'dark'),
}))

// Keep the theme in step with the OS until the user picks one explicitly.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (readStoredTheme()) return
      const mode = e.matches ? 'dark' : 'light'
      applyTheme(mode)
      useThemeStore.setState({ mode })
    })
  } catch {
    /* older browsers: no live system-theme tracking, not a blocker */
  }
}

// The class is normally set by the inline script in index.html; apply it here
// too so tests and any other entry point start from the stored preference.
applyTheme(useThemeStore.getState().mode)
