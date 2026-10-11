import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'
import { costSchema, parseMonth, toCostDto } from '@/lib/costs'

export async function PUT(request: Request, ctx: RouteContext<'/api/costs/[id]'>) {
  const { id } = await ctx.params
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = costSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const existing = await prisma.cost.findFirst({ where: { id, bakeryId }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Custo não encontrado' }, { status: 404 })

  const { month, ...data } = parsed.data
  const cost = await prisma.cost.update({
    where: { id },
    data: month ? { ...data, month: parseMonth(month) } : data,
  })
  return NextResponse.json(toCostDto(cost))
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/costs/[id]'>) {
  const { id } = await ctx.params
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { count } = await prisma.cost.deleteMany({ where: { id, bakeryId } })
  if (count === 0) return NextResponse.json({ error: 'Custo não encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
