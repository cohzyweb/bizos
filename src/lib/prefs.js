// Client-side preferences (no server column for these — stored on this
// device). Extracted from the Settings page so other screens can honour the
// same values, e.g. the WhatsApp reminder template on the Customers page.

export const PREFS_KEY = 'bizos:settings-prefs'

export const DEFAULT_PREFS = {
  printWidth: '80',
  autoPrint: false,
  showDebtOnSlip: true,
  waTemplate:
    'Hello {name}, this is a friendly reminder that you have an outstanding balance of {amount} at {business}. Thank you.',
  waInstant: true,
  waWeekly: false,
}

export function readPrefs() {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return { ...DEFAULT_PREFS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function writePrefs(next) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch {
    /* storage can be unavailable; ignore */
  }
}
