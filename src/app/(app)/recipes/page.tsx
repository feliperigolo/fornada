import { RecipeList } from '@/components/recipes/recipe-list'

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl text-primary">Fichas técnicas</h1>
      <RecipeList />
    </div>
  )
}
