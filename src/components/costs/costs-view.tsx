'use client'

import { useEffect, useState } from 'react'
import { Copy, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import { MoneyInput } from '@/components/money-input'
import { MonthSelect, monthLabel, shiftMonth } from '@/components/month-select'

type CostType = 'FIXED' | 'VARIABLE' | 'LOAN'
type Recurrence = 'MONTHLY' | 'ANNUAL' | 'ONETIME'

type Cost = {
  id: string
  name: string
  amount: number
  type: CostType
  recurrence: Recurrence
  monthlyAmount: number
}

type CostsResponse = {
  month: string
  currentMonth: string
  costs: Cost[]
  summary: { fixed: number; variable: number; loan: number; total: number }
}

type RevenueResponse = {
  month: string
  grossRevenue: number
  history: { month: string; grossRevenue: number }[]
}

const TYPE_LABEL: Record<CostType, string> = {
  FIXED: 'Fixo',
  VARIABLE: 'Variável',
  LOAN: 'Empréstimo',
}
const GROUP_LABEL: Record<CostType, string> = {
  FIXED: 'Custos fixos',
  VARIABLE: 'Custos variáveis',
  LOAN: 'Empréstimos',
}
const RECURRENCE_LABEL: Record<Recurrence, string> = {
  MONTHLY: 'Mensal',
  ANNUAL: 'Anual',
  ONETIME: 'Única',
}
const BADGE: Record<CostType, string> = {
  FIXED: 'bg-primary/10 text-primary',
  VARIABLE: 'bg-orange/30 text-charcoal',
  LOAN: 'bg-accent/30 text-primary',
}

const monthFmt = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const inputCls = 'w-full rounded-lg border border-primary/20 bg-white px-3 py-3 text-base'

export function CostsView() {
  const [tab, setTab] = useState<'costs' | 'revenue'>('costs')

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-white p-1 shadow-sm">
        {(
          [
            ['costs', 'Custos'],
            ['revenue', 'Faturamento'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-md py-2 font-medium ${
              tab === value ? 'bg-primary text-white' : 'text-charcoal'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'costs' ? <CostsTab /> : <RevenueTab />}
    </div>
  )
}

function CostsTab() {
  const [data, setData] = useState<CostsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Cost | 'new' | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [version, setVersion] = useState(0)
  const load = () => setVersion((v) => v + 1)

  useEffect(() => {
    let cancelled = false
    fetch(month ? `/api/costs?month=${month}` : '/api/costs')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar custos')
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar custos')
      })
    return () => {
      cancelled = true
    }
  }, [version, month])

  function selectMonth(ym: string) {
    setMonth(ym)
    setEditing(null)
    setNotice(null)
    setError(null)
  }

  async function replicate(from: string, to: string) {
    if (
      !confirm(
        `Copiar os custos de ${monthLabel(from)} para ${monthLabel(to)}? Itens que já existem no mês (mesmo nome e tipo) serão ignorados.`,
      )
    )
      return
    setCopying(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/costs/replicate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fromMonth: from, toMonth: to }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao copiar custos')
      setNotice(
        json.sourceCount === 0
          ? `${monthLabel(from)} não tem custos para copiar.`
          : `${json.created} copiado(s)` +
              (json.skipped > 0 ? `, ${json.skipped} já existia(m).` : '.'),
      )
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao copiar custos')
    } finally {
      setCopying(false)
    }
  }

  async function remove(c: Cost) {
    if (!confirm(`Excluir "${c.name}"?`)) return
    const res = await fetch(`/api/costs/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Erro ao excluir')
      return
    }
    load()
  }

  if (!data) {
    return error ? (
      <Alert>{error}</Alert>
    ) : (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const selected = data.month.slice(0, 7)
  const previous = shiftMonth(selected, -1)
  const switching = month !== null && month !== selected

  const copyButton = (
    <button
      type="button"
      onClick={() => replicate(previous, selected)}
      disabled={copying}
      className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-3 font-medium text-primary disabled:opacity-50"
    >
      {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
      Copiar do mês anterior
    </button>
  )

  const groups = (['FIXED', 'VARIABLE', 'LOAN'] as CostType[])
    .map((t) => ({ type: t, items: data.costs.filter((c) => c.type === t) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className={`pb-24 ${switching ? 'opacity-60' : ''}`}>
      {error && <Alert>{error}</Alert>}
      {notice && (
        <div role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <label className="mb-4 block">
        <span className="mb-1 block text-sm">Mês</span>
        <MonthSelect current={data.currentMonth} value={selected} onChange={selectMonth} />
      </label>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Fixo" value={data.summary.fixed} />
        <Stat label="Variável" value={data.summary.variable} />
        <Stat label="Total" value={data.summary.total} strong />
      </div>
      {data.summary.loan > 0 && (
        <p className="mb-4 text-xs">
          O total inclui {formatBRL(data.summary.loan)} de empréstimos. Custos anuais são rateados
          em 12 meses.
        </p>
      )}

      {editing && (
        <CostForm
          cost={editing === 'new' ? null : editing}
          month={selected}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {groups.length === 0 && !editing && (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-sm">
          <p>Nenhum custo lançado. Copiar do mês anterior?</p>
          {copyButton}
          <p className="text-xs">Ou toque em + para lançar manualmente.</p>
        </div>
      )}
      {groups.length > 0 && <div className="mb-5 grid">{copyButton}</div>}

      {groups.map((g) => (
        <section key={g.type} className="mb-5">
          <h2 className="mb-2 text-lg text-primary">{GROUP_LABEL[g.type]}</h2>
          <ul className="space-y-2">
            {g.items.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-primary">{c.name}</p>
                  <p className="flex items-center gap-2 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[c.type]}`}>
                      {TYPE_LABEL[c.type]}
                    </span>
                    {RECURRENCE_LABEL[c.recurrence]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-1 font-medium">{formatBRL(c.amount)}</span>
                  <button
                    aria-label={`Editar ${c.name}`}
                    onClick={() => setEditing(c)}
                    className="p-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={`Excluir ${c.name}`}
                    onClick={() => remove(c)}
                    className="p-2 text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <button
        aria-label="Novo custo"
        onClick={() => setEditing('new')}
        className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg md:bottom-6 md:right-6"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  )
}

function CostForm({
  cost,
  month,
  onCancel,
  onSaved,
}: {
  cost: Cost | null
  month: string
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(cost?.name ?? '')
  const [amount, setAmount] = useState(cost?.amount ?? 0)
  const [type, setType] = useState<CostType>(cost?.type ?? 'FIXED')
  const [recurrence, setRecurrence] = useState<Recurrence>(cost?.recurrence ?? 'MONTHLY')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = amount
    if (!name.trim() || !(value > 0)) {
      setError('Informe um nome e um valor maior que zero')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(cost ? `/api/costs/${cost.id}` : '/api/costs', {
        method: cost ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          amount: value,
          type,
          recurrence,
          ...(cost ? {} : { month }),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 space-y-3 rounded-xl border border-accent bg-white p-4">
      <h2 className="text-lg text-primary">{cost ? 'Editar custo' : 'Novo custo'}</h2>
      {error && <Alert>{error}</Alert>}
      <label className="block">
        <span className="mb-1 block text-sm">Nome</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Aluguel"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">Valor (R$)</span>
        <MoneyInput value={amount} onChange={setAmount} placeholder="0,00" className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm">Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CostType)}
            className={inputCls}
          >
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Recorrência</span>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className={inputCls}
          >
            {Object.entries(RECURRENCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-primary/30 px-4 py-3 font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </button>
      </div>
    </form>
  )
}

function RevenueTab() {
  const [data, setData] = useState<RevenueResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [value, setValue] = useState(0)
  const [month, setMonth] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/revenue')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar faturamento')
        setData(json)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar faturamento'))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const n = value
    if (!(n > 0) || !data) {
      setError('Informe um valor válido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/revenue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grossRevenue: n,
          month: month ?? data.month.slice(0, 7),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      setData(json)
      setValue(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return error ? (
      <Alert>{error}</Alert>
    ) : (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div>
      {error && <Alert>{error}</Alert>}
      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <p className="text-sm capitalize">{monthFmt.format(new Date(data.month))}</p>
        <p className="text-3xl font-semibold text-primary">{formatBRL(data.grossRevenue)}</p>
        <p className="text-xs">Faturamento bruto do mês</p>
      </div>

      <form onSubmit={save} className="mb-6 space-y-2">
        <label className="block">
          <span className="mb-1 block text-sm">Mês de referência</span>
          <MonthSelect
            current={data.month}
            value={month ?? data.month.slice(0, 7)}
            onChange={setMonth}
          />
        </label>
        <div className="flex gap-2">
          <MoneyInput
            value={value}
            onChange={setValue}
            placeholder="Faturamento (R$)"
            aria-label="Faturamento do mês"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={saving}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </form>

      <h2 className="mb-2 text-lg text-primary">Últimos 6 meses</h2>
      <ul className="divide-y divide-primary/10 rounded-xl bg-white shadow-sm">
        {data.history.map((h) => (
          <li key={h.month} className="flex justify-between px-4 py-3">
            <span className="capitalize">{monthFmt.format(new Date(h.month))}</span>
            <span className="font-medium">{formatBRL(h.grossRevenue)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 shadow-sm ${strong ? 'bg-primary text-white' : 'bg-white'}`}>
      <p className="text-xs">{label}</p>
      <p className="text-sm font-semibold sm:text-base">{formatBRL(value)}</p>
    </div>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      {children}
    </div>
  )
}
