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
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})