import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { useEntitlements } from '../features/plans/useEntitlements'
import { Badge, Button, Card, EmptyState, Field, Input, Spinner, cx } from '../components/ui'
import { formatDate, formatTime, naira } from '../lib/format'
import { toast, handlePlanError } from '../lib/stores'

// ---------------------------------------------------------------------------
// Helpers (pure — every figure below comes from the queried rows)
// ---------------------------------------------------------------------------

const STATUS_FILTERS = [
  { key: 'all', label: 'All', dot: 'bg-slate-400' },
  { key: 'in', label: 'In stock', dot: 'bg-teal-600' },
  { key: 'low', label: 'Low stock', dot: 'bg-amber-500' },
  { key: 'out', label: 'Out of stock', dot: 'bg-red-500' },
]

const REASONS = {
  sale: { label: 'Sale', chip: 'bg-red-50 text-red-700', dot: 'bg-red-500', change: 'text-red-600' },
  restock: { label: 'Restock', chip: 'bg-teal-50 text-teal-700', dot: 'bg-teal-600', change: 'text-teal-700' },
  opening: { label: 'Opening stock', chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', change: 'text-slate-700' },
  correction: { label: 'Correction', chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', change: 'text-slate-700' },
  damage: { label: 'Damage', chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', change: 'text-amber-700' },
  void: { label: 'Voided sale', chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', change: 'text-amber-700' },
}

function qtyLabel(value) {
  return Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })
}

// Raw numeric text for form fields (never grouped — Number('1,450') is NaN).
function numStr(value, fallback = '0') {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : fallback
}

function statusOf(p) {
  const stock = Number(p.stock_qty)
  if (stock <= 0) return 'out'
  if (stock <= Number(p.low_stock_level)) return 'low'
  return 'in'
}

// Margin is shown in ₦ and as a % of the selling price (never of cost, so a
// zero cost price can't produce an Infinity).
function marginOf(p) {
  const cost = Number(p.cost_price)
  const sell = Number(p.selling_price)
  const amount = sell - cost
  const pct = sell > 0 ? (amount / sell) * 100 : 0
  return { amount, pct }
}

function stockBar(p) {
  const stock = Number(p.stock_qty)
  const max = Math.max(Number(p.low_stock_level) * 2, stock, 1)
  const pct = Math.max(4, Math.min(100, (stock / max) * 100))
  const state = statusOf(p)
  const color = state === 'out' ? 'bg-red-500' : state === 'low' ? 'bg-amber-500' : 'bg-teal-600'
  return { pct, color, state }
}

function productCode(id) {
  return `#${String(id ?? '').slice(-4).toUpperCase()}`
}

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-6 shadow-lift sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-headline text-xl font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="focus-ring text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit product
// ---------------------------------------------------------------------------

function ProductEditor({ mode, product, categories, businessId, onClose }) {
  const queryClient = useQueryClient()
  const isEdit = mode === 'edit'
  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    category: product?.category ?? '',
    cost_price: product ? numStr(product.cost_price) : '',
    selling_price: product ? numStr(product.selling_price) : '',
    stock_qty: product ? numStr(product.stock_qty) : '',
    low_stock_level: product ? numStr(product.low_stock_level) : '5',
  }))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()

    const next = {}
    const name = form.name.trim()
    const cost = form.cost_price.trim() === '' ? 0 : Number(form.cost_price)
    const selling = Number(form.selling_price)
    const stock = Number(form.stock_qty)
    const level = Number(form.low_stock_level)

    if (!name) next.name = 'Product name is required.'
    if (form.selling_price.trim() === '' || !Number.isFinite(selling) || selling < 0) {
      next.selling_price = 'Selling price must be 0 or more.'
    }
    if (!Number.isFinite(cost) || cost < 0) next.cost_price = 'Cost price must be 0 or more.'
    if (!isEdit && (!Number.isFinite(stock) || stock < 0)) next.stock_qty = 'Opening quantity must be 0 or more.'
    if (form.low_stock_level.trim() === '' || !Number.isFinite(level) || level < 0) {
      next.low_stock_level = 'Low stock level must be 0 or more.'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setBusy(true)
    try {
      let error
      if (isEdit) {
        ;({ error } = await supabase
          .from('products')
          .update({
            name,
            category: form.category.trim() || null,
            cost_price: cost,
            selling_price: selling,
            low_stock_level: level,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id))
      } else {
        ;({ error } = await supabase
          .from('products')
          .insert({
            business_id: businessId,
            name,
            category: form.category.trim() || null,
            cost_price: cost,
            selling_price: selling,
            stock_qty: stock,
            low_stock_level: level,
          })
          .select('id')
          .single())
      }
      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['products', businessId] })
      toast.success(isEdit ? 'Product updated' : 'Product added')
      onClose()
    } catch (err) {
      if (handlePlanError(err)) onClose()
      else toast.error(err?.message || 'Could not save the product')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit product' : 'Add product'}
      subtitle={isEdit ? 'Stock quantity is changed from Restock, not here.' : 'Add it to your catalog and start tracking stock.'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Product name" error={errors.name}>
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Indomie Chicken Noodles" autoFocus />
        </Field>

        <Field label="Category" hint="Optional — type any category, or pick one you already use.">
          <Input value={form.category} onChange={set('category')} list="product-categories" placeholder="e.g. Groceries" />
          <datalist id="product-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost price (₦)" error={errors.cost_price}>
            <Input inputMode="decimal" value={form.cost_price} onChange={set('cost_price')} placeholder="0" />
          </Field>
          <Field label="Selling price (₦)" error={errors.selling_price}>
            <Input inputMode="decimal" value={form.selling_price} onChange={set('selling_price')} placeholder="0" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={isEdit ? 'Quantity in stock' : 'Opening quantity'}
            error={errors.stock_qty}
            hint={isEdit ? 'Use Restock to change this.' : 'Units you have on the shelf today.'}
          >
            <Input
              inputMode="decimal"
              value={form.stock_qty}
              onChange={set('stock_qty')}
              placeholder="0"
              readOnly={isEdit}
              disabled={isEdit}
            />
          </Field>
          <Field label="Low stock level" error={errors.low_stock_level} hint="Alert when stock falls to this.">
            <Input inputMode="decimal" value={form.low_stock_level} onChange={set('low_stock_level')} placeholder="5" />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {isEdit ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Restock (adjust_stock RPC, owner only on the server)
// ---------------------------------------------------------------------------

function RestockModal({ product, businessId, onClose }) {
  const queryClient = useQueryClient()
  const [qty, setQty] = useState('')
  const [newCost, setNewCost] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const amount = Number(qty)
    const cost = newCost.trim() === '' ? null : Number(newCost)
    const next = {}
    if (qty.trim() === '' || !Number.isFinite(amount) || amount <= 0) next.qty = 'Enter the units received (more than 0).'
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) next.cost = 'Cost price must be 0 or more.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setBusy(true)
    try {
      const { error } = await supabase.rpc('adjust_stock', {
        p_product_id: product.id,
        p_change: amount,
        p_reason: 'restock',
        p_note: note.trim() || null,
        p_new_cost: cost,
      })
      if (error) throw error

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products', businessId] }),
        queryClient.invalidateQueries({ queryKey: ['stock_movements', businessId] }),
      ])
      toast.success('Stock updated')
      onClose()
    } catch (err) {
      if (handlePlanError(err)) onClose()
      else toast.error(err?.message || 'Could not update stock')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Restock item" subtitle={`Record incoming stock for ${product.name}.`} onClose={onClose}>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-primary-container">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <p className="truncate text-sm font-bold text-slate-800">{product.name}</p>
              <p className="tabular text-xs text-slate-500">
                Current stock: {qtyLabel(product.stock_qty)} unit{Number(product.stock_qty) === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <span className="tabular text-xs font-semibold text-slate-400">{productCode(product.id)}</span>
        </div>

        <Field label="Units received (+)" error={errors.qty}>
          <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 24" autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New cost price (₦)" error={errors.cost} hint="Optional — updates your margin.">
            <Input inputMode="decimal" value={newCost} onChange={(e) => setNewCost(e.target.value)} placeholder="Leave blank" />
          </Field>
          <Field label="Note" hint="Optional — e.g. supplier or invoice.">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Balogun wholesalers" />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Confirm restock
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DetailPanel({ product, isOwner, movements, movementsLoading, movementsError, onClose, onEdit, onRestock }) {
  const { amount, pct } = marginOf(product)
  const state = statusOf(product)
  const stock = Number(product.stock_qty)

  return (
    <Card className="space-y-4 lg:sticky lg:top-20">
      {state !== 'in' && (
        <div className={cx('flex items-start gap-2.5 rounded-lg p-3', state === 'out' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800')}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider">
              {state === 'out' ? 'Out of stock' : 'Reorder threshold reached'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed">
              {state === 'out'
                ? 'No units left — restock before the next sale.'
                : `Reorder threshold reached — ${qtyLabel(stock)} unit${stock === 1 ? '' : 's'} left.`}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-xs font-semibold text-slate-400">{productCode(product.id)}</span>
            <Badge tone={state === 'out' ? 'danger' : state === 'low' ? 'warn' : 'success'} dot>
              {state === 'out'
                ? 'Out of stock'
                : state === 'low'
                  ? `Low stock (${qtyLabel(stock)} left)`
                  : 'In stock'}
            </Badge>
          </div>
          <h2 className="mt-1 truncate font-headline text-lg font-bold text-slate-900">{product.name}</h2>
          <p className="text-sm text-slate-500">{product.category || 'Uncategorised'}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close product details"
          className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-lg bg-surface-container-low p-3.5">
        <div>
          <p className="label-caps">Selling</p>
          <p className="tabular mt-1 text-sm font-bold text-slate-900">{naira(product.selling_price)}</p>
        </div>
        <div>
          <p className="label-caps">Cost</p>
          <p className="tabular mt-1 text-sm font-bold text-slate-600">{naira(product.cost_price)}</p>
        </div>
        <div>
          <p className="label-caps">Net margin</p>
          <p className={cx('tabular mt-1 text-sm font-bold', amount < 0 ? 'text-red-600' : 'text-teal-700')}>{naira(amount)}</p>
          <p className="tabular text-[11px] text-slate-500">{pct.toFixed(1)}% return</p>
        </div>
      </div>

      {isOwner && (
        <div className="flex items-center gap-2.5">
          <Button className="flex-1" onClick={() => onRestock(product)}>
            <PackagePlus className="h-4 w-4" /> Restock item
          </Button>
          <Button variant="secondary" onClick={() => onEdit(product)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-headline text-sm font-bold text-slate-900">
            <History className="h-4 w-4 text-primary-container" /> Stock Movement Ledger
          </h3>
          <span className="label-caps">Last 12</span>
        </div>

        {movementsLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : movementsError ? (
          <p className="py-5 text-center text-sm text-slate-500">Could not load the stock history.</p>
        ) : movements.length === 0 ? (
          <p className="py-5 text-center text-sm text-slate-500">No stock movements recorded yet.</p>
        ) : (
          <div className="relative mt-3 space-y-4 before:absolute before:bottom-2 before:left-[4px] before:top-2 before:w-0.5 before:bg-slate-100">
            {movements.map((m) => {
              const r = REASONS[m.reason] ?? REASONS.correction
              const change = Number(m.change_qty)
              return (
                <div key={m.id} className="relative pl-5">
                  <span className={cx('absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full', r.dot)} />
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', r.chip)}>{r.label}</span>
                    <span className={cx('tabular text-xs font-bold', r.change)}>
                      {change > 0 ? '+' : ''}
                      {qtyLabel(change)}
                    </span>
                  </div>
                  {(m.note || m.sale_id) && (
                    <p className="truncate text-xs text-slate-500">{m.note || 'From a sale'}</p>
                  )}
                  <p className="tabular text-[11px] text-slate-400">
                    {formatDate(m.created_at)} · {formatTime(m.created_at)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const { business, businessId, isOwner } = useAuth()
  const { can, limit, tier } = useEntitlements()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState(null)
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(10)
  const [selectedId, setSelectedId] = useState(null)
  const [editor, setEditor] = useState(null) // { mode: 'add' | 'edit', product? }
  const [restocking, setRestocking] = useState(null) // product

  const productsQuery = useQuery({
    queryKey: ['products', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_archived', false)
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const products = productsQuery.data ?? []
  const selected = selectedId ? products.find((p) => p.id === selectedId) ?? null : null

  const movementsQuery = useQuery({
    queryKey: ['stock_movements', businessId, selectedId],
    enabled: Boolean(businessId && selectedId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, change_qty, reason, note, sale_id, created_at')
        .eq('business_id', businessId)
        .eq('product_id', selectedId)
        .order('created_at', { ascending: false })
        .limit(12)
      if (error) throw error
      return data ?? []
    },
  })

  // ---- Derived: counts, filters, pagination (all client-side) ----
  const query = search.trim().toLowerCase()
  const searched = query
    ? products.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(query) ||
          (p.category || '').toLowerCase().includes(query),
      )
    : products

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
  const categoryCounts = Object.fromEntries(
    categories.map((c) => [c, products.filter((p) => p.category === c).length]),
  )

  const statusCounts = { all: products.length, in: 0, low: 0, out: 0 }
  for (const p of products) statusCounts[statusOf(p)] += 1

  const statusFiltered = status === 'all' ? searched : searched.filter((p) => statusOf(p) === status)
  const filtered = category ? statusFiltered.filter((p) => p.category === category) : statusFiltered

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const current = Math.min(page, pageCount - 1)
  const start = current * perPage
  const rows = filtered.slice(start, start + perPage)

  // ---- Usage meter ----
  const unlimited = can('unlimited_products')
  const maxProducts = limit('max_products')
  const hasNumericLimit = typeof maxProducts === 'number' && maxProducts > 0
  const usagePct = hasNumericLimit ? Math.min(100, Math.round((products.length / maxProducts) * 100)) : 0

  // ---- CSV export of the rows currently in view (after filters) ----
  function exportCsv() {
    if (filtered.length === 0) {
      toast.info('Nothing to export right now.')
      return
    }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      ['Name', 'Category', 'Cost price', 'Selling price', 'Stock', 'Low stock level'].join(','),
      ...filtered.map((p) =>
        [
          esc(p.name),
          esc(p.category ?? ''),
          Number(p.cost_price),
          Number(p.selling_price),
          Number(p.stock_qty),
          Number(p.low_stock_level),
        ].join(','),
      ),
    ]
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} product${filtered.length === 1 ? '' : 's'}`)
  }

  function clearFilters() {
    setSearch('')
    setStatus('all')
    setCategory(null)
    setPage(0)
  }

  // ---- Loading / error ----
  if (productsQuery.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (productsQuery.error) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load your products"
          hint={productsQuery.error.message}
          action={<Button onClick={() => productsQuery.refetch()}>Try again</Button>}
        />
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {/* ===== Header ===== */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">Products &amp; Inventory</h1>
              <Badge tone="success" dot>Live Ledger</Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Manage your shop catalog, stock levels, and margins for{' '}
              <span className="font-semibold text-slate-900">{business?.name}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {unlimited ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-surface-container-low px-3.5 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary-container">
                  <Package className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Pro · Unlimited</p>
                  <p className="tabular text-[11px] text-slate-500">{products.length} products</p>
                </div>
              </div>
            ) : hasNumericLimit ? (
              <div className="min-w-[220px] rounded-lg bg-surface-container-low px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="font-semibold text-slate-700">
                    <span className="tabular">{products.length}</span> / <span className="tabular">{maxProducts}</span> products
                  </span>
                  <span className="tabular font-bold text-primary-container">{usagePct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${usagePct}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{tier === 'pro' ? 'Pro plan' : 'Free plan'}</p>
              </div>
            ) : (
              <div className="rounded-lg bg-surface-container-low px-3.5 py-2.5">
                <p className="text-sm font-bold text-slate-800">
                  <span className="tabular">{products.length}</span> products
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              {isOwner && (
                <Button onClick={() => setEditor({ mode: 'add' })}>
                  <Plus className="h-4 w-4" /> Add Product
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {products.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No products yet"
            hint="Add your first product to start tracking stock, margins, and restocks."
            action={isOwner ? <Button onClick={() => setEditor({ mode: 'add' })}><Plus className="h-4 w-4" /> Add Product</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          {/* ===== Filters ===== */}
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <label htmlFor="products-search" className="sr-only">Search products</label>
                <Input
                  id="products-search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  placeholder="Search by name or category…"
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-surface-container-low p-1">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setStatus(s.key)
                      setPage(0)
                    }}
                    className={cx(
                      'focus-ring flex shrink-0 items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold transition-colors',
                      status === s.key ? 'bg-white text-primary-container shadow-sm' : 'text-slate-600 hover:bg-white/70',
                    )}
                    aria-pressed={status === s.key}
                  >
                    <span className={cx('h-1.5 w-1.5 rounded-full', s.dot)} />
                    {s.label} <span className="tabular">({statusCounts[s.key]})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="label-caps shrink-0">Category:</span>
              <button
                type="button"
                onClick={() => {
                  setCategory(null)
                  setPage(0)
                }}
                className={cx(
                  'focus-ring shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  !category ? 'bg-primary-container text-white' : 'bg-surface-container-low text-slate-700 hover:bg-slate-100',
                )}
                aria-pressed={!category}
              >
                All <span className="tabular">({products.length})</span>
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c)
                    setPage(0)
                  }}
                  className={cx(
                    'focus-ring shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    category === c ? 'bg-primary-container text-white' : 'bg-surface-container-low text-slate-700 hover:bg-slate-100',
                  )}
                  aria-pressed={category === c}
                >
                  {c} <span className="tabular">({categoryCounts[c]})</span>
                </button>
              ))}
            </div>
          </Card>

          {/* ===== Table + detail panel ===== (panel column only when selected) */}
          <div className={cx('grid items-start gap-5', selectedId && 'lg:grid-cols-[1fr_320px]')}>
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container-low px-5 py-3">
                <p className="text-xs text-slate-600">
                  Showing active inventory for <span className="font-semibold">{business?.name}</span>
                </p>
                <p className="text-xs text-slate-500">
                  <span className="tabular font-semibold text-slate-700">{filtered.length}</span> of{' '}
                  <span className="tabular font-semibold text-slate-700">{products.length}</span>
                </p>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No products match"
                  hint="Try a different search term, or clear the filters to see your full catalog."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="label-caps px-5 py-3">Product</th>
                          <th className="label-caps px-3 py-3 text-right">Cost price</th>
                          <th className="label-caps px-3 py-3 text-right">Selling price</th>
                          <th className="label-caps px-3 py-3 text-right">Margin</th>
                          <th className="label-caps px-3 py-3">Stock</th>
                          <th className="label-caps whitespace-nowrap px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((p) => {
                          const { amount, pct } = marginOf(p)
                          const bar = stockBar(p)
                          const isSelected = selectedId === p.id
                          return (
                            <tr
                              key={p.id}
                              tabIndex={0}
                              onClick={() => setSelectedId(p.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedId(p.id)
                                }
                              }}
                              className={cx(
                                'focus-ring cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50',
                                isSelected && 'bg-teal-50/70',
                              )}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary-container">
                                    <Package className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold text-slate-800">{p.name}</span>
                                    <span className="block truncate text-xs text-slate-500">
                                      {p.category || 'Uncategorised'} ·{' '}
                                      <span className="tabular">{productCode(p.id)}</span>
                                    </span>
                                  </span>
                                </div>
                              </td>

                              <td className="tabular px-3 py-3 text-right text-slate-600">{naira(p.cost_price)}</td>
                              <td className="tabular px-3 py-3 text-right font-semibold text-slate-900">{naira(p.selling_price)}</td>

                              <td className="px-3 py-3 text-right">
                                <span className={cx('tabular block font-semibold', amount < 0 ? 'text-red-600' : 'text-teal-700')}>
                                  {naira(amount)}
                                </span>
                                <span className="tabular block text-[11px] text-slate-400">{pct.toFixed(1)}%</span>
                              </td>

                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="tabular w-8 text-right font-semibold text-slate-800">{qtyLabel(p.stock_qty)}</span>
                                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                    <span className={cx('block h-full rounded-full', bar.color)} style={{ width: `${bar.pct}%` }} />
                                  </span>
                                  {bar.state === 'out' && <Badge tone="danger">Out</Badge>}
                                  {bar.state === 'low' && <Badge tone="warn">Low</Badge>}
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-right">
                                {isOwner && (
                                  <div className="flex justify-end gap-1">
                                    <button
                                      type="button"
                                      aria-label={`Edit ${p.name}`}
                                      title="Edit"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditor({ mode: 'edit', product: p })
                                      }}
                                      className="focus-ring flex h-8 w-8 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Restock ${p.name}`}
                                      title="Restock"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setRestocking(p)
                                      }}
                                      className="focus-ring flex h-8 w-8 items-center justify-center rounded text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-700"
                                    >
                                      <PackagePlus className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ===== Pagination ===== */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
                    <p className="text-xs text-slate-500">
                      Showing{' '}
                      <span className="tabular font-semibold text-slate-700">
                        {start + 1}–{Math.min(start + perPage, filtered.length)}
                      </span>{' '}
                      of <span className="tabular font-semibold text-slate-700">{filtered.length}</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        Rows:
                        <select
                          value={perPage}
                          onChange={(e) => {
                            setPerPage(Number(e.target.value))
                            setPage(0)
                          }}
                          className="focus-ring rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPage(current - 1)}
                          disabled={current === 0}
                          aria-label="Previous page"
                          className="focus-ring flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="tabular px-1 text-xs font-semibold text-slate-700">
                          {current + 1} / {pageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage(current + 1)}
                          disabled={current >= pageCount - 1}
                          aria-label="Next page"
                          className="focus-ring flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Card>

            {selected && (
              <DetailPanel
                product={selected}
                isOwner={isOwner}
                movements={movementsQuery.data ?? []}
                movementsLoading={movementsQuery.isLoading}
                movementsError={movementsQuery.error}
                onClose={() => setSelectedId(null)}
                onEdit={(p) => setEditor({ mode: 'edit', product: p })}
                onRestock={(p) => setRestocking(p)}
              />
            )}
          </div>
        </>
      )}

      {/* ===== Dialogs ===== */}
      {editor && (
        <ProductEditor
          mode={editor.mode}
          product={editor.product}
          categories={categories}
          businessId={businessId}
          onClose={() => setEditor(null)}
        />
      )}
      {restocking && (
        <RestockModal product={restocking} businessId={businessId} onClose={() => setRestocking(null)} />
      )}
    </div>
  )
}
