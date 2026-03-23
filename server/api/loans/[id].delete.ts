import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const loanId = event.context.params?.id
  if (!loanId) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }

  const loanWhere = user.role === 'ADMIN'
    ? { id: loanId, deletedAt: null }
    : {
        id: loanId,
        deletedAt: null,
        OR: [
          { createdById: user.id },
          { assignments: { some: { userId: user.id } } }
        ]
      }

  const loan = await prisma.loan.findFirst({
    where: loanWhere,
    select: { id: true, contractId: true }
  })

  if (!loan) {
    throw createError({ statusCode: 404, message: 'Loan not found' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.loanActivity.create({
      data: {
        loanId,
        type: 'DELETED',
        performedBy: user.id
      }
    })

    await tx.loan.update({
      where: { id: loanId },
      data: { deletedAt: new Date() }
    })
  })

  return { ok: true }
})

