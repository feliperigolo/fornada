import { RecipeForm } from '@/components/recipes/recipe-form'

export default async function Page({ params }: PageProps<'/recipes/[id]/edit'>) {
  const { id } = await params
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl text-primary">Editar receita</h1>
      <RecipeForm recipeId={id} />
    </div>
  )
}
