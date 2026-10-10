import { z } from 'zod'

const itemSchema = z
  .object({
    ingredientId: z.string().min(1).optional(),
    subRecipeId: z.string().min(1).optional(),
    quantity: z.number().finite().positive().max(99_999_999),
    unit: z.string().trim().min(1).max(20),
  })
  .refine((i) => !!i.ingredientId !== !!i.subRecipeId, {
    message: 'Informe ingredientId ou subRecipeId',
  })

export const recipeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  yieldQty: z.number().finite().positive().max(99_999_999).nullish(),
  yieldUnit: z.string().trim().max(20).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  items: z.array(itemSchema).max(200),
})

export const previewSchema = z.object({
  yieldQty: z.number().finite().positive().nullish(),
  items: z.array(itemSchema).max(200),
})

export type RecipeInput = z.infer<typeof recipeSchema>
