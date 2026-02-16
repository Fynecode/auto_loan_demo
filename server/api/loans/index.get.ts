import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const query = getQuery(event)
  const page = Math.max(Number(query.page ?? 1), 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 15), 1), 100)
  const sort = String(query.sort ?? 'newest')
  const status = String(query.status ?? 'all')
  const search = String(query.search ?? '').trim()

  const orderBy = sort === 'oldest'
    ? { createdAt: 'asc' as const }
    : { createdAt: 'desc' as const }

  const statusMap: Record<string, string> = {
    completed: 'COMPLETED',
    drafted: 'DRAFT',
    pending: 'PENDING_APPROVAL',
    cancelled: 'CANCELLED'
  }

  const statusFilter = statusMap[status]
  const searchFilter = search
    ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' as const } },
          { client: { firstName: { contains: search, mode: 'insensitive' as const } } },
          { client: { email: { contains: search, mode: 'insensitive' as const } } },
          { client: { empNumber: { contains: search, mode: 'insensitive' as const } } },
          { client: { idNumber: { contains: search, mode: 'insensitive' as const } } }
        ]
      }
    : {}

  const where = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(searchFilter as object)
  }

  const total = await prisma.loan.count({ where })

  const loans = await prisma.loan.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      client: {
        select: {
          firstName: true
        }
      }
    }
  })

  return {
    items: loans.map(loan => ({
      id: loan.id,
      client: `${loan.client.firstName}`,
      amount: Number(loan.principal),
      status: loan.status,
      due: loan.endDate
        ? loan.endDate.toISOString().split('T')[0]
        : '-'
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1)
  }
})
