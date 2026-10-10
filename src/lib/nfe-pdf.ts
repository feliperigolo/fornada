import { z } from 'zod'
import type { ParsedNfeItem } from '@/lib/nfe-types'

const MODEL = 'claude-sonnet-5-5'

const itemSchema = z.object({
  name: z.string().min(1),
  quantity: z.coerce.number(),
  unit: z.string().nullish(),
  unitPrice: z.coerce.number(),
  totalPrice: z.coerce.number(),
})

const resultSchema = z.object({
  supplier: z.string().nullish(),
  nfNumber: z.string().nullish(),
  items: z.array(itemSchema),
})

const PROMPT = `Extraia os itens desta NF-e (nota fiscal). Responda APENAS com JSON válido, sem markdown, no formato:
{"supplier": "razão social do emitente", "nfNumber": "número da nota", "items": [{"name": string, "quantity": number, "unit": string, "unitPrice": number, "totalPrice": number}]}
Regras: use ponto como separador decimal, valores em reais sem símbolo, "unit" como aparece na nota (ex.: KG, UN, L). Inclua todos os itens/produtos e nenhum total geral.`

export async function parseNfePdf(pdf: Buffer): Promise<{
  supplier?: string
  nfNumber?: string
  items: ParsedNfeItem[]
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf.toString('base64'),
              },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Falha na API da Anthropic (${res.status})`)
  }

  const body = (await res.json()) as {
    content?: { type: string; text?: string }[]
  }
  const text = body.content?.find((c) => c.type === 'text')?.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Resposta da IA sem JSON')

  const parsed = resultSchema.parse(JSON.parse(match[0]))
  return {
    supplier: parsed.supplier ?? undefined,
    nfNumber: parsed.nfNumber ?? undefined,
    items: parsed.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit ?? undefined,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
    })),
  }
}
