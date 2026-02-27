import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { LoanStatus } from '~~/app/generated/prisma/client'
import { createError, defineEventHandler, readBody } from 'h3'

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
  const user = await requireAuth(event)

  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }
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

  const updateData: { status: LoanStatus; startDate?: Date; endDate?: Date } = {
    status: nextStatus
  }

  if (nextStatus === 'ACTIVE') {
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + loan.durationMonths)
    updateData.startDate = startDate
    updateData.endDate = endDate
  }
  if (nextStatus === 'COMPLETED') {
    updateData.endDate = new Date()
  }

  return prisma.$transaction(async (tx) => {
    const updatedLoan = await tx.loan.update({
      where: { id },
      data: updateData
    })

    await tx.loanActivity.create({
      data: {
        loanId: id,
        type: 'STATUS_UPDATED',
        details: `${loan.status} -> ${nextStatus}`,
        performedBy: user.id
      }
    })

    return updatedLoan
  })
})
