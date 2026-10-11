/** Preço = Custo / (1 − Margem%) */
export function priceByMargin(cost: number, marginPct: number) {
  return cost / (1 - marginPct / 100)
}

/** Margem% = (Preço − Custo) / Preço */
export function marginPct(cost: number, price: number) {
  return ((price - cost) / price) * 100
}

/** Preço = Custo × (1 + Markup%) */
export function priceByMarkup(cost: number, markupPct: number) {
  return cost * (1 + markupPct / 100)
}

/** Ponto de equilíbrio = Custos fixos / Margem de contribuição% */
export function breakEven(fixedCosts: number, contributionPct: number) {
  return fixedCosts / (contributionPct / 100)
}

/** NCG = (PMR + PME − PMP) × faturamento diário (faturamento mensal / 30) */
export function workingCapital(pmr: number, pme: number, pmp: number, monthlyRevenue: number) {
  const daily = monthlyRevenue / 30
  return { daily, cycle: pmr + pme - pmp, ncg: (pmr + pme - pmp) * daily }
}

export type MarginLevel = 'good' | 'warn' | 'bad'

export function marginLevel(pct: number): MarginLevel {
  if (pct >= 30) return 'good'
  if (pct >= 15) return 'warn'
  return 'bad'
}
