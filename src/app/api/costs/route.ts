import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'
import {
  costSchema,
  currentMonthStart,
  monthSchema,
  parseMonth,
  summarize,
  toCostDto,
} from '@/lib/costs'

export async function GET(request: Request) {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const current = currentMonthStart()
  const param = new URL(request.url).searchParams.get('month')
  if (param !== null && !monthSchema.safeParse(param).success) {
    return NextResponse.json({ error: 'Mês inválido (use YYYY-MM)' }, { status: 400 })
  }
  const month = param ? parseMonth(param) : current

  const rows = await prisma.cost.findMany({
    where: { bakeryId, month },
    orderBy: { name: 'asc' },
  })
  const costs = rows.map(toCostDto)

  return NextResponse.json({
    month: month.toISOString(),
    currentMonth: current.toISOString(),
    costs,
    summary: summarize(costs),
  })
}

export async function POST(request: Request) {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = costSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { month, ...data } = parsed.data
  const cost = await prisma.cost.create({
    data: { ...data, bakeryId, month: month ? parseMonth(month) : currentMonthStart() },
  })
  return NextResponse.json(toCostDto(cost), { status: 201 })
}
