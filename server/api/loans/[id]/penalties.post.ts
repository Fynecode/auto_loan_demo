import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler, readBody } from 'h3'
import { LoanPenaltyType } from '~~/prisma/generated/client/index.js'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const loanId = event.context.params?.id
  if (!loanId) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }

  const body = await readBody(event)
  const typeInput = String(body?.type || '')
  const months = body?.months ? Number(body.months) : null
  const reason = typeof body?.reason === 'string' ? body.reason : null

  const loan = await prisma.loan.findFirst({
    where: user.role === 'ADMIN'
      ? { id: loanId }
      : {
          id: loanId,
          OR: [
            { createdById: user.id },
            { assignments: { some: { userId: user.id } } }
          ]
        },
    select: {
      status: true,
      totalMonthlyInstallment: true,
      remainingAmount: true,
      endDate: true
    }
  })
  if (!loan) {
    throw createError({ statusCode: 404, message: 'Loan not found' })
  }
  if (loan.status !== 'ACTIVE') {
    throw createError({ statusCode: 400, message: 'Penalties can only be applied to ACTIVE loans' })
  }

  const typeMap: Record<string, LoanPenaltyType> = {
    INSTALLMENT_RATE: LoanPenaltyType.INSTALLMENT_INCREASE,
    INSTALLMENT_INCREASE: LoanPenaltyType.INSTALLMENT_INCREASE,
    PERIOD_EXTENSION: LoanPenaltyType.PERIOD_EXTENSION,
    FULL_REPAYMENT: LoanPenaltyType.FULL_REPAYMENT_DEMAND,
    FULL_REPAYMENT_DEMAND: LoanPenaltyType.FULL_REPAYMENT_DEMAND
  }
  const type = typeMap[typeInput]

  if (!type) {
    throw createError({ statusCode: 400, message: 'Invalid penalty type' })
  }

  if (type !== LoanPenaltyType.FULL_REPAYMENT_DEMAND && (!months || months < 1)) {
    throw createError({ statusCode: 400, message: 'Penalty months required' })
  }

  let rate = 0
  let penaltyAmount = 0
  let baseMonthlyInstallment = Number(loan.totalMonthlyInstallment)

  if (type === LoanPenaltyType.INSTALLMENT_INCREASE) {
    rate = 5
    penaltyAmount = Number((baseMonthlyInstallment * (rate / 100)).toFixed(2))
  }

  const penalty = await prisma.$transaction(async (tx) => {
    const record = await tx.loanPenalty.create({
      data: {
        loanId,
        type,
        rate,
        months: months ?? 0,
        baseMonthlyInstallment,
        penaltyAmount,
        reason: reason || undefined
      }
    })

    if (type === LoanPenaltyType.PERIOD_EXTENSION) {
      const baseEnd = loan.endDate ? new Date(loan.endDate) : new Date()
      const endDate = new Date(baseEnd)
      endDate.setMonth(endDate.getMonth() + (months ?? 0))
      await tx.loan.update({
        where: { id: loanId },
        data: { endDate }
      })
    }

    if (type === LoanPenaltyType.INSTALLMENT_INCREASE) {
      const remaining = Number(loan.remainingAmount)
      const extra = penaltyAmount * (months ?? 0)
      await tx.loan.update({
        where: { id: loanId },
        data: {
          remainingAmount: remaining + extra,
          totalMonthlyInstallment: baseMonthlyInstallment + penaltyAmount
        }
      })
    }

    await tx.loanActivity.create({
      data: {
        loanId,
        type: 'PENALTY_APPLIED',
        details: `${type}${months ? ` (${months} months)` : ''}`,
        performedBy: user.id
      }
    })

    return record
  })

  return penalty
})

