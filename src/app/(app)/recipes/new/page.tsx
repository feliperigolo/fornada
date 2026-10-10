import { RecipeForm } from '@/components/recipes/recipe-form'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl text-primary">Nova receita</h1>
      <RecipeForm cloneFromId={from} />
    </div>
  )
}
