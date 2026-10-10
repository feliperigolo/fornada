'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Layers, Loader2, Plus, Search } from 'lucide-react'
import { formatBRL, formatQty } from '@/lib/format'
import type { RecipeListItem } from './types'

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function RecipeList() {
  const [recipes, setRecipes] = useState<RecipeListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/recipes')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar receitas')
        setRecipes(data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar receitas'))
  }, [])

  const filtered = useMemo(() => {
    if (!recipes) return []
    const q = normalize(query.trim())
    return q ? recipes.filter((r) => normalize(r.name).includes(q)) : recipes
  }, [recipes, query])

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar receita"
          className="w-full rounded-lg border border-primary/20 bg-white py-3 pl-9 pr-3 text-base"
        />
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!recipes && !error && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {recipes && filtered.length === 0 && (
        <p className="py-12 text-center text-sm">
          {recipes.length === 0
            ? 'Nenhuma receita ainda. Toque em + para criar a primeira.'
            : 'Nenhuma receita encontrada.'}
        </p>
      )}

      <ul className="space-y-3 pb-24">
        {filtered.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="block rounded-xl bg-white p-4 shadow-sm active:bg-cream"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="font-medium text-primary">{r.name}</span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                    r.composite ? 'bg-accent/30 text-primary' : 'bg-cream text-charcoal'
                  }`}
                >
                  {r.composite && <Layers className="h-3 w-3" />}
                  {r.composite ? 'Composta' : 'Simples'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {r.yieldQty
                    ? `Rende ${formatQty(r.yieldQty)} ${r.yieldUnit ?? ''}`
                    : 'Rendimento não informado'}
                </span>
                <span className="font-medium">
                  {r.unitCost != null
                    ? `${formatBRL(r.unitCost)}/${r.yieldUnit || 'un'}`
                    : formatBRL(r.totalCost)}
                </span>
              </div>
              {r.stale && (
                <p className="mt-2 flex items-center gap-1 text-xs text-orange">
                  <AlertTriangle className="h-3 w-3" /> Preços desatualizados
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/recipes/new"
        aria-label="Nova receita"
        className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg md:bottom-6 md:right-6"
      >
        <Plus className="h-7 w-7" />
      </Link>
    </div>
  )
}
