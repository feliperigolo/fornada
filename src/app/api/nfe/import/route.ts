import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'
import type { ImportSummary } from '@/lib/nfe-types'

export const maxDuration = 60

const money = z.number().finite().nonnegative().max(99_999_999)

const itemSchema = z.object({
  action: z.enum(['link', 'create', 'ignore']),
  ingredientId: z.string().optional(),
  code: z.string().optional(),
  name: z.string().trim().min(1).max(300),
  quantity: z.number().finite().nonnegative().max(99_999_999),
  unit: z.string().trim().max(20).optional(),
  unitPrice: money,
  totalPrice: money,
})

const payloadSchema = z.object({
  supplier: z.string().max(300).optional(),
  nfNumber: z.string().max(60).optional(),
  raw: z.string().min(1).max(5_000_000),
  items: z.array(itemSchema).min(1).max(1000),
})

export async function POST(request: Request) {
  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) {
    return NextResponse.json({ error: 'Não autenticado ou sem padaria' }, { status: 401 })
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  const { supplier, nfNumber, raw, items } = parsed.data

  const linkIds = [
    ...new Set(items.filter((i) => i.action === 'link').map((i) => i.ingredientId)),
  ]
  if (linkIds.some((id) => !id)) {
    return NextResponse.json({ error: 'Item vinculado sem insumo' }, { status: 400 })
  }
  const owned = await prisma.ingredient.count({
    where: { id: { in: linkIds as string[] }, bakeryId },
  })
  if (owned !== linkIds.length) {
    return NextResponse.json({ error: 'Insumo inválido' }, { status: 400 })
  }

  let updated = 0
  let created = 0
  const ignored = items.filter((i) => i.action === 'ignore').length

  const nfeImportId = await prisma.$transaction(
    async (tx) => {
      const nfeImport = await tx.nfeImport.create({
        data: { bakeryId, supplier, nfNumber, xmlRaw: raw },
        select: { id: true },
      })
      const now = new Date()

      for (const item of items) {
        if (item.action === 'ignore') continue

        let ingredientId: string
        if (item.action === 'create') {
          const ing = await tx.ingredient.create({
            data: {
              bakeryId,
              name: item.name,
              unit: item.unit || 'un',
              costPerUnit: item.unitPrice,
            },
            select: { id: true },
          })
          ingredientId = ing.id
          created++
        } else {
          ingredientId = item.ingredientId!
          await tx.ingredient.update({
            where: { id: ingredientId },
            data: { costPerUnit: item.unitPrice },
          })
          updated++
        }

        await tx.nfeItem.create({
          data: {
            nfeImportId: nfeImport.id,
            ingredientId,
            code: item.code,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitPrice,
            totalCost: item.totalPrice,
          },
        })
        await tx.costHistory.create({
          data: { ingredientId, unitCost: item.unitPrice, recordedAt: now },
        })
      }
      return nfeImport.id
    },
    { timeout: 30_000, maxWait: 10_000 }
  )

  return NextResponse.json({ nfeImportId, updated, created, ignored } satisfies ImportSummary)
}
