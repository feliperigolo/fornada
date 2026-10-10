import { prisma } from '@/lib/prisma'

export const STALE_DAYS = 30

export type CostItemInput = {
  ingredientId?: string | null
  subRecipeId?: string | null
  quantity: number
  unit: string
}

export type CostedItem = {
  kind: 'ingredient' | 'recipe'
  refId: string
  name: string
  quantity: number
  unit: string
  cost: number
  stale: boolean
  lastPriceAt: Date | null
}

type IngredientInfo = {
  name: string
  unit: string
  costPerUnit: number
  lastPriceAt: Date | null
}

type RecipeInfo = {
  id: string
  name: string
  yieldQty: number | null
  yieldUnit: string | null
  notes: string | null
  items: CostItemInput[]
}

export type CostContext = {
  ingredients: Map<string, IngredientInfo>
  recipes: Map<string, RecipeInfo>
}

export type RecipeCost = {
  totalCost: number
  unitCost: number | null
  stale: boolean
  composite: boolean
  items: CostedItem[]
}

const FACTORS: Record<string, { base: string; factor: number }> = {
  g: { base: 'mass', factor: 1 },
  kg: { base: 'mass', factor: 1000 },
  mg: { base: 'mass', factor: 0.001 },
  ml: { base: 'volume', factor: 1 },
  l: { base: 'volume', factor: 1000 },
}

/** Converte `qty` de `from` para `to` quando ambas são massa ou volume; senão devolve `qty`. */
export function convertQty(qty: number, from: string | null, to: string | null): number {
  if (!from || !to) return qty
  const a = FACTORS[from.trim().toLowerCase()]
  const b = FACTORS[to.trim().toLowerCase()]
  if (!a || !b || a.base !== b.base) return qty
  return (qty * a.factor) / b.factor
}

export async function loadCostContext(bakeryId: string): Promise<CostContext> {
  const [ingredients, recipes] = await Promise.all([
    prisma.ingredient.findMany({
      where: { bakeryId },
      select: {
        id: true,
        name: true,
        unit: true,
        costPerUnit: true,
        costHistory: { orderBy: { recordedAt: 'desc' }, take: 1, select: { recordedAt: true } },
      },
    }),
    prisma.recipe.findMany({
      where: { bakeryId },
      include: { items: true },
    }),
  ])

  return {
    ingredients: new Map(
      ingredients.map((i) => [
        i.id,
        {
          name: i.name,
          unit: i.unit,
          costPerUnit: Number(i.costPerUnit),
          lastPriceAt: i.costHistory[0]?.recordedAt ?? null,
        },
      ])
    ),
    recipes: new Map(
      recipes.map((r) => [
        r.id,
        {
          id: r.id,
          name: r.name,
          yieldQty: r.yieldQty == null ? null : Number(r.yieldQty),
          yieldUnit: r.yieldUnit,
          notes: r.notes,
          items: r.items.map((it) => ({
            ingredientId: it.ingredientId,
            subRecipeId: it.subRecipeId,
            quantity: Number(it.quantity),
            unit: it.unit,
          })),
        },
      ])
    ),
  }
}

function isStale(lastPriceAt: Date | null, now: number) {
  return !lastPriceAt || now - lastPriceAt.getTime() > STALE_DAYS * 86_400_000
}

/**
 * Custo recursivo de uma lista de itens.
 * - ingrediente: quantidade × costPerUnit
 * - sub-receita: (quantidade / yieldQty da sub-receita) × custo total da sub-receita
 */
export function costItems(
  items: CostItemInput[],
  ctx: CostContext,
  yieldQty: number | null,
  memo = new Map<string, RecipeCost>(),
  visiting = new Set<string>()
): RecipeCost {
  const now = Date.now()
  const out: CostedItem[] = []
  let total = 0
  let stale = false
  let composite = false

  for (const it of items) {
    if (it.ingredientId) {
      const ing = ctx.ingredients.get(it.ingredientId)
      if (!ing) continue
      const qty = convertQty(it.quantity, it.unit, ing.unit)
      const cost = qty * ing.costPerUnit
      const itemStale = isStale(ing.lastPriceAt, now)
      total += cost
      stale ||= itemStale
      out.push({
        kind: 'ingredient',
        refId: it.ingredientId,
        name: ing.name,
        quantity: it.quantity,
        unit: it.unit,
        cost,
        stale: itemStale,
        lastPriceAt: ing.lastPriceAt,
      })
    } else if (it.subRecipeId) {
      const sub = ctx.recipes.get(it.subRecipeId)
      if (!sub) continue
      composite = true
      const subCost = costRecipe(sub.id, ctx, memo, visiting)
      const subYield = sub.yieldQty
      const cost =
        subCost && subYield && subYield > 0
          ? (convertQty(it.quantity, it.unit, sub.yieldUnit) / subYield) * subCost.totalCost
          : 0
      const itemStale = subCost?.stale ?? false
      total += cost
      stale ||= itemStale
      out.push({
        kind: 'recipe',
        refId: sub.id,
        name: sub.name,
        quantity: it.quantity,
        unit: it.unit,
        cost,
        stale: itemStale,
        lastPriceAt: null,
      })
    }
  }

  return {
    totalCost: total,
    unitCost: yieldQty && yieldQty > 0 ? total / yieldQty : null,
    stale,
    composite,
    items: out,
  }
}

export function costRecipe(
  id: string,
  ctx: CostContext,
  memo = new Map<string, RecipeCost>(),
  visiting = new Set<string>()
): RecipeCost | null {
  const cached = memo.get(id)
  if (cached) return cached
  const recipe = ctx.recipes.get(id)
  if (!recipe || visiting.has(id)) return null // ciclo ou receita inexistente

  visiting.add(id)
  const result = costItems(recipe.items, ctx, recipe.yieldQty, memo, visiting)
  visiting.delete(id)
  memo.set(id, result)
  return result
}

/** True se `target` é alcançável a partir das sub-receitas de `fromIds` (usado para barrar ciclos). */
export function reaches(fromIds: string[], target: string, ctx: CostContext): boolean {
  const seen = new Set<string>()
  const stack = [...fromIds]
  while (stack.length) {
    const id = stack.pop()!
    if (id === target) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const it of ctx.recipes.get(id)?.items ?? []) {
      if (it.subRecipeId) stack.push(it.subRecipeId)
    }
  }
  return false
}
