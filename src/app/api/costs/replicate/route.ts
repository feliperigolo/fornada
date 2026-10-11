import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'
import { monthSchema, parseMonth } from '@/lib/costs'

const bodySchema = z.object({ fromMonth: monthSchema, toMonth: monthSchema })

const key = (name: string, type: string) => `${type}:${name.trim().toLowerCase()}`

/** Copia os custos de `fromMonth` para `toMonth`, ignorando os que já existem (mesmo nome e tipo). */
export async function POST(request: Request) {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  if (parsed.data.fromMonth === parsed.data.toMonth) {
    return NextResponse.json({ error: 'Os meses de origem e destino são iguais' }, { status: 400 })
  }

  const from = parseMonth(parsed.data.fromMonth)
  const to = parseMonth(parsed.data.toMonth)

  const created = await prisma.$transaction(async (tx) => {
    const [source, existing] = await Promise.all([
      tx.cost.findMany({ where: { bakeryId, month: from } }),
      tx.cost.findMany({ where: { bakeryId, month: to }, select: { name: true, type: true } }),
    ])
    const seen = new Set(existing.map((c) => key(c.name, c.type)))
    const toCreate = source.filter((c) => {
      const k = key(c.name, c.type)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    await tx.cost.createMany({
      data: toCreate.map((c) => ({
        bakeryId,
        name: c.name,
        amount: c.amount,
        type: c.type,
        recurrence: c.recurrence,
        month: to,
      })),
    })
    return { sourceCount: source.length, created: toCreate.length }
  })

  return NextResponse.json({ ...created, skipped: created.sourceCount - created.created })
}
