import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'
import { addMonths, currentMonthStart, monthSchema, parseMonth } from '@/lib/costs'

const bodySchema = z.object({
  grossRevenue: z.number().finite().nonnegative().max(999_999_999),
  /** Mês de referência "YYYY-MM"; padrão: mês atual. Aceita até 11 meses para trás. */
  month: monthSchema.optional(),
})

const MANUAL = 'manual'

/** `selected`: mês cujo total vai em `grossRevenue` (padrão: mês atual). O histórico é sempre dos 6 últimos meses. */
async function monthTotals(bakeryId: string, selected?: Date) {
  const current = currentMonthStart()
  const target = selected ?? current
  const histFrom = addMonths(current, -5)
  const from = target < histFrom ? target : histFrom
  const to = target > current ? target : current
  const rows = await prisma.monthlyRevenue.findMany({
    where: { bakeryId, month: { gte: from, lte: to } },
    select: { month: true, grossRevenue: true },
  })

  const byMonth = new Map<number, number>()
  for (const r of rows) {
    byMonth.set(r.month.getTime(), (byMonth.get(r.month.getTime()) ?? 0) + Number(r.grossRevenue))
  }

  const history = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(current, -i)
    return { month: m.toISOString(), grossRevenue: byMonth.get(m.getTime()) ?? 0 }
  })

  return {
    month: target.toISOString(),
    currentMonth: current.toISOString(),
    grossRevenue: byMonth.get(target.getTime()) ?? 0,
    history, // do mês atual para trás
  }
}

export async function GET(request: Request) {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const param = new URL(request.url).searchParams.get('month')
  if (param !== null && !monthSchema.safeParse(param).success) {
    return NextResponse.json({ error: 'Mês inválido (use YYYY-MM)' }, { status: 400 })
  }
  return NextResponse.json(await monthTotals(bakeryId, param ? parseMonth(param) : undefined))
}

/** Registra/atualiza o faturamento manual do mês atual. */
export async function POST(request: Request) {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const current = currentMonthStart()
  let month = current
  if (parsed.data.month) {
    month = parseMonth(parsed.data.month)
    if (month > current || month < addMonths(current, -11)) {
      return NextResponse.json({ error: 'Mês fora do período permitido' }, { status: 400 })
    }
  }
  const existing = await prisma.monthlyRevenue.findFirst({
    where: { bakeryId, month, source: MANUAL },
    select: { id: true },
  })
  if (existing) {
    await prisma.monthlyRevenue.update({
      where: { id: existing.id },
      data: { grossRevenue: parsed.data.grossRevenue },
    })
  } else {
    await prisma.monthlyRevenue.create({
      data: { bakeryId, month, source: MANUAL, grossRevenue: parsed.data.grossRevenue },
    })
  }

  return NextResponse.json(await monthTotals(bakeryId))
}
