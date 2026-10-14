import { Logo } from '../components/ui'

export default function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8">
        <Logo />
        <h1 className="mt-6 font-headline text-2xl font-bold text-slate-900">Connect Supabase to start</h1>
        <p className="mt-2 text-slate-600">The app needs your Supabase project details before it can run.</p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Create a project at supabase.com.</li>
          <li>Open the SQL editor and run <code className="rounded bg-slate-100 px-1.5 py-0.5">supabase/migrations/001_init.sql</code>, then <code className="rounded bg-slate-100 px-1.5 py-0.5">002_staff_invites.sql</code>, then <code className="rounded bg-slate-100 px-1.5 py-0.5">003_security_hardening.sql</code>.</li>
          <li>Copy <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.example</code> to <code className="rounded bg-slate-100 px-1.5 py-0.5">.env</code> and paste the project URL and anon key (Project Settings, then API).</li>
          <li>Restart <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run dev</code>.</li>
        </ol>
      </div>
    </div>
  )
}
