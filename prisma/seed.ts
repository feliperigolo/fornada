import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import bcrypt from 'bcryptjs'

async function main() {
  neonConfig.webSocketConstructor = ws
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter } as any)

  console.log('Conectando ao banco...')

  const passwordHash = await bcrypt.hash('fornada@2024', 12)

  const user = await prisma.user.upsert({
    where: { email: 'admin@fornada.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@fornada.com',
      password: passwordHash,
    },
  })

  console.log('✅ Usuário admin criado:', user.email)

  const bakeryName = 'Panificadora Keli'
  const bakery =
    (await prisma.bakery.findFirst({
      where: { ownerId: user.id, name: bakeryName },
    })) ??
    (await prisma.bakery.create({
      data: { name: bakeryName, ownerId: user.id },
    }))

  console.log('✅ Padaria criada:', bakery.name)

  // Receitas de exemplo. Usam os insumos que já existem na padaria (importados via NF-e).
  // costPerUnit é por unidade de compra (SC/PCT/CX), então as quantidades abaixo são
  // expressas nessa unidade: kg usado / kg por embalagem.
  async function findIngredient(fragment: string) {
    const ing = await prisma.ingredient.findFirst({
      where: { bakeryId: bakery.id, name: { contains: fragment, mode: 'insensitive' } },
    })
    if (!ing) {
      throw new Error(
        `Insumo "${fragment}" não encontrado na padaria. Importe a NF-e de teste primeiro.`
      )
    }
    return ing
  }

  const farinha = await findIngredient('farinha de trigo') // SC de 25 kg
  const fermento = await findIngredient('fermento biologico') // PCT de 0,5 kg
  const sal = await findIngredient('sal refinado') // PCT de 1 kg
  const melhorador = await findIngredient('melhorador de farinha') // PCT de 1 kg
  const gordura = await findIngredient('gordura vegetal') // CX de 15 kg

  const massaName = 'Massa Base Pão Francês'
  let massa = await prisma.recipe.findFirst({ where: { bakeryId: bakery.id, name: massaName } })
  if (!massa) {
    massa = await prisma.recipe.create({
      data: {
        bakeryId: bakery.id,
        name: massaName,
        yieldQty: 80,
        yieldUnit: 'un',
        notes: 'Massa padrão para pão francês',
        items: {
          create: [
            { ingredientId: farinha.id, quantity: 25 / 25, unit: farinha.unit },
            { ingredientId: fermento.id, quantity: 0.5 / 0.5, unit: fermento.unit },
            { ingredientId: sal.id, quantity: 0.3 / 1, unit: sal.unit },
            { ingredientId: melhorador.id, quantity: 0.1 / 1, unit: melhorador.unit },
          ],
        },
      },
    })
  }
  console.log('✅ Receita:', massa.name)

  const recheadoName = 'Pão Francês com Recheio'
  let recheado = await prisma.recipe.findFirst({
    where: { bakeryId: bakery.id, name: recheadoName },
  })
  if (!recheado) {
    recheado = await prisma.recipe.create({
      data: {
        bakeryId: bakery.id,
        name: recheadoName,
        yieldQty: 80,
        yieldUnit: 'un',
        notes: 'Versão enriquecida com gordura',
        items: {
          create: [
            // 1 porção = rendimento completo da massa base (80 un)
            { subRecipeId: massa.id, quantity: 80, unit: 'un' },
            { ingredientId: gordura.id, quantity: Number((0.2 / 15).toFixed(6)), unit: gordura.unit },
          ],
        },
      },
    })
  }
  console.log('✅ Receita:', recheado.name)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})