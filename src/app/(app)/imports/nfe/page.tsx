import { NfeImporter } from '@/components/nfe-importer'

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl text-primary">Importar NF-e</h1>
      <p className="mb-5 text-sm">
        Envie o XML ou PDF da nota para atualizar o custo dos insumos.
      </p>
      <NfeImporter />
    </div>
  )
}
