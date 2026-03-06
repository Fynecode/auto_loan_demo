import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const loanId = event.context.params?.id
  if (!loanId) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }

  const body = await readBody(event)
  const remainingAmount = Number(body?.remainingAmount)
  if (!Number.isFinite(remainingAmount) || remainingAmount < 0) {
    throw createError({ statusCode: 400, message: 'Invalid remaining amount' })
  }

  const loan = await prisma.loan.findFirst({
    where: user.role === 'ADMIN'
      ? { id: loanId }
      : {
          id: loanId,
          OR: [
            { createdById: user.id },
            { assignments: { some: { userId: user.id } } }
          ]
        }
  })
  if (!loan) {
    throw createError({ statusCode: 404, message: 'Loan not found' })
  }
  if (loan.status !== 'ACTIVE') {
    throw createError({ statusCode: 400, message: 'Loan must be ACTIVE to update remaining amount' })
  }

  const isCompleted = remainingAmount === 0
  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: {
      remainingAmount,
      ...(isCompleted ? { status: 'COMPLETED', endDate: new Date() } : {})
    }
  })

  await prisma.loanActivity.create({
    data: {
      loanId,
      type: isCompleted ? 'STATUS_UPDATED' : 'UPDATED',
      details: isCompleted
        ? 'ACTIVE -> COMPLETED (remaining amount cleared)'
        : `Remaining amount updated to ${remainingAmount}`,
      performedBy: user.id
    }
  })

  return updated
})
