'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Loader2, Package, Search, Trash2 } from 'lucide-react'
import { formatBRL, formatQty } from '@/lib/format'
import type { IngredientOption, RecipeDetail, RecipeListItem } from './types'

type FormItem = {
  key: string
  kind: 'ingredient' | 'recipe'
  refId: string
  name: string
  quantity: number
  unit: string
}

type Candidate = {
  kind: 'ingredient' | 'recipe'
  id: string
  name: string
  unit: string
  /** custo atual por `unit` */
  cost: number | null
}

type Preview = {
  totalCost: number
  unitCost: number | null
  items: { kind: string; refId: string; cost: number }[]
}

const UNITS = ['g', 'kg', 'ml', 'l', 'un']

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function RecipeForm({
  recipeId,
  cloneFromId,
}: {
  recipeId?: string
  cloneFromId?: string
}) {
  const router = useRouter()
  const sourceId = recipeId ?? cloneFromId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [yieldQty, setYieldQty] = useState('')
  const [yieldUnit, setYieldUnit] = useState('un')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<FormItem[]>([])

  const [ingredients, setIngredients] = useState<IngredientOption[]>([])
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Candidate | null>(null)
  const [pickQty, setPickQty] = useState('')
  const [pickUnit, setPickUnit] = useState('')

  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const seq = useRef(0)

  // carga inicial: insumos, receitas e (se edição/clone) a receita de origem
  useEffect(() => {
    async function load() {
      try {
        const [ingRes, recRes, srcRes] = await Promise.all([
          fetch('/api/ingredients'),
          fetch('/api/recipes'),
          sourceId ? fetch(`/api/recipes/${sourceId}`) : Promise.resolve(null),
        ])
        if (!ingRes.ok || !recRes.ok) throw new Error('Erro ao carregar dados')
        setIngredients(await ingRes.json())
        setRecipes(await recRes.json())
        if (srcRes) {
          const src = (await srcRes.json()) as RecipeDetail & { error?: string }
          if (!srcRes.ok) throw new Error(src.error ?? 'Receita não encontrada')
          setName(cloneFromId ? `${src.name} (cópia)` : src.name)
          setYieldQty(src.yieldQty ? String(src.yieldQty) : '')
          setYieldUnit(src.yieldUnit ?? 'un')
          setNotes(src.notes ?? '')
          setItems(
            src.items.map((it, i) => ({
              key: `${it.kind}-${it.refId}-${i}`,
              kind: it.kind,
              refId: it.refId,
              name: it.name,
              quantity: it.quantity,
              unit: it.unit,
            }))
          )
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sourceId, cloneFromId])

  const candidates = useMemo<Candidate[]>(() => {
    const q = normalize(query.trim())
    if (!q) return []
    const ing: Candidate[] = ingredients
      .filter((i) => normalize(i.name).includes(q))
      .map((i) => ({
        kind: 'ingredient',
        id: i.id,
        name: i.name,
        unit: i.unit,
        cost: i.costPerUnit,
      }))
    const rec: Candidate[] = recipes
      .filter((r) => r.id !== recipeId && normalize(r.name).includes(q))
      .map((r) => ({
        kind: 'recipe',
        id: r.id,
        name: r.name,
        unit: r.yieldUnit || 'un',
        cost: r.unitCost,
      }))
    return [...ing, ...rec].slice(0, 8)
  }, [query, ingredients, recipes, recipeId])

  // custo em tempo real calculado no backend (debounce)
  useEffect(() => {
    if (items.length === 0) return
    const mine = ++seq.current
    const t = setTimeout(async () => {
      setPreviewing(true)
      try {
        const yq = parseFloat(yieldQty.replace(',', '.'))
        const res = await fetch('/api/recipes/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            yieldQty: yq > 0 ? yq : null,
            items: items.map((it) => ({
              ingredientId: it.kind === 'ingredient' ? it.refId : undefined,
              subRecipeId: it.kind === 'recipe' ? it.refId : undefined,
              quantity: it.quantity,
              unit: it.unit,
            })),
          }),
        })
        if (res.ok && mine === seq.current) setPreview(await res.json())
      } finally {
        if (mine === seq.current) setPreviewing(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [items, yieldQty])

  function pick(c: Candidate) {
    setPicked(c)
    setPickUnit(c.unit)
    setPickQty('')
    setQuery('')
  }

  function addPicked() {
    const q = parseFloat(pickQty.replace(',', '.'))
    if (!picked || !(q > 0) || !pickUnit.trim()) return
    setItems((prev) => [
      ...prev,
      {
        key: `${picked.kind}-${picked.id}-${Date.now()}`,
        kind: picked.kind,
        refId: picked.id,
        name: picked.name,
        quantity: q,
        unit: pickUnit.trim(),
      },
    ])
    setPicked(null)
  }

  async function save() {
    setError(null)
    if (!name.trim()) {
      setError('Informe o nome da receita')
      return
    }
    const yq = parseFloat(yieldQty.replace(',', '.'))
    setSaving(true)
    try {
      const res = await fetch(recipeId ? `/api/recipes/${recipeId}` : '/api/recipes', {
        method: recipeId ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          yieldQty: yq > 0 ? yq : null,
          yieldUnit: yq > 0 ? yieldUnit.trim() || null : null,
          notes: notes.trim() || null,
          items: items.map((it) => ({
            ingredientId: it.kind === 'ingredient' ? it.refId : undefined,
            subRecipeId: it.kind === 'recipe' ? it.refId : undefined,
            quantity: it.quantity,
            unit: it.unit,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      router.push(`/recipes/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const inputCls = 'w-full rounded-lg border border-primary/20 bg-white px-3 py-3 text-base'

  return (
    <div className="space-y-5 pb-44 md:pb-32">
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm">Nome da receita</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="Ex.: Pão francês"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm">Rendimento</span>
          <input
            inputMode="decimal"
            value={yieldQty}
            onChange={(e) => setYieldQty(e.target.value)}
            className={inputCls}
            placeholder="40"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Unidade</span>
          <input
            list="unit-options"
            value={yieldUnit}
            onChange={(e) => setYieldUnit(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm">Observações (opcional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputCls}
        />
      </label>

      <section>
        <h2 className="mb-2 text-lg text-primary">Ingredientes</h2>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar insumo ou receita"
            className={`${inputCls} pl-9`}
          />
        </div>

        {query.trim() && (
          <ul className="mt-1 overflow-hidden rounded-lg border border-primary/10 bg-white">
            {candidates.length === 0 && (
              <li className="px-3 py-2 text-sm">Nada encontrado</li>
            )}
            {candidates.map((c) => (
              <li key={`${c.kind}-${c.id}`}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-cream"
                >
                  {c.kind === 'recipe' ? (
                    <Layers className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <Package className="h-4 w-4 shrink-0" />
                  )}
                  <span className="flex-1">
                    {c.name}
                    {c.kind === 'recipe' && (
                      <span className="ml-2 rounded-full bg-accent/30 px-2 py-0.5 text-xs">
                        receita
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 opacity-70">
                    {c.cost != null ? `${formatBRL(c.cost)}/${c.unit}` : c.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {picked && (
          <div className="mt-3 rounded-xl border border-accent bg-accent/10 p-3">
            <p className="mb-2 text-sm font-medium text-primary">{picked.name}</p>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                autoFocus
                inputMode="decimal"
                value={pickQty}
                onChange={(e) => setPickQty(e.target.value)}
                placeholder="Quantidade"
                className={inputCls}
              />
              <input
                list="unit-options"
                value={pickUnit}
                onChange={(e) => setPickUnit(e.target.value)}
                className={inputCls}
              />
              <button
                type="button"
                onClick={addPicked}
                className="rounded-lg bg-primary px-4 font-medium text-white"
              >
                Adicionar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="mt-2 text-xs underline"
            >
              Cancelar
            </button>
          </div>
        )}

        <ul className="mt-3 space-y-2">
          {items.map((it, idx) => {
            const cost = preview?.items[idx]?.cost
            return (
              <li
                key={it.key}
                className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-primary">
                    {it.kind === 'recipe' && (
                      <Layers className="mr-1 inline h-4 w-4 text-accent" />
                    )}
                    {it.name}
                  </p>
                  <p className="text-sm">
                    {formatQty(it.quantity)} {it.unit}
                    {cost != null && ` · ${formatBRL(cost)}`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remover ${it.name}`}
                  onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                  className="shrink-0 p-2 text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            )
          })}
          {items.length === 0 && (
            <li className="text-sm">Busque um insumo ou receita para adicionar.</li>
          )}
        </ul>
      </section>

      <datalist id="unit-options">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-primary/10 bg-white p-3 md:bottom-0 md:left-60">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>
              Custo total:{' '}
              <strong className="text-primary">
                {items.length > 0 && preview ? formatBRL(preview.totalCost) : formatBRL(0)}
              </strong>
              {previewing && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
            </span>
            <span>
              Por {yieldUnit || 'unidade'}:{' '}
              <strong className="text-primary">
                {items.length > 0 && preview?.unitCost != null ? formatBRL(preview.unitCost) : '—'}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-5 w-5 animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar receita'}
          </button>
        </div>
      </div>
    </div>
  )
}
