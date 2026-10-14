import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Calendar,
  Download,
  Eye,
  EyeOff,
  Lock,
  PieChart,
  Receipt,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { useEntitlements } from '../features/plans/useEntitlements'
import { Badge, Button, Card, EmptyState, Input, Spinner, cx } from '../components/ui'
import { formatDate, naira } from '../lib/format'
import { lagosDayKey, lagosDayStart } from '../lib/dates'
import { handlePlanError, toast, useUpgradeStore } from '../lib/stores'

const DAY_MS = 86_400_000
const LAGOS_OFFSET_MS = 3_600_000
const MASK = '••••••'
const MASK_SHORT = '••••'

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last', label: 'Last Month' },
]

const MIX_META = {
  cash: { label: 'Cash', tone: 'bg-primary' },
  transfer: { label: 'Bank transfer', tone: 'bg-secondary' },
  pos: { label: 'POS terminal', tone: 'bg-primary-fixed' },
  part: { label: 'Part payment', tone: 'bg-tertiary' },
  credit: { label: 'Store credit (ledger)', tone: 'bg-error' },
}

function mixMeta(type) {
  return MIX_META[type] || { label: type, tone: 'bg-slate-400' }
}

// Lagos day index for an instant (calendar-day arithmetic that ignores time of day).
function dayIndex(value) {
  return Math.floor((new Date(value).getTime() + LAGOS_OFFSET_MS) / DAY_MS)
}

function pct(part, whole) {
  const w = Number(whole)
  if (!(w > 0)) return 0
  return Math.round((Number(part) / w) * 1000) / 10
}

// The four selectable ranges, all computed on the Lagos (UTC+1) calendar.
function buildRanges(now = new Date()) {
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET_MS)
  const y = lagosNow.getUTCFullYear()
  const m = lagosNow.getUTCMonth()
  const monthStart = new Date(Date.UTC(y, m, 1) - LAGOS_OFFSET_MS)
  const prevMonthStart = new Date(Date.UTC(y, m - 1, 1) - LAGOS_OFFSET_MS)
  return {
    today: { start: lagosDayStart(0, now), end: now },
    week: { start: lagosDayStart(-6, now), end: now },
    month: { start: monthStart, end: now },
    last: { start: prevMonthStart, end: new Date(monthStart.getTime() - 1) },
  }
}

// Every Lagos calendar day the range touches, oldest first.
function rangeDays(range) {
  const out = []
  const first = lagosDayStart(0, range.start).getTime()
  const last = range.end.getTime()
  for (let t = first, i = 0; t <= last && i < 400; t += DAY_MS, i += 1) out.push(new Date(t))
  return out
}

// "14 days elapsed / 31 total" for the active range.
function periodSpan(period, range) {
  if (period === 'today') return { elapsed: 1, total: 1 }
  if (period === 'week') {
    const elapsed = dayIndex(Date.now()) - dayIndex(range.start) + 1
    return { elapsed: Math.min(7, Math.max(1, elapsed)), total: 7 }
  }
  const s = new Date(range.start.getTime() + LAGOS_OFFSET_MS)
  const daysInMonth = Math.round(
    (Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1) - Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1)) / DAY_MS,
  )
  if (period === 'last') return { elapsed: daysInMonth, total: daysInMonth }
  const elapsed = dayIndex(Date.now()) - dayIndex(range.start) + 1
  return { elapsed: Math.min(daysInMonth, Math.max(1, elapsed)), total: daysInMonth }
}

function periodLabel(period, range) {
  if (period === 'month') return `This Month (${formatDate(range.start, { day: undefined, month: 'short', year: 'numeric' })})`
  if (period === 'last') return `Last Month (${formatDate(range.start, { day: undefined, month: 'short', year: 'numeric' })})`
  return (PERIODS.find((p) => p.id === period) || PERIODS[0]).label
}

// Owner-only RPC + the raw rows the charts / leaderboards are built from.
async function fetchReport(businessId, range) {
  const startMs = range.start.getTime()
  const endMs = range.end.getTime()

  const [summaryRes, salesRes, itemsRes] = await Promise.all([
    supabase.rpc('report_summary', {
      p_business_id: businessId,
      p_start: new Date(startMs).toISOString(),
      p_end: new Date(endMs).toISOString(),
    }),
    supabase
      .from('sales')
      .select('id, business_id, payment_type, total, amount_paid, is_voided, created_at, receipt_no')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true }),
    supabase
      .from('sale_items')
      .select('id, sale_id, product_id, product_name, qty, unit_price, unit_cost, line_total')
      .eq('business_id', businessId),
  ])

  if (salesRes.error) throw salesRes.error
  if (itemsRes.error) throw itemsRes.error

  // PLAN_LIMIT:report_range -> opens the upgrade modal, inline card is shown too.
  let planLimited = false
  if (summaryRes.error) {
    if (!handlePlanError(summaryRes.error)) throw summaryRes.error
    planLimited = true
  }

  const sales = (salesRes.data || []).filter((s) => {
    const t = new Date(s.created_at).getTime()
    return t >= startMs && t <= endMs
  })
  const live = sales.filter((s) => !s.is_voided)

  // ---- Daily buckets ----
  const days = rangeDays(range).map((date) => ({ key: lagosDayKey(date), date, total: 0, count: 0 }))
  const byKey = new Map(days.map((d) => [d.key, d]))
  for (const s of live) {
    const bucket = byKey.get(lagosDayKey(s.created_at))
    if (bucket) {
      bucket.total += Number(s.total)
      bucket.count += 1
    }
  }

  // ---- Money metrics (client-side mirror of report_summary) ----
  const totalSales = live.reduce((sum, s) => sum + Number(s.total), 0)
  const collected = live.reduce((sum, s) => sum + Number(s.amount_paid), 0)
  const local = {
    total: totalSales,
    count: live.length,
    collected,
    outstanding: totalSales - collected,
    avg: live.length ? totalSales / live.length : 0,
  }
  const summary = planLimited ? null : summaryRes.data
  const totals = {
    total: summary ? Number(summary.total_sales) : local.total,
    count: summary ? Number(summary.sales_count) : local.count,
    collected: summary ? Number(summary.collected) : local.collected,
    outstanding: summary ? Number(summary.outstanding) : local.outstanding,
    avg: summary ? Number(summary.avg_sale) : local.avg,
    profit: summary && summary.profit !== null && summary.profit !== undefined ? Number(summary.profit) : null,
  }

  // ---- Chart series: daily up to 14 days, grouped by week beyond that ----
  const todayKey = lagosDayKey(new Date())
  let series
  let groupedWeekly = false
  if (days.length > 14) {
    groupedWeekly = true
    series = []
    for (let i = 0; i < days.length; i += 7) {
      const part = days.slice(i, i + 7)
      series.push({
        key: part[0].key,
        label: `${formatDate(part[0].date, { day: '2-digit', month: 'short', year: undefined })} – ${formatDate(
          part[part.length - 1].date,
          { day: '2-digit', month: 'short', year: undefined },
        )}`,
        total: part.reduce((sum, d) => sum + d.total, 0),
        isToday: part.some((d) => d.key === todayKey),
      })
    }
  } else {
    series = days.map((d) => ({
      key: d.key,
      label: days.length === 1 ? 'Today' : formatDate(d.date, { year: undefined }),
      total: d.total,
      isToday: d.key === todayKey,
    }))
  }

  // ---- Sub-stats ----
  let busiest = null
  let best = null
  for (const d of days) {
    if (!busiest || d.count > busiest.count) busiest = { date: d.date, count: d.count }
    if (!best || d.total > best.total) best = { date: d.date, total: d.total }
  }

  // ---- Settlement mix ----
  const mixMap = new Map()
  for (const s of live) {
    const type = s.payment_type || 'cash'
    const row = mixMap.get(type) || { type, amount: 0, count: 0 }
    row.amount += Number(s.total)
    row.count += 1
    mixMap.set(type, row)
  }
  const mix = [...mixMap.values()].sort((a, b) => b.amount - a.amount)

  // ---- Product leaderboard (items joined to in-range, non-voided sales) ----
  const liveIds = new Set(live.map((s) => s.id))
  const board = new Map()
  for (const item of itemsRes.data || []) {
    if (!liveIds.has(item.sale_id)) continue
    const key = item.product_id || item.product_name
    const row = board.get(key) || { id: key, name: item.product_name || 'Unnamed item', units: 0, revenue: 0, margin: 0 }
    row.units += Number(item.qty)
    row.revenue += Number(item.line_total)
    row.margin += (Number(item.unit_price) - Number(item.unit_cost)) * Number(item.qty)
    board.set(key, row)
  }

  return {
    planLimited,
    empty: live.length === 0,
    totals,
    balanceSales: live.filter((s) => Number(s.amount_paid) < Number(s.total)).length,
    days,
    series,
    groupedWeekly,
    mix,
    leaderboard: [...board.values()],
    stats: { busiest, best, perDay: days.length ? totals.total / days.length : 0 },
  }
}

function downloadCsv(days) {
  const rows = [['day', 'sales_count', 'total_ngn']]
  for (const d of days) rows.push([d.key, d.count, Number(d.total).toFixed(2)])
  const csv = rows.map((r) => r.join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const first = days[0]?.key || 'range'
  const last = days[days.length - 1]?.key || first
  link.href = url
  link.download = `bizos-daily-summary-${first}-to-${last}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  toast.success('Daily summary exported')
}

function RangeChart({ series, masked }) {
  const max = Math.max(...series.map((d) => d.total), 1)
  return (
    <div className="flex h-56 items-end gap-2 sm:gap-3">
      {series.map((d) => {
        const h = Math.max(4, Math.round((d.total / max) * 100))
        return (
          <div key={d.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="tabular truncate text-[10px] font-semibold text-slate-500 sm:text-xs">
              {masked ? MASK_SHORT : d.total >= 1000 ? `${Math.round(d.total / 100) / 10}k` : d.total || ''}
            </span>
            <div
              className={cx('mx-auto w-full max-w-[88px] rounded-t-DEFAULT', d.isToday ? 'bg-primary-container' : 'bg-teal-200')}
              style={{ height: `${h}%` }}
            />
            <span
              className={cx(
                'truncate text-[10px] font-semibold sm:text-[11px]',
                d.isToday ? 'text-primary-container' : 'text-slate-400',
              )}
            >
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function StatTile({ label, value, hint, tone = 'text-slate-900' }) {
  return (
    <div className="flex items-center gap-3 rounded bg-surface-container-low p-3">
      <div className="min-w-0">
        <p className="label-caps">{label}</p>
        <p className={cx('tabular mt-1 truncate font-headline text-base font-bold', tone)}>{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { business, businessId, isOwner } = useAuth()
  const { can, limit } = useEntitlements()
  const showUpgrade = useUpgradeStore((s) => s.show)

  const [period, setPeriod] = useState('today')
  const [hideFigures, setHideFigures] = useState(false)
  const [filter, setFilter] = useState('')

  const ranges = useMemo(() => buildRanges(), [])
  const range = ranges[period] || ranges.today
  const canProfit = can('profit_report')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['reports', businessId, range.start.getTime(), range.end.getTime(), canProfit],
    enabled: Boolean(businessId) && isOwner,
    queryFn: () => fetchReport(businessId, range),
  })

  // Every naira on the page goes through here so Hide Figures masks all of it.
  const money = (value) => (hideFigures ? MASK : naira(Math.round(Number(value ?? 0))))

  if (!isOwner) return null

  if (isLoading || (!data && !error)) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Card className="mx-auto max-w-lg">
          <EmptyState
            icon={AlertTriangle}
            title="Could not load this report"
            hint={error.message}
            action={<Button onClick={() => refetch()}>Try again</Button>}
          />
        </Card>
      </div>
    )
  }

  const { totals, days, series, groupedWeekly, mix, leaderboard, stats, planLimited, balanceSales, empty } = data
  const span = periodSpan(period, range)
  const collectedPct = pct(totals.collected, totals.total)
  const marginPctValue = pct(totals.profit ?? 0, totals.total)

  const board = [...leaderboard].sort((a, b) => (canProfit ? b.margin - a.margin : b.revenue - a.revenue))
  const visibleBoard = board
    .filter((r) => r.name.toLowerCase().includes(filter.trim().toLowerCase()))
    .slice(0, 8)

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {/* ===== Header ===== */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">Reports &amp; Analytics</h1>
            <Badge tone="primary">
              <Lock className="h-3 w-3" /> Owner
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Executive financial intelligence, margin analysis, and sales velocity for{' '}
            <span className="font-semibold text-slate-900">{business?.name}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            aria-pressed={hideFigures}
            aria-label={hideFigures ? 'Show figures' : 'Hide figures'}
            title={hideFigures ? 'Show all money on this page' : 'Mask financial figures for discreet viewing'}
            onClick={() => setHideFigures((v) => !v)}
          >
            {hideFigures ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {hideFigures ? 'Show Figures' : 'Hide Figures'}
          </Button>
          <Button variant="secondary" onClick={() => downloadCsv(days)} aria-label="Export daily summary as CSV">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ===== Period bar ===== */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lift md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Report period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cx(
                'focus-ring whitespace-nowrap rounded px-3 py-2 text-sm font-semibold transition-colors',
                period === p.id
                  ? 'bg-primary-container text-white'
                  : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800',
              )}
            >
              {periodLabel(p.id, ranges[p.id])}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex flex-wrap items-center gap-2 rounded bg-surface-container-low px-3 py-2 text-sm text-slate-700">
            <Calendar className="h-4 w-4 shrink-0 text-primary-container" aria-hidden="true" />
            <span className="tabular font-semibold">
              {formatDate(range.start)} – {formatDate(range.end)}
            </span>
            <span className="text-xs text-slate-500">
              ({span.elapsed} day{span.elapsed === 1 ? '' : 's'} elapsed / {span.total} total)
            </span>
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            aria-label="Refresh metrics"
            title="Refresh metrics"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <RefreshCw className={cx('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ===== Plan limit: longer range than the plan allows ===== */}
      {planLimited ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-700">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <p className="font-headline text-base font-bold text-slate-900">Upgrade to unlock longer ranges</p>
                <p className="mt-1 text-sm text-slate-600">
                  Your current plan covers reports of up to {Number(limit('report_max_days')) || 7} days at a time, so
                  the figures for {formatDate(range.start)} – {formatDate(range.end)} are hidden.
                </p>
              </div>
            </div>
            <Button onClick={() => showUpgrade('report_range')}>See how to unlock</Button>
          </div>
        </Card>
      ) : (
        <>
          {/* ===== KPI row ===== */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-brand-gradient p-5 text-white shadow-lift">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-100">Total sales</p>
              <p className="tabular mt-2 font-headline text-3xl font-extrabold">{money(totals.total)}</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-teal-100">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                {totals.count} sale{totals.count === 1 ? '' : 's'} in this range
              </p>
              <p className="tabular mt-1 text-xs text-teal-100/90">Average sale {money(totals.avg)}</p>
            </div>

            <Card className="shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-caps">Collected</p>
                  <p className="tabular mt-2 font-headline text-3xl font-extrabold text-emerald-600">
                    {money(totals.collected)}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-600">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                {totals.total > 0 ? (
                  <Badge tone="success" dot>
                    {collectedPct}% of total
                  </Badge>
                ) : (
                  <Badge tone="neutral">No sales yet</Badge>
                )}
                <span className="text-xs text-slate-500">Cash, transfers &amp; POS received</span>
              </div>
            </Card>

            <Card className="shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-caps">Outstanding / who owes</p>
                  <p className="tabular mt-2 font-headline text-3xl font-extrabold text-red-600">
                    {money(totals.outstanding)}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-red-50 text-red-600">
                  <Receipt className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                {balanceSales > 0 ? (
                  <Badge tone="danger">
                    {balanceSales} sale{balanceSales === 1 ? '' : 's'} awaiting balance
                  </Badge>
                ) : (
                  <Badge tone="success" dot>
                    All paid up
                  </Badge>
                )}
                <Link to="/customers" className="text-sm font-semibold text-teal-700 hover:underline">
                  View ledgers →
                </Link>
              </div>
            </Card>

            <Card className="shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <p className="label-caps">Profit</p>
                {canProfit && totals.profit !== null && <Badge tone="neutral">Owner only</Badge>}
              </div>
              {!canProfit || totals.profit === null ? (
                <>
                  <p className="mt-2 flex items-center gap-2 font-headline text-2xl font-bold text-slate-300">
                    <Lock className="h-6 w-6" aria-hidden="true" /> Pro
                  </p>
                  <button
                    type="button"
                    onClick={() => showUpgrade('profit_report')}
                    className="focus-ring mt-3 text-sm font-semibold text-teal-700 hover:underline"
                  >
                    See how to unlock
                  </button>
                </>
              ) : (
                <>
                  <p className="tabular mt-2 font-headline text-3xl font-extrabold text-teal-700">
                    {money(totals.profit)}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {marginPctValue}% margin on sales
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(0, Math.min(100, marginPctValue))}%` }}
                    />
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* ===== Empty range ===== */}
          {empty ? (
            <Card>
              <EmptyState
                icon={Receipt}
                title="No sales in this period"
                hint="Nothing was recorded between these dates. Pick another period or record a sale."
                action={
                  <Link
                    to="/sales"
                    className="focus-ring inline-flex h-11 items-center rounded bg-primary-container px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-600"
                  >
                    Go to sales history
                  </Link>
                }
              />
            </Card>
          ) : (
            <>
              {/* ===== Chart + settlement mix ===== */}
              <div className="grid items-start gap-4 lg:grid-cols-12">
                <Card className="lg:col-span-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-headline text-lg font-bold text-slate-900">Revenue — daily sales</h2>
                        <Badge tone="neutral">
                          {groupedWeekly ? 'Grouped by week' : `${days.length} day${days.length === 1 ? '' : 's'}`}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {groupedWeekly
                          ? 'This range is longer than 14 days, so daily sales are grouped by week.'
                          : 'Sales value recorded on each day of this range.'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <RangeChart series={series} masked={hideFigures} />
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <StatTile
                      label="Busiest day"
                      value={
                        stats.busiest && stats.busiest.count > 0
                          ? formatDate(stats.busiest.date, {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                              year: undefined,
                            })
                          : '—'
                      }
                      hint={`${stats.busiest?.count ?? 0} sale${stats.busiest?.count === 1 ? '' : 's'}`}
                    />
                    <StatTile
                      label="Best day total"
                      value={money(stats.best?.total ?? 0)}
                      hint={
                        stats.best && stats.best.total > 0
                          ? formatDate(stats.best.date, { day: '2-digit', month: 'short', year: undefined })
                          : 'No sales yet'
                      }
                      tone="text-teal-700"
                    />
                    <StatTile
                      label="Average per day"
                      value={money(stats.perDay)}
                      hint={`Across ${days.length} day${days.length === 1 ? '' : 's'}`}
                    />
                  </div>
                </Card>

                <Card className="lg:col-span-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-headline text-lg font-bold text-slate-900">Settlement Mix</h2>
                    <PieChart className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">How this period's sales were paid for.</p>
                  <ul className="mt-4 space-y-3">
                    {mix.map((row) => {
                      const meta = mixMeta(row.type)
                      const share = pct(row.amount, totals.total)
                      return (
                        <li key={row.type} className="rounded bg-surface-container-low p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', meta.tone)} aria-hidden="true" />
                              <span className="truncate text-sm font-semibold text-slate-800">{meta.label}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="tabular block text-sm font-bold text-slate-900">{money(row.amount)}</span>
                              <span className="tabular block text-[11px] text-slate-500">{share}% share</span>
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={cx('h-full rounded-full', meta.tone)}
                              style={{ width: `${share}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-500">
                            {row.count} sale{row.count === 1 ? '' : 's'}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    Share of total sales value in this range. Credit and part-paid rows count the full sale value.
                  </p>
                </Card>
              </div>

              {/* ===== Product contribution & margin leaderboard ===== */}
              <Card>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-headline text-lg font-bold text-slate-900">
                        Product Contribution &amp; Margin Leaderboard
                      </h2>
                      <Badge tone="neutral">Top {Math.min(8, board.length)} drivers</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Ranked by {canProfit ? 'realised margin' : 'revenue'} for the selected range.
                    </p>
                  </div>
                  <div className="relative md:w-64">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Filter product..."
                      aria-label="Filter products by name"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-3">Rank &amp; product</th>
                        <th className="px-3 py-3 text-right">Units sold</th>
                        <th className="px-3 py-3 text-right">Revenue</th>
                        <th className="px-3 py-3 text-right">
                          <span className="inline-flex items-center gap-1">
                            {canProfit ? null : <Lock className="h-3 w-3" aria-hidden="true" />} Margin
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBoard.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                            {board.length === 0 ? 'No items sold in this range.' : 'No products match your filter.'}
                          </td>
                        </tr>
                      ) : (
                        visibleBoard.map((row, i) => (
                          <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className={cx(
                                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                    i === 0 ? 'bg-primary-container text-white' : 'bg-surface-container-high text-slate-700',
                                  )}
                                >
                                  {i + 1}
                                </span>
                                <span className="truncate font-semibold text-slate-800">{row.name}</span>
                              </div>
                            </td>
                            <td className="tabular px-3 py-3 text-right text-slate-700">{row.units}</td>
                            <td className="tabular px-3 py-3 text-right font-bold text-slate-900">
                              {money(row.revenue)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {canProfit ? (
                                <span className="flex flex-col items-end">
                                  <span className="tabular font-bold text-emerald-700">{money(row.margin)}</span>
                                  <span className="tabular text-[11px] text-slate-500">
                                    {pct(row.margin, row.revenue)}% margin
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-end gap-2 text-sm text-slate-400">
                                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                  <button
                                    type="button"
                                    onClick={() => showUpgrade('profit_report')}
                                    className="focus-ring font-semibold text-teal-700 hover:underline"
                                  >
                                    Unlock
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {!canProfit && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Margin per product is a Pro feature — revenue and units stay visible on every plan.
                  </p>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
