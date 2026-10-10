export type ParsedNfeItem = {
  code?: string
  name: string
  quantity: number
  unit?: string
  unitPrice: number
  totalPrice: number
}

export type ParsedNfe = {
  supplier?: string
  nfNumber?: string
  items: ParsedNfeItem[]
  /** XML bruto (NF-e XML) ou JSON extraído (PDF) — persistido em NfeImport.xmlRaw */
  raw: string
  source: 'xml' | 'pdf'
}

export type IngredientOption = {
  id: string
  name: string
  unit: string
  costPerUnit: number
}

export type ParseResponse = {
  nfe: ParsedNfe
  ingredients: IngredientOption[]
}

export type ImportItemPayload = {
  action: 'link' | 'create' | 'ignore'
  ingredientId?: string
  code?: string
  name: string
  quantity: number
  unit?: string
  unitPrice: number
  totalPrice: number
}

export type ImportPayload = {
  supplier?: string
  nfNumber?: string
  raw: string
  items: ImportItemPayload[]
}

export type ImportSummary = {
  nfeImportId: string
  updated: number
  created: number
  ignored: number
}
