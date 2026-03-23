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
      ? { id: loanId, deletedAt: null }
      : {
          id: loanId,
          deletedAt: null,
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

  if (remainingAmount > Number(loan.remainingAmount)) {
    throw createError({ statusCode: 400, message: 'Remaining amount cannot increase' })
  }

  const reductionAmount = Number(loan.remainingAmount) - remainingAmount
  if (reductionAmount <= 0) {
    throw createError({ statusCode: 400, message: 'Remaining amount must decrease' })
  }

  const isCompleted = remainingAmount === 0
  const updated = await prisma.$transaction(async (tx) => {
    const updatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: {
        remainingAmount,
        ...(isCompleted ? { status: 'COMPLETED', endDate: new Date() } : {})
      }
    })

    await tx.payment.create({
      data: {
        loanId,
        amount: reductionAmount,
        paidAt: new Date()
      }
    })

    await tx.loanActivity.create({
      data: {
        loanId,
        type: isCompleted ? 'STATUS_UPDATED' : 'UPDATED',
        details: isCompleted
          ? 'ACTIVE -> COMPLETED (remaining amount cleared)'
          : `Payment recorded: N$ ${reductionAmount.toLocaleString()}`,
        performedBy: user.id
      }
    })

    return updatedLoan
  })

  return updated
})
