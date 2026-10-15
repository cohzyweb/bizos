import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// ---- A tiny fake Supabase auth client, controlled per test ----
const state = {
  session: null,
  updateUserCalls: [],
  updateUserError: null,
}

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: null }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      updateUser: async (payload) => {
        state.updateUserCalls.push(payload)
        return { data: { user: {} }, error: state.updateUserError }
      },
    },
  },
}))

import ResetPasswordPage from '../src/features/auth/ResetPasswordPage.jsx'

const session = { user: { id: 'u1', email: 'adaeze@myshop.ng' } }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

async function fillAndSubmit(password, confirm) {
  const fields = await screen.findAllByLabelText(/password/i)
  fireEvent.change(fields[0], { target: { value: password } })
  fireEvent.change(fields[1], { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: /save new password/i }))
}

beforeEach(() => {
  state.session = session
  state.updateUserCalls = []
  state.updateUserError = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ResetPasswordPage', () => {
  it('shows the form once the recovery session is there and saves the new password', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: /set a new password/i })).toBeInTheDocument()
    expect(screen.getByText(/adaeze@myshop\.ng/)).toBeInTheDocument()

    await fillAndSubmit('newsecret1', 'newsecret1')

    await waitFor(() => expect(state.updateUserCalls).toHaveLength(1))
    expect(state.updateUserCalls[0]).toEqual({ password: 'newsecret1' })
  })

  it('rejects a password shorter than 8 characters', async () => {
    renderPage()
    await fillAndSubmit('short', 'short')

    expect(await screen.findByText(/use a password with at least 8 characters/i)).toBeInTheDocument()
    expect(state.updateUserCalls).toHaveLength(0)
  })

  it('rejects mismatched passwords', async () => {
    renderPage()
    await fillAndSubmit('newsecret1', 'newsecret2')

    expect(await screen.findByText(/must match/i)).toBeInTheDocument()
    expect(state.updateUserCalls).toHaveLength(0)
  })

  it('surfaces the error Supabase returns', async () => {
    state.updateUserError = { message: 'New password should be different from the old password.' }
    renderPage()
    await fillAndSubmit('brandnewpw1', 'brandnewpw1')

    expect(await screen.findByText(/different from the old password/i)).toBeInTheDocument()
  })

  it('tells the user the link is dead when no session ever arrives', async () => {
    vi.useFakeTimers()
    state.session = null
    renderPage()

    expect(screen.getByText(/checking your link/i)).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })

    expect(screen.getByRole('heading', { name: /link expired/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to log in/i })).toBeInTheDocument()
    expect(state.updateUserCalls).toHaveLength(0)
  })

  it('lets the user reveal the password they are typing', async () => {
    renderPage()
    const first = (await screen.findAllByLabelText(/password/i))[0]

    expect(first).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getAllByRole('button', { name: /show password/i })[0])
    expect(first).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getAllByRole('button', { name: /hide password/i })[0])
    expect(first).toHaveAttribute('type', 'password')
  })
})
