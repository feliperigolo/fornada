import { parseStringPromise } from 'xml2js'

type NfeItem = {
  code?: string
  name: string
  quantity: number
  unit?: string
  unitPrice: number
  totalPrice: number
}

export async function parseNfe(xml: string): Promise<{ supplier?: string; nfNumber?: string; items: NfeItem[] }> {
  const doc = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true })

  // Try common NF-e paths
  const infNFe = doc?.nfeProc?.NFe?.infNFe ?? doc?.NFe?.infNFe ?? doc?.infNFe

  const supplier = infNFe?.emit?.xNome ?? infNFe?.emit?.xFant
  const nfNumber = infNFe?.ide?.nNF

  const det = infNFe?.det
  const detItems = [] as any[]

  if (!det) return { supplier, nfNumber, items: [] }

  if (Array.isArray(det)) {
    detItems.push(...det)
  } else {
    detItems.push(det)
  }

  const items: NfeItem[] = detItems.map((d) => {
    const prod = d?.prod ?? {}
    const name = prod.xProd ?? prod.cProd ?? 'Unknown'
    const code = prod.cProd ?? undefined
    const quantity = parseFloat(prod.qCom ?? prod.quantidade ?? 0) || 0
    const unit = prod.uCom ?? prod.unidade ?? undefined
    const unitPrice = parseFloat(prod.vUnCom ?? prod.vUnid ?? prod.vProd ?? 0) || 0
    const totalPrice = parseFloat(prod.vProd ?? prod.vTot ?? unitPrice * quantity) || unitPrice * quantity

    return {
      code,
      name,
      quantity,
      unit,
      unitPrice,
      totalPrice,
    }
  })

  return { supplier, nfNumber, items }
}

export default parseNfe
