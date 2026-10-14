// WhatsApp helpers shared by every screen that messages a customer:
// number normalising, wa.me links, and the actual wording (purchase
// confirmations, balance/status updates, debt reminders). Keeping the copy in
// one place means the POS, Customers, Dashboard and Sales History all say the
// same thing — and it can be unit-tested here.
import { naira } from './format'

const PAYMENT_LABEL = {
  cash: 'Cash',
  transfer: 'Transfer',
  pos: 'POS',
  credit: 'Credit',
  part: 'Part payment',
}

export function paymentLabel(type) {
  return PAYMENT_LABEL[type] ?? type ?? ''
}

// "0803 123 4567" -> "2348031234567": wa.me wants international digits.
export function waDigits(phone) {
  return String(phone ?? '')
    .replace(/\D/g, '')
    .replace(/^0/, '234')
}

// True when we can actually open this number in WhatsApp.
export function hasWhatsApp(phone) {
  return waDigits(phone).length >= 10
}

export function whatsappHref(phone, message) {
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(message ?? '')}`
}

// Settings > WhatsApp Reminders template with {name} {amount} {business}.
// Unknown placeholders are left intact so the preview shows what is missing.
export function applyTemplate(template, { name, amount, business } = {}) {
  return String(template ?? '')
    .split('{name}')
    .join(name ?? '{name}')
    .split('{amount}')
    .join(amount ?? '{amount}')
    .split('{business}')
    .join(business ?? '{business}')
}

function daysPhrase(daysOwing) {
  const d = Number(daysOwing)
  if (!Number.isFinite(d) || d <= 0) return ''
  return d === 1 ? '1 day' : `${d} days`
}

// Whole days a balance has been open (0 when it is settled or unknown).
export function daysOwingSince(value) {
  if (!value) return 0
  const d = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  return Number.isFinite(d) ? Math.max(0, d) : 0
}

function customerGreeting(customerName) {
  return `Hello ${customerName || 'there'} 👋`
}

function itemLine({ name, qty = 1, price, lineTotal } = {}) {
  if (!name) return null
  const amount = lineTotal ?? (price != null && price !== '' ? Number(price) * Number(qty) : null)
  const value = Number.isFinite(Number(amount)) ? Number(amount) : null
  return `• ${qty} × ${name}${value != null ? ` — ${naira(value)}` : ''}`
}

/**
 * "State of the goods": what the customer took, what they paid and what is
 * left — sent right after a sale (and available again from Sales History).
 */
export function purchaseConfirmation({
  shop,
  customerName,
  receiptNo,
  when,
  items = [],
  total,
  paid,
  paymentType,
  note,
} = {}) {
  const balanceLeft = Math.max(Number(total ?? 0) - Number(paid ?? 0), 0)
  const lines = items.map(itemLine).filter(Boolean)
  const out = [
    customerGreeting(customerName),
    `Thank you for shopping at ${shop || 'our shop'}!`,
    '',
  ]
  if (receiptNo) out.push(`Receipt ${receiptNo}${when ? ` — ${when}` : ''}`)
  out.push(...lines)
  out.push(`Total: ${naira(total)}`)
  out.push(`Paid${paymentType ? ` (${paymentLabel(paymentType)})` : ''}: ${naira(paid)}`)
  if (balanceLeft > 0) {
    out.push(`Balance due: ${naira(balanceLeft)} — settle it anytime with cash, transfer or POS.`)
  }
  out.push('', note || 'Thank you for your patronage!')
  return out.join('\n')
}

/**
 * Status update after a payment lands: how much came in and where the
 * account stands now.
 */
export function paymentReceivedMessage({ shop, customerName, amount, newBalance, method } = {}) {
  const settled = !(Number(newBalance) > 0)
  return [
    customerGreeting(customerName),
    `We received ${naira(amount)}${method ? ` (${paymentLabel(method)})` : ''} from you at ${
      shop || 'our shop'
    } — thank you!`,
    settled
      ? 'Your account is fully settled. We appreciate your patronage 🙏.'
      : `Your balance is now ${naira(newBalance)}. You can clear the rest anytime with cash, transfer or POS.`,
  ].join('\n')
}

/**
 * Anytime status update: the state of the customer's account — balance,
 * how long it has been open, and which receipts are still unsettled.
 */
export function balanceStatusMessage({ shop, customerName, balance, daysOwing, openReceipts = [] } = {}) {
  const owes = Number(balance) > 0
  const days = daysPhrase(daysOwing)
  const out = [customerGreeting(customerName)]
  out.push(
    owes
      ? `Account update from ${shop || 'our shop'}: your outstanding balance is ${naira(balance)}${
          days ? `, open for ${days}` : ''
        }.`
      : `Account update from ${shop || 'our shop'}: nothing is owed — your account is clear. Thank you!`,
  )
  if (openReceipts.length) {
    out.push(`Still open on your account: ${openReceipts.join(', ')}.`)
  }
  if (owes) out.push('Pay in parts if you prefer — cash, transfer or POS all work.')
  return out.join('\n')
}

/**
 * Debt reminders: the polite and urgent wordings used from the Customers
 * page (and the one-tap row buttons).
 */
export function reminderTemplates({ customerName, balance, shop, daysOwing } = {}) {
  const who = customerName || 'there'
  const amount = naira(balance)
  const days = daysPhrase(daysOwing)
  const store = shop || 'our shop'
  return {
    polite: `Hello ${who} 👋, greetings from ${store}! This is a gentle reminder that your outstanding balance of ${amount} is still open${
      days ? ` (${days} now)` : ''
    }. Please settle it whenever it is convenient for you — cash, bank transfer or POS all work. Thank you for your continued patronage 🙏.`,
    urgent: `Hello ${who}, this is an urgent reminder from ${store}: your outstanding balance of ${amount} is now overdue${
      days ? ` (${days})` : ''
    }. Please kindly settle it today so your account can be cleared. We appreciate your business and are happy to help if you need to arrange payment. Thank you.`,
  }
}
