import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'

export async function GET() {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rows = await prisma.ingredient.findMany({
    where: { bakeryId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, unit: true, costPerUnit: true },
  })
  return NextResponse.json(
    rows.map((r) => ({ ...r, costPerUnit: Number(r.costPerUnit) }))
  )
}
