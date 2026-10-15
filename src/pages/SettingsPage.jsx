import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronRight,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  Lock,
  MessageCircle,
  Moon,
  Printer,
  ReceiptText,
  Rocket,
  ShieldCheck,
  Store,
  UserPlus,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { useEntitlements } from '../features/plans/useEntitlements'
import { Badge, Button, Card, EmptyState, Field, Input, Spinner, cx } from '../components/ui'
import { formatDate, formatTime, initials, naira } from '../lib/format'
import { handlePlanError, toast, useUpgradeStore } from '../lib/stores'
import { useThemeStore } from '../lib/theme'
import { readPrefs, writePrefs } from '../lib/prefs'
import { applyTemplate } from '../lib/whatsapp'

// ---------------------------------------------------------------------------
// Page sections
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: Moon },
  { id: 'profile', label: 'Business Profile', icon: Store },
  { id: 'receipt', label: 'Receipt & Invoicing', icon: ReceiptText },
  { id: 'staff', label: 'Staff & Security', icon: ShieldCheck },
  { id: 'whatsapp', label: 'WhatsApp Reminders', icon: MessageCircle },
  { id: 'data', label: 'Data & Sync', icon: Database },
]

// ---------------------------------------------------------------------------
// Client-side preferences (no server column for these — stored on this device)
// ---------------------------------------------------------------------------

function seedOf(biz) {
  return {
    name: biz?.name ?? '',
    phone: biz?.phone ?? '',
    address: biz?.address ?? '',
    receipt_note: biz?.receipt_note ?? '',
    low_stock_default: Number(biz?.low_stock_default ?? 5),
    allow_negative_stock: Boolean(biz?.allow_negative_stock ?? true),
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function download(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows, cols) {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n')
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary-container' : 'bg-slate-300',
      )}
    >
      <span
        className={cx(
          'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded bg-surface-container-low p-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function Section({ id, icon: Icon, title, hint, action, innerRef, children }) {
  return (
    <section
      id={id}
      ref={innerRef}
      className="scroll-mt-[240px] rounded-lg border border-slate-200 bg-white p-5 shadow-lift lg:scroll-mt-52"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-teal-50 text-primary-container">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold text-slate-900">{title}</h2>
            {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function memberLabel(m, userId) {
  if (m.user_id && userId && m.user_id === userId) return 'You'
  return m.invited_email || 'Team member'
}

function memberInitials(m, user) {
  if (m.user_id && user?.id === m.user_id) return initials(user?.user_metadata?.full_name || 'You')
  const local = (m.invited_email || '').split('@')[0]
  return initials(local.replace(/[.\-_]+/g, ' ') || 'Team')
}

// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { business, businessId, user, isOwner, refresh } = useAuth()
  const { can, limit, launchAccess } = useEntitlements()
  const showUpgrade = useUpgradeStore((s) => s.show)
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  const qc = useQueryClient()

  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState(readPrefs)
  const [active, setActive] = useState(SECTIONS[0].id)
  const [modal, setModal] = useState(null) // { email, error, busy }
  const [busyMemberId, setBusyMemberId] = useState(null)

  const sectionRefs = useRef({})
  const saveRef = useRef(() => {})

  // ---- Server data --------------------------------------------------------
  const bizQuery = useQuery({
    queryKey: ['settings-business', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, phone, address, receipt_note, low_stock_default, allow_negative_stock, plan, founding_member, created_at')
        .eq('id', businessId)
        .single()
      if (error) throw error
      return data
    },
  })

  const membersQuery = useQuery({
    queryKey: ['settings-members', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_members')
        .select('id, user_id, invited_email, role, is_active, created_at')
        .eq('business_id', businessId)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })

  const productsQuery = useQuery({
    queryKey: ['settings-receipt-products', businessId],
    enabled: Boolean(businessId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, selling_price')
        .eq('business_id', businessId)
        .eq('is_archived', false)
        .order('created_at')
        .limit(3)
      if (error) throw error
      return data ?? []
    },
  })

  const owingQuery = useQuery({
    queryKey: ['settings-owing', businessId],
    enabled: Boolean(businessId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_balances')
        .select('name, balance')
        .eq('business_id', businessId)
        .gt('balance', 0)
        .order('balance', { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0] ?? null
    },
  })

  const biz = bizQuery.data ?? null

  // Seed the form once the business row arrives (or the id changes).
  useEffect(() => {
    if (biz?.id) {
      setForm(seedOf(biz))
      setDirty(false)
    }
  }, [biz?.id])

  // Scroll spy for the section nav.
  useEffect(() => {
    const onScroll = () => {
      let current = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = sectionRefs.current[s.id]
        if (el && el.getBoundingClientRect().top <= 200) current = s.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const save = async () => {
    if (!dirty || saving || !form) return
    const payload = {
      name: String(form.name || '').trim(),
      phone: String(form.phone || '').trim(),
      address: String(form.address || '').trim(),
      receipt_note: String(form.receipt_note ?? ''),
      low_stock_default: Math.max(0, Math.round(Number(form.low_stock_default) || 0)),
      allow_negative_stock: Boolean(form.allow_negative_stock),
    }
    if (!payload.name) {
      toast.error('Shop trading name is required')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('businesses').update(payload).eq('id', businessId)
    setSaving(false)
    if (error) {
      toast.error(error.message || 'Could not save settings')
      return
    }
    setForm(payload)
    setDirty(false)
    await refresh() // sidebar picks up the new business name
    qc.invalidateQueries({ queryKey: ['settings-business', businessId] })
    toast.success('Settings saved')
  }

  // Keep the latest save() reachable from the Ctrl+S listener.
  useEffect(() => {
    saveRef.current = save
  })

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const discard = () => {
    if (!biz) return
    setForm(seedOf(biz))
    setDirty(false)
    toast.info('Changes discarded')
  }

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const setPref = (patch) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      writePrefs(next)
      return next
    })

  const goTo = (id) => {
    setActive(id)
    const el = sectionRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ---- Staff ---------------------------------------------------------------
  const canStaff = can('staff')

  const toggleMember = async (m) => {
    setBusyMemberId(m.id)
    const { error } = await supabase.from('business_members').update({ is_active: !m.is_active }).eq('id', m.id)
    setBusyMemberId(null)
    if (error) {
      if (!handlePlanError(error)) toast.error(error.message || 'Could not update staff access')
      return
    }
    toast.success(m.is_active ? 'Staff access deactivated' : 'Staff access activated')
    qc.invalidateQueries({ queryKey: ['settings-members', businessId] })
  }

  const removeInvite = async (m) => {
    const label = m.invited_email || 'this invite'
    if (!window.confirm(`Remove the pending invite for ${label}? They will not be able to join until you invite them again.`)) return
    setBusyMemberId(m.id)
    const { error } = await supabase.from('business_members').delete().eq('id', m.id)
    setBusyMemberId(null)
    if (error) {
      toast.error(error.message || 'Could not remove invite')
      return
    }
    toast.success(`Invite for ${label} removed`)
    qc.invalidateQueries({ queryKey: ['settings-members', businessId] })
  }

  const addStaff = async (e) => {
    e.preventDefault()
    const email = String(modal?.email || '').trim()
    if (!email) {
      setModal((m) => ({ ...m, error: 'Email is required' }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setModal((m) => ({ ...m, error: 'Enter a valid email address' }))
      return
    }
    const members = membersQuery.data ?? []
    const alreadyInvited = members.some(
      (m) => (m.invited_email || '').trim().toLowerCase() === email.toLowerCase(),
    )
    if (alreadyInvited) {
      setModal((m) => ({ ...m, error: 'This email is already on your team list.' }))
      return
    }
    setModal((m) => ({ ...m, error: null, busy: true }))
    const { error } = await supabase
      .from('business_members')
      .insert({ business_id: businessId, invited_email: email, role: 'staff', is_active: true })
    if (error) {
      setModal((m) => ({ ...m, busy: false }))
      if (handlePlanError(error)) setModal(null) // upgrade prompt takes over
      else toast.error(error.message || 'Could not add staff')
      return
    }
    setModal(null)
    toast.success(`${email} added as staff`)
    qc.invalidateQueries({ queryKey: ['settings-members', businessId] })
  }

  // ---- Exports -------------------------------------------------------------
  const scopedRows = async () => {
    const [p, c, s] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId),
      supabase.from('customers').select('*').eq('business_id', businessId),
      supabase.from('sales').select('*').eq('business_id', businessId),
    ])
    const err = p.error || c.error || s.error
    if (err) throw err
    return { products: p.data ?? [], customers: c.data ?? [], sales: s.data ?? [] }
  }

  const backupJson = async () => {
    try {
      const rows = await scopedRows()
      const payload = { exported_at: new Date().toISOString(), business: biz, ...rows }
      download(`bizos-backup-${todayKey()}.json`, JSON.stringify(payload, null, 2), 'application/json')
      toast.success('Local backup created')
    } catch (err) {
      toast.error(err?.message || 'Export failed')
    }
  }

  const exportCsv = async (kind) => {
    try {
      const table = kind === 'products' ? 'products' : 'sales'
      const { data, error } = await supabase.from(table).select('*').eq('business_id', businessId)
      if (error) throw error
      const rows = data ?? []
      if (!rows.length) {
        toast.info(`No ${kind} to export yet`)
        return
      }
      download(
        `bizos-${kind}-${todayKey()}.csv`,
        '\ufeff' + toCsv(rows, Object.keys(rows[0])),
        'text/csv;charset=utf-8',
      )
      toast.success(`${kind === 'products' ? 'Products' : 'Sales'} CSV downloaded`)
    } catch (err) {
      toast.error(err?.message || 'Export failed')
    }
  }

  // ---- Early returns (after hooks) ----------------------------------------
  if (!isOwner) return null

  if (bizQuery.isLoading || !form) {
    if (bizQuery.error) {
      return (
        <div className="mx-auto max-w-[1280px]">
          <Card className="mx-auto max-w-lg">
            <EmptyState
              icon={AlertTriangle}
              title="Could not load your store settings"
              hint={bizQuery.error.message}
              action={<Button onClick={() => qc.invalidateQueries({ queryKey: ['settings-business', businessId] })}>Try again</Button>}
            />
          </Card>
        </div>
      )
    }
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const members = membersQuery.data ?? []
  const products = productsQuery.data ?? []
  const receiptSubtotal = products.reduce((sum, p) => sum + Number(p.selling_price || 0), 0)
  const owing = owingQuery.data
  const waText = applyTemplate(prefs.waTemplate, {
    name: owing?.name,
    amount: owing ? naira(owing.balance) : undefined,
    business: biz?.name || undefined,
  })
  const shopName = form.name || business?.name || 'your shop'

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {/* ===== Sticky header ===== */}
      <div className="sticky top-16 z-10 -mx-4 -mt-5 border-b border-slate-200 bg-background/95 px-4 pb-4 pt-5 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:-mt-7 lg:px-8 lg:pt-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="label-caps flex items-center gap-1.5">
              <span>Settings &amp; Business Profile</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-teal-700">Store Preferences</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">Store Configuration</h1>
              {dirty && <Badge tone="warn">Unsaved changes</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Configure shop identity, receipts, staff and data for <span className="font-semibold">{shopName}</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={discard} disabled={!dirty}>
              Discard Changes
            </Button>
            <Button onClick={save} disabled={!dirty || saving} loading={saving}>
              Save Settings
            </Button>
            <span className="hidden text-xs text-slate-400 xl:inline">Ctrl+S</span>
          </div>
        </div>
      </div>

      {/* ===== Nav + panels ===== */}
      <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-start">
        {/* Section nav */}
        <div className="min-w-0 lg:sticky lg:top-48">
          <p className="label-caps mb-2 hidden lg:block">Navigation</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => goTo(id)}
                aria-current={active === id ? 'true' : undefined}
                className={cx(
                  'focus-ring flex shrink-0 items-center gap-2 rounded px-3 py-2.5 text-left text-sm font-semibold transition-colors lg:w-full',
                  active === id
                    ? 'bg-primary-container text-white shadow-lift'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-primary-container hover:text-teal-700',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 hidden rounded bg-surface-container-low p-3 text-xs leading-relaxed text-slate-500 lg:block">
            <p className="font-semibold text-slate-700">Owner settings</p>
            <p className="mt-1">
              Changes apply to {shopName}. Options marked &ldquo;Saved on this device&rdquo; are browser-only.
            </p>
          </div>
        </div>

        {/* Panels */}
        <div className="min-w-0 space-y-5">
          {/* ---- 1. Appearance ---- */}
          <Section
            id="appearance"
            innerRef={(el) => {
              sectionRefs.current.appearance = el
            }}
            icon={Moon}
            title="Appearance"
            hint="How BizOs looks while you work. Applies instantly."
            action={<Badge tone="warn">Saved on this device</Badge>}
          >
            <div className="max-w-xl">
              <ToggleRow
                label="Dark mode"
                hint="Darker surfaces and softer contrast — kinder on the eyes in a dim shop or at night."
                checked={themeMode === 'dark'}
                onChange={(v) => setThemeMode(v ? 'dark' : 'light')}
              />
            </div>
          </Section>

          {/* ---- 2. Business Profile ---- */}
          <Section
            id="profile"
            innerRef={(el) => {
              sectionRefs.current.profile = el
            }}
            icon={Store}
            title="Business Profile & Identity"
            hint="The shop identity used on receipts, reports and the sidebar."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={biz.plan === 'pro' ? 'success' : 'neutral'}>
                  {String(biz.plan || 'free').toUpperCase()} PLAN
                </Badge>
                <Badge tone="neutral">
                  {biz.founding_member ? 'Founding member · ' : 'Founded '}
                  {formatDate(biz.created_at)}
                </Badge>
              </div>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shop Trading Name" hint="Required. Shown on receipts and in the sidebar.">
                <Input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Adaeze Provisions" required />
              </Field>
              <Field label="Phone" hint="Customers see this on receipts.">
                <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="0803 123 4567" inputMode="tel" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Physical Address" hint="Printed under your shop name on receipts.">
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => setField('address', e.target.value)}
                    placeholder="Shop B14, Balogun Modern Market, Lagos Island"
                    className="focus-ring w-full rounded border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary-container"
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* ---- 3. Receipt & Invoicing ---- */}
          <Section
            id="receipt"
            innerRef={(el) => {
              sectionRefs.current.receipt = el
            }}
            icon={ReceiptText}
            title="Receipt & Invoicing"
            hint="What prints on your receipts and how stock alerts behave."
            action={<Badge tone="primary">Server settings</Badge>}
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              <div className="space-y-4">
                <Field label="Receipt Note" hint="Prints at the bottom of every receipt.">
                  <textarea
                    rows={3}
                    value={form.receipt_note}
                    onChange={(e) => setField('receipt_note', e.target.value)}
                    placeholder="Thank you for your patronage"
                    className="focus-ring w-full rounded border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary-container"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Default Low-stock Alert" hint="Default alert level applied to new products.">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={form.low_stock_default}
                      onChange={(e) => setField('low_stock_default', e.target.value)}
                    />
                  </Field>
                  <div className="flex items-end">
                    <ToggleRow
                      label="Allow Negative Stock"
                      hint="Selling past available stock is allowed and flagged for review."
                      checked={form.allow_negative_stock}
                      onChange={(v) => setField('allow_negative_stock', v)}
                    />
                  </div>
                </div>

                <div className="rounded border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="label-caps">Thermal print preferences</p>
                    <Badge tone="warn">Saved on this device</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['58', '80'].map((w) => (
                      <button
                        key={w}
                        type="button"
                        aria-pressed={prefs.printWidth === w}
                        onClick={() => setPref({ printWidth: w })}
                        className={cx(
                          'focus-ring rounded border px-3 py-2 text-sm font-semibold transition-colors',
                          prefs.printWidth === w
                            ? 'border-primary-container bg-teal-50 text-teal-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-primary-container',
                        )}
                      >
                        {w}mm {w === '80' ? '(Standard)' : '(Pocket)'}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 space-y-3">
                    <ToggleRow
                      label="Auto-print receipt"
                      hint="Send the slip to the printer right after checkout."
                      checked={prefs.autoPrint}
                      onChange={(v) => setPref({ autoPrint: v })}
                    />
                    <ToggleRow
                      label="Show outstanding debt on slip"
                      hint="Appends the customer's remaining balance at the bottom."
                      checked={prefs.showDebtOnSlip}
                      onChange={(v) => setPref({ showDebtOnSlip: v })}
                    />
                  </div>
                </div>
              </div>

              {/* Live receipt preview */}
              <div>
                <p className="label-caps mb-2">Live preview</p>
                <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-700">
                  <p className="text-center font-headline text-sm font-extrabold uppercase tracking-wide text-slate-900">
                    {form.name || 'Your shop name'}
                  </p>
                  <p className="mt-1 text-center text-[11px] leading-snug text-slate-500">
                    {form.address || 'Your address'}
                    {form.phone && <span className="block">Tel: {form.phone}</span>}
                  </p>
                  <p className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                    <span>TRX #PREVIEW</span>
                    <span className="tabular">
                      {formatDate(new Date())} {formatTime(new Date())}
                    </span>
                  </p>
                  <div className="my-2 border-t border-dashed border-slate-300" />
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Item</span>
                    <span>Qty x Amt</span>
                  </div>
                  {productsQuery.isLoading ? (
                    <p className="mt-3 text-center text-slate-400">Loading products…</p>
                  ) : products.length === 0 ? (
                    <p className="mt-3 text-center text-slate-400">Add products to preview them here.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {products.map((p) => (
                        <li key={p.id} className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate">{p.name}</span>
                          <span className="tabular shrink-0 font-semibold">1 x {naira(p.selling_price)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="my-2 border-t border-dashed border-slate-300" />
                  <div className="flex justify-between font-bold">
                    <span>SUBTOTAL</span>
                    <span className="tabular">{naira(receiptSubtotal)}</span>
                  </div>
                  <p className="mt-3 text-center text-[11px] text-slate-500">
                    {form.receipt_note || 'Thank you for your patronage'}
                  </p>
                  <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-primary-container">
                    Powered by BizOs
                  </p>
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Live preview · {prefs.printWidth}mm width
                </p>
              </div>
            </div>
          </Section>

          {/* ---- 4. Staff & Security ---- */}
          <Section
            id="staff"
            innerRef={(el) => {
              sectionRefs.current.staff = el
            }}
            icon={ShieldCheck}
            title="Staff & Security"
            hint="Invite people who can sell, and switch their access off any time."
            action={
              <Button size="sm" variant="secondary" onClick={() => setModal({ email: '', error: null, busy: false })} disabled={!canStaff}>
                <UserPlus className="h-4 w-4" /> Add Staff
              </Button>
            }
          >
            {!canStaff && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <p className="text-sm text-slate-600">
                    Staff seats are part of Pro. The free plan keeps your shop owner-only.
                  </p>
                </div>
                <Button size="sm" onClick={() => showUpgrade('staff')}>
                  Unlock staff seats
                </Button>
              </div>
            )}

            {membersQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : membersQuery.isError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Could not load staff"
                hint={membersQuery.error.message}
                action={
                  <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ['settings-members', businessId] })}>
                    Try again
                  </Button>
                }
              />
            ) : members.length === 0 ? (
              <EmptyState icon={UserPlus} title="No staff yet" hint="Invite a cashier so they can record sales on your behalf." />
            ) : (
              <ul className="space-y-3">
                {members.map((m) => {
                  const isYou = Boolean(m.user_id && user?.id === m.user_id)
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 rounded bg-surface-container-low p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
                        {memberInitials(m, user)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-800">{memberLabel(m, user?.id)}</span>
                          <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>
                            {m.role === 'owner' ? 'Owner' : 'Staff'}
                          </Badge>
                          {!m.user_id && <Badge tone="warn">Pending invite</Badge>}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <Badge tone={m.is_active ? 'success' : 'neutral'} dot>
                            {m.is_active ? 'Active' : 'Deactivated'}
                          </Badge>
                          {isYou && <span>This is your account</span>}
                          {!isYou && m.created_at && <span>Added {formatDate(m.created_at)}</span>}
                          {!m.user_id && (
                            <span>
                              Hasn&rsquo;t signed up yet &mdash; they join automatically the first time they log in with this email.
                            </span>
                          )}
                        </span>
                      </span>
                      {m.role !== 'owner' && !m.user_id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyMemberId === m.id}
                          onClick={() => removeInvite(m)}
                        >
                          Remove
                        </Button>
                      )}
                      {m.role !== 'owner' && m.user_id && (
                        <Button
                          size="sm"
                          variant={m.is_active ? 'secondary' : 'soft'}
                          loading={busyMemberId === m.id}
                          onClick={() => toggleMember(m)}
                        >
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="mt-4 flex items-start gap-2 rounded bg-surface-container-low p-3 text-xs text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                {canStaff
                  ? `You can have up to ${
                      limit('max_staff') === null || limit('max_staff') === undefined
                        ? 'unlimited'
                        : limit('max_staff')
                    } staff seat${limit('max_staff') === 1 ? '' : 's'}. Deactivating someone keeps their history but blocks their access immediately.`
                  : 'Staff seats are locked on your current plan.'}
              </span>
            </p>
            {launchAccess && (
              <p className="mt-3 flex items-start gap-2 rounded bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-emerald-200">
                <Rocket className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Launch mode gives Pro staff seats while active. Your data is never deleted.</span>
              </p>
            )}
          </Section>

          {/* ---- 5. WhatsApp Reminders ---- */}
          <Section
            id="whatsapp"
            innerRef={(el) => {
              sectionRefs.current.whatsapp = el
            }}
            icon={MessageCircle}
            title="WhatsApp Reminders"
            hint="Wording used when you message customers about what they owe."
            action={<Badge tone="warn">Saved on this device</Badge>}
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <Field label="Reminder Template" hint="Placeholders: {name}, {amount}, {business}.">
                  <textarea
                    rows={5}
                    value={prefs.waTemplate}
                    onChange={(e) => setPref({ waTemplate: e.target.value })}
                    className="focus-ring w-full rounded border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 focus:border-primary-container"
                  />
                </Field>
                <ToggleRow
                  label="Instant receipt dispatch"
                  hint="Include the receipt text when you share a completed sale."
                  checked={prefs.waInstant}
                  onChange={(v) => setPref({ waInstant: v })}
                />
                <ToggleRow
                  label="Weekly overdue chase"
                  hint="Prompt you every week to chase customers with balances."
                  checked={prefs.waWeekly}
                  onChange={(v) => setPref({ waWeekly: v })}
                />
                <p className="text-xs text-slate-500">
                  Saved on this device — reminders open in WhatsApp from the Customers page using your browser or phone.
                  Nothing is sent automatically from a server.
                </p>
              </div>

              <div>
                <p className="label-caps mb-2">Preview</p>
                <div className="rounded bg-emerald-50 p-4">
                  <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-teal-600 px-4 py-3 text-sm leading-relaxed text-white shadow-lift">
                    {waText}
                  </div>
                  <p className="mt-2 text-right text-[11px] text-emerald-700">
                    {owing
                      ? `Preview using ${owing.name}'s current balance`
                      : 'No one owes you right now — showing template placeholders'}
                  </p>
                </div>
                <div className="mt-3 rounded border border-slate-200 p-3 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">How it works</p>
                  <p className="mt-1">
                    You pick the customer on the Customers page; BizOs opens a wa.me link with this message already
                    written. You press send.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* ---- 6. Data & Sync ---- */}
          <Section
            id="data"
            innerRef={(el) => {
              sectionRefs.current.data = el
            }}
            icon={Database}
            title="Data & Sync"
            hint="Exports and local backups."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <div className="flex items-center justify-between">
                  <p className="label-caps">Export</p>
                  <Download className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Business-scoped files: {shopName}, its products, customers and sales.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button size="sm" variant="secondary" onClick={backupJson}>
                    <FileJson className="h-4 w-4" /> Export JSON backup
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => exportCsv('products')}>
                      <FileSpreadsheet className="h-4 w-4" /> Products CSV
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => exportCsv('sales')}>
                      <FileSpreadsheet className="h-4 w-4" /> Sales CSV
                    </Button>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <p className="label-caps">Plan</p>
                  <Badge tone={biz.plan === 'pro' ? 'success' : 'neutral'}>
                    {String(biz.plan || 'free').toUpperCase()}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Staff seats, product limits and reports follow your plan.
                </p>
                <Link to="/settings/plan" className="mt-4 inline-block">
                  <Button size="sm" variant="secondary">
                    View plan
                  </Button>
                </Link>
              </Card>

            </div>
          </Section>

          {/* ---- Optional: hardware / settlement parity strip ---- */}
          <Card className="flex items-start gap-3 bg-surface-container-low">
            <Printer className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Hardware &amp; Settlement (Coming Soon)</p>
              <p className="mt-1 text-sm text-slate-500">
                Thermal printers, barcode scanners and bank settlement channels are not configurable yet — there is no
                live backend for them. This strip replaces those panels until they ship.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* ===== Add staff modal ===== */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"
          onClick={() => setModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add staff"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-xl bg-white p-6 shadow-lift sm:rounded-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-headline text-xl font-bold text-slate-900">Add staff</h3>
                <p className="mt-1 text-sm text-slate-600">
                  They sign in with this email and get a Staff role in {shopName}.
                </p>
              </div>
              <button onClick={() => setModal(null)} aria-label="Close" className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={addStaff} className="mt-5 space-y-4">
              <Field label="Staff email" error={modal.error}>
                <Input
                  type="email"
                  autoFocus
                  value={modal.email}
                  placeholder="name@example.com"
                  onChange={(e) => setModal((m) => ({ ...m, email: e.target.value, error: null }))}
                />
              </Field>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={modal.busy}>
                  Add staff
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
