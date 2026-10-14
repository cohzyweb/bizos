import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { lagosDayKey, lagosDayStart } from '../../lib/dates'

// Everything the dashboard needs. RLS makes staff see only their own sales.
export function useDashboardData(businessId, { isOwner, canProfit }) {
  return useQuery({
    queryKey: ['dashboard', businessId, isOwner, canProfit],
    enabled: Boolean(businessId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const weekStart = lagosDayStart(-6)
      const todayStart = lagosDayStart(0)

      const [salesRes, owingRes, lowRes, recentRes, profitRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total, amount_paid, payment_type, created_at')
          .eq('business_id', businessId)
          .eq('is_voided', false)
          .gte('created_at', weekStart.toISOString()),
        supabase
          .from('customer_balances')
          .select('customer_id, name, phone, balance, oldest_debt_at')
          .eq('business_id', businessId)
          .gt('balance', 0)
          .order('balance', { ascending: false }),
        supabase
          .from('low_stock_products')
          .select('id, name, stock_qty, low_stock_level')
          .eq('business_id', businessId)
          .order('stock_qty', { ascending: true })
          .limit(6),
        supabase
          .from('sales')
          .select('id, receipt_no, created_at, total, amount_paid, payment_type, is_voided, customers(name)')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(6),
        isOwner && canProfit
          ? supabase.rpc('report_summary', {
              p_business_id: businessId,
              p_start: todayStart.toISOString(),
              p_end: new Date(todayStart.getTime() + 86_400_000).toISOString(),
            })
          : Promise.resolve({ data: null }),
      ])

      for (const r of [salesRes, owingRes, lowRes, recentRes]) if (r.error) throw r.error

      // ---- Today and the 7-day trend, grouped by Lagos day ----
      const todayKey = lagosDayKey(new Date())
      const byDay = {}
      for (let i = 6; i >= 0; i--) byDay[lagosDayKey(lagosDayStart(-i))] = 0
      const today = { total: 0, count: 0, cash: 0, transfer: 0, pos: 0, credit: 0 }

      for (const s of salesRes.data) {
        const key = lagosDayKey(s.created_at)
        byDay[key] = (byDay[key] ?? 0) + Number(s.total)
        if (key !== todayKey) continue
        today.total += Number(s.total)
        today.count += 1
        if (s.payment_type === 'cash') today.cash += Number(s.total)
        else if (s.payment_type === 'transfer') today.transfer += Number(s.total)
        else if (s.payment_type === 'pos') today.pos += Number(s.total)
        else today.credit += Number(s.total) - Number(s.amount_paid) // credit and part-paid
      }

      const owing = owingRes.data
      return {
        today,
        trend: Object.entries(byDay).map(([day, total]) => ({ day, total })),
        owingTotal: owing.reduce((sum, c) => sum + Number(c.balance), 0),
        owingCount: owing.length,
        topDebtors: owing.slice(0, 5),
        lowStock: lowRes.data,
        recent: recentRes.data,
        profitToday: profitRes.data ? Number(profitRes.data.profit ?? 0) : null,
      }
    },
  })
}
