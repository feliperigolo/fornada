import { CostsView } from '@/components/costs/costs-view'

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl text-primary">Financeiro</h1>
      <CostsView />
    </div>
  )
}
