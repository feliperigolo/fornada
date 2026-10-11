import { PricingView } from '@/components/pricing/pricing-view'

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl text-primary">Preços e análises</h1>
      <PricingView />
    </div>
  )
}
