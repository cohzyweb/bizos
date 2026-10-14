import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useToastStore } from '../lib/stores'

const tones = {
  success: { icon: CheckCircle2, cls: 'text-emerald-600' },
  error: { icon: AlertCircle, cls: 'text-red-600' },
  info: { icon: Info, cls: 'text-teal-700' },
}

export default function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-auto lg:left-auto lg:right-6 lg:top-20 lg:items-end">
      {toasts.map((t) => {
        const { icon: Icon, cls } = tones[t.tone] || tones.info
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-toast"
          >
            <Icon className={`h-5 w-5 shrink-0 ${cls}`} />
            <p className="flex-1 text-sm font-medium text-slate-800">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
