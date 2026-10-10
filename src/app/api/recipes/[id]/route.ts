import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'
import { costRecipe, loadCostContext, reaches } from '@/lib/recipe-cost'
import { recipeSchema } from '@/lib/recipe-schema'

async function ownedRecipe(id: string, bakeryId: string) {
  return prisma.recipe.findFirst({ where: { id, bakeryId }, select: { id: true } })
}

export async function GET(_req: Request, ctx: RouteContext<'/api/recipes/[id]'>) {
  const { id } = await ctx.params
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const costCtx = await loadCostContext(bakeryId)
  const recipe = costCtx.recipes.get(id)
  if (!recipe) return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 })

  const cost = costRecipe(id, costCtx)
  return NextResponse.json({
    id: recipe.id,
    name: recipe.name,
    yieldQty: recipe.yieldQty,
    yieldUnit: recipe.yieldUnit,
    notes: recipe.notes,
    totalCost: cost?.totalCost ?? 0,
    unitCost: cost?.unitCost ?? null,
    composite: cost?.composite ?? false,
    stale: cost?.stale ?? false,
    items: cost?.items ?? [],
  })
}

export async function PUT(request: Request, ctx: RouteContext<'/api/recipes/[id]'>) {
  const { id } = await ctx.params
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await ownedRecipe(id, bakeryId))) {
    return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 })
  }

  const parsed = recipeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  const data = parsed.data

  const costCtx = await loadCostContext(bakeryId)
  const subIds: string[] = []
  for (const it of data.items) {
    const ok = it.ingredientId
      ? costCtx.ingredients.has(it.ingredientId)
      : costCtx.recipes.has(it.subRecipeId!)
    if (!ok) return NextResponse.json({ error: 'Item inválido' }, { status: 400 })
    if (it.subRecipeId) subIds.push(it.subRecipeId)
  }
  if (reaches(subIds, id, costCtx)) {
    return NextResponse.json(
      { error: 'Uma receita não pode usar a si mesma (direta ou indiretamente)' },
      { status: 400 }
    )
  }

  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { recipeId: id } }),
    prisma.recipe.update({
      where: { id },
      data: {
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
    }),
  ])

  return NextResponse.json({ id })
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/recipes/[id]'>) {
  const { id } = await ctx.params
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await ownedRecipe(id, bakeryId))) {
    return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 })
  }

  const usedBy = await prisma.recipeItem.count({ where: { subRecipeId: id } })
  if (usedBy > 0) {
    return NextResponse.json(
      { error: 'Esta receita é usada como componente em outras receitas' },
      { status: 409 }
    )
  }

  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { recipeId: id } }),
    prisma.recipe.delete({ where: { id } }),
  ])
  return NextResponse.json({ ok: true })
}
