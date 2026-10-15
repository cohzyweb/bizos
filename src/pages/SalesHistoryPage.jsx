import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, Download, MessageCircle, Printer, Receipt, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { Badge, Button, Card, EmptyState, Field, Spinner, cx } from '../components/ui'
import { formatDate, formatTime, naira } from '../lib/format'
import { lagosDayKey, lagosDayStart } from '../lib/dates'
import { handlePlanError, toast } from '../lib/stores'
import { hasWhatsApp, purchaseConfirmation, waDigits, whatsappHref } from '../lib/whatsapp'

// ---------------------------------------------------------------------------
// Constants & small helpers
// ---------------------------------------------------------------------------

const DATE_CHIPS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All' },
]

const METHOD_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'cash', label: 'Cash' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'pos', label: 'POS' },
  { key: 'credit', label: 'Credit' },
  { key: 'part', label: 'Part' },
]

const METHOD_LABEL = {
  cash: 'Cash',
  transfer: 'Transfer',
  pos: 'POS',
  credit: 'Credit',
  part: 'Part payment',
}

const METHOD_TONE = {
  cash: 'success',
  transfer: 'primary',
  pos: 'primary',
  credit: 'danger',
  part: 'warn',
}

// The first four channels make up the payment-mix KPI (part payments are rare).
const MIX_METHODS = ['cash', 'transfer', 'pos', 'credit']

function monthStartLagos() {
  const lagosNow = new Date(Date.now() + 3_600_000)
  return new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), 1) - 3_600_000)
}

// [start, end] instants (end exclusive) for a date chip. null = unbounded.
function rangeBounds(key) {
  if (key === 'today') return [lagosDayStart(0), null]
  if (key === 'yesterday') return [lagosDayStart(-1), lagosDayStart(0)]
  if (key === '7d') return [lagosDayStart(-6), null]
  if (key === 'month') return [monthStartLagos(), null]
  return [null, null]
}

function inRange(sale, range) {
  const [start, end] = rangeBounds(range)
  const t = new Date(sale.created_at).getTime()
  if (start && t < start.getTime()) return false
  if (end && t >= end.getTime()) return false
  return true
}

function customerOf(sale) {
  return sale.customers || null
}

function paymentBadge(sale) {
  if (sale.is_voided) return <Badge tone="neutral">Voided</Badge>
  return <Badge tone={METHOD_TONE[sale.payment_type] || 'neutral'}>{METHOD_LABEL[sale.payment_type] || sale.payment_type}</Badge>
}

function statusBadge(sale) {
  if (sale.is_voided) return <Badge tone="neutral">Voided</Badge>
  return <Badge tone="success">Completed</Badge>
}

function itemsSummary(items = []) {
  const units = items.reduce((n, i) => n + Number(i.qty || 0), 0)
  const names = items.slice(0, 2).map((i) => i.product_name)
  const extra = items.length - names.length
  return {
    head: `${items.length} item${items.length === 1 ? '' : 's'} (${units} unit${units === 1 ? '' : 's'})`,
    names: names.length ? names.join(', ') + (extra > 0 ? ` +${extra} more` : '') : '',
  }
}

// Itemised "state of the goods" message — same wording as the POS sends.
function receiptWhatsappLink(sale, items, business) {
  const customer = customerOf(sale)
  if (!hasWhatsApp(customer?.phone)) return null
  const text = purchaseConfirmation({
    shop: business?.name,
    customerName: customer?.name,
    receiptNo: sale.receipt_no,
    when: `${formatDate(sale.created_at)} ${formatTime(sale.created_at)}`,
    items: (items || []).map((i) => ({ name: i.product_name, qty: i.qty, lineTotal: i.line_total })),
    total: sale.total,
    paid: sale.amount_paid,
    paymentType: sale.payment_type,
    note: business?.receipt_note || null,
  })
  return whatsappHref(customer.phone, text)
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SalesHistoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { business, businessId, isOwner } = useAuth()

  const [search, setSearch] = useState('')
  const [range, setRange] = useState('today')
  const [method, setMethod] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState('')
  const [voidBusy, setVoidBusy] = useState(false)

  // Escape closes the void dialog (it is the only focus trap we render).
  useEffect(() => {
    if (!voidOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !voidBusy) setVoidOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [voidOpen, voidBusy])

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-history', businessId],
    enabled: Boolean(businessId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const [salesRes, itemsRes] = await Promise.all([
        supabase
          .from('sales')
          .select(
            'id, receipt_no, payment_type, subtotal, discount, total, amount_paid, is_voided, void_reason, created_at, customer_id, customers(name, phone)',
          )
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        supabase
          .from('sale_items')
          .select('id, sale_id, product_name, qty, unit_price, line_total')
          .eq('business_id', businessId),
      ])
      if (salesRes.error) throw salesRes.error
      if (itemsRes.error) throw itemsRes.error

      const bySale = {}
      for (const it of itemsRes.data || []) {
        if (!bySale[it.sale_id]) bySale[it.sale_id] = []
        bySale[it.sale_id].push(it)
      }
      return { sales: salesRes.data || [], bySale }
    },
  })

  const sales = data?.sales || []
  const bySale = data?.bySale || {}

  // ---- Client-side filtering (search, date chips, method chips) ----
  const dateRows = useMemo(() => sales.filter((s) => inRange(s, range)), [sales, range])

  const methodCounts = useMemo(() => {
    const counts = { all: dateRows.length }
    for (const s of dateRows) counts[s.payment_type] = (counts[s.payment_type] || 0) + 1
    return counts
  }, [dateRows])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dateRows.filter((s) => {
      if (method !== 'all' && s.payment_type !== method) return false
      if (q) {
        const name = customerOf(s)?.name || ''
        if (!s.receipt_no?.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [dateRows, method, search])

  const selected = selectedId ? sales.find((s) => s.id === selectedId) || null : null
  const selectedItems = selected ? bySale[selected.id] || [] : []

  // ---- KPIs ----
  const todayKey = lagosDayKey(new Date())
  const todaySales = sales.filter((s) => !s.is_voided && lagosDayKey(s.created_at) === todayKey)
  const grossToday = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0)

  const mix = MIX_METHODS.map((m) => {
    const list = todaySales.filter((s) => s.payment_type === m)
    return { key: m, label: METHOD_LABEL[m], count: list.length, sum: list.reduce((a, s) => a + Number(s.total || 0), 0) }
  }).filter((m) => m.count > 0)
  const mixTotal = mix.reduce((a, m) => a + m.sum, 0)

  const outstandingRows = sales.filter((s) => !s.is_voided && Number(s.total) - Number(s.amount_paid) > 0)
  const outstanding = outstandingRows.reduce((sum, s) => sum + (Number(s.total) - Number(s.amount_paid)), 0)

  const voidedInRange = dateRows.filter((s) => s.is_voided).length
  const sendable = rows.filter((s) => !s.is_voided && waDigits(customerOf(s)?.phone)).length

  // ---- Handlers ----
  function exportCsv() {
    try {
      const head = ['Receipt #', 'Date', 'Time', 'Customer', 'Payment type', 'Total', 'Paid', 'Status']
      const lines = [head, ...rows.map((s) => [
        s.receipt_no,
        formatDate(s.created_at),
        formatTime(s.created_at),
        customerOf(s)?.name || 'Walk-in',
        METHOD_LABEL[s.payment_type] || s.payment_type,
        Number(s.total),
        Number(s.amount_paid),
        s.is_voided ? 'Voided' : 'Completed',
      ])]
      const csv = lines.map((r) => r.map(csvCell).join(',')).join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sales-${todayKey}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.info(`Exported ${rows.length} sale${rows.length === 1 ? '' : 's'}`)
    } catch {
      toast.error('Could not export CSV in this browser')
    }
  }

  function openVoid() {
    setVoidReason('')
    setVoidError('')
    setVoidOpen(true)
  }

  async function confirmVoid() {
    const reason = voidReason.trim()
    if (!reason) {
      setVoidError('Reason required')
      return
    }
    setVoidBusy(true)
    const { error: err } = await supabase.rpc('void_sale', { p_sale_id: selected.id, p_reason: reason })
    setVoidBusy(false)
    if (err) {
      if (!handlePlanError(err)) toast.error(err.message || 'Could not void this sale')
      return
    }
    toast.success('Sale voided and stock restored')
    setVoidOpen(false)
    setVoidReason('')
    queryClient.invalidateQueries({ queryKey: ['sales-history', businessId] })
  }

  // ---- Loading / error ----
  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (error) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load your sales"
          hint={error.message}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {/* Print: when a slip is open, show only the receipt on paper (thermal 80mm look). */}
      {selected && (
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .slip-print, .slip-print * { visibility: visible !important; }
            .slip-print { position: fixed !important; left: 0 !important; top: 0 !important; width: 72mm !important; box-shadow: none !important; }
          }
        `}</style>
      )}

      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">Sales History &amp; Receipts</h1>
            <Badge tone="success" dot>Live sync active</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Audit completed retail transactions, track payment channels, reprint thermal slips, and reissue digital
            WhatsApp receipts for <span className="font-semibold">{business?.name}</span>.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* ===== KPI row ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-brand-gradient p-5 text-white shadow-lift">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-200">Today&apos;s gross sales</p>
          <p className="tabular mt-2 font-headline text-3xl font-extrabold">{naira(grossToday)}</p>
          <p className="mt-1 text-sm text-teal-200">
            {todaySales.length} sale{todaySales.length === 1 ? '' : 's'} recorded
          </p>
        </div>

        <Card>
          <p className="label-caps">Payment mix</p>
          {mix.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No sales yet today.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {mix.map((m, i) => (
                <div key={m.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <span className={cx('h-2 w-2 rounded-full', ['bg-teal-700', 'bg-teal-500', 'bg-teal-300', 'bg-amber-500'][i] || 'bg-teal-700')} />
                      {m.label}
                      <span className="tabular font-normal text-slate-400">· {m.count}</span>
                    </span>
                    <span className="tabular font-semibold text-slate-900">{naira(m.sum)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div
                      className={cx('h-full rounded-full', ['bg-teal-700', 'bg-teal-500', 'bg-teal-300', 'bg-amber-500'][i] || 'bg-teal-700')}
                      style={{ width: `${mixTotal ? Math.max(4, (m.sum / mixTotal) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <p className="label-caps">Outstanding</p>
          <p className={cx('tabular mt-2 font-headline text-3xl font-extrabold', outstanding > 0 ? 'text-red-600' : 'text-teal-700')}>
            {naira(outstanding)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {outstanding > 0
              ? `${outstandingRows.length} sale${outstandingRows.length === 1 ? '' : 's'} still owed`
              : 'Everything is fully paid'}
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="label-caps">Voided</p>
            {voidedInRange > 0 && <Badge tone="neutral">{voidedInRange}</Badge>}
          </div>
          <p className="tabular mt-2 font-headline text-3xl font-extrabold text-slate-900">{voidedInRange}</p>
          <p className="mt-1 text-xs text-slate-500">
            in {DATE_CHIPS.find((c) => c.key === range)?.label.toLowerCase()} view
          </p>
        </Card>
      </div>

      {/* ===== Filter card ===== */}
      <Card className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="sales-search" className="sr-only">Search sales</label>
          <input
            id="sales-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt number or customer..."
            className="focus-ring h-11 w-full rounded border border-slate-200 bg-white pl-9 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-container"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {DATE_CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => setRange(c.key)}
              aria-pressed={range === c.key}
              className={cx(
                'focus-ring rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                range === c.key ? 'bg-primary-container text-white' : 'bg-surface-container-low text-slate-600 hover:bg-slate-100',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
          {METHOD_CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => setMethod(c.key)}
              aria-pressed={method === c.key}
              className={cx(
                'focus-ring shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                method === c.key ? 'bg-primary-container text-white' : 'bg-surface-container-low text-slate-600 hover:bg-slate-100',
              )}
            >
              {c.label} ({methodCounts[c.key] || 0})
            </button>
          ))}
        </div>
      </Card>

      {/* ===== Table + slip panel ===== (slip column only when selected) */}
      <div className={cx('grid items-start gap-5', selectedId && 'lg:grid-cols-[1fr_340px]')}>
        {/* --- Transactions table --- */}
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
            <p className="text-sm font-semibold text-slate-800">
              {rows.length} transaction{rows.length === 1 ? '' : 's'} in view
            </p>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <MessageCircle className="h-4 w-4" /> {sendable} receipt{sendable === 1 ? '' : 's'} ready to send
            </span>
          </div>

          {sales.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No sales recorded yet"
              hint="Record your first sale and it will show up here with its receipt."
              action={<Button onClick={() => navigate('/sale/new')}>Record a sale</Button>}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title={range === 'today' && method === 'all' && !search ? 'No sales yet today' : 'No sales match your filters'}
              hint={
                range === 'today' && method === 'all' && !search
                  ? 'Sales you record today will appear here the moment you complete them.'
                  : 'Try a different date range, payment method, or search term.'
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('')
                      setMethod('all')
                      setRange('all')
                    }}
                  >
                    Clear filters
                  </Button>
                  <Button onClick={() => navigate('/sale/new')}>Record a sale</Button>
                </div>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="label-caps px-5 py-3">Receipt # / Time</th>
                    <th className="label-caps px-3 py-3">Customer</th>
                    <th className="label-caps px-3 py-3">Items summary</th>
                    <th className="label-caps px-3 py-3">Payment method</th>
                    <th className="label-caps px-3 py-3 text-right">Amount</th>
                    <th className="label-caps whitespace-nowrap px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const items = bySale[s.id] || []
                    const summary = itemsSummary(items)
                    const balance = Number(s.total) - Number(s.amount_paid)
                    const isSelected = s.id === selectedId
                    return (
                      <tr
                        key={s.id}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => setSelectedId(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedId(s.id)
                          }
                        }}
                        className={cx(
                          'focus-ring cursor-pointer border-t border-slate-100 transition-colors',
                          isSelected ? 'bg-teal-50' : 'hover:bg-slate-50',
                          s.is_voided && 'opacity-60',
                        )}
                      >
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="tabular block font-semibold text-slate-800">{s.receipt_no}</span>
                          <span className="tabular block text-xs text-slate-500">{formatTime(s.created_at)}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{customerOf(s)?.name || 'Walk-in'}</td>
                        <td className="px-3 py-3 text-slate-600">
                          <span className="tabular block">{summary.head}</span>
                          {summary.names && <span className="block max-w-[150px] truncate text-xs text-slate-400">{summary.names}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{paymentBadge(s)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="tabular block font-semibold text-slate-900">{naira(s.total)}</span>
                          {!s.is_voided && balance > 0 && (
                            <span className="tabular block text-xs font-semibold text-red-600">{naira(balance)} balance</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-center">{statusBadge(s)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-200 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {rows.length} of {sales.length} sale{sales.length === 1 ? '' : 's'}
            </p>
          </div>
        </Card>

        {/* --- Receipt slip panel --- */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {!selected ? (
            <Card className="p-0">
              <EmptyState
                icon={Receipt}
                title="Select a sale to view its receipt"
                hint="Click any row in the table to open its thermal slip."
              />
            </Card>
          ) : (
            <>
              <Card className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Receipt className="h-5 w-5 shrink-0 text-primary-container" />
                    <span className="truncate font-headline text-base font-bold text-slate-900">Slip {selected.receipt_no}</span>
                    {statusBadge(selected)}
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    aria-label="Close receipt panel"
                    className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                  {hasWhatsApp(customerOf(selected)?.phone) ? (
                    <a
                      href={receiptWhatsappLink(selected, selectedItems, business)}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded bg-emerald-100 px-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-200"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  ) : (
                    <Button size="sm" variant="soft" disabled title="No customer phone on this sale">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </Button>
                  )}
                </div>

                {isOwner && !selected.is_voided && (
                  <Button size="sm" variant="danger" className="w-full" onClick={openVoid}>
                    <Ban className="h-4 w-4" /> Void sale
                  </Button>
                )}
              </Card>

              {/* Thermal receipt */}
              <div className="slip-print select-none rounded-lg border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-700 shadow-lift">
                <div className="text-center">
                  <p className="font-headline text-sm font-extrabold uppercase tracking-wider text-slate-900">{business?.name}</p>
                  {business?.address && <p className="text-slate-500">{business.address}</p>}
                  {business?.phone && <p className="tabular text-slate-500">Tel: {business.phone}</p>}
                </div>

                <div className="my-3 border-t border-dashed border-slate-300" />

                <div className="tabular flex justify-between gap-2">
                  <span>
                    Receipt <span className="font-bold">{selected.receipt_no}</span>
                  </span>
                  <span>
                    {formatDate(selected.created_at)} {formatTime(selected.created_at)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between gap-2">
                  <span>Customer</span>
                  <span className="font-semibold">{customerOf(selected)?.name || 'Walk-in'}</span>
                </div>

                <div className="my-3 border-t border-dashed border-slate-300" />

                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {selectedItems.length === 0 && <p className="text-slate-400">No item details for this sale.</p>}
                  {selectedItems.map((it) => (
                    <div key={it.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{it.product_name}</p>
                        <p className="tabular text-[10px] text-slate-500">
                          {Number(it.qty)} × {naira(it.unit_price)}
                        </p>
                      </div>
                      <span className="tabular shrink-0 font-semibold">{naira(it.line_total)}</span>
                    </div>
                  ))}
                </div>

                <div className="my-3 border-t border-dashed border-slate-300" />

                <div className="tabular space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{naira(selected.subtotal)}</span>
                  </div>
                  {Number(selected.discount) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount</span>
                      <span>-{naira(selected.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1 text-[13px] font-bold text-slate-900">
                    <span>Total</span>
                    <span>{naira(selected.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount paid</span>
                    <span>{naira(selected.amount_paid)}</span>
                  </div>
                  {Number(selected.total) - Number(selected.amount_paid) > 0 && !selected.is_voided && (
                    <div className="flex justify-between font-semibold text-red-600">
                      <span>Balance due</span>
                      <span>{naira(Number(selected.total) - Number(selected.amount_paid))}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Payment</span>
                    <span className="font-semibold">{METHOD_LABEL[selected.payment_type] || selected.payment_type}</span>
                  </div>
                </div>

                {selected.is_voided && (
                  <div className="my-3 border-t border-dashed border-slate-300" />
                )}
                {selected.is_voided && (
                  <div className="rounded bg-red-50 p-2 text-center text-[11px] font-bold uppercase tracking-widest text-red-600">
                    Voided{selected.void_reason ? ` — ${selected.void_reason}` : ''}
                  </div>
                )}

                {business?.receipt_note && (
                  <>
                    <div className="my-3 border-t border-dashed border-slate-300" />
                    <p className="text-center text-[11px] font-semibold text-slate-600">{business.receipt_note}</p>
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ===== Void modal ===== */}
      {voidOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !voidBusy) setVoidOpen(false)
          }}
        >
          <Card className="w-full max-w-md shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="void-title" className="font-headline text-lg font-bold text-slate-900">
                  Void sale {selected.receipt_no}?
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Stock will be restored and the sale will be marked as voided. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setVoidOpen(false)}
                aria-label="Close void dialog"
                className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <Field label="Reason for voiding" error={voidError}>
                <textarea
                  rows={3}
                  value={voidReason}
                  onChange={(e) => {
                    setVoidReason(e.target.value)
                    if (voidError) setVoidError('')
                  }}
                  placeholder="e.g. Customer returned the goods"
                  className="focus-ring w-full rounded border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-container"
                />
              </Field>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setVoidOpen(false)} disabled={voidBusy}>
                Cancel
              </Button>
              <Button variant="solidDanger" loading={voidBusy} onClick={confirmVoid}>
                <Ban className="h-4 w-4" /> Void sale
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
