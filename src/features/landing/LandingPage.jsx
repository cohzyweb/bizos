import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Badge as BadgeIcon,
  BadgeCheck,
  Banknote,
  BellRing,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CirclePlay,
  CircleX,
  Cloud,
  CloudOff,
  Download,
  EyeOff,
  Headphones,
  LockKeyhole,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  Moon,
  PackageX,
  PartyPopper,
  Plus,
  ReceiptText,
  ScanBarcode,
  Search,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  SquarePlus,
  Sun,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  WifiOff,
  Zap,
} from 'lucide-react'
import { Logo } from '../../components/ui'
import Reveal from '../../components/Reveal'
import { useThemeStore } from '../../lib/theme'

// Marketing page — ported from the Stitch export in design/code.html.
// Logged-out visitors land here; logged-in users go to the dashboard.

const FAQS = [
  {
    icon: WifiOff,
    question: 'Does it work without internet?',
    answer:
      'Yes! You can record sales, add products, and generate receipts even with zero internet. When your phone catches network, BizOs automatically syncs everything safely to the cloud.',
  },
  {
    icon: Users,
    question: 'Can my staff use it without seeing my profit?',
    answer:
      'Yes! You can assign Cashier permissions so apprentices or attendants can ring up transactions and register payments, while confidential profit margins and wholesale cost prices stay hidden.',
  },
  {
    icon: Shield,
    question: 'Is my business data safe?',
    answer:
      'All records are encrypted end-to-end and stored redundantly. If you misplace or break your phone, simply log in on a new device to recover all your shop stock and customer debts.',
  },
  {
    icon: Download,
    question: 'Will I lose my data if I decide to stop?',
    answer:
      'Never. Your data remains strictly yours. You can download and export complete Excel or CSV backups of your customer records, sales transactions, and inventory at any time with one click.',
  },
  {
    icon: MonitorSmartphone,
    question: 'Do I need a computer to use BizOs?',
    answer:
      'No! BizOs is fully optimized for any Android phone or iPhone, as well as tablets and desktop laptops. You can run your entire shop directly from your pocket.',
  },
]

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

function SectionHeading({ eyebrow, title, subtitle, className = 'mb-14' }) {
  return (
    <Reveal className={`text-center max-w-2xl mx-auto ${className}`}>
      <span className="text-primary font-label-md text-label-md uppercase tracking-wider font-bold">{eyebrow}</span>
      <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-2 mb-3">{title}</h2>
      <p className="font-body-lg text-body-lg text-on-surface-variant">{subtitle}</p>
    </Reveal>
  )
}

function Header() {
  const themeMode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const themeDark = themeMode === 'dark'
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/40 animate-fade-down">
      <div className="h-20 max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <Link to="/" className="flex items-center gap-space-sm">
            <Logo />
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low text-primary font-label-sm text-label-sm border border-outline-variant/50">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Made for Nigerian shops
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-space-lg">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors relative after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-space-md">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={themeDark}
            title={themeDark ? 'Light mode' : 'Dark mode'}
            className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            {themeDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link
            to="/login"
            className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface px-space-sm py-space-xs transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center h-10 px-4 rounded bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary-container hover:text-white transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95"
          >
            Start free
          </Link>
          <div className="hidden w-8 h-8 rounded-full bg-primary items-center justify-center sm:flex">
            <User className="h-[18px] w-[18px] text-on-primary" />
          </div>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative w-full pt-10 pb-20 overflow-hidden bg-gradient-to-b from-surface via-surface-container-low/40 to-surface">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">
          {/* Left column: copy & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-start z-10">
            <Reveal delay={0} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high/60 text-primary font-label-md text-label-md mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
              Built for Nigerian retail shops &amp; supermarkets
            </Reveal>
            <Reveal as="h1" delay={70} className="font-display-hero text-display-hero text-on-surface tracking-tight leading-tight mb-5">
              Know your sales, your stock, and who owes you.{' '}
              <span className="text-primary underline decoration-secondary decoration-wavy decoration-2 underline-offset-4">
                From your phone
              </span>{' '}
              or your laptop.
            </Reveal>
            <Reveal as="p" delay={130} className="font-body-lg text-body-lg text-on-surface-variant mb-8 max-w-xl">
              BizOs helps small shops record sales in seconds, track stock automatically, and collect debts, even when
              the network is down.
            </Reveal>
            <Reveal delay={190} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-8">
              <Link
                to="/signup"
                className="group h-12 px-7 rounded bg-primary-container text-white hover:text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
              >
                <span>Start free</span>
                <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href="#how-it-works"
                className="h-12 px-6 rounded bg-surface-container-lowest text-on-surface font-label-lg text-label-lg shadow-sm hover:bg-surface-container transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              >
                <CirclePlay className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
                <span>See how it works</span>
              </a>
            </Reveal>
            {/* Trust checklist */}
            <Reveal delay={250} className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-4 text-on-surface-variant font-label-md text-label-md">
              <div className="flex items-center gap-2">
                <CircleCheck className="h-[18px] w-[18px] text-secondary" />
                <span>Free while we launch</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="h-[18px] w-[18px] text-secondary" />
                <span>Works 100% offline</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="h-[18px] w-[18px] text-secondary" />
                <span>Made for Nigerian shops</span>
              </div>
            </Reveal>
          </div>

          {/* Right column: overlapping laptop + phone mockup */}
          <Reveal delay={320} className="lg:col-span-6 relative mt-8 lg:mt-0 flex justify-center items-center">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary-fixed/30 to-secondary-fixed/20 rounded-xl blur-2xl -z-10" />
            {/* Laptop frame */}
            <div className="relative w-full max-w-[540px] bg-surface-container-lowest rounded-lg shadow-xl overflow-hidden p-3.5">
              <div className="bg-surface-container-low px-4 py-2.5 rounded-md flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-error/70 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-tertiary-fixed-dim inline-block" />
                  <span className="w-3 h-3 rounded-full bg-secondary inline-block" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant ml-2 font-medium">
                    Adaeze Provisions · Surulere, Lagos
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-sm font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Live Sync
                </div>
              </div>

              {/* Laptop dashboard content */}
              <div className="p-3 bg-surface rounded-md space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-container-lowest p-2.5 rounded shadow-sm">
                    <span className="text-on-surface-variant font-label-sm text-label-sm">Today&apos;s Sales</span>
                    <p className="font-metric-numeral text-headline-sm text-on-surface font-bold mt-0.5">₦84,500</p>
                    <span className="text-secondary font-label-sm text-label-sm flex items-center gap-0.5 mt-0.5">
                      <TrendingUp className="h-3.5 w-3.5" /> +14% vs yesterday
                    </span>
                  </div>
                  <div className="bg-surface-container-lowest p-2.5 rounded shadow-sm">
                    <span className="text-on-surface-variant font-label-sm text-label-sm">Who Owes You</span>
                    <p className="font-metric-numeral text-headline-sm text-error font-bold mt-0.5">₦126,300</p>
                    <span className="text-on-surface-variant font-label-sm text-label-sm">4 shop regulars</span>
                  </div>
                  <div className="bg-surface-container-lowest p-2.5 rounded shadow-sm">
                    <span className="text-on-surface-variant font-label-sm text-label-sm">Low Stock Items</span>
                    <p className="font-metric-numeral text-headline-sm text-tertiary font-bold mt-0.5">3 items</p>
                    <span className="text-tertiary font-label-sm text-label-sm">Needs reorder</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-3 rounded shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-label-md text-label-md text-on-surface">Hourly Cash &amp; Transfer Flow</span>
                    <span className="font-label-sm text-label-sm text-primary">₦84,500 total</span>
                  </div>
                  <svg className="w-full h-12 text-primary" fill="none" viewBox="0 0 300 50">
                    <path
                      d="M0 45 L30 38 L60 42 L90 28 L120 32 L150 15 L180 22 L210 10 L240 18 L270 5 L300 12"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      strokeDasharray="480"
                      className="animate-draw-line"
                    />
                    <path
                      d="M0 45 L30 38 L60 42 L90 28 L120 32 L150 15 L180 22 L210 10 L240 18 L270 5 L300 12 L300 50 L0 50 Z"
                      fill="currentColor"
                      fillOpacity="0.08"
                      className="animate-fade-in"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Overlapping phone mockup */}
            <div className="absolute -bottom-8 -right-2 sm:right-4 w-60 sm:w-64 bg-surface-container-lowest rounded-xl shadow-2xl p-2.5 -rotate-3 hover:rotate-0 transition-transform duration-500 hover:scale-[1.03]">
              <div className="bg-surface-container-low rounded-lg p-3 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-label-md text-label-md font-bold text-on-surface">New Sale · Cart</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-sm font-semibold">
                    Cashier 01
                  </span>
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded shadow-xs">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface font-medium leading-none">
                        Golden Terra 2.5L
                      </p>
                      <span className="text-on-surface-variant font-label-sm text-label-sm">Qty: 2</span>
                    </div>
                    <span className="font-label-md text-label-md font-bold text-on-surface">₦13,000</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded shadow-xs">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface font-medium leading-none">
                        Peak Milk (Carton)
                      </p>
                      <span className="text-on-surface-variant font-label-sm text-label-sm">Qty: 1</span>
                    </div>
                    <span className="font-label-md text-label-md font-bold text-on-surface">₦5,500</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 mb-2 font-headline-sm text-headline-sm font-bold text-primary">
                  <span className="font-label-md text-label-md text-on-surface">Total:</span>
                  <span>₦18,500</span>
                </div>
                <button className="w-full h-10 rounded bg-primary-container text-white hover:text-on-primary font-label-md text-label-md font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-colors hover:bg-primary">
                  <ShoppingCart className="h-4 w-4" />
                  Complete Sale
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

const TRUST_ITEMS = [
  {
    icon: WifiOff,
    tile: 'bg-primary-fixed text-on-primary-fixed',
    title: 'Works offline',
    body: 'Continues recording seamlessly when network drops.',
  },
  {
    icon: Smartphone,
    tile: 'bg-secondary-fixed text-on-secondary-fixed',
    title: 'Receipts on WhatsApp',
    body: 'Direct 1-tap receipts sent straight to buyer phones.',
  },
  {
    icon: Banknote,
    tile: 'bg-primary-fixed-dim text-on-primary-fixed-variant',
    title: 'Made for Nigerian shops',
    body: 'Naira (₦), bank transfers, POS & local counter workflow.',
  },
  {
    icon: LockKeyhole,
    tile: 'bg-surface-container-high text-primary',
    title: 'Your data stays yours',
    body: 'Export CSV backups anytime. Zero vendor lock-in.',
  },
]

function TrustStrip() {
  return (
    <section className="w-full bg-surface-container-lowest py-8 shadow-xs">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST_ITEMS.map((item, index) => (
            <Reveal key={item.title} delay={index * 70} className="h-full">
              <div className="group flex items-start gap-3.5 p-3 rounded-md bg-surface-container-low/50 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lift hover:bg-surface-container-low">
                <div
                  className={`w-10 h-10 rounded flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${item.tile}`}
                >
                  <item.icon className="h-[22px] w-[22px]" />
                </div>
                <div>
                  <h3 className="font-label-lg text-label-lg font-bold text-on-surface">{item.title}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{item.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const PROBLEMS = [
  {
    icon: CircleX,
    tile: 'bg-error-container text-on-error-container',
    title: 'Lost credit sales',
    body: 'Customers forget what they owe, notebook pages get torn or misplaced, and follow-ups become awkward arguments without proof.',
    stat: 'Up to ₦45,000 lost monthly to forgotten credits',
    statClass: 'text-error',
    statIcon: CircleAlert,
  },
  {
    icon: PackageX,
    tile: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    title: 'Surprise stock-outs',
    body: 'Running out of fast-selling items without warning. Customers turn away to the next shop while your money sits in dead stock.',
    stat: '22% of walk-ins lost when cartons run out',
    statClass: 'text-tertiary',
    statIcon: TrendingDown,
  },
  {
    icon: CircleHelp,
    tile: 'bg-surface-container-highest text-primary',
    title: 'Not knowing real profit',
    body: 'Lots of cash sitting in the drawer at night, but zero clarity on what is actual shop profit versus replenishment capital.',
    stat: 'Miscalculating daily takeaway profit',
    statClass: 'text-primary',
    statIcon: EyeOff,
  },
]

function ProblemSection() {
  return (
    <section className="w-full py-20 bg-surface">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <SectionHeading
          eyebrow="Paper Ledger Realities"
          title="Still running your shop from a notebook?"
          subtitle="The hidden costs of paper ledgers that quietly drain your profit and sanity every month."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROBLEMS.map((item, index) => (
            <Reveal key={item.title} delay={index * 90} className="h-full">
              <div className="group h-full bg-surface-container-lowest p-7 rounded-lg shadow-sm hover:shadow-lift transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between">
                <div>
                  <div
                    className={`w-12 h-12 rounded-md flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${item.tile}`}
                  >
                    <item.icon className="h-[26px] w-[26px]" />
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2.5">{item.title}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">{item.body}</p>
                </div>
                <div className="mt-6 pt-4 bg-surface-container-low/50 rounded p-3">
                  <span className={`font-label-sm text-label-sm font-bold flex items-center gap-1.5 ${item.statClass}`}>
                    <item.statIcon className="h-4 w-4" /> {item.stat}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section className="w-full py-20 bg-surface-container-low/30 scroll-mt-24" id="features">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <SectionHeading
          eyebrow="Comprehensive Capabilities"
          title="Every tool your shop needs to run effortlessly"
          subtitle="Built around the daily hustle of Nigerian retail counters—fast, transparent, and rock-solid."
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Bento 1: Fast sales (span 7) */}
          <Reveal delay={0} className="md:col-span-7 h-full">
            <div className="group h-full bg-surface-container-lowest p-6 sm:p-8 rounded-lg shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
                  10-second ring-up
                </span>
                <span className="text-on-surface-variant font-label-sm text-label-sm">Barcode or quick-tap</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Record a sale in under 10 seconds</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                No slow loading spinners. Tap frequent items or scan with phone camera. Accept cash, transfer, or POS
                split payments instantly.
              </p>
            </div>
            <div className="bg-surface-container-low/60 rounded-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-[18px] w-[18px] text-outline" />
                  <input
                    className="w-full h-10 pl-9 pr-3 rounded bg-surface-container-lowest text-on-surface font-body-sm text-body-sm shadow-xs focus:outline-none"
                    value="Golden Terra Oil"
                    readOnly
                    type="text"
                  />
                </div>
                <button className="h-10 px-3 rounded bg-surface-container-lowest shadow-xs text-primary flex items-center justify-center">
                  <ScanBarcode className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-surface-container-lowest p-2.5 rounded shadow-xs flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    Golden Terra 2.5L
                  </span>
                  <span className="text-primary font-label-sm text-label-sm font-bold mt-1">₦6,500</span>
                  <span className="text-secondary font-label-sm text-label-sm">32 in stock</span>
                </div>
                <div className="bg-surface-container-lowest p-2.5 rounded shadow-xs flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    Peak Evap Milk
                  </span>
                  <span className="text-primary font-label-sm text-label-sm font-bold mt-1">₦550</span>
                  <span className="text-tertiary font-label-sm text-label-sm">Low: 4 left</span>
                </div>
                <div className="bg-surface-container-lowest p-2.5 rounded shadow-xs flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    Indomie Onion 70g
                  </span>
                  <span className="text-primary font-label-sm text-label-sm font-bold mt-1">₦250</span>
                  <span className="text-secondary font-label-sm text-label-sm">118 in stock</span>
                </div>
              </div>
            </div>
            </div>
          </Reveal>

          {/* Bento 2: Debts tracker (span 5) */}
          <Reveal delay={80} className="md:col-span-5 h-full">
            <div className="group h-full bg-surface-container-lowest p-6 sm:p-8 rounded-lg shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-bold">
                  Who Owes Me
                </span>
                <span className="font-label-md text-label-md text-error font-bold">₦126,300 total</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
                Debts tracker with 1-click WhatsApp
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                Never forget who took goods on credit. Send polite, automated WhatsApp reminders with accurate item
                breakdowns.
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-md bg-surface-container-low/60 shadow-xs">
                <div>
                  <p className="font-label-md text-label-md text-on-surface font-bold">Mama Chinedu</p>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Owes ₦14,200 · 4 days ago</span>
                </div>
                <button className="h-8 px-3 rounded bg-secondary text-on-secondary text-label-sm font-semibold flex items-center gap-1 shadow-xs">
                  <MessageCircle className="h-3.5 w-3.5" /> Remind
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-surface-container-low/60 shadow-xs">
                <div>
                  <p className="font-label-md text-label-md text-on-surface font-bold">Alhaji Bello</p>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Owes ₦35,000 · Yesterday</span>
                </div>
                <button className="h-8 px-3 rounded bg-secondary text-on-secondary text-label-sm font-semibold flex items-center gap-1 shadow-xs">
                  <MessageCircle className="h-3.5 w-3.5" /> Remind
                </button>
              </div>
            </div>
            </div>
          </Reveal>

          {/* Bento 3: WhatsApp receipts (span 4) */}
          <Reveal delay={160} className="md:col-span-4 h-full">
            <div className="group h-full bg-surface-container-lowest p-6 sm:p-7 rounded-lg shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <div>
              <div className="w-10 h-10 rounded bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed mb-4">
                <ReceiptText className="h-[22px] w-[22px]" />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">WhatsApp digital receipts</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                Save money on expensive POS thermal rolls. Generate branded, clear WhatsApp receipts customers
                appreciate.
              </p>
            </div>
            <div className="bg-surface-container-low/70 p-3.5 rounded-md border-dashed border-2 border-outline-variant/60 font-mono text-[12px] text-on-surface-variant">
              <div className="text-center font-bold text-on-surface font-headline-sm text-headline-sm">
                Adaeze Provisions
              </div>
              <div className="text-center text-[10px] text-on-surface-variant mb-2">Surulere Lagos · 0803 234 5678</div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-1 mb-1 font-semibold text-on-surface">
                <span>Item</span>
                <span>Qty / Amount</span>
              </div>
              <div className="flex justify-between">
                <span>Golden Terra 2.5L</span>
                <span>₦6,500</span>
              </div>
              <div className="flex justify-between">
                <span>Dano Milk Pouch</span>
                <span>₦2,200</span>
              </div>
              <div className="flex justify-between font-bold text-on-surface pt-1 mt-1 border-t border-outline-variant/40">
                <span>PAID VIA TRANSFER</span>
                <span>₦8,700</span>
              </div>
            </div>
            </div>
          </Reveal>

          {/* Bento 4: Automatic stock tracking (span 4) */}
          <Reveal delay={240} className="md:col-span-4 h-full">
            <div className="group h-full bg-surface-container-lowest p-6 sm:p-7 rounded-lg shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <div>
              <div className="w-10 h-10 rounded bg-primary-fixed flex items-center justify-center text-on-primary-fixed mb-4">
                <Boxes className="h-[22px] w-[22px]" />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Automatic stock tracking</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                Every sale deducts count instantly. Receive amber alerts before fast-moving cartons sell out completely.
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-2.5 rounded bg-surface-container-low/50 flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface">Dangote Sugar 50kg</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-sm font-semibold">
                  14 bags left
                </span>
              </div>
              <div className="p-2.5 rounded bg-surface-container-low/50 flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface">Peak Milk Powder</span>
                <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-label-sm font-semibold">
                  2 units (Low)
                </span>
              </div>
            </div>
            </div>
          </Reveal>

          {/* Bento 5: Staff accounts & reports (span 4) */}
          <Reveal delay={320} className="md:col-span-4 h-full">
            <div className="group h-full bg-surface-container-lowest p-6 sm:p-7 rounded-lg shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <div>
              <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center text-primary mb-4">
                <BadgeIcon className="h-[22px] w-[22px]" />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Staff accounts &amp; reports</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                Allow apprentices or salesgirls to record sales on their phones without revealing your cost price or
                profit margins.
              </p>
            </div>
            <div className="p-3 bg-surface-container-low/60 rounded-md space-y-1.5">
              <div className="flex items-center justify-between text-label-sm font-semibold">
                <span className="text-on-surface">Role: Shop Attendant</span>
                <span className="text-secondary">Limited Mode</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Cost prices hidden · Debts restricted · Sales allowed
              </p>
            </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

const CALLOUTS = [
  {
    className: 'bg-secondary-fixed text-on-secondary-fixed',
    icon: BadgeCheck,
    label: 'Real-time Sales & Profit (₦84,500 today)',
  },
  {
    className: 'bg-error-container text-on-error-container',
    icon: CircleAlert,
    label: 'Instant Debtor Tracking (₦126,300 owing)',
  },
  {
    className: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    icon: BellRing,
    label: 'Stock Alert (Indomie & Peak Milk low)',
  },
]

const DASHBOARD_METRICS = [
  {
    label: 'Today Sales (Cash + POS)',
    value: '₦84,500',
    valueClass: 'text-primary',
    bar: 72,
  },
  {
    label: 'Estimated Daily Profit',
    value: '₦19,400',
    valueClass: 'text-secondary',
    note: '23% margin',
    noteClass: 'text-secondary',
  },
  {
    label: 'Debtors Outstanding',
    value: '₦126,300',
    valueClass: 'text-error',
    note: '4 customers pending',
    noteClass: 'text-error font-semibold',
  },
  {
    label: 'Restock Urgency',
    value: '3 Products',
    valueClass: 'text-tertiary',
    note: 'Peak Milk, Golden Terra',
    noteClass: 'text-tertiary',
  },
]

const RECENT_TX = [
  {
    time: '11:42 AM',
    items: 'Golden Terra 2.5L (x2)',
    method: 'Transfer (OPay)',
    methodClass: 'bg-surface-container-high text-on-surface',
    amount: '₦13,000',
    amountClass: 'text-on-surface',
    status: 'Paid',
    statusClass: 'text-secondary',
  },
  {
    time: '11:15 AM',
    items: 'Peak Milk, 5x Indomie',
    method: 'Cash',
    methodClass: 'bg-surface-container-high text-on-surface',
    amount: '₦6,750',
    amountClass: 'text-on-surface',
    status: 'Paid',
    statusClass: 'text-secondary',
  },
  {
    time: '10:50 AM',
    items: 'Carton Gino Sachet (x1)',
    method: 'Credit',
    methodClass: 'bg-error-container text-on-error-container',
    amount: '₦14,200',
    amountClass: 'text-error',
    status: 'Owing',
    statusClass: 'text-error',
  },
]

const SHOWCASE_CARDS = [
  {
    icon: ShoppingCart,
    tile: 'bg-primary-fixed text-on-primary-fixed',
    title: '1. New Sale Screen',
    body: 'Big buttons, instant product search, and flexible partial payments or full credit booking in seconds.',
    previewClass: 'text-on-surface',
    previewLabel: 'Cart Subtotal',
    previewValue: '₦18,500',
    previewValueClass: 'text-primary font-bold',
  },
  {
    icon: MessageCircle,
    tile: 'bg-secondary-fixed text-on-secondary-fixed',
    title: '2. WhatsApp Receipt',
    body: 'Direct 1-tap push to the buyer’s phone. Build instant credibility and eliminate messy lost receipts.',
    previewClass: 'text-secondary',
    previewLabel: 'Receipt Generated',
    previewCheck: true,
  },
  {
    icon: Wallet,
    tile: 'bg-error-container text-on-error-container',
    title: '3. Who Owes Me',
    body: 'Full ledger of every customer debt with date timestamps and instant pre-filled polite reminder messages.',
    previewClass: 'text-error',
    previewLabel: 'Mama Chinedu',
    previewValue: '₦14,200 Pending',
  },
]

function ShowcaseSection() {
  return (
    <section className="w-full py-20 bg-surface">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <SectionHeading
          className="mb-16"
          eyebrow="Designed for Daily Speed"
          title="See everything in your shop in one glance"
          subtitle="Clear visual indicators, high-contrast balances, and zero clutter."
        />

        {/* Annotated dashboard mockup */}
        <Reveal delay={100} className="relative bg-surface-container-lowest rounded-xl shadow-xl p-4 sm:p-8 mb-12">
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            {CALLOUTS.map((callout) => (
              <div
                key={callout.label}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-label-sm font-semibold shadow-xs ${callout.className}`}
              >
                <callout.icon className="h-4 w-4" />
                {callout.label}
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-surface-container-low/40 p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <h4 className="font-headline-md text-headline-md text-on-surface">Adaeze Provisions · Store Dashboard</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Lagos Main Hub · Last synced 2 mins ago
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-9 px-4 rounded bg-primary-container text-white font-label-md text-label-md shadow-xs flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4" /> New Sale (F2)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DASHBOARD_METRICS.map((metric) => (
                <div key={metric.label} className="bg-surface-container-lowest p-4 rounded-md shadow-xs">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{metric.label}</span>
                  <p className={`font-metric-numeral text-headline-sm font-bold mt-1 ${metric.valueClass}`}>
                    {metric.value}
                  </p>
                  {metric.bar !== undefined ? (
                    <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${metric.bar}%` }} />
                    </div>
                  ) : metric.note ? (
                    <span className={`font-label-sm text-label-sm flex items-center gap-1 mt-1 ${metric.noteClass}`}>
                      <Check className="h-3.5 w-3.5" /> {metric.note}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="bg-surface-container-lowest rounded-md p-4 shadow-xs overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="font-label-lg text-label-lg font-bold text-on-surface">
                  Recent Counter Transactions
                </span>
                <span className="font-label-sm text-label-sm text-primary cursor-pointer hover:underline underline-offset-4 transition-all">
                  View all 38 sales
                </span>
              </div>
              <table className="w-full text-left font-body-sm text-body-sm">
                <thead>
                  <tr className="text-on-surface-variant">
                    <th className="pb-2 font-semibold">Time</th>
                    <th className="pb-2 font-semibold">Items</th>
                    <th className="pb-2 font-semibold">Method</th>
                    <th className="pb-2 font-semibold text-right">Amount</th>
                    <th className="pb-2 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {RECENT_TX.map((tx) => (
                    <tr key={tx.time} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-2 text-on-surface-variant">{tx.time}</td>
                      <td className="py-2 text-on-surface font-medium">{tx.items}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-label-sm ${tx.methodClass}`}>{tx.method}</span>
                      </td>
                      <td className={`py-2 text-right font-bold ${tx.amountClass}`}>{tx.amount}</td>
                      <td className={`py-2 text-center font-semibold text-label-sm ${tx.statusClass}`}>{tx.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        {/* 3 mobile cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SHOWCASE_CARDS.map((card, index) => (
            <Reveal key={card.title} delay={index * 100} className="h-full">
              <div className="group h-full bg-surface-container-lowest p-6 rounded-lg shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className={`w-8 h-8 rounded flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${card.tile}`}
                  >
                    <card.icon className="h-[18px] w-[18px]" />
                  </span>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface">{card.title}</h4>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant mb-4">{card.body}</p>
                <div className="p-3 bg-surface-container-low/60 rounded-md transition-colors duration-300 group-hover:bg-surface-container-low">
                  <div
                    className={`flex justify-between items-center text-label-md font-semibold ${card.previewClass}`}
                  >
                    <span>{card.previewLabel}</span>
                    {card.previewCheck ? (
                      <CircleCheck className="h-[18px] w-[18px]" />
                    ) : (
                      <span className={card.previewValueClass ?? ''}>{card.previewValue}</span>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    number: '01',
    title: 'Add your products',
    body: 'Type item name, selling price, and starting quantity. Or choose from our ready-made Nigerian grocery templates.',
    note: 'Pre-loaded provisions list available',
    noteClass: 'text-primary',
    noteIcon: SquarePlus,
  },
  {
    number: '02',
    title: 'Record sales as they happen',
    body: 'Tap items in 10 seconds. Select Cash, Bank Transfer, POS terminal, or register credit debt with 1 click.',
    note: 'Quick tap counter mode',
    noteClass: 'text-primary',
    noteIcon: Zap,
  },
  {
    number: '03',
    title: 'Check your numbers anywhere',
    body: 'See your real profit, track stock levels from home, and send polite WhatsApp reminders to debtors effortlessly.',
    note: 'End-of-day profit certainty',
    noteClass: 'text-secondary',
    noteIcon: CircleCheck,
  },
]

function HowItWorksSection() {
  return (
    <section className="w-full py-20 bg-surface-container-low/40 scroll-mt-24" id="how-it-works">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <SectionHeading
          className="mb-16"
          eyebrow="Fast Setup"
          title="Get started in under 3 minutes"
          subtitle="No complicated tutorials or training required. If you know how to send WhatsApp, you can use BizOs."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delay={index * 110} className="h-full">
              <div className="group h-full bg-surface-container-lowest p-8 rounded-lg shadow-sm relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                <div className="font-display-hero text-display-hero text-primary-fixed-dim font-extrabold mb-3 transition-transform duration-300 group-hover:translate-x-1">
                  {step.number}
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2.5">{step.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{step.body}</p>
                <div
                  className={`mt-6 flex items-center gap-2 font-label-sm text-label-sm font-semibold ${step.noteClass}`}
                >
                  <step.noteIcon className="h-[18px] w-[18px]" /> {step.note}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const OFFLINE_CHECKS = [
  'Continue ringing up customers with zero delay',
  'Print or send receipts locally',
  'Automatic silent sync once network reconnects',
]

const OFFLINE_QUEUE = [
  { name: 'Indomie Relish (x3)', amount: '₦3,600' },
  { name: 'Peak Milk Carton', amount: '₦5,500' },
  { name: 'Sunlight Detergent 1kg', amount: '₦2,100' },
]

function OfflineSection() {
  return (
    <section className="w-full py-20 bg-surface scroll-mt-24" id="offline">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <div className="bg-surface-container-lowest rounded-xl shadow-lg p-6 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <Reveal delay={0} className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-label-sm font-bold mb-4">
                <span className="w-2 h-2 rounded-full bg-tertiary-container animate-ping" />
                Offline-First Architecture
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-4">
                No network? Keep selling.
                <br />
                Your sales sync when you&apos;re back online.
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-6">
                Nigerian telecom networks drop without warning. BizOs stores every transaction securely on your device
                first. When the signal returns, everything automatically updates to the cloud without losing a single
                kobo.
              </p>
              <div className="space-y-3">
                {OFFLINE_CHECKS.map((check) => (
                  <div key={check} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-secondary shrink-0" />
                    <span className="font-body-md text-body-md text-on-surface font-medium">{check}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Offline graphic simulator */}
            <Reveal delay={200} className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-sm bg-surface-container-low rounded-lg p-4 shadow-sm space-y-3">
                <div className="p-3 rounded-md bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <CloudOff className="h-5 w-5 text-tertiary-container" />
                    <div>
                      <p className="font-label-md text-label-md font-bold leading-none">You&apos;re offline</p>
                      <span className="text-[11px] font-medium opacity-90">3 sales waiting to sync</span>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 bg-surface-container-lowest/80 rounded-sm font-semibold">
                    Local mode
                  </span>
                </div>

                <div className="bg-surface-container-lowest p-3 rounded-md shadow-xs space-y-2">
                  {OFFLINE_QUEUE.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-body-sm">
                      <span className="text-on-surface font-medium">{item.name}</span>
                      <span className="font-bold text-on-surface">{item.amount}</span>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 rounded bg-secondary-fixed text-on-secondary-fixed flex items-center gap-2 text-label-sm font-semibold shadow-xs">
                  <Cloud className="h-4 w-4 text-secondary" />
                  <span>Auto-sync ready: Network restored</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

const FREE_FEATURES = [
  'Unlimited sales records',
  'Automatic stock tracking',
  'Debts & WhatsApp reminders',
  'Shareable digital receipts',
  '100% offline mode',
  'Up to 50 active products',
]

const PRO_FEATURES = [
  'Unlimited products inventory',
  'Multi-staff cashier permissions',
  'Profit & loss statements & trends',
  'Custom store logo on receipts',
  'Priority WhatsApp customer support',
]

function PricingSection() {
  return (
    <section className="w-full py-20 bg-surface-container-low/30 scroll-mt-24" id="pricing">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <Reveal delay={0} className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed text-label-sm font-bold mb-4 shadow-xs">
            <PartyPopper className="h-4 w-4" />
            Full access is 100% free while we launch · No credit card required
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-3">
            Simple, honest pricing for growing shops
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Start for free today. Upgrade only when your shop expands.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-8">
          {/* Free plan */}
          <Reveal delay={120} className="h-full">
            <div className="group h-full bg-surface-container-lowest p-8 rounded-lg shadow-sm flex flex-col justify-between relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline-md text-headline-md text-on-surface">Free Plan</h3>
                <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-sm font-bold">
                  Free Forever
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-display-hero text-display-hero font-extrabold text-on-surface">₦0</span>
                <span className="font-body-md text-body-md text-on-surface-variant">/ month</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                Ideal for single-shop retailers, kiosks, and provision store managers getting started.
              </p>
              <ul className="space-y-3 font-body-md text-body-md text-on-surface mb-8">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <CircleCheck className="h-5 w-5 text-secondary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
              <Link
                to="/signup"
                className="w-full h-12 rounded bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary-container hover:text-white transition-all flex items-center justify-center hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Get started free
              </Link>
            </div>
          </Reveal>

          {/* Pro plan */}
          <Reveal delay={240} className="h-full">
            <div className="group h-full bg-surface-container-lowest p-8 rounded-lg shadow-md flex flex-col justify-between relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline-md text-headline-md text-on-surface">Pro Plan</h3>
                <span className="px-3 py-1 rounded-full bg-surface-container-high text-primary text-label-sm font-bold">
                  Coming Soon
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-display-hero text-display-hero font-extrabold text-on-surface">₦0</span>
                <span className="font-body-md text-body-md text-on-surface-variant font-semibold">free during beta</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                Engineered for busy supermarkets and multi-counter retail stores.
              </p>
              <ul className="space-y-3 font-body-md text-body-md text-on-surface mb-8">
                <li className="flex items-center gap-3 font-medium text-primary">
                  <Plus className="h-5 w-5 text-primary shrink-0" />
                  <span>Everything in Free, plus:</span>
                </li>
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <CircleCheck className="h-5 w-5 text-secondary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              to="/signup"
              className="w-full h-12 rounded bg-surface-container-high text-primary font-label-lg text-label-lg shadow-xs hover:bg-surface-container transition-all flex items-center justify-center hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Try Pro free in beta
            </Link>
            </div>
          </Reveal>
        </div>

        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
          Everything is free for now. We&apos;ll notify you well before anything changes.
        </p>
      </div>
    </section>
  )
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <section className="w-full py-20 bg-surface scroll-mt-24" id="faq">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop">
        <SectionHeading
          eyebrow="Got Questions?"
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about setting up and running BizOs."
        />
        <div className="max-w-3xl mx-auto space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <Reveal key={faq.question} delay={index * 60}>
                <div className="bg-surface-container-lowest p-6 rounded-lg shadow-xs transition-shadow duration-300 hover:shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="group w-full flex items-center gap-3 font-headline-sm text-headline-sm text-on-surface text-left"
                  >
                    <faq.icon className="h-[22px] w-[22px] text-primary shrink-0 transition-transform duration-300 group-hover:scale-110" />
                    <span className="flex-1 transition-colors group-hover:text-primary">{faq.question}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-outline transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {/* grid-rows trick: animates height open/closed without JS measuring */}
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p
                        className={`font-body-md text-body-md text-on-surface-variant pl-8 pt-3 transition-opacity duration-300 ${
                          isOpen ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
      <section className="w-full py-16 bg-brand-gradient text-white">
      <Reveal className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop text-center">
        <h2 className="font-headline-lg text-headline-lg font-bold tracking-tight mb-4">
          Start running your shop with total confidence.
        </h2>
        <p className="font-body-lg text-body-lg opacity-90 max-w-xl mx-auto mb-8">
          Join hundreds of Nigerian retail, provision, and grocery shop owners who never lose track of sales or debts.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="group h-12 px-8 rounded bg-surface-container-lowest text-primary font-label-lg text-label-lg shadow-xl hover:bg-surface transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0 active:scale-[0.98]"
          >
            <span>Start free today</span>
            <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <a
            href="#faq"
            className="h-12 px-6 rounded bg-primary-fixed/20 text-white font-label-lg text-label-lg shadow-sm hover:bg-primary-fixed/30 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            <span>Chat with us on WhatsApp</span>
          </a>
        </div>
      </Reveal>
    </section>
  )
}

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Offline Mode', href: '#offline' },
      { label: 'POS', href: '#' },
      { label: 'Reports', href: '#' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About BizOs', href: '#' },
      { label: 'Why Nigeria', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Security', href: '#' },
      { label: 'Data Ownership', href: '#' },
    ],
  },
]

function Footer() {
  return (
    <footer className="w-full bg-surface-container-lowest border-t border-outline-variant/40">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-xl mb-12">
          {FOOTER_COLUMNS.map((column, index) => (
            <Reveal key={column.title} delay={index * 70}>
              <h4 className="font-headline-sm text-headline-sm text-on-surface mb-space-md">{column.title}</h4>
              <ul className="space-y-space-sm font-body-md text-body-md">
                {column.links.map((link) => (
                  <li key={link.label} className="text-on-surface-variant hover:text-primary transition-colors">
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}

          <Reveal delay={210}>
            <h4 className="font-headline-sm text-headline-sm text-on-surface mb-space-md">Contact</h4>
            <ul className="space-y-space-sm font-body-md text-body-md">
              <li className="text-on-surface-variant hover:text-primary">
                <a href="#faq" className="flex items-center gap-1.5">
                  <MessageCircle className="h-[18px] w-[18px] text-secondary" />
                  WhatsApp Support
                </a>
              </li>
              <li className="text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-[18px] w-[18px]" />
                  Lagos Office
                </span>
              </li>
              <li className="text-on-surface-variant hover:text-primary">
                <a href="#faq">Help Center</a>
              </li>
              <li className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm">
                  <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
                  Real-time Status Sync
                </span>
              </li>
            </ul>
          </Reveal>
        </div>

        <div className="border-t border-outline-variant/30 pt-8 flex flex-col sm:flex-row items-center justify-between gap-space-md">
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center sm:text-left">
            © {new Date().getFullYear()} BizOs Technologies Ltd. Made with pride in Nigeria 🇳🇬
          </p>
          <div className="flex items-center gap-space-md text-on-surface-variant">
            <a aria-label="WhatsApp" className="hover:text-primary hover:scale-110 transition-all duration-300" href="#faq">
              <Smartphone className="h-5 w-5" />
            </a>
            <a aria-label="Support" className="hover:text-primary hover:scale-110 transition-all duration-300" href="#faq">
              <Headphones className="h-5 w-5" />
            </a>
            <a aria-label="Security" className="hover:text-primary hover:scale-110 transition-all duration-300" href="#faq">
              <ShieldCheck className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="w-full bg-surface">
      <Header />
      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)]">
        <Hero />
        <TrustStrip />
        <ProblemSection />
        <FeaturesSection />
        <ShowcaseSection />
        <HowItWorksSection />
        <OfflineSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
