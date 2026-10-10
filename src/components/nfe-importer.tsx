'use client'

import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileUp, Loader2, Search, X } from 'lucide-react'
import type {
  ImportSummary,
  IngredientOption,
  ParseResponse,
  ParsedNfe,
} from '@/lib/nfe-types'

type Action = 'link' | 'create' | 'ignore'

type CardState = {
  action: Action
  ingredientId: string | null
  query: string
}

type Phase = 'idle' | 'parsing' | 'review' | 'importing' | 'done'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function score(query: string, candidate: string) {
  const q = normalize(query)
  const c = normalize(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (c.includes(q) || q.includes(c)) return 0.8
  const qt = q.split(' ')
  const ct = new Set(c.split(' '))
  const hits = qt.filter((t) => ct.has(t)).length
  return hits / Math.max(qt.length, ct.size)
}

function search(ingredients: IngredientOption[], query: string, limit = 5) {
  return ingredients
    .map((ing) => ({ ing, s: score(query, ing.name) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.ing)
}

function initialCard(name: string, ingredients: IngredientOption[]): CardState {
  const best = ingredients
    .map((ing) => ({ ing, s: score(name, ing.name) }))
    .sort((a, b) => b.s - a.s)[0]
  if (best && best.s >= 0.6) {
    return { action: 'link', ingredientId: best.ing.id, query: '' }
  }
  return { action: 'create', ingredientId: null, query: '' }
}

export function NfeImporter() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [nfe, setNfe] = useState<ParsedNfe | null>(null)
  const [ingredients, setIngredients] = useState<IngredientOption[]>([])
  const [cards, setCards] = useState<CardState[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pendingLinks = cards.filter((c) => c.action === 'link' && !c.ingredientId).length
  const toImport = cards.filter((c) => c.action !== 'ignore').length

  function reset() {
    setPhase('idle')
    setError(null)
    setNfe(null)
    setCards([])
    setSummary(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function upload(file: File) {
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.xml') && !lower.endsWith('.pdf')) {
      setError('Envie um arquivo .xml ou .pdf')
      return
    }
    setError(null)
    setPhase('parsing')
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/nfe/parse', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao ler a nota')
      const parsed = data as ParseResponse
      setNfe(parsed.nfe)
      setIngredients(parsed.ingredients)
      setCards(parsed.nfe.items.map((i) => initialCard(i.name, parsed.ingredients)))
      setPhase('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ler a nota')
      setPhase('idle')
    }
  }

  async function confirmImport() {
    if (!nfe) return
    setError(null)
    setPhase('importing')
    try {
      const res = await fetch('/api/nfe/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          supplier: nfe.supplier,
          nfNumber: nfe.nfNumber,
          raw: nfe.raw,
          items: nfe.items.map((item, i) => ({
            ...item,
            action: cards[i].action,
            ingredientId: cards[i].action === 'link' ? cards[i].ingredientId : undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao importar')
      setSummary(data as ImportSummary)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao importar')
      setPhase('review')
    }
  }

  function patch(i: number, p: Partial<CardState>) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
  }

  if (phase === 'done' && summary) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" />
        <h2 className="mb-4 text-xl text-primary">Importação concluída</h2>
        <ul className="mb-6 space-y-1">
          <li>{summary.updated} ingrediente(s) atualizado(s)</li>
          <li>{summary.created} criado(s)</li>
          <li>{summary.ignored} ignorado(s)</li>
        </ul>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-5 py-3 font-medium text-white"
        >
          Importar outra nota
        </button>
      </div>
    )
  }

  const busy = phase === 'parsing' || phase === 'importing'

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {(phase === 'idle' || phase === 'parsing') && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f && phase === 'idle') upload(f)
          }}
          onClick={() => phase === 'idle' && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-4 py-14 text-center transition-colors ${
            dragging ? 'border-accent bg-accent/10' : 'border-primary/30'
          }`}
        >
          {phase === 'parsing' ? (
            <>
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
              <p className="font-medium text-primary">Lendo a nota…</p>
              <p className="text-sm">PDFs podem levar alguns segundos</p>
            </>
          ) : (
            <>
              <FileUp className="mb-3 h-10 w-10 text-primary" />
              <p className="font-medium text-primary">
                Arraste a NF-e aqui ou toque para escolher
              </p>
              <p className="text-sm">Aceita .xml e .pdf (até 10 MB)</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xml,.pdf,application/pdf,text/xml,application/xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
            }}
          />
        </div>
      )}

      {(phase === 'review' || phase === 'importing') && nfe && (
        <>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium text-primary">{nfe.supplier ?? 'Fornecedor não identificado'}</p>
              <p>
                {nfe.nfNumber ? `NF ${nfe.nfNumber} · ` : ''}
                {nfe.items.length} itens
              </p>
            </div>
            <button
              onClick={reset}
              disabled={busy}
              className="shrink-0 rounded-lg border border-primary/20 px-3 py-1.5 text-sm"
            >
              Trocar arquivo
            </button>
          </div>

          <ul className="space-y-3 pb-32 md:pb-24">
            {nfe.items.map((item, i) => (
              <ItemCard
                key={i}
                item={item}
                card={cards[i]}
                ingredients={ingredients}
                disabled={busy}
                onChange={(p) => patch(i, p)}
              />
            ))}
          </ul>

          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-primary/10 bg-white p-3 md:bottom-0 md:left-60">
            <div className="mx-auto max-w-2xl">
              <button
                onClick={confirmImport}
                disabled={busy || toImport === 0 || pendingLinks > 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                {phase === 'importing' && <Loader2 className="h-5 w-5 animate-spin" />}
                {phase === 'importing'
                  ? 'Importando…'
                  : pendingLinks > 0
                    ? `Escolha o insumo em ${pendingLinks} item(ns)`
                    : `Importar selecionados (${toImport})`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ItemCard({
  item,
  card,
  ingredients,
  disabled,
  onChange,
}: {
  item: ParsedNfe['items'][number]
  card: CardState
  ingredients: IngredientOption[]
  disabled: boolean
  onChange: (p: Partial<CardState>) => void
}) {
  const selected = ingredients.find((i) => i.id === card.ingredientId) ?? null
  const matches = useMemo(
    () => (card.query ? search(ingredients, card.query) : []),
    [ingredients, card.query]
  )
  const unitMismatch =
    selected &&
    item.unit &&
    normalize(item.unit) !== normalize(selected.unit)

  const options: { value: Action; label: string }[] = [
    { value: 'link', label: 'Vincular' },
    { value: 'create', label: 'Criar novo' },
    { value: 'ignore', label: 'Ignorar' },
  ]

  return (
    <li
      className={`rounded-xl bg-white p-4 shadow-sm ${card.action === 'ignore' ? 'opacity-60' : ''}`}
    >
      <p className="font-medium text-primary">{item.name}</p>
      <p className="mb-3 text-sm">
        {num.format(item.quantity)} {item.unit ?? ''} × {brl.format(item.unitPrice)} ={' '}
        <strong>{brl.format(item.totalPrice)}</strong>
      </p>

      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-cream p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ action: o.value })}
            className={`rounded-md py-2 text-sm ${
              card.action === o.value ? 'bg-primary text-white' : 'text-charcoal'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {card.action === 'link' && (
        <div>
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-accent bg-accent/10 px-3 py-2 text-sm">
              <span>
                <strong>{selected.name}</strong> · {selected.unit} ·{' '}
                {brl.format(selected.costPerUnit)} atual
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label="Remover vínculo"
                onClick={() => onChange({ ingredientId: null })}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  type="search"
                  value={card.query}
                  disabled={disabled}
                  onChange={(e) => onChange({ query: e.target.value })}
                  placeholder="Buscar insumo pelo nome"
                  className="w-full rounded-lg border border-primary/20 py-2 pl-9 pr-3 text-base"
                />
              </div>
              {card.query && (
                <ul className="mt-1 overflow-hidden rounded-lg border border-primary/10">
                  {matches.length === 0 && (
                    <li className="px-3 py-2 text-sm">Nenhum insumo encontrado</li>
                  )}
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => onChange({ ingredientId: m.id, query: '' })}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-cream"
                      >
                        {m.name} <span className="opacity-70">({m.unit})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {unitMismatch && (
            <p className="mt-2 text-xs text-orange">
              Unidade da nota ({item.unit}) difere do insumo ({selected?.unit}). O custo será
              gravado como {brl.format(item.unitPrice)} por {selected?.unit}.
            </p>
          )}
        </div>
      )}

      {card.action === 'create' && (
        <p className="text-sm">
          Será criado o insumo “{item.name}” ({item.unit || 'un'}) com custo{' '}
          {brl.format(item.unitPrice)}.
        </p>
      )}
    </li>
  )
}
