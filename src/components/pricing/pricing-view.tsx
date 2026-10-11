'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, HelpCircle, Loader2 } from 'lucide-react'
import { formatBRL, parseNumber } from '@/lib/format'
import { MonthSelect } from '@/components/month-select'
import {
  breakEven,
  marginLevel,
  marginPct,
  priceByMargin,
  priceByMarkup,
  workingCapital,
  type MarginLevel,
} from '@/lib/pricing-calc'

type CostsResponse = {
  month: string
  currentMonth: string
  summary: { fixed: number; variable: number; loan: number; total: number }
}
type RevenueResponse = { grossRevenue: number }
type RecipeOption = { id: string; name: string; unitCost: number | null; totalCost: number }

const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const inputCls = 'w-full rounded-lg border border-primary/20 bg-white px-3 py-3 text-base'

type Period = {
  month: string // YYYY-MM efetivamente carregado
  currentMonth: string
  fixed: number
  variable: number
  loan: number
  revenue: number
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar dados')
  return json as T
}

export function PricingView() {
  const [period, setPeriod] = useState<Period | null>(null)
  const [recipes, setRecipes] = useState<RecipeOption[]>([])
  const [month, setMonth] = useState<string | null>(null) // null = mês atual
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>('margin')

  useEffect(() => {
    getJson<RecipeOption[]>('/api/recipes')
      .then(setRecipes)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar dados'))
  }, [])

  useEffect(() => {
    let cancelled = false
    const q = month ? `?month=${month}` : ''
    Promise.all([
      getJson<CostsResponse>(`/api/costs${q}`),
      getJson<RevenueResponse>(`/api/revenue${q}`),
    ])
      .then(([costs, revenue]) => {
        if (cancelled) return
        setError(null)
        setPeriod({
          month: costs.month.slice(0, 7),
          currentMonth: costs.currentMonth,
          fixed: costs.summary.fixed,
          variable: costs.summary.variable,
          loan: costs.summary.loan,
          revenue: revenue.grossRevenue,
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
      })
    return () => {
      cancelled = true
    }
  }, [month])

  if (!period) {
    return error ? (
      <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    ) : (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const ctx = { ...period, recipes }
  const switching = month !== null && month !== period.month

  const expenses = ctx.fixed + ctx.variable + ctx.loan
  const net = ctx.revenue - expenses

  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id))

  return (
    <div className={`pb-8 ${switching ? 'opacity-60' : ''}`}>
      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <label className="mb-4 block">
        <span className="mb-1 block text-sm">Mês de referência</span>
        <MonthSelect
          current={period.currentMonth}
          value={month ?? period.month}
          onChange={setMonth}
        />
      </label>
      <div className="mb-2 grid grid-cols-2 gap-3">
        <Summary label="Faturamento bruto" value={ctx.revenue} />
        <Summary label="Despesas fixas" value={ctx.fixed} />
        <Summary label="Despesas variáveis" value={ctx.variable} />
        <Summary label="Receita líquida" value={net} tone={net >= 0 ? 'good' : 'bad'} />
      </div>
      <p className="mb-5 text-xs">
        Receita líquida = faturamento − todas as despesas
        {ctx.loan > 0 ? ` (inclui ${formatBRL(ctx.loan)} de empréstimos)` : ''}. Valores do mês
        selecionado.
      </p>

      <div className="space-y-3">
        <Calculator
          id="margin"
          title="Margem de contribuição"
          formula="Preço = Custo ÷ (1 − Margem%)"
          open={open === 'margin'}
          onToggle={toggle}
          help="É a parte do preço de venda que sobra depois de pagar o custo do produto. Com ela você cobre as despesas fixas e ainda tem lucro. Se o custo é R$ 6 e você quer 40% de margem, o preço é R$ 6 ÷ 0,60 = R$ 10: dos R$ 10, R$ 4 (40%) ficam com a padaria."
        >
          <MarginCalc recipes={ctx.recipes} />
        </Calculator>

        <Calculator
          id="markup"
          title="Markup"
          formula="Preço = Custo × (1 + Markup%)"
          open={open === 'markup'}
          onToggle={toggle}
          help="É o percentual que você soma em cima do custo para chegar ao preço. Custo R$ 6 com markup de 50% vira R$ 9. Atenção: markup de 50% NÃO é margem de 50% — a margem real nesse caso é de 33%. Por isso a calculadora compara os dois."
        >
          <MarkupCalc recipes={ctx.recipes} />
        </Calculator>

        <Calculator
          id="breakeven"
          title="Ponto de equilíbrio"
          formula="PE = Custos fixos ÷ Margem%"
          open={open === 'breakeven'}
          onToggle={toggle}
          help="É o faturamento mínimo no mês para pagar todos os custos fixos, sem lucro nem prejuízo. Abaixo dele a padaria perde dinheiro; acima, começa a lucrar. Se os fixos são R$ 10.000 e a margem média é 40%, precisa faturar R$ 25.000."
        >
          <BreakEvenCalc key={ctx.month} fixed={ctx.fixed + ctx.loan} revenue={ctx.revenue} />
        </Calculator>

        <Calculator
          id="wc"
          title="Capital de giro"
          formula="NCG = (PMR + PME − PMP) × Fat. diário"
          open={open === 'wc'}
          onToggle={toggle}
          help="É o dinheiro que precisa estar disponível para tocar a operação enquanto você espera receber. PMR: dias até o cliente pagar. PME: dias que o estoque fica parado. PMP: dias que o fornecedor te dá para pagar. Quanto maior o ciclo (PMR + PME − PMP), mais caixa você precisa."
        >
          <WorkingCapitalCalc key={ctx.month} revenue={ctx.revenue} />
        </Calculator>
      </div>
    </div>
  )
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs">{label}</p>
      <p
        className={`text-lg font-semibold ${
          tone === 'bad' ? 'text-red-700' : tone === 'good' ? 'text-green-700' : 'text-primary'
        }`}
      >
        {formatBRL(value)}
      </p>
    </div>
  )
}

function Calculator({
  id,
  title,
  formula,
  help,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  formula: string
  help: string
  open: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
}) {
  const [showHelp, setShowHelp] = useState(false)
  return (
    <section className="rounded-xl bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <h2 className="text-lg text-primary">{title}</h2>
          <span className="mt-1 inline-block rounded-full bg-accent/30 px-2 py-0.5 text-xs text-primary">
            {formula}
          </span>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-primary/10 p-4">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="flex items-center gap-1 text-sm text-primary underline"
          >
            <HelpCircle className="h-4 w-4" /> O que é isso?
          </button>
          {showHelp && <p className="rounded-lg bg-cream p-3 text-sm">{help}</p>}
          {children}
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm">
        {label}
        {suffix ? ` (${suffix})` : ''}
      </span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
  )
}

function CostField({
  recipes,
  value,
  onChange,
}: {
  recipes: RecipeOption[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {recipes.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-sm">Usar custo de uma receita (opcional)</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const r = recipes.find((x) => x.id === e.target.value)
              if (r)
                onChange(String(Number((r.unitCost ?? r.totalCost).toFixed(4))).replace('.', ','))
            }}
            className={inputCls}
          >
            <option value="">Selecionar receita…</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {formatBRL(r.unitCost ?? r.totalCost)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Field
        label="Custo do produto"
        suffix="R$"
        value={value}
        onChange={onChange}
        placeholder="0,00"
      />
    </div>
  )
}

function SubmitButton() {
  return (
    <button type="submit" className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white">
      Calcular
    </button>
  )
}

function ResultBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="space-y-1 rounded-lg border border-accent bg-accent/10 p-4">
      {children}
    </div>
  )
}

function Err({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-700">{children}</p>
}

const LEVEL_STYLE: Record<MarginLevel, { cls: string; label: string }> = {
  good: { cls: 'bg-green-100 text-green-800', label: 'Saudável (≥ 30%)' },
  warn: { cls: 'bg-yellow-100 text-yellow-800', label: 'Atenção (15% a 30%)' },
  bad: { cls: 'bg-red-100 text-red-800', label: 'Crítica (< 15%)' },
}

function MarginCalc({ recipes }: { recipes: RecipeOption[] }) {
  const [mode, setMode] = useState<'suggest' | 'diagnose'>('suggest')
  const [cost, setCost] = useState('')
  const [margin, setMargin] = useState('')
  const [price, setPrice] = useState('')
  const [result, setResult] = useState<
    | { kind: 'suggest'; price: number; profit: number }
    | { kind: 'diagnose'; margin: number; profit: number }
    | { kind: 'error'; message: string }
    | null
  >(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const c = parseNumber(cost)
    if (!(c > 0)) return setResult({ kind: 'error', message: 'Informe o custo do produto.' })
    if (mode === 'suggest') {
      const m = parseNumber(margin)
      if (!(m >= 0 && m < 100)) {
        return setResult({ kind: 'error', message: 'A margem deve estar entre 0% e 99,9%.' })
      }
      const p = priceByMargin(c, m)
      setResult({ kind: 'suggest', price: p, profit: p - c })
    } else {
      const p = parseNumber(price)
      if (!(p > 0)) return setResult({ kind: 'error', message: 'Informe o preço praticado.' })
      setResult({ kind: 'diagnose', margin: marginPct(c, p), profit: p - c })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-cream p-1">
        {(
          [
            ['suggest', 'Sugerir preço'],
            ['diagnose', 'Diagnosticar preço'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setMode(v)
              setResult(null)
            }}
            className={`rounded-md py-2 text-sm ${mode === v ? 'bg-primary text-white' : ''}`}
          >
            {l}
          </button>
        ))}
      </div>
      <CostField recipes={recipes} value={cost} onChange={setCost} />
      {mode === 'suggest' ? (
        <Field
          label="Margem desejada"
          suffix="%"
          value={margin}
          onChange={setMargin}
          placeholder="40"
        />
      ) : (
        <Field
          label="Preço praticado"
          suffix="R$"
          value={price}
          onChange={setPrice}
          placeholder="0,00"
        />
      )}
      <SubmitButton />

      {result?.kind === 'error' && <Err>{result.message}</Err>}
      {result?.kind === 'suggest' && (
        <ResultBox>
          <p className="text-sm">Preço de venda sugerido</p>
          <p className="text-2xl font-semibold text-primary">{formatBRL(result.price)}</p>
          <p className="text-sm">Sobra {formatBRL(result.profit)} por unidade</p>
        </ResultBox>
      )}
      {result?.kind === 'diagnose' && (
        <ResultBox>
          <p className="text-sm">Margem atual</p>
          <p className="text-2xl font-semibold text-primary">{pct.format(result.margin)}%</p>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs ${LEVEL_STYLE[marginLevel(result.margin)].cls}`}
          >
            {LEVEL_STYLE[marginLevel(result.margin)].label}
          </span>
          <p className="text-sm">
            {result.profit >= 0 ? 'Sobra' : 'Falta'} {formatBRL(Math.abs(result.profit))} por
            unidade
          </p>
        </ResultBox>
      )}
    </form>
  )
}

function MarkupCalc({ recipes }: { recipes: RecipeOption[] }) {
  const [cost, setCost] = useState('')
  const [markup, setMarkup] = useState('')
  const [result, setResult] = useState<
    | {
        kind: 'ok'
        byMarkup: number
        byMargin: number
        realMargin: number
      }
    | { kind: 'error'; message: string }
    | null
  >(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const c = parseNumber(cost)
    const m = parseNumber(markup)
    if (!(c > 0)) return setResult({ kind: 'error', message: 'Informe o custo do produto.' })
    if (!(m >= 0)) return setResult({ kind: 'error', message: 'Informe o markup desejado.' })
    const byMarkup = priceByMarkup(c, m)
    setResult({
      kind: 'ok',
      byMarkup,
      // mesmo percentual aplicado como margem (só existe abaixo de 100%)
      byMargin: m < 100 ? priceByMargin(c, m) : NaN,
      realMargin: marginPct(c, byMarkup),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <CostField recipes={recipes} value={cost} onChange={setCost} />
      <Field
        label="Markup desejado"
        suffix="%"
        value={markup}
        onChange={setMarkup}
        placeholder="60"
      />
      <SubmitButton />

      {result?.kind === 'error' && <Err>{result.message}</Err>}
      {result?.kind === 'ok' && (
        <ResultBox>
          <p className="text-sm">Preço de venda por markup</p>
          <p className="text-2xl font-semibold text-primary">{formatBRL(result.byMarkup)}</p>
          <p className="text-sm">
            Esse preço equivale a uma margem real de {pct.format(result.realMargin)}%.
          </p>
          {Number.isFinite(result.byMargin) ? (
            <p className="text-sm">
              Com o mesmo percentual como <strong>margem</strong>, o preço seria{' '}
              {formatBRL(result.byMargin)} — diferença de{' '}
              {formatBRL(result.byMargin - result.byMarkup)}.
            </p>
          ) : (
            <p className="text-sm">
              Com markup acima de 100% não existe margem equivalente com o mesmo percentual.
            </p>
          )}
        </ResultBox>
      )}
    </form>
  )
}

function BreakEvenCalc({ fixed, revenue }: { fixed: number; revenue: number }) {
  const [cm, setCm] = useState('')
  const [result, setResult] = useState<
    { kind: 'ok'; be: number } | { kind: 'error'; message: string } | null
  >(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const m = parseNumber(cm)
    if (!(m > 0 && m <= 100)) {
      return setResult({ kind: 'error', message: 'A margem deve ser maior que 0% e até 100%.' })
    }
    if (!(fixed > 0)) {
      return setResult({ kind: 'error', message: 'Cadastre custos fixos em Financeiro primeiro.' })
    }
    setResult({ kind: 'ok', be: breakEven(fixed, m) })
  }

  const diff = result?.kind === 'ok' ? revenue - result.be : 0

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="rounded-lg bg-cream p-3 text-sm">
        Custos fixos do mês (fixos + empréstimos): <strong>{formatBRL(fixed)}</strong>
        <br />
        Faturamento do mês: <strong>{formatBRL(revenue)}</strong>
      </p>
      <Field
        label="Margem de contribuição média"
        suffix="%"
        value={cm}
        onChange={setCm}
        placeholder="40"
      />
      <SubmitButton />

      {result?.kind === 'error' && <Err>{result.message}</Err>}
      {result?.kind === 'ok' && (
        <ResultBox>
          <p className="text-sm">Faturamento necessário para empatar</p>
          <p className="text-2xl font-semibold text-primary">{formatBRL(result.be)}</p>
          <p className={`text-sm ${diff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {diff >= 0
              ? `Você já passou do equilíbrio: sobram ${formatBRL(diff)} sobre o ponto de equilíbrio.`
              : `Faltam ${formatBRL(-diff)} de faturamento para atingir o equilíbrio.`}
          </p>
        </ResultBox>
      )}
    </form>
  )
}

function WorkingCapitalCalc({ revenue }: { revenue: number }) {
  const [pmr, setPmr] = useState('')
  const [pme, setPme] = useState('')
  const [pmp, setPmp] = useState('')
  const [result, setResult] = useState<
    | { kind: 'ok'; ncg: number; daily: number; cycle: number }
    | { kind: 'error'; message: string }
    | null
  >(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const a = parseNumber(pmr)
    const b = parseNumber(pme)
    const c = parseNumber(pmp)
    if (![a, b, c].every((n) => n >= 0)) {
      return setResult({ kind: 'error', message: 'Preencha os três prazos (em dias).' })
    }
    setResult({ kind: 'ok', ...workingCapital(a, b, c, revenue) })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="rounded-lg bg-cream p-3 text-sm">
        Faturamento do mês: <strong>{formatBRL(revenue)}</strong> · diário (÷ 30):{' '}
        <strong>{formatBRL(revenue / 30)}</strong>
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Field label="PMR" suffix="dias" value={pmr} onChange={setPmr} placeholder="30" />
        <Field label="PME" suffix="dias" value={pme} onChange={setPme} placeholder="15" />
        <Field label="PMP" suffix="dias" value={pmp} onChange={setPmp} placeholder="20" />
      </div>
      <p className="text-xs">
        PMR: prazo médio de recebimento · PME: prazo médio de estoque · PMP: prazo médio de
        pagamento
      </p>
      <SubmitButton />

      {result?.kind === 'error' && <Err>{result.message}</Err>}
      {result?.kind === 'ok' && (
        <ResultBox>
          <p className="text-sm">Necessidade de capital de giro</p>
          <p className="text-2xl font-semibold text-primary">
            {formatBRL(Math.max(result.ncg, 0))}
          </p>
          <p className="text-sm">
            Ciclo financeiro de {pct.format(result.cycle)} dias × {formatBRL(result.daily)} por dia.
          </p>
          {result.ncg < 0 && (
            <p className="text-sm">
              O ciclo é negativo: os fornecedores financiam a operação, então não há necessidade de
              capital de giro.
            </p>
          )}
          {revenue === 0 && (
            <p className="text-sm text-red-700">
              Registre o faturamento do mês em Financeiro para um cálculo real.
            </p>
          )}
        </ResultBox>
      )}
    </form>
  )
}
