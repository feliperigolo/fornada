const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qty = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export function formatBRL(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  return brl.format(Number.isFinite(num) ? num : 0)
}
export const formatQty = (n: number) => qty.format(n)

/** Interpreta números digitados em pt-BR ("1.234,56", "R$ 10,5", "10.5"). */
export function parseNumber(input: string): number {
  const s = input.replace(/[^\d.,-]/g, '')
  if (!s) return NaN
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return parseFloat(normalized)
}
