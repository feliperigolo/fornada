import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCurrentBakeryId } from '@/lib/bakery'
import { parseNfe } from '@/lib/nfe-parser'
import { parseNfePdf } from '@/lib/nfe-pdf'
import type { ParseResponse } from '@/lib/nfe-types'

export const maxDuration = 60

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const bakeryId = await getCurrentBakeryId()
  if (!bakeryId) {
    return NextResponse.json({ error: 'Nenhuma padaria cadastrada' }, { status: 400 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Arquivo vazio ou maior que 10 MB' }, { status: 400 })
  }

  const name = file.name.toLowerCase()
  const isXml = name.endsWith('.xml') || file.type.includes('xml')
  const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
  if (!isXml && !isPdf) {
    return NextResponse.json({ error: 'Envie um arquivo .xml ou .pdf' }, { status: 400 })
  }

  let nfe: ParseResponse['nfe']
  try {
    if (isXml) {
      const xml = await file.text()
      const parsed = await parseNfe(xml)
      nfe = { ...parsed, raw: xml, source: 'xml' }
    } else {
      const parsed = await parseNfePdf(Buffer.from(await file.arrayBuffer()))
      nfe = { ...parsed, raw: JSON.stringify(parsed), source: 'pdf' }
    }
  } catch (err) {
    console.error('NF-e parse error', err)
    return NextResponse.json(
      { error: 'Não foi possível ler os itens da nota. Verifique o arquivo.' },
      { status: 422 }
    )
  }

  if (nfe.items.length === 0) {
    return NextResponse.json({ error: 'Nenhum item encontrado na nota' }, { status: 422 })
  }

  const rows = await prisma.ingredient.findMany({
    where: { bakeryId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, unit: true, costPerUnit: true },
  })
  const ingredients = rows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    costPerUnit: Number(r.costPerUnit),
  }))

  return NextResponse.json({ nfe, ingredients } satisfies ParseResponse)
}
