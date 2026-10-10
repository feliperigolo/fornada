import { NextResponse } from 'next/server'
import { getCurrentBakeryId } from '@/lib/bakery'
import { costItems, loadCostContext } from '@/lib/recipe-cost'
import { previewSchema } from '@/lib/recipe-schema'

/** Calcula o custo de uma receita ainda não salva (painel em tempo real do formulário). */
export async function POST(request: Request) {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = previewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const ctx = await loadCostContext(bakeryId)
  const cost = costItems(parsed.data.items, ctx, parsed.data.yieldQty ?? null)
  return NextResponse.json(cost)
}
