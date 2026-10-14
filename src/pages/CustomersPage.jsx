import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Download,
  Eye,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Search,
  Send,
  ShoppingCart,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { Badge, Button, Card, EmptyState, Field, Input, Spinner, cx } from '../components/ui'
import { formatDate, initials, naira } from '../lib/format'
import { lagosDayKey } from '../lib/dates'
import { handlePlanError, toast } from '../lib/stores'
import { readPrefs } from '../lib/prefs'
import {
  applyTemplate,
  balanceStatusMessage,
  daysOwingSince,
  hasWhatsApp,
  paymentReceivedMessage,
  reminderTemplates,
  whatsappHref,
} from '../lib/whatsapp'

const DAY_MS = 86_400_000

const AVATAR_TONES = [
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
]

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
]

function methodLabel(method) {
  const found = PAY_METHODS.find((m) => m.value === method)
  return found ? found.label : 'Cash'
}

// Lagos (UTC+1) "now" and the start of the Lagos calendar month, as an ISO instant.
function lagosMonthStartIso() {
  const lagosNow = new Date(Date.now() + 3_600_000)
  return new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), 1) - 3_600_000).toISOString()
}

function lagosMonthName() {
  const lagosNow = new Date(Date.now() + 3_600_000)
  return lagosNow.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
}

function ageChip(balance, oldestDebtAt, nowMs) {
  if (!(balance > 0)) return null
  if (!oldestDebtAt) return { label: 'Owing', tone: 'neutral' }
  const days = Math.floor((nowMs - new Date(oldestDebtAt).getTime()) / DAY_MS)
  if (days <= 0) return { label: 'Today', tone: 'primary' }
  if (days > 7) return { label: `Overdue ${days} days`, tone: 'danger' }
  if (days > 3) return { label: `${days} days owing`, tone: 'warn' }
  return { label: `${days} day${days === 1 ? '' : 's'} owing`, tone: 'neutral' }
}

function Modal({ title, hint, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white p-6 shadow-lift sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-headline text-xl font-bold text-slate-900">{title}</h3>
            {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="focus-ring rounded text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const { business, businessId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [drafts, setDrafts] = useState({})

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const [payOpen, setPayOpen] = useState(false)
  const [amountStr, setAmountStr] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [payError, setPayError] = useState('')
  const [paying, setPaying] = useState(false)

  const [phoneEditOpen, setPhoneEditOpen] = useState(false)
  const [phoneValue, setPhoneValue] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)

  // Set after a successful payment: { amount, newBalance } — drives the
  // "tell them on WhatsApp" confirmation inside the payment modal.
  const [paid, setPaid] = useState(null)

  // ---- List data: balances (KPIs + table) and this Lagos month's payments ----
  const listQuery = useQuery({
    queryKey: ['customers-page', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const [balancesRes, paymentsRes] = await Promise.all([
        supabase
          .from('customer_balances')
          .select('customer_id, business_id, name, phone, balance, oldest_debt_at')
          .eq('business_id', businessId)
          .order('balance', { ascending: false }),
        supabase
          .from('payments')
          .select('id, customer_id, amount, method, note, created_at')
          .eq('business_id', businessId)
          .gte('created_at', lagosMonthStartIso()),
      ])
      if (balancesRes.error) throw balancesRes.error
      if (paymentsRes.error) throw paymentsRes.error
      return { balances: balancesRes.data ?? [], monthPayments: paymentsRes.data ?? [] }
    },
  })

  const balances = listQuery.data?.balances ?? []
  const monthPayments = listQuery.data?.monthPayments ?? []

  const active = useMemo(
    () => balances.find((c) => c.customer_id === selectedId) ?? balances[0] ?? null,
    [balances, selectedId],
  )

  // ---- Detail data for the selected customer ----
  const detailQuery = useQuery({
    queryKey: ['customer-detail', businessId, active?.customer_id],
    enabled: Boolean(businessId && active?.customer_id),
    queryFn: async () => {
      const [salesRes, paymentsRes] = await Promise.all([
        supabase
          .from('sales')
          .select('id, receipt_no, customer_id, payment_type, total, amount_paid, is_voided, created_at')
          .eq('business_id', businessId)
          .eq('customer_id', active.customer_id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('payments')
          .select('id, customer_id, sale_id, amount, method, note, created_at')
          .eq('business_id', businessId)
          .eq('customer_id', active.customer_id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])
      if (salesRes.error) throw salesRes.error
      if (paymentsRes.error) throw paymentsRes.error
      return { sales: salesRes.data ?? [], payments: paymentsRes.data ?? [] }
    },
  })

  const detail = detailQuery.data

  // ---- Derived numbers ----
  const nowMs = Date.now()
  const owing = balances.filter((c) => Number(c.balance) > 0)
  const clearedCount = balances.length - owing.length
  const outstanding = owing.reduce((sum, c) => sum + Number(c.balance), 0)
  const overdue = owing.filter(
    (c) => c.oldest_debt_at && nowMs - new Date(c.oldest_debt_at).getTime() > 7 * DAY_MS,
  )
  const overdueTotal = overdue.reduce((sum, c) => sum + Number(c.balance), 0)
  const recovered = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return balances.filter((c) => {
      const balance = Number(c.balance)
      if (tab === 'owing' && balance <= 0) return false
      if (tab === 'cleared' && balance > 0) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || String(c.phone ?? '').toLowerCase().includes(q)
    })
  }, [balances, tab, search])

  const activeBalance = active ? Number(active.balance) : 0
  const openSales = (detail?.sales ?? []).filter((s) => !s.is_voided && Number(s.amount_paid) < Number(s.total))
  const clearedSales = (detail?.sales ?? []).filter(
    (s) => !s.is_voided && Number(s.amount_paid) >= Number(s.total),
  )

  const ledger = useMemo(() => {
    const sales = detail?.sales ?? []
    const payments = detail?.payments ?? []
    const entries = []
    for (const s of sales) {
      const remaining = Number(s.total) - Number(s.amount_paid)
      if (s.is_voided || remaining <= 0) continue
      entries.push({
        key: `sale-${s.id}`,
        kind: 'sale',
        at: s.created_at,
        title: `Credit sale ${s.receipt_no}`,
        sub: `${formatDate(s.created_at)} · ${naira(s.total)} total`,
        amount: remaining,
        foot: `Bal ${naira(remaining)}`,
      })
    }
    for (const p of payments) {
      entries.push({
        key: `pay-${p.id}`,
        kind: 'payment',
        at: p.created_at,
        title: `Settlement · ${methodLabel(p.method)}`,
        sub: `${formatDate(p.created_at)}${p.note ? ` · ${p.note}` : ''}`,
        amount: -Number(p.amount),
        foot: 'Settled',
      })
    }
    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return entries.slice(0, 10)
  }, [detail])

  // Presets behind the composer: the two debt reminders, an anytime status
  // update ("where your account stands"), and the owner's own template from
  // Settings > WhatsApp Reminders.
  const prefs = readPrefs()
  const activeDaysOwing = active ? daysOwingSince(active.oldest_debt_at) : 0
  const templates = active
    ? {
        ...reminderTemplates({
          customerName: active.name,
          balance: activeBalance,
          shop: business?.name,
          daysOwing: activeDaysOwing,
        }),
        status: balanceStatusMessage({
          shop: business?.name,
          customerName: active.name,
          balance: activeBalance,
          daysOwing: activeDaysOwing,
          openReceipts: openSales.slice(0, 3).map((s) => s.receipt_no),
        }),
        custom: applyTemplate(prefs.waTemplate, {
          name: active.name,
          amount: naira(activeBalance),
          business: business?.name,
        }),
      }
    : null
  const MESSAGE_PRESETS = [
    ['polite', 'Polite'],
    ['urgent', 'Urgent'],
    ['status', 'Status update'],
    ['custom', 'My template'],
  ]
  const messageText = active ? (drafts[active.customer_id] ?? templates.polite) : ''
  const setDraft = (id, text) => setDrafts((prev) => ({ ...prev, [id]: text }))

  // ---- Actions ----
  async function saveCustomer(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      setAddError('Customer name is required.')
      return
    }
    setAdding(true)
    const { error } = await supabase
      .from('customers')
      .insert({ business_id: businessId, name, phone: newPhone.trim() || null })
    setAdding(false)
    if (error) {
      if (!handlePlanError(error)) toast.error(error.message)
      return
    }
    toast.success(`${name} added to your directory`)
    queryClient.invalidateQueries()
    setAddOpen(false)
    setNewName('')
    setNewPhone('')
    setAddError('')
  }

  async function confirmPayment() {
    const amount = Number(String(amountStr).replace(/,/g, ''))
    if (!(amount > 0)) {
      setPayError('Enter an amount greater than zero.')
      return
    }
    if (amount > activeBalance + 1e-9) {
      setPayError(`Payment cannot exceed the outstanding balance of ${naira(activeBalance)}.`)
      return
    }
    setPaying(true)
    const { data, error } = await supabase.rpc('record_payment', {
      p_business_id: businessId,
      p_customer_id: active.customer_id,
      p_amount: amount,
      p_method: method,
      p_note: note.trim() || null,
    })
    setPaying(false)
    if (error) {
      if (!handlePlanError(error)) toast.error(error.message)
      return
    }
    toast.success(`Payment recorded. Balance now ${naira(Number(data ?? 0))}`)
    queryClient.invalidateQueries()
    // Stay open and offer to tell the customer the payment landed.
    setPaid({ amount, newBalance: Number(data ?? 0) })
    setAmountStr('')
    setNote('')
    setPayError('')
  }

  function closePayment() {
    setPaid(null)
    setAmountStr('')
    setNote('')
    setPayError('')
    setPayOpen(false)
  }

  function sendPaymentConfirmation() {
    if (!paid || !hasWhatsApp(active?.phone)) return
    const text = paymentReceivedMessage({
      shop: business?.name,
      customerName: active.name,
      amount: paid.amount,
      newBalance: paid.newBalance,
      method,
    })
    window.open(whatsappHref(active.phone, text), '_blank', 'noopener,noreferrer')
    closePayment()
  }

  async function savePhone() {
    const phone = phoneValue.trim()
    if (phone === (active.phone ?? '')) {
      setPhoneEditOpen(false)
      return
    }
    setPhoneSaving(true)
    const { error } = await supabase.from('customers').update({ phone: phone || null }).eq('id', active.customer_id)
    setPhoneSaving(false)
    if (error) {
      if (!handlePlanError(error)) toast.error(error.message || 'Could not save the number')
      return
    }
    toast.success(phone ? `WhatsApp number saved for ${active.name}` : `Number removed for ${active.name}`)
    setPhoneEditOpen(false)
    queryClient.invalidateQueries()
  }

  function exportCsv() {
    const lines = [['Name', 'Phone', 'Balance', 'Oldest debt']]
    for (const r of rows) {
      lines.push([
        r.name,
        r.phone ?? '',
        String(Number(r.balance)),
        r.oldest_debt_at ? lagosDayKey(r.oldest_debt_at) : '',
      ])
    }
    const csv = lines
      .map((cols) => cols.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-${lagosDayKey(new Date())}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.info(`Exported ${rows.length} customer${rows.length === 1 ? '' : 's'} to CSV`)
  }

  if (!businessId || listQuery.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (listQuery.error) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load your customers"
          hint={listQuery.error.message}
          action={<Button onClick={() => listQuery.refetch()}>Try again</Button>}
        />
      </Card>
    )
  }

  const tabs = [
    { key: 'all', label: 'All', count: balances.length },
    { key: 'owing', label: 'Owing', count: owing.length },
    { key: 'cleared', label: 'Cleared', count: clearedCount },
  ]

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {/* ===== Header ===== */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">Customers &amp; Debts</h1>
            {owing.length > 0 && (
              <Badge tone="danger" dot>
                {owing.length} account{owing.length === 1 ? '' : 's'} due
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Manage customer credit books, track overdue balances, and dispatch 1-tap WhatsApp payment reminders.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      {/* ===== KPI row ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">Total outstanding debt</p>
              <p className="tabular mt-2 font-headline text-3xl font-extrabold text-red-600">
                {naira(outstanding)}
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-red-100 text-red-700">
              <Wallet className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              Across {owing.length} owing customer{owing.length === 1 ? '' : 's'}
            </p>
            {owing.length > 0 && <Badge tone="danger" dot>Outstanding</Badge>}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">Overdue &gt; 7 days</p>
              <p className="tabular mt-2 font-headline text-3xl font-extrabold text-amber-700">
                {naira(overdueTotal)}
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              {overdue.length} customer{overdue.length === 1 ? '' : 's'} require follow-up
            </p>
            {overdue.length > 0 && <Badge tone="warn" dot>Action</Badge>}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">Recovered ({lagosMonthName()})</p>
              <p className="tabular mt-2 font-headline text-3xl font-extrabold text-emerald-700">
                {naira(recovered)}
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              {monthPayments.length} debt settlement{monthPayments.length === 1 ? '' : 's'} recorded
            </p>
            <Badge tone="success">This month</Badge>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">Customer directory</p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="tabular font-headline text-3xl font-extrabold text-slate-900">
                  {balances.length}
                </span>
                <span className="text-sm text-slate-500">Registered</span>
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-primary-container">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">{clearedCount} cleared balance</p>
            <Badge tone="primary">{business?.name || 'Your shop'}</Badge>
          </div>
        </Card>
      </div>

      {/* ===== Search + tabs ===== */}
      <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name or phone number..."
            aria-label="Search customers by name or phone number"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cx(
                'focus-ring whitespace-nowrap rounded px-3 py-2 text-xs font-semibold transition-colors',
                tab === t.key
                  ? 'bg-primary-container text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </Card>

      {/* ===== Table + detail panel ===== */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 bg-surface-container-low px-5 py-3">
            <p className="label-caps text-slate-700">Active debtors book</p>
            <p className="text-xs text-slate-500">
              {rows.length} of {balances.length} customer{balances.length === 1 ? '' : 's'}
            </p>
          </div>

          {balances.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers yet"
              hint="Add your first customer to start keeping credit books and tracking repayments."
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Customer
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={tab === 'owing' && !search.trim() ? CheckCircle2 : Search}
              title={
                tab === 'owing' && !search.trim()
                  ? 'No one owes you right now'
                  : tab === 'cleared' && !search.trim()
                    ? 'No cleared customers yet'
                    : 'No customers match your search'
              }
              hint={
                tab === 'owing' && !search.trim()
                  ? 'Every balance is cleared — that is good news. Credit sales will show up here automatically.'
                  : tab === 'cleared' && !search.trim()
                    ? `Customers move here once their balance reaches ${naira(0)}.`
                    : `Nothing found for "${search.trim()}". Try another name or phone number.`
              }
              action={
                search.trim() ? (
                  <Button variant="secondary" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-3 py-3">Balance due</th>
                    <th className="px-3 py-3">Age</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, i) => {
                    const balance = Number(c.balance)
                    const age = ageChip(balance, c.oldest_debt_at, nowMs)
                    const isActive = active?.customer_id === c.customer_id
                    const rowTemplates = reminderTemplates({
                      customerName: c.name,
                      balance,
                      shop: business?.name,
                      daysOwing: daysOwingSince(c.oldest_debt_at),
                    })
                    return (
                      <tr
                        key={c.customer_id}
                        onClick={() => setSelectedId(c.customer_id)}
                        tabIndex={0}
                        aria-selected={isActive}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedId(c.customer_id)
                          }
                        }}
                        className={cx(
                          'cursor-pointer border-t border-slate-100 transition-colors focus-ring',
                          isActive ? 'bg-teal-50' : 'hover:bg-slate-50',
                        )}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={cx(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                AVATAR_TONES[i % AVATAR_TONES.length],
                              )}
                            >
                              {initials(c.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-800">{c.name}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {c.phone || 'No phone'}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {balance > 0 ? (
                            <>
                              <span className="tabular block font-semibold text-red-600">{naira(balance)}</span>
                              {c.oldest_debt_at && (
                                <span className="block text-[11px] text-slate-400">
                                  Since {formatDate(c.oldest_debt_at)}
                                </span>
                              )}
                            </>
                          ) : (
                            <Badge tone="success">Cleared</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {age ? (
                            <Badge tone={age.tone} dot={age.tone === 'danger'}>
                              {age.label}
                            </Badge>
                          ) : (
                            <Badge tone="success">Settled</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {hasWhatsApp(c.phone) && (
                              <a
                                href={whatsappHref(c.phone, rowTemplates.polite)}
                                onClick={(e) => e.stopPropagation()}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Send a WhatsApp reminder to ${c.name}`}
                                className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedId(c.customer_id)
                              }}
                            >
                              <Eye className="h-4 w-4" /> View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ===== Detail panel ===== */}
        <aside className="self-start lg:sticky lg:top-6">
          {!active ? (
            <Card>
              <EmptyState
                icon={Users}
                title="No customer selected"
                hint="Add a customer or pick a row to see their balance, sales and reminders."
              />
            </Card>
          ) : (
            <Card className="space-y-5">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-primary-container font-headline text-base font-bold text-white">
                  {initials(active.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-headline text-xl font-bold text-slate-900">{active.name}</h2>
                  {phoneEditOpen ? (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Input
                        type="tel"
                        autoFocus
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') savePhone()
                          if (e.key === 'Escape') setPhoneEditOpen(false)
                        }}
                        placeholder="e.g. 0803 123 4567"
                        aria-label="Customer WhatsApp number"
                        className="h-9 min-w-0 flex-1 text-sm"
                      />
                      <Button size="sm" onClick={savePhone} loading={phoneSaving}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPhoneEditOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneValue(active.phone ?? '')
                        setPhoneEditOpen(true)
                      }}
                      className="focus-ring group mt-0.5 flex items-center gap-1.5 rounded text-sm text-teal-700 hover:text-teal-900"
                      aria-label={`Edit WhatsApp number for ${active.name}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {active.phone || 'No number yet — tap to add'}
                      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                    </button>
                  )}
                </div>
                <Badge tone={activeBalance > 0 ? 'danger' : 'success'} dot={activeBalance > 0}>
                  {activeBalance > 0 ? 'Owing' : 'Cleared'}
                </Badge>
              </div>

              <div className="rounded bg-surface-container-low p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="label-caps">Current balance due</p>
                    <p
                      className={cx(
                        'tabular mt-1 font-headline text-3xl font-extrabold',
                        activeBalance > 0 ? 'text-red-600' : 'text-emerald-700',
                      )}
                    >
                      {naira(activeBalance)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="label-caps">Cleared sales</p>
                    <p className="tabular mt-1 font-headline text-xl font-bold text-slate-900">
                      {detailQuery.isLoading ? '—' : clearedSales.length}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {detailQuery.isLoading ? 'loading…' : `${openSales.length} open`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="label-caps">Open sales</p>
                {detailQuery.isLoading ? (
                  <div className="flex justify-center py-6">
                    <Spinner />
                  </div>
                ) : detailQuery.error ? (
                  <p className="rounded bg-red-50 p-3 text-sm text-red-600">
                    Could not load this customer's sales — try again in a moment.
                  </p>
                ) : openSales.length === 0 ? (
                  <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">
                    No open sales — this account is fully settled.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {openSales.map((s) => {
                      const remaining = Number(s.total) - Number(s.amount_paid)
                      return (
                        <li key={s.id} className="rounded border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-slate-800">{s.receipt_no}</span>
                            <span className="shrink-0 text-[11px] text-slate-500">
                              {formatDate(s.created_at)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                            <span className="text-slate-500">
                              Total <span className="tabular">{naira(s.total)}</span> · Paid{' '}
                              <span className="tabular font-semibold text-emerald-700">
                                {naira(s.amount_paid)}
                              </span>
                            </span>
                            <span className="tabular font-semibold text-red-600">
                              Remaining {naira(remaining)}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="soft"
                  disabled={activeBalance <= 0}
                  onClick={() => {
                    setAmountStr('')
                    setNote('')
                    setPayError('')
                    setPayOpen(true)
                  }}
                >
                  <Banknote className="h-4 w-4" /> Record Payment
                </Button>
                <Button variant="secondary" onClick={() => navigate('/sale/new')}>
                  <ShoppingCart className="h-4 w-4" /> Add Credit Sale
                </Button>
              </div>

              {/* WhatsApp reminder composer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp reminder
                  </p>
                  <span className="text-[11px] font-semibold text-emerald-700">Live preview</span>
                </div>
                {hasWhatsApp(active.phone) ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {MESSAGE_PRESETS.map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={messageText === templates[key]}
                          onClick={() => setDraft(active.customer_id, templates[key])}
                          className={cx(
                            'focus-ring rounded px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                            messageText === templates[key]
                              ? key === 'urgent'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500 hover:text-slate-700',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={messageText}
                      onChange={(e) => setDraft(active.customer_id, e.target.value)}
                      rows={5}
                      aria-label="WhatsApp reminder message"
                      className="focus-ring w-full rounded border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400"
                      placeholder="Write your reminder message..."
                    />
                    <a
                      href={whatsappHref(active.phone, messageText)}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring flex h-11 items-center justify-center gap-2 rounded bg-emerald-600 font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Send className="h-4 w-4" /> Send on WhatsApp
                    </a>
                  </>
                ) : (
                  <p className="rounded bg-slate-50 p-3 text-sm text-slate-500">
                    Add a WhatsApp number for this customer (top of this panel) to send reminders.
                  </p>
                )}
              </div>

              {/* Ledger & settlement log */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="label-caps text-slate-700">Ledger &amp; settlement log</p>
                  <span className="text-[11px] text-slate-400">Last {ledger.length} entries</span>
                </div>
                {ledger.length === 0 ? (
                  <p className="text-sm text-slate-500">No ledger activity yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {ledger.map((e) => (
                      <li
                        key={e.key}
                        className="flex items-start justify-between gap-3 rounded bg-surface-container-low p-3"
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span
                            className={cx(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded',
                              e.kind === 'sale'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700',
                            )}
                          >
                            {e.kind === 'sale' ? <Receipt className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-slate-800">{e.title}</span>
                            <span className="block text-[11px] text-slate-500">{e.sub}</span>
                          </span>
                        </div>
                        <span className="shrink-0 text-right">
                          <span
                            className={cx(
                              'tabular block text-xs font-bold',
                              e.amount > 0 ? 'text-red-600' : 'text-emerald-700',
                            )}
                          >
                            {e.amount > 0 ? '+' : '-'}
                            {naira(Math.abs(e.amount))}
                          </span>
                          <span className="block text-[10px] text-slate-400">{e.foot}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </aside>
      </div>

      {/* ===== Add customer modal ===== */}
      {addOpen && (
        <Modal title="Add customer" hint="Name is required. A phone number enables WhatsApp reminders." onClose={() => setAddOpen(false)}>
          <form onSubmit={saveCustomer} className="space-y-4">
            <Field label="Customer name" error={addError}>
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setAddError('')
                }}
                placeholder="e.g. Mama Chinedu"
                aria-label="Customer name"
                autoFocus
              />
            </Field>
            <Field label="Phone number (optional)" hint="Nigerian numbers starting with 0 work best for WhatsApp.">
              <Input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g. 0803 123 4567"
                aria-label="Customer phone number"
              />
            </Field>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" loading={adding}>
                Add customer
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===== Record payment modal ===== */}
      {payOpen && active && (
        <Modal
          title="Record payment"
          hint={`Payments apply to ${active.name}'s oldest sales first.`}
          onClose={closePayment}
        >
          {!paid && (
            <div className="rounded bg-slate-50 p-3">
              <p className="label-caps">Outstanding balance</p>
              <p className="tabular font-headline text-2xl font-extrabold text-red-600">{naira(activeBalance)}</p>
            </div>
          )}
          {paid ? (
            <div className="mt-4 space-y-4 text-center">
              <div>
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <p className="mt-3 font-headline text-lg font-bold text-slate-900">{naira(paid.amount)} received</p>
                <p className="text-sm text-slate-600">
                  {active.name}'s balance is now{' '}
                  <span className="tabular font-semibold text-slate-900">{naira(paid.newBalance)}</span>.
                </p>
              </div>
              {hasWhatsApp(active.phone) ? (
                <div className="space-y-2">
                  <Button className="w-full" onClick={sendPaymentConfirmation}>
                    <MessageCircle className="h-4 w-4" /> Send confirmation on WhatsApp
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={closePayment}>
                    Done
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" className="w-full" onClick={closePayment}>
                  Done
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
            <Field label="Amount" error={payError}>
              <Input
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value)
                  setPayError('')
                }}
                placeholder="0"
                aria-label="Payment amount"
                autoFocus
              />
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Method</span>
              <div className="grid grid-cols-3 gap-1.5 rounded bg-slate-100 p-1">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={method === m.value}
                    onClick={() => setMethod(m.value)}
                    className={cx(
                      'focus-ring rounded py-2 text-sm font-semibold transition-colors',
                      method === m.value
                        ? 'bg-white text-primary-container shadow-xs'
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Note (optional)">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. OPay transfer reference"
                aria-label="Payment note"
              />
            </Field>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={closePayment}>
                Cancel
              </Button>
              <Button className="flex-1" loading={paying} onClick={confirmPayment}>
                Save payment
              </Button>
            </div>
          </div>
          )}
        </Modal>
      )}
    </div>
  )
}
