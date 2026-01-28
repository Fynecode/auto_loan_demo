import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      client: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  })

  return loans.map(loan => ({
    id: loan.id,
    client: `${loan.client.firstName} ${loan.client.lastName}`,
    amount: Number(loan.principal),
    status: loan.status,
    due: loan.endDate
      ? loan.endDate.toISOString().split('T')[0]
      : '—'
  }))
})
