import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Primeira padaria do usuário logado (ainda sem seletor de padaria). */
export async function getCurrentBakeryId(): Promise<string | null> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null

  const bakery = await prisma.bakery.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return bakery?.id ?? null
}
