const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qty = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export const formatBRL = (n: number) => brl.format(n)
export const formatQty = (n: number) => qty.format(n)
