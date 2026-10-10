import { RecipeDetailView } from '@/components/recipes/recipe-detail'

export default async function Page({ params }: PageProps<'/recipes/[id]'>) {
  const { id } = await params
  return (
    <div className="mx-auto max-w-2xl">
      <RecipeDetailView id={id} />
    </div>
  )
}
