import { z } from 'zod'
import type { CostType, Recurrence } from '@prisma/client'

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export const costSchema = z.object({
  name: z.string().trim().min(1).max(200),
  amount: z.number().finite().positive().max(999_999_999),
  type: z.enum(['FIXED', 'VARIABLE', 'LOAN']),
  recurrence: z.enum(['MONTHLY', 'ANNUAL', 'ONETIME']),
  /** Mês de competência "YYYY-MM"; padrão: mês atual. */
  month: monthSchema.optional(),
})

const TZ = 'America/Sao_Paulo'

/** Primeiro dia (UTC, 00:00) do mês corrente no fuso de São Paulo — chave de MonthlyRevenue.month. */
export function currentMonthStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' })
    .formatToParts(now)
  const year = Number(parts.find((p) => p.type === 'year')!.value)
  const month = Number(parts.find((p) => p.type === 'month')!.value)
  return new Date(Date.UTC(year, month - 1, 1))
}

/** "2026-10" → primeiro dia do mês (UTC, 00:00). */
export function parseMonth(value: string): Date {
  const [y, m] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
}

export function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1))
}

type CostRow = {
  id: string
  name: string
  amount: { toString(): string } | number
  type: CostType
  recurrence: Recurrence
}

/** Equivalente mensal: anual é rateado em 12. */
export function monthlyAmount(c: Pick<CostRow, 'amount' | 'recurrence'>): number {
  const amount = Number(c.amount)
  return c.recurrence === 'ANNUAL' ? amount / 12 : amount
}

export function toCostDto(c: CostRow) {
  return {
    id: c.id,
    name: c.name,
    amount: Number(c.amount),
    type: c.type,
    recurrence: c.recurrence,
    monthlyAmount: monthlyAmount(c),
  }
}

export type CostDto = ReturnType<typeof toCostDto>

export function summarize(costs: CostDto[]) {
  const sum = (t: CostType) =>
    costs.filter((c) => c.type === t).reduce((acc, c) => acc + c.monthlyAmount, 0)
  const fixed = sum('FIXED')
  const variable = sum('VARIABLE')
  const loan = sum('LOAN')
  return { fixed, variable, loan, total: fixed + variable + loan }
}
