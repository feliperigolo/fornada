export type RecipeListItem = {
  id: string
  name: string
  yieldQty: number | null
  yieldUnit: string | null
  itemCount: number
  totalCost: number
  unitCost: number | null
  composite: boolean
  stale: boolean
}

export type RecipeDetailItem = {
  kind: 'ingredient' | 'recipe'
  refId: string
  name: string
  quantity: number
  unit: string
  cost: number
  stale: boolean
  lastPriceAt: string | null
}

export type RecipeDetail = {
  id: string
  name: string
  yieldQty: number | null
  yieldUnit: string | null
  notes: string | null
  totalCost: number
  unitCost: number | null
  composite: boolean
  stale: boolean
  items: RecipeDetailItem[]
}

export type IngredientOption = {
  id: string
  name: string
  unit: string
  costPerUnit: number
}
