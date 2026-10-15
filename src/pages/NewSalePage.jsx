import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Minus,
  PackageOpen,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Tag,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, Spinner, cx, inputClass } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { formatDate, formatTime, naira } from '../lib/format'
import { hasWhatsApp, purchaseConfirmation, whatsappHref } from '../lib/whatsapp'
import { handlePlanError, toast } from '../lib/stores'

const PAYMENTS = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'credit', label: 'Credit (Debt)' },
  { value: 'part', label: 'Part payment' },
]
const PAYMENT_LABEL = Object.fromEntries(PAYMENTS.map((p) => [p.value, p.label]))

// Only the receipt is printed; the rest of the POS screen stays hidden.
const PRINT_CSS = `@media print{
  body *{visibility:hidden!important}
  #pos-receipt,#pos-receipt *{visibility:visible!important}
  #pos-receipt{position:absolute;left:0;top:0;width:76mm;padding:8mm 4mm;background:#fff}
}`

function newClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function NewSalePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { business, user, businessId } = useAuth()
  const searchRef = useRef(null)

  // ---- Filters ----
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  // ---- Cart ----
  const [cart, setCart] = useState([]) // {product_id, qty, name, price, stock_qty, low_stock_level}
  const [cartId, setCartId] = useState(null) // idempotency key for this cart
  const [customerId, setCustomerId] = useState('')
  // Capture the customer's WhatsApp number at the till: either by adding a
  // new customer on the spot, or filling in the number of an existing one.
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [payment, setPayment] = useState('cash')
  const [discount, setDiscount] = useState('')
  const [received, setReceived] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastSale, setLastSale] = useState(null)

  // ---- Data ----
  const productsQuery = useQuery({
    queryKey: ['pos-products', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, selling_price, stock_qty, low_stock_level')
        .eq('business_id', businessId)
        .eq('is_archived', false)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const customersQuery = useQuery({
    queryKey: ['pos-customers', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('business_id', businessId)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  // allow_negative_stock is not part of the AuthProvider business payload,
  // so read it straight from the businesses row (falls back to false).
  const settingsQuery = useQuery({
    queryKey: ['pos-business-settings', businessId],
    enabled: Boolean(businessId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('businesses')
        .select('allow_negative_stock')
        .eq('id', businessId)
        .single()
      return data ?? null
    },
  })

  const allowNegative =
    typeof business?.allow_negative_stock === 'boolean'
      ? business.allow_negative_stock
      : Boolean(settingsQuery.data?.allow_negative_stock)

  const products = productsQuery.data ?? []
  const customers = customersQuery.data ?? []
  const cashierName = (user?.user_metadata?.full_name || user?.email || 'Staff').split(' ')[0]

  // ---- Filtering ----
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort()
  const query = search.trim().toLowerCase()
  const visible = products.filter((p) => {
    const inCategory = category === 'All' || (p.category ?? '') === category
    const inSearch =
      !query || p.name.toLowerCase().includes(query) || String(p.category ?? '').toLowerCase().includes(query)
    return inCategory && inSearch
  })

  // ---- Cart math (server reprices at checkout) ----
  const byId = new Map(products.map((p) => [p.id, p]))
  const lines = cart.map((line) => {
    const live = byId.get(line.product_id)
    return {
      ...line,
      name: live?.name ?? line.name,
      price: toNumber(live?.selling_price ?? line.price),
      stock: toNumber(live?.stock_qty ?? line.stock_qty),
    }
  })
  const units = lines.reduce((sum, l) => sum + l.qty, 0)
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0)
  const discountNum = Math.max(0, Math.min(toNumber(discount), subtotal))
  const total = Math.max(subtotal - discountNum, 0)
  const receivedNum = Math.max(0, toNumber(received))
  const partPaid = payment === 'part' ? Math.min(receivedNum, total) : 0
  const change = payment === 'cash' && receivedNum > total ? receivedNum - total : 0
  const outstanding = payment === 'credit' ? total : payment === 'part' ? Math.max(total - partPaid, 0) : 0
  const requiresCustomer = payment === 'credit' || payment === 'part'
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null
  // A customer counts as picked when one is selected, or when a new one is
  // being typed at the till (credit/part sales need one either way).
  const hasCustomer = addingCustomer ? Boolean(newCustName.trim()) : Boolean(customerId)
  const canSubmit = lines.length > 0 && (!requiresCustomer || hasCustomer) && !submitting

  // ---- Cart actions ----
  function addToCart(product) {
    const stock = toNumber(product.stock_qty)
    if (stock <= 0 && !allowNegative) return
    const line = cart.find((l) => l.product_id === product.id)
    const inCart = line?.qty ?? 0
    if (!allowNegative && inCart + 1 > stock) {
      toast.info(`Only ${stock} left of ${product.name}`)
      return
    }
    const next = line
      ? cart.map((l) => (l.product_id === product.id ? { ...l, qty: inCart + 1 } : l))
      : [
          ...cart,
          {
            product_id: product.id,
            qty: 1,
            name: product.name,
            price: toNumber(product.selling_price),
            stock_qty: stock,
            low_stock_level: toNumber(product.low_stock_level),
          },
        ]
    setCart(next)
    if (!cartId) setCartId(newClientId())
  }

  function changeQty(productId, delta) {
    const line = cart.find((l) => l.product_id === productId)
    if (!line) return
    const nextQty = line.qty + delta
    if (nextQty <= 0) {
      setCart(cart.filter((l) => l.product_id !== productId))
      return
    }
    const stock = toNumber(byId.get(productId)?.stock_qty ?? line.stock_qty)
    if (delta > 0 && !allowNegative && nextQty > stock) {
      toast.info(`Only ${stock} left of ${line.name}`)
      return
    }
    setCart(cart.map((l) => (l.product_id === productId ? { ...l, qty: nextQty } : l)))
  }

  function removeLine(productId) {
    setCart(cart.filter((l) => l.product_id !== productId))
  }

  function clearCart() {
    setCart([])
    setCartId(null)
    setDiscount('')
    setReceived('')
  }

  // ---- Checkout ----
  async function completeSale() {
    if (!canSubmit) return
    const creatingNow = addingCustomer && Boolean(newCustName.trim())
    if (requiresCustomer && !customerId && !creatingNow) {
      toast.error('Select a customer for credit or part payment')
      return
    }
    // One idempotency key per cart: reused on retry, cleared after success.
    const clientId = cartId ?? newClientId()
    if (!cartId) setCartId(clientId)

    const items = lines.map((l) => ({ product_id: l.product_id, qty: l.qty }))
    const saleItems = lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price }))
    let customer = selectedCustomer

    setSubmitting(true)
    try {
      if (addingCustomer) {
        // Typed at the till: create the customer first so the sale (and their
        // WhatsApp number) land on a record receipts can be sent to.
        const name = newCustName.trim()
        if (!name) {
          toast.error('Enter the customer’s name, or pick Walk-in customer')
          return
        }
        const { data: created, error: createError } = await supabase
          .from('customers')
          .insert({ business_id: businessId, name, phone: newCustPhone.trim() || null })
          .select('id, name, phone')
          .single()
        if (createError) throw createError
        customer = created
      } else if (customerId) {
        const phone = phoneDraft.trim()
        if (phone && phone !== (selectedCustomer?.phone ?? '')) {
          // Fill in (or correct) the WhatsApp number of an existing customer.
          const { error: phoneError } = await supabase.from('customers').update({ phone }).eq('id', customerId)
          if (phoneError) throw phoneError
          customer = { ...selectedCustomer, phone }
        }
      }

      const { data, error } = await supabase.rpc('record_sale', {
        p_business_id: businessId,
        p_client_id: clientId,
        p_customer_id: customer?.id ?? null,
        p_payment_type: payment,
        p_discount: discountNum,
        p_amount_paid: payment === 'part' ? partPaid : 0,
        p_items: items,
      })
      if (error) throw error

      setLastSale({
        sale: data,
        items: saleItems,
        customer: customer ? { name: customer.name, phone: customer.phone } : null,
        change: payment === 'cash' ? change : 0,
      })
      toast.success('Sale recorded')

      setCart([])
      setCartId(null)
      setDiscount('')
      setReceived('')
      setCustomerId('')
      setAddingCustomer(false)
      setNewCustName('')
      setNewCustPhone('')
      setPhoneDraft('')
      setPayment('cash')
      queryClient.invalidateQueries()
    } catch (err) {
      if (handlePlanError(err)) return
      toast.error(err?.message || 'Could not record the sale')
    } finally {
      setSubmitting(false)
    }
  }

  function sendWhatsApp() {
    const sale = lastSale
    if (!hasWhatsApp(sale?.customer?.phone)) return
    const s = sale.sale
    // Tells the customer exactly what they got, what they paid and what is
    // left — the same wording Sales History uses.
    const text = purchaseConfirmation({
      shop: business?.name,
      customerName: sale.customer.name,
      receiptNo: s.receipt_no,
      when: `${formatDate(s.created_at)} ${formatTime(s.created_at)}`,
      items: sale.items,
      total: s.total,
      paid: s.amount_paid,
      paymentType: s.payment_type,
      note: business?.receipt_note || null,
    })
    window.open(whatsappHref(sale.customer.phone, text), '_blank', 'noopener,noreferrer')
  }

  function startNextSale() {
    setLastSale(null)
    setSearch('')
    setCategory('All')
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  // "/" focuses search, Escape closes the receipt modal
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') setLastSale(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  const paymentChip = (m) => (
    <button
      key={m.value}
      type="button"
      onClick={() => setPayment(m.value)}
      aria-pressed={payment === m.value}
      className={cx(
        'focus-ring rounded px-2 py-2 text-xs font-bold transition-colors',
        payment === m.value
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container text-slate-600 hover:bg-surface-container-high hover:text-slate-900',
      )}
    >
      {m.label}
    </button>
  )

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {/* ===== Page header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">New sale</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ring up a sale at the counter — stock and totals are confirmed when you complete it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="primary">{products.length} product{products.length === 1 ? '' : 's'}</Badge>
          <Badge tone="neutral">Cashier: {cashierName}</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ===== LEFT: product browser ===== */}
        <section className="min-w-0 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or category…"
              aria-label="Search products"
              className={cx(inputClass, 'pl-9 pr-16')}
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">
              /
            </kbd>
          </div>

          {/* Category chips (only real category values) */}
          <div className="flex items-center gap-2 overflow-x-auto rounded-lg bg-surface-container-low p-1">
            {['All', ...categories].map((cat) => {
              const count = cat === 'All' ? products.length : products.filter((p) => p.category === cat).length
              const active = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  aria-pressed={active}
                  className={cx(
                    'focus-ring flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors',
                    active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800',
                  )}
                >
                  <span>{cat}</span>
                  <span
                    className={cx(
                      'tabular rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      active ? 'bg-teal-50 text-primary-container' : 'bg-slate-200/70 text-slate-500',
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {products.length === 0 ? (
            <Card>
              <EmptyState
                icon={PackageOpen}
                title="No products yet"
                hint="Add your products and they will show up here for quick sale."
                action={<Button onClick={() => navigate('/products')}>Add a product</Button>}
              />
            </Card>
          ) : visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={Search}
                title="No products match"
                hint="Try a different search term or clear the category filter."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('')
                      setCategory('All')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((p) => {
                const stock = toNumber(p.stock_qty)
                const low = toNumber(p.low_stock_level)
                const out = stock <= 0
                const isLow = !out && stock <= low
                const blocked = out && !allowNegative
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={blocked}
                    aria-label={`Add ${p.name} to cart`}
                    className={cx(
                      'focus-ring group flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-all',
                      blocked
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:-translate-y-0.5 hover:border-primary-container hover:shadow-lift',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {p.category ? (
                        <span className="rounded bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {p.category}
                        </span>
                      ) : (
                        <span />
                      )}
                      {out ? (
                        <Badge tone={allowNegative ? 'warn' : 'danger'} dot={allowNegative}>
                          Out of stock
                        </Badge>
                      ) : (
                        <Badge tone={isLow ? 'warn' : 'success'}>{stock} left</Badge>
                      )}
                    </div>
                    <h3 className="mt-2 font-headline text-sm font-bold leading-snug text-slate-900 group-hover:text-primary-container">
                      {p.name}
                    </h3>
                    <div className="mt-4 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                      <span className="tabular font-headline text-xl font-extrabold text-slate-900">
                        {naira(p.selling_price)}
                      </span>
                      <span
                        className={cx(
                          'flex h-7 w-7 items-center justify-center rounded transition-colors',
                          blocked
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-surface-container text-primary-container group-hover:bg-primary-container group-hover:text-white',
                        )}
                      >
                        {blocked ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Showing {visible.length} of {products.length} product{products.length === 1 ? '' : 's'}
          </p>
        </section>

        {/* ===== RIGHT: cart panel ===== */}
        <aside className="min-w-0 self-start lg:sticky lg:top-24">
          <Card className="p-0">
            {/* Cart header */}
            <div className="rounded-t-lg bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-lg font-bold text-slate-900">Current Cart</h2>
                  <Badge tone="primary">
                    {lines.length} item{lines.length === 1 ? '' : 's'}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={lines.length === 0}
                  className="focus-ring flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Cashier: {cashierName} ·{' '}
                <span className="tabular font-bold text-primary-container">{units} unit{units === 1 ? '' : 's'}</span>
              </p>
            </div>

            {/* Line items */}
            <div className="max-h-[36vh] overflow-y-auto px-4 lg:max-h-[40vh]">
              {lines.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="Cart is empty" hint="Tap a product to add it here." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {lines.map((l) => {
                    const blocked = !allowNegative && l.qty >= l.stock
                    return (
                      <li key={l.product_id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{l.name}</p>
                          <p className="tabular text-xs text-slate-500">{naira(l.price)} each</p>
                          {l.stock <= 0 && (
                            <Badge tone={allowNegative ? 'warn' : 'danger'} className="mt-1">
                              {allowNegative ? 'Will go negative' : 'Out of stock'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1 rounded bg-surface-container p-0.5">
                            <button
                              type="button"
                              onClick={() => changeQty(l.product_id, -1)}
                              aria-label={`Decrease quantity of ${l.name}`}
                              className="focus-ring flex h-6 w-6 items-center justify-center rounded text-slate-700 transition-colors hover:bg-white"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="tabular w-6 text-center text-xs font-bold text-slate-900">{l.qty}</span>
                            <button
                              type="button"
                              onClick={() => changeQty(l.product_id, 1)}
                              disabled={blocked}
                              aria-label={`Increase quantity of ${l.name}`}
                              className="focus-ring flex h-6 w-6 items-center justify-center rounded text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="tabular text-sm font-bold text-slate-900">{naira(l.price * l.qty)}</span>
                            <button
                              type="button"
                              onClick={() => removeLine(l.product_id)}
                              aria-label={`Remove ${l.name} from cart`}
                              className="focus-ring flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Customer selector */}
            <div className="border-t border-slate-200 bg-surface-container-low p-4">
              <label htmlFor="pos-customer" className="label-caps flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Customer
              </label>
              <select
                id="pos-customer"
                value={addingCustomer ? '__new' : customerId}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__new') {
                    setAddingCustomer(true)
                    setCustomerId('')
                  } else {
                    setAddingCustomer(false)
                    setCustomerId(v)
                    setPhoneDraft('')
                  }
                }}
                className={cx(inputClass, 'mt-1.5')}
              >
                <option value="">Walk-in customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
                <option value="__new">＋ New customer…</option>
              </select>

              {addingCustomer && (
                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <label htmlFor="pos-new-name" className="label-caps">
                      Customer name
                    </label>
                    <Input
                      id="pos-new-name"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="e.g. Mama Chinedu"
                      aria-label="New customer name"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="pos-new-phone" className="label-caps">
                      WhatsApp number
                    </label>
                    <Input
                      id="pos-new-phone"
                      type="tel"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      placeholder="e.g. 0803 123 4567"
                      aria-label="New customer WhatsApp number"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Optional — the number you send receipts and reminders to.
                    </p>
                  </div>
                </div>
              )}

              {!addingCustomer && selectedCustomer && !selectedCustomer.phone && (
                <div className="mt-2">
                  <label htmlFor="pos-customer-phone" className="label-caps">
                    WhatsApp number
                  </label>
                  <Input
                    id="pos-customer-phone"
                    type="tel"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="e.g. 0803 123 4567"
                    aria-label="Customer WhatsApp number"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Saved to {selectedCustomer.name}'s record — needed to send the receipt and reminders.
                  </p>
                </div>
              )}

              {customersQuery.error && (
                <p className="mt-1.5 text-xs font-medium text-red-600">Could not load customers.</p>
              )}
              {requiresCustomer && !hasCustomer && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Pick a customer for credit or part payment — or add a new one.
                </p>
              )}
            </div>

            {/* Payment + totals */}
            <div className="space-y-3 p-4">
              <div>
                <p className="label-caps">Payment method</p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">{PAYMENTS.slice(0, 3).map(paymentChip)}</div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">{PAYMENTS.slice(3).map(paymentChip)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pos-discount" className="label-caps">
                    Discount (₦)
                  </label>
                  <Input
                    id="pos-discount"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="tabular mt-1.5 text-right"
                  />
                </div>
                {payment === 'cash' && (
                  <div>
                    <label htmlFor="pos-received" className="label-caps">
                      Cash received (₦)
                    </label>
                    <Input
                      id="pos-received"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      placeholder="0"
                      className="tabular mt-1.5 text-right"
                    />
                  </div>
                )}
                {payment === 'part' && (
                  <div>
                    <label htmlFor="pos-paid" className="label-caps">
                      Amount paid now (₦)
                    </label>
                    <Input
                      id="pos-paid"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      placeholder="0"
                      className="tabular mt-1.5 text-right"
                    />
                  </div>
                )}
                {(payment === 'transfer' || payment === 'pos' || payment === 'credit') && (
                  <div className="flex items-end pb-3">
                    <p className="text-xs text-slate-500">
                      {payment === 'credit'
                        ? 'Nothing is paid today — the full total is owed.'
                        : 'Paid in full automatically at checkout.'}
                    </p>
                  </div>
                )}
              </div>

              {payment === 'cash' && receivedNum > 0 && receivedNum < total && (
                <p className="text-xs font-medium text-amber-700">
                  Received amount is less than the total — {naira(total - receivedNum)} short.
                </p>
              )}
              {payment === 'cash' && change > 0 && (
                <p className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                  <span>Change to give</span>
                  <span className="tabular">{naira(change)}</span>
                </p>
              )}

              {/* Totals */}
              <div className="space-y-1.5 border-t border-slate-200 pt-3 text-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span>
                    Subtotal ({lines.length} item{lines.length === 1 ? '' : 's'}, {units} unit
                    {units === 1 ? '' : 's'})
                  </span>
                  <span className="tabular font-semibold text-slate-800">{naira(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Tag className="h-3.5 w-3.5" /> Discount
                  </span>
                  <span className="tabular font-bold">{discountNum > 0 ? `-${naira(discountNum)}` : naira(0)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
                  <span className="font-headline text-base font-bold text-slate-900">Total Payable</span>
                  <span className="tabular font-headline text-3xl font-extrabold text-primary">{naira(total)}</span>
                </div>
                {(payment === 'credit' || payment === 'part') && outstanding > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="label-caps">Outstanding after sale</span>
                    <span className="tabular text-sm font-bold text-red-600">{naira(outstanding)}</span>
                  </div>
                )}
              </div>

              <Button size="lg" className="w-full" onClick={completeSale} disabled={!canSubmit} loading={submitting}>
                <Zap className="h-5 w-5" /> Complete Sale
              </Button>

              <p className="text-center text-[11px] text-slate-400">
                {lines.length === 0
                  ? 'Add at least one product to check out.'
                  : requiresCustomer && !customerId
                    ? 'Pick a customer before completing this sale.'
                    : 'Prices and stock are confirmed by the server at checkout.'}
              </p>
            </div>
          </Card>
        </aside>
      </div>

      {/* ===== Success modal ===== */}
      {lastSale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Sale complete"
        >
          <style>{PRINT_CSS}</style>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-lift">
            <div className="flex flex-col md:flex-row">
              {/* Thermal receipt */}
              <div id="pos-receipt" className="bg-[#FEFDF9] p-5 md:w-[300px]">
                <div className="text-center">
                  <p className="font-headline text-lg font-extrabold uppercase text-slate-900">
                    {business?.name || 'Receipt'}
                  </p>
                  {business?.address && <p className="text-[11px] text-slate-500">{business.address}</p>}
                  {business?.phone && <p className="text-[11px] text-slate-500">Tel: {business.phone}</p>}
                </div>
                <div className="mt-3 flex justify-between border-b border-dashed border-slate-300 pb-1.5 text-[11px] text-slate-500">
                  <span className="tabular">#{lastSale.sale.receipt_no}</span>
                  <span className="tabular">
                    {formatDate(lastSale.sale.created_at)} {formatTime(lastSale.sale.created_at)}
                  </span>
                </div>
                <ul className="space-y-1 border-b border-dashed border-slate-300 py-2 text-[12px]">
                  {lastSale.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">
                        {it.qty}× {it.name}
                      </span>
                      <span className="tabular font-bold">{naira(it.qty * it.price)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1 pt-2 text-[12px]">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Subtotal</dt>
                    <dd className="tabular">{naira(lastSale.sale.subtotal)}</dd>
                  </div>
                  {toNumber(lastSale.sale.discount) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Discount</dt>
                      <dd className="tabular">-{naira(lastSale.sale.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-dashed border-slate-300 pt-1.5 text-sm font-bold text-slate-900">
                    <dt>Total</dt>
                    <dd className="tabular">{naira(lastSale.sale.total)}</dd>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <dt>Paid ({PAYMENT_LABEL[lastSale.sale.payment_type] ?? lastSale.sale.payment_type})</dt>
                    <dd className="tabular">{naira(lastSale.sale.amount_paid)}</dd>
                  </div>
                  {lastSale.change > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <dt>Change</dt>
                      <dd className="tabular">{naira(lastSale.change)}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 text-center text-[10px] text-slate-400">
                  {lastSale.customer?.name ? `Customer: ${lastSale.customer.name}` : 'Walk-in customer'}
                  <br />
                  {business?.receipt_note || 'Thank you for your patronage'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="font-headline text-lg font-extrabold text-slate-900">Sale Complete!</h3>
                      <p className="text-sm font-semibold text-emerald-700">
                        Receipt {lastSale.sale.receipt_no} recorded
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastSale(null)}
                    aria-label="Close receipt"
                    className="focus-ring rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-1.5 rounded-lg bg-surface-container-low p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="label-caps">Customer</span>
                    <span className="truncate font-semibold text-slate-800">
                      {lastSale.customer?.name || 'Walk-in customer'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="label-caps">Total paid</span>
                    <span className="tabular font-bold text-slate-900">
                      {naira(lastSale.sale.amount_paid)} / {naira(lastSale.sale.total)}
                    </span>
                  </div>
                  {toNumber(lastSale.sale.total) - toNumber(lastSale.sale.amount_paid) > 0 && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="label-caps">Outstanding</span>
                      <span className="tabular font-bold text-red-600">
                        {naira(toNumber(lastSale.sale.total) - toNumber(lastSale.sale.amount_paid))}
                      </span>
                    </div>
                  )}
                  {hasWhatsApp(lastSale.customer?.phone) && (
                    <p className="text-xs text-slate-500">
                      Send {lastSale.customer.name || 'the customer'} the full itemised receipt on WhatsApp —
                      {lastSale.customer.phone}.
                    </p>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {hasWhatsApp(lastSale.customer?.phone) && (
                    <Button variant="soft" className="w-full" onClick={sendWhatsApp}>
                      <MessageCircle className="h-4 w-4" /> Send Receipt on WhatsApp
                    </Button>
                  )}
                  <Button variant="secondary" className="w-full" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Print Receipt
                  </Button>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <Button size="lg" className="w-full" onClick={startNextSale}>
                    <ShoppingBag className="h-5 w-5" /> Start Next Sale
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
