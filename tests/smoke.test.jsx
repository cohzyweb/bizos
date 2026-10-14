import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ---- A small fake Supabase client, controlled per test ----
const state = {
  session: null,
  membership: null,
  tables: {},
  rpc: {},
  sessionFailure: null,
  sessionHang: false,
  getSessionError: null,
}

function builder(table, opts = {}) {
  const b = { _inserted: null, _updated: null, _single: false }
  for (const m of ['select', 'eq', 'gte', 'gt', 'order', 'limit']) b[m] = () => b
  b.single = () => {
    b._single = true
    return b
  }
  b.insert = (values) => {
    b._inserted = Array.isArray(values) ? values : [values]
    return b
  }
  b.update = (values) => {
    b._updated = values
    return b
  }
  b.then = (resolve) => {
    if (b._inserted) {
      const rows = b._inserted.map((v, i) => ({ id: `${table}-new-${(state.tables[table]?.length ?? 0) + i + 1}`, ...v }))
      state.tables[table] = [...(state.tables[table] ?? []), ...rows]
      return resolve({ data: b._single ? rows[0] : rows, error: null })
    }
    if (b._updated) {
      const rows = state.tables[table] ?? []
      for (const r of rows) Object.assign(r, b._updated)
      return resolve({ data: b._single ? (rows[0] ?? null) : null, error: null })
    }
    if (opts.head) return resolve({ count: state.tables[table]?.length ?? 0, error: null })
    return resolve({ data: state.tables[table] ?? [], error: null })
  }
  return b
}

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => {
        if (state.sessionFailure) throw new Error(state.sessionFailure)
        if (state.sessionHang) return new Promise(() => {})
        return { data: { session: state.session }, error: state.getSessionError ?? null }
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
      signInWithPassword: async () => ({ error: null }),
      signInWithOAuth: async () => ({ data: { url: null, user: null, session: null }, error: null }),
      signUp: async () => ({ data: {}, error: null }),
    },
    from: (table) => {
      if (table === 'business_members') {
        const b = builder(table)
        b.then = (resolve) => resolve({ data: state.membership ? [state.membership] : [], error: null })
        return b
      }
      return {
        select: (_cols, opts) => builder(table, opts),
        insert: (values) => builder(table).insert(values),
        update: (values) => builder(table).update(values),
      }
    },
    rpc: async (name) => ({ data: state.rpc[name] ?? null, error: null }),
  },
}))

import App, { queryClient } from '../src/app/App.jsx'

const session = { user: { id: 'u1', email: 'adaeze@test.ng', user_metadata: { full_name: 'Adaeze Okonkwo' } } }
const business = { id: 'b1', name: 'Adaeze Provisions', plan: 'free' }
const proLimits = { max_products: null, max_staff: 20, report_max_days: null, profit_report: true, receipt_branding: true }

function go(path) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.pushState({}, '', '/')
  queryClient.clear()
  state.session = null
  state.membership = null
  state.tables = {}
  state.rpc = {}
  state.sessionFailure = null
  state.sessionHang = false
  state.getSessionError = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('routing guards', () => {
  it('shows the marketing landing page to logged-out visitors at "/"', async () => {
    go('/')
    expect(await screen.findByRole('heading', { name: /Know your sales, your stock, and who owes you/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.queryByText('Welcome back')).not.toBeInTheDocument()
  })

  it('still shows the login page at "/login" for logged-out visitors', async () => {
    go('/login')
    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
  })

  it('offers only email sign-in on the login page (OAuth switched off)', async () => {
    go('/login')
    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Apple/ })).not.toBeInTheDocument()
    expect(screen.queryByText('or continue with email')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. adaeze@myshop.ng')).toBeInTheDocument()
  })

  it('offers only email sign-up on the signup page (OAuth switched off)', async () => {
    go('/signup')
    expect(await screen.findByText('Create your account')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Apple/ })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Adaeze Okonkwo')).toBeInTheDocument()
  })

  it('sends a logged-in user without a business to setup', async () => {
    state.session = session
    go('/')
    expect(await screen.findByText("What's your business called?")).toBeInTheDocument()
  })

  it('hides owner-only screens from staff', async () => {
    state.session = session
    state.membership = { role: 'staff', business_id: 'b1', businesses: business }
    state.rpc.get_entitlements = { tier: 'pro', launch_access: true, launch_ends_at: null, limits: proLimits }
    go('/reports')
    expect(await screen.findByText(/Good (morning|afternoon|evening), Adaeze/)).toBeInTheDocument()
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
  })
})

describe('failed OAuth callback', () => {
  it('shows the provider error and returns the user to login', async () => {
    // Supabase bounces back to "/" with error params when the round-trip
    // fails (redirect URL not allow-listed, provider disabled, consent denied).
    window.history.pushState({}, '', '/?error=access_denied&error_description=Redirect+URL+is+not+allowed')
    render(<App />)

    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Redirect URL is not allowed')
    // the failed attempt is stripped from the address bar (no replay on refresh)
    expect(window.location.pathname).toBe('/login')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
  })

  it('surfaces the error reported by the Supabase client', async () => {
    window.history.pushState({}, '', '/login')
    state.getSessionError = { message: 'Value for parameter redirect_url is not allowed' }
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Value for parameter redirect_url is not allowed')
  })

  it('never hangs on a rejected session lookup', async () => {
    window.history.pushState({}, '', '/login')
    state.sessionFailure = 'SecurityError: storage blocked'
    render(<App />)

    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('storage blocked')
  })

  it('drops the spinner when the session lookup never settles', async () => {
    vi.useFakeTimers()
    window.history.pushState({}, '', '/login')
    state.sessionHang = true
    render(<App />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })
})

describe('dashboard with data', () => {
  it('sums today, shows debts, and shows the launch banner', async () => {
    state.session = session
    state.membership = { role: 'owner', business_id: 'b1', businesses: business }
    state.rpc.get_entitlements = { tier: 'pro', launch_access: true, launch_ends_at: null, limits: proLimits }
    state.rpc.report_summary = { profit: 19800 }
    const now = new Date().toISOString()
    state.tables.sales = [
      { id: 's1', total: 12000, amount_paid: 12000, payment_type: 'cash', created_at: now },
      { id: 's2', total: 4500, amount_paid: 4500, payment_type: 'transfer', created_at: now },
      { id: 's3', total: 8000, amount_paid: 0, payment_type: 'credit', created_at: now },
    ]
    state.tables.customer_balances = [
      { customer_id: 'c1', name: 'Mama Chinedu', phone: '0803123', balance: 14200, oldest_debt_at: now },
      { customer_id: 'c2', name: 'Alhaji Bello', phone: null, balance: 25000, oldest_debt_at: now },
    ]
    go('/')
    expect(await screen.findByText('₦24,500')).toBeInTheDocument() // today's sales
    expect(screen.getByText('₦39,200')).toBeInTheDocument() // total owed
    expect(screen.getByText('₦19,800')).toBeInTheDocument() // profit (owner, pro)
    expect(screen.getByText(/Full access is free while we launch/)).toBeInTheDocument()
  })

  it('locks profit on the free plan', async () => {
    state.session = session
    state.membership = { role: 'owner', business_id: 'b1', businesses: business }
    state.rpc.get_entitlements = {
      tier: 'free',
      launch_access: false,
      launch_ends_at: null,
      limits: { max_products: 50, max_staff: 0, report_max_days: 7, profit_report: false, receipt_branding: false },
    }
    go('/')
    await screen.findByText(/Good (morning|afternoon|evening), Adaeze/)
    await waitFor(() => expect(screen.getByText('See how to unlock')).toBeInTheDocument())
    expect(screen.queryByText(/Full access is free/)).not.toBeInTheDocument()
  })
})

describe('plan page', () => {
  it('explains launch access', async () => {
    state.session = session
    state.membership = { role: 'owner', business_id: 'b1', businesses: business }
    state.rpc.get_entitlements = { tier: 'pro', launch_access: true, launch_ends_at: null, limits: proLimits }
    go('/settings/plan')
    expect(await screen.findByText(/You have full access/)).toBeInTheDocument()
    expect(screen.getByText('What becomes Pro later')).toBeInTheDocument()
  })
})

describe('capturing a WhatsApp number at the till', () => {
  const freeLimits = { max_products: 50, max_staff: 0, report_max_days: 7, profit_report: false, receipt_branding: false }

  function signInAsOwner() {
    state.session = session
    state.membership = { role: 'owner', business_id: 'b1', businesses: business }
    state.rpc.get_entitlements = { tier: 'free', launch_access: false, launch_ends_at: null, limits: freeLimits }
  }

  it('creates the customer with their number and offers to send the receipt', async () => {
    signInAsOwner()
    state.tables.products = [
      { id: 'p1', name: 'Indomie Noodles', category: 'Food', selling_price: 700, stock_qty: 12, low_stock_level: 3 },
    ]
    state.tables.customers = []
    state.rpc.record_sale = {
      id: 's1',
      receipt_no: 'ADR-0042',
      total: 1400,
      amount_paid: 1400,
      payment_type: 'cash',
      created_at: new Date().toISOString(),
    }

    go('/sale/new')
    fireEvent.click(await screen.findByRole('button', { name: 'Add Indomie Noodles to cart' }))

    // Pick "＋ New customer…" at the till and type the details once.
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: '__new' } })
    fireEvent.change(await screen.findByLabelText('New customer name'), { target: { value: 'Mama Chinedu' } })
    fireEvent.change(screen.getByLabelText('New customer WhatsApp number'), { target: { value: '0803 123 4567' } })

    fireEvent.click(screen.getByRole('button', { name: /Complete Sale/ }))

    // The receipt can go out on WhatsApp straight away...
    expect(await screen.findByText('Sale Complete!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Receipt on WhatsApp/ })).toBeInTheDocument()
    // ...and the number is saved to their record for future reminders.
    expect(state.tables.customers[0]).toMatchObject({ name: 'Mama Chinedu', phone: '0803 123 4567' })
  })

  it('offers to add a missing number for an existing customer', async () => {
    signInAsOwner()
    state.tables.products = [
      { id: 'p1', name: 'Indomie Noodles', category: 'Food', selling_price: 700, stock_qty: 12, low_stock_level: 3 },
    ]
    state.tables.customers = [{ id: 'c1', business_id: 'b1', name: 'Baba Sule', phone: null }]

    go('/sale/new')
    await screen.findByLabelText('Customer')
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'c1' } })

    expect(await screen.findByLabelText('Customer WhatsApp number')).toBeInTheDocument()
    expect(screen.getByText(/Saved to Baba Sule's record/)).toBeInTheDocument()
  })

  it('does not ask for a number when the customer already has one', async () => {
    signInAsOwner()
    state.tables.products = [
      { id: 'p1', name: 'Indomie Noodles', category: 'Food', selling_price: 700, stock_qty: 12, low_stock_level: 3 },
    ]
    state.tables.customers = [{ id: 'c1', business_id: 'b1', name: 'Baba Sule', phone: '08031234567' }]

    go('/sale/new')
    await screen.findByLabelText('Customer')
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'c1' } })

    await waitFor(() => expect(screen.queryByLabelText('Customer WhatsApp number')).not.toBeInTheDocument())
  })
})

describe('messaging a customer from their record', () => {
  const freeLimits = { max_products: 50, max_staff: 0, report_max_days: 7, profit_report: false, receipt_branding: false }

  function seedCustomer() {
    state.session = session
    state.membership = { role: 'owner', business_id: 'b1', businesses: business }
    state.rpc.get_entitlements = { tier: 'free', launch_access: false, launch_ends_at: null, limits: freeLimits }
    const now = new Date().toISOString()
    state.tables.customer_balances = [
      { customer_id: 'c1', business_id: 'b1', name: 'Baba Sule', phone: '08031234567', balance: 2000, oldest_debt_at: now },
    ]
    state.tables.sales = []
    state.tables.payments = []
  }

  it('offers status-update and saved-template presets alongside the reminders', async () => {
    seedCustomer()
    go('/customers')

    const msg = await screen.findByLabelText('WhatsApp reminder message')
    expect(screen.getByRole('button', { name: 'Polite' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Urgent' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Status update' }))
    expect(msg.value).toMatch(/Account update from Adaeze Provisions/)

    // The template saved in Settings > WhatsApp Reminders is now usable.
    fireEvent.click(screen.getByRole('button', { name: 'My template' }))
    expect(msg.value).toMatch(/Hello Baba Sule/)
  })

  it('offers to confirm a payment on WhatsApp once it is recorded', async () => {
    seedCustomer()
    state.rpc.record_payment = 1500

    go('/customers')
    fireEvent.click(await screen.findByRole('button', { name: /Record Payment/ }))
    fireEvent.change(await screen.findByLabelText('Payment amount'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /Save payment/ }))

    expect(await screen.findByRole('button', { name: /Send confirmation on WhatsApp/ })).toBeInTheDocument()
    expect(screen.getByText(/Baba Sule's balance is now/)).toBeInTheDocument()
  })

  it('lets the owner add or fix a missing WhatsApp number on the record', async () => {
    seedCustomer()
    state.tables.customer_balances[0].phone = null
    state.tables.customers = [{ id: 'c1', business_id: 'b1', name: 'Baba Sule', phone: null }]

    go('/customers')
    fireEvent.click(await screen.findByRole('button', { name: /Edit WhatsApp number/ }))
    fireEvent.change(screen.getByLabelText('Customer WhatsApp number'), { target: { value: '08123456789' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(state.tables.customers[0].phone).toBe('08123456789'))
  })
})
