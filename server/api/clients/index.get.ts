import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const query = getQuery(event)
  const page = Math.max(Number(query.page ?? 1), 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 15), 1), 100)
  const sort = String(query.sort ?? 'newest')
  const search = String(query.search ?? '').trim()

  const orderBy = sort === 'oldest'
    ? { createdAt: 'asc' as const }
    : { createdAt: 'desc' as const }

  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
          { empNumber: { contains: search, mode: 'insensitive' as const } },
          { idNumber: { contains: search, mode: 'insensitive' as const } }
        ]
      }
    : {}

  const total = await prisma.client.count({ where })

  const clients = await prisma.client.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      loans: {
        where: { status: 'ACTIVE' },
        select: { principal: true }
      }
    }
  })

  return {
    items: clients.map(client => {
      const activeLoansCount = client.loans.length
      const activeLoansAmount = client.loans.reduce((sum, loan) => {
        return sum + Number(loan.principal)
      }, 0)

      return {
        id: client.id,
        fullName: client.firstName,
        email: client.email,
        phone: client.phone ?? '-',
        activeLoans: activeLoansCount,
        activeLoanAmount: activeLoansAmount
      }
    }),
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1)
  }
})
