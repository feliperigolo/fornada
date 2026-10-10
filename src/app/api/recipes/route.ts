import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'
import { costRecipe, loadCostContext } from '@/lib/recipe-cost'
import { recipeSchema } from '@/lib/recipe-schema'

export async function GET() {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const ctx = await loadCostContext(bakeryId)
  const memo = new Map()
  const list = [...ctx.recipes.values()]
    .map((r) => {
      const c = costRecipe(r.id, ctx, memo)
      return {
        id: r.id,
        name: r.name,
        yieldQty: r.yieldQty,
        yieldUnit: r.yieldUnit,
        itemCount: r.items.length,
        totalCost: c?.totalCost ?? 0,
        unitCost: c?.unitCost ?? null,
        composite: c?.composite ?? false,
        stale: c?.stale ?? false,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return NextResponse.json(list)
}

export async function POST(request: Request) {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = recipeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  const data = parsed.data

  const ctx = await loadCostContext(bakeryId)
  for (const it of data.items) {
    const ok = it.ingredientId
      ? ctx.ingredients.has(it.ingredientId)
      : ctx.recipes.has(it.subRecipeId!)
    if (!ok) return NextResponse.json({ error: 'Item inválido' }, { status: 400 })
  }

  const recipe = await prisma.recipe.create({
    data: {
      bakeryId,
      name: data.name,
      yieldQty: data.yieldQty ?? null,
      yieldUnit: data.yieldUnit || null,
      notes: data.notes || null,
      items: {
        create: data.items.map((it) => ({
          ingredientId: it.ingredientId ?? null,
          subRecipeId: it.subRecipeId ?? null,
          quantity: it.quantity,
          unit: it.unit,
        })),
      },
    },
    select: { id: true },
  })

  return NextResponse.json(recipe, { status: 201 })
}
