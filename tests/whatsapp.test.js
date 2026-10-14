import { describe, it, expect } from 'vitest'
import {
  applyTemplate,
  balanceStatusMessage,
  daysOwingSince,
  hasWhatsApp,
  paymentReceivedMessage,
  purchaseConfirmation,
  reminderTemplates,
  waDigits,
  whatsappHref,
} from '../src/lib/whatsapp'
import { naira } from '../src/lib/format'

describe('waDigits / hasWhatsApp', () => {
  it('normalises Nigerian numbers to international digits', () => {
    expect(waDigits('0803 123 4567')).toBe('2348031234567')
    expect(waDigits('+234 803 123 4567')).toBe('2348031234567')
    expect(waDigits(null)).toBe('')
  })

  it('only treats real numbers as WhatsApp-capable', () => {
    expect(hasWhatsApp('08031234567')).toBe(true)
    expect(hasWhatsApp('0803')).toBe(false)
    expect(hasWhatsApp('')).toBe(false)
    expect(hasWhatsApp(null)).toBe(false)
  })
})

describe('whatsappHref', () => {
  it('builds a wa.me link with the encoded message', () => {
    const href = whatsappHref('0803 123 4567', 'Balance: ₦500 & counting')
    expect(href).toBe('https://wa.me/2348031234567?text=Balance%3A%20%E2%82%A6500%20%26%20counting')
  })
})

describe('applyTemplate', () => {
  it('fills the Settings placeholders and leaves unknown ones intact', () => {
    const tpl = 'Hello {name}, you owe {amount} at {business} (ref {id})'
    expect(applyTemplate(tpl, { name: 'Mama C', amount: naira(1500), business: 'Adaeze Provisions' })).toBe(
      'Hello Mama C, you owe ₦1,500 at Adaeze Provisions (ref {id})',
    )
  })
})

describe('daysOwingSince', () => {
  it('counts whole days and treats missing dates as 0', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    expect(daysOwingSince(threeDaysAgo)).toBe(3)
    expect(daysOwingSince(null)).toBe(0)
    expect(daysOwingSince('not-a-date')).toBe(0)
  })
})

describe('purchaseConfirmation', () => {
  it('lists what was bought, what was paid, and closes cleanly when settled', () => {
    const text = purchaseConfirmation({
      shop: 'Adaeze Provisions',
      customerName: 'Mama Chinedu',
      receiptNo: 'ADR-0042',
      when: '13 Oct 2026 10:15',
      items: [
        { name: 'Indomie Noodles', qty: 3, price: 700 },
        { name: 'Peak Milk 900g', qty: 1, lineTotal: 2500 },
      ],
      total: 4600,
      paid: 4600,
      paymentType: 'cash',
      note: 'Come again!',
    })
    expect(text).toContain('Hello Mama Chinedu 👋')
    expect(text).toContain('Thank you for shopping at Adaeze Provisions!')
    expect(text).toContain('Receipt ADR-0042 — 13 Oct 2026 10:15')
    expect(text).toContain(`• 3 × Indomie Noodles — ${naira(2100)}`)
    expect(text).toContain(`• 1 × Peak Milk 900g — ${naira(2500)}`)
    expect(text).toContain(`Total: ${naira(4600)}`)
    expect(text).toContain(`Paid (Cash): ${naira(4600)}`)
    expect(text).not.toContain('Balance due')
    expect(text).toContain('Come again!')
  })

  it('spells out the balance left on credit and part sales', () => {
    const text = purchaseConfirmation({
      shop: 'Adaeze Provisions',
      customerName: 'Baba Sule',
      receiptNo: 'ADR-0043',
      items: [{ name: 'Rice 5kg', qty: 2, price: 9000 }],
      total: 18000,
      paid: 10000,
      paymentType: 'part',
    })
    expect(text).toContain(`Paid (Part payment): ${naira(10000)}`)
    expect(text).toContain(`Balance due: ${naira(8000)}`)
    expect(text).toContain('cash, transfer or POS')
  })
})

describe('paymentReceivedMessage', () => {
  it('reports the payment and the new balance', () => {
    const text = paymentReceivedMessage({
      shop: 'Adaeze Provisions',
      customerName: 'Baba Sule',
      amount: 5000,
      newBalance: 3000,
      method: 'transfer',
    })
    expect(text).toContain('We received ₦5,000 (Transfer)')
    expect(text).toContain('Your balance is now ₦3,000')
  })

  it('celebrates a settled account', () => {
    const text = paymentReceivedMessage({ shop: 'Adaeze', customerName: 'Baba Sule', amount: 3000, newBalance: 0 })
    expect(text).toContain('fully settled')
    expect(text).not.toContain('balance is now')
  })
})

describe('balanceStatusMessage', () => {
  it('summarises an open balance with its age and receipts', () => {
    const text = balanceStatusMessage({
      shop: 'Adaeze Provisions',
      customerName: 'Mama Chinedu',
      balance: 14200,
      daysOwing: 9,
      openReceipts: ['ADR-0040', 'ADR-0042'],
    })
    expect(text).toContain('outstanding balance is ₦14,200')
    expect(text).toContain('open for 9 days')
    expect(text).toContain('Still open on your account: ADR-0040, ADR-0042.')
  })

  it('confirms a cleared account', () => {
    const text = balanceStatusMessage({ shop: 'Adaeze', customerName: 'Mama Chinedu', balance: 0 })
    expect(text).toContain('nothing is owed')
    expect(text).not.toContain('Still open')
  })
})

describe('reminderTemplates', () => {
  it('mentions the amount and the days open in both wordings', () => {
    const { polite, urgent } = reminderTemplates({
      customerName: 'Alhaji Bello',
      balance: 25000,
      shop: 'Adaeze Provisions',
      daysOwing: 12,
    })
    expect(polite).toContain('Alhaji Bello')
    expect(polite).toContain(naira(25000))
    expect(polite).toContain('12 days now')
    expect(urgent).toContain(naira(25000))
    expect(urgent).toContain('overdue (12 days)')
    expect(urgent).toContain('Adaeze Provisions')
  })

  it('omits the days phrase when the age is unknown', () => {
    const { polite } = reminderTemplates({ customerName: 'Baba Sule', balance: 1000 })
    expect(polite).not.toContain('days now')
    expect(polite).toContain('our shop')
  })
})
