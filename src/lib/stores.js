import { create } from 'zustand'

// ---- Toasts ----
let toastId = 0
export const useToastStore = create((set) => ({
  toasts: [],
  push: (message, tone = 'success') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
export const toast = {
  success: (m) => useToastStore.getState().push(m, 'success'),
  error: (m) => useToastStore.getState().push(m, 'error'),
  info: (m) => useToastStore.getState().push(m, 'info'),
}

// ---- Upgrade prompt (shown when the server raises PLAN_LIMIT:<key>) ----
export const useUpgradeStore = create((set) => ({
  open: false,
  reason: null,
  show: (reason) => set({ open: true, reason }),
  hide: () => set({ open: false, reason: null }),
}))

// If an error is a plan-limit error, open the upgrade prompt and return true.
export function handlePlanError(error) {
  const msg = error?.message || ''
  const match = msg.match(/PLAN_LIMIT:([a-z_]+)/)
  if (match) {
    useUpgradeStore.getState().show(match[1])
    return true
  }
  return false
}

// ---- Online / offline status ----
export const useOnlineStore = create((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  setOnline: (online) => set({ online }),
}))
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useOnlineStore.getState().setOnline(true))
  window.addEventListener('offline', () => useOnlineStore.getState().setOnline(false))
}
