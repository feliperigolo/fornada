'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Copy, Layers, Loader2, Pencil, Trash2 } from 'lucide-react'
import { formatBRL, formatQty } from '@/lib/format'
import type { RecipeDetail } from './types'

const dateFmt = new Intl.DateTimeFormat('pt-BR')

export function RecipeDetailView({ id }: { id: string }) {
  const router = useRouter()
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar receita')
        setRecipe(data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar receita'))
  }, [id])

  async function remove() {
    if (!confirm('Excluir esta receita?')) return
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/recipes')
      return
    }
    const data = await res.json().catch(() => ({}))
    setError(data.error ?? 'Erro ao excluir')
    setDeleting(false)
  }

  const back = (
    <Link href="/recipes" className="mb-4 inline-flex items-center gap-1 text-sm text-primary">
      <ArrowLeft className="h-4 w-4" /> Receitas
    </Link>
  )

  if (error && !recipe) {
    return (
      <div>
        {back}
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div>
        {back}
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-8">
      {back}
      <div className="mb-4 flex items-start justify-between gap-2">
        <h1 className="text-2xl text-primary">{recipe.name}</h1>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
            recipe.composite ? 'bg-accent/30 text-primary' : 'bg-white text-charcoal'
          }`}
        >
          {recipe.composite && <Layers className="h-3 w-3" />}
          {recipe.composite ? 'Composta' : 'Simples'}
        </span>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs">Custo total</p>
          <p className="text-lg font-semibold text-primary">{formatBRL(recipe.totalCost)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs">
            Custo por {recipe.yieldUnit || 'unidade'}
          </p>
          <p className="text-lg font-semibold text-primary">
            {recipe.unitCost != null ? formatBRL(recipe.unitCost) : '—'}
          </p>
        </div>
      </div>
      {recipe.yieldQty && (
        <p className="mb-4 text-sm">
          Rendimento: {formatQty(recipe.yieldQty)} {recipe.yieldUnit}
        </p>
      )}

      {recipe.stale && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-orange/20 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Há preços sem atualização há mais de 30 dias. Importe uma NF-e recente para
          recalcular o custo.
        </div>
      )}

      <h2 className="mb-2 text-lg text-primary">Itens</h2>
      <ul className="mb-4 space-y-2">
        {recipe.items.map((it) => (
          <li key={`${it.kind}-${it.refId}`} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  href={it.kind === 'recipe' ? `/recipes/${it.refId}` : '/ingredients'}
                  className="font-medium text-primary"
                >
                  {it.name}
                </Link>
                {it.kind === 'recipe' && (
                  <span className="ml-2 rounded-full bg-accent/30 px-2 py-0.5 text-xs">
                    receita
                  </span>
                )}
                <p className="text-sm">
                  {formatQty(it.quantity)} {it.unit}
                </p>
              </div>
              <span className="font-medium">{formatBRL(it.cost)}</span>
            </div>
            {it.stale && (
              <p className="mt-1 flex items-center gap-1 text-xs text-orange">
                <AlertTriangle className="h-3 w-3" />
                {it.kind === 'recipe'
                  ? 'Contém preços desatualizados'
                  : it.lastPriceAt
                    ? `Preço de ${dateFmt.format(new Date(it.lastPriceAt))} (mais de 30 dias)`
                    : 'Sem registro de preço por NF-e'}
              </p>
            )}
          </li>
        ))}
        {recipe.items.length === 0 && <li className="text-sm">Nenhum item nesta receita.</li>}
      </ul>

      {recipe.notes && (
        <>
          <h2 className="mb-1 text-lg text-primary">Observações</h2>
          <p className="mb-4 whitespace-pre-wrap text-sm">{recipe.notes}</p>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white"
        >
          <Pencil className="h-4 w-4" /> Editar
        </Link>
        <Link
          href={`/recipes/new?from=${recipe.id}`}
          className="flex items-center justify-center gap-2 rounded-lg border border-primary px-4 py-3 font-medium text-primary"
        >
          <Copy className="h-4 w-4" /> Usar como base
        </Link>
      </div>
      <button
        onClick={remove}
        disabled={deleting}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm text-red-700 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" /> Excluir receita
      </button>
    </div>
  )
}
