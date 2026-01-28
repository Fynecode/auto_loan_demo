import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { LoanStatus } from '~~/app/generated/prisma/client'

const allowedTransitions: Record<LoanStatus, LoanStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['OVERDUE', 'COMPLETED'],
  OVERDUE: ['COMPLETED'],
  DEFAULTED: [],
  COMPLETED: [],
  CANCELLED: []
}

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const id = event.context.params!.id
  const { nextStatus } = await readBody(event)

  const loan = await prisma.loan.findUnique({ where: { id } })
  if (!loan) {
    throw createError({ statusCode: 404, message: 'Loan not found' })
  }

  if (!allowedTransitions[loan.status].includes(nextStatus)) {
    throw createError({
      statusCode: 400,
      message: `Invalid transition from ${loan.status} to ${nextStatus}`
    })
  }

  return prisma.loan.update({
    where: { id },
    data: { status: nextStatus }
  })
})
