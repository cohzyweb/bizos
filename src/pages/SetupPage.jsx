import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { Button, Field, Input, Logo, Card } from '../components/ui'
import { naira } from '../lib/format'
import { toast, handlePlanError } from '../lib/stores'

const STEPS = ['Business name', 'Contact', 'First products']

export default function SetupPage() {
  const navigate = useNavigate()
  const { refresh, user } = useAuth()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState({ name: '', price: '', stock: '' })
  const [busy, setBusy] = useState(false)

  function addItem() {
    if (!draft.name.trim() || !draft.price) return
    setItems((list) => [...list, { name: draft.name.trim(), price: Number(draft.price), stock: Number(draft.stock || 0) }])
    setDraft({ name: '', price: '', stock: '' })
  }

  async function finish(skipProducts = false) {
    setBusy(true)
    try {
      const { data: businessId, error } = await supabase.rpc('create_business', {
        p_name: name.trim(),
        p_phone: phone.trim() || null,
        p_address: address.trim() || null,
      })
      if (error) throw error

      const toAdd = skipProducts ? [] : items
      for (const it of toAdd) {
        const { data: p, error: pe } = await supabase
          .from('products')
          .insert({ business_id: businessId, name: it.name, selling_price: it.price, cost_price: 0 })
          .select('id')
          .single()
        if (pe) throw pe
        if (it.stock > 0) {
          const { error: se } = await supabase.rpc('adjust_stock', {
            p_product_id: p.id,
            p_change: it.stock,
            p_reason: 'opening',
          })
          if (se) throw se
        }
      }
      await refresh()
      toast.success('Your shop is ready')
      navigate('/', { replace: true })
    } catch (err) {
      if (!handlePlanError(err)) toast.error(err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const canNext = step === 0 ? name.trim().length >= 2 : true

  return (
    <div className="min-h-screen bg-surface px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Logo className="mb-8" />

        <ol className="mb-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= step ? 'bg-primary-container text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span>
              <span className={`hidden text-xs font-semibold sm:block ${i <= step ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < step ? 'bg-primary-container' : 'bg-slate-200'}`} />}
            </li>
          ))}
        </ol>

        <Card className="p-6 sm:p-8">
          {step === 0 && (
            <>
              <h1 className="font-headline text-2xl font-bold text-slate-900">What's your business called?</h1>
              <p className="mt-1 text-slate-600">This appears on your receipts.</p>
              <div className="mt-6">
                <Field label="Business name">
                  <Input autoFocus placeholder="e.g. Adaeze Provisions" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="font-headline text-2xl font-bold text-slate-900">How can customers reach you?</h1>
              <p className="mt-1 text-slate-600">Optional, but it makes your receipts look complete.</p>
              <div className="mt-6 space-y-5">
                <Field label="Phone number">
                  <Input inputMode="tel" placeholder="e.g. 0803 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Shop address">
                  <Input placeholder="e.g. 12 Balogun Market, Lagos Island" value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-headline text-2xl font-bold text-slate-900">Add your first products</h1>
              <p className="mt-1 text-slate-600">Add a few now. You can add the rest any time.</p>
              <div className="mt-6 grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[1fr_120px_100px_auto]">
                <div className="col-span-2 sm:col-span-1">
                  <Input placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <Input inputMode="decimal" placeholder="Price ₦" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^0-9.]/g, '') })} />
                <Input inputMode="numeric" placeholder="In stock" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/[^0-9.]/g, '') })} />
                <Button onClick={addItem} aria-label="Add product" className="h-12 px-4"><Plus className="h-5 w-5" /></Button>
              </div>

              {items.length > 0 && (
                <ul className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {items.map((it, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-800">{it.name}</p>
                        <p className="text-xs text-slate-500">{it.stock} in stock</p>
                      </div>
                      <span className="tabular font-semibold text-slate-800">{naira(it.price)}</span>
                      <button aria-label="Remove" onClick={() => setItems((l) => l.filter((_, x) => x !== i))} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft className="h-4 w-4" /> Back</Button>
            ) : (
              <span className="text-xs text-slate-400">{user?.email}</span>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext}>Continue <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => finish(true)} disabled={busy} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Skip for now</button>
                <Button onClick={() => finish(false)} loading={busy}>Finish setup</Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
