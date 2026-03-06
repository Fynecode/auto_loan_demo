import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const loanId = event.context.params?.id
  if (!loanId) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }

  const [assignees, staff] = await Promise.all([
    prisma.loanAssignment.findMany({
      where: { loanId },
      include: { user: { select: { id: true, name: true, email: true } } }
    }),
    prisma.user.findMany({
      where: { role: 'STAFF' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true }
    })
  ])

  return {
    assignees: assignees.map(a => a.user),
    staff
  }
})
