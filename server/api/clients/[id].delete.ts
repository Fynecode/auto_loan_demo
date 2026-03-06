import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const clientId = event.context.params?.id
  if (!clientId) {
    throw createError({ statusCode: 400, message: 'Missing client id' })
  }

  const activeLoan = await prisma.loan.findFirst({
    where: { clientId, status: 'ACTIVE' },
    select: { id: true }
  })
  if (activeLoan) {
    throw createError({
      statusCode: 400,
      message: 'Client has an active loan and cannot be deleted'
    })
  }

  const loanIds = await prisma.loan.findMany({
    where: { clientId },
    select: { id: true }
  })
  const ids = loanIds.map(l => l.id)

  await prisma.$transaction(async (tx) => {
    if (ids.length) {
      await tx.loanActivity.deleteMany({ where: { loanId: { in: ids } } })
      await tx.loanPenalty.deleteMany({ where: { loanId: { in: ids } } })
      await tx.loanTransition.deleteMany({ where: { loanId: { in: ids } } })
      await tx.payment.deleteMany({ where: { loanId: { in: ids } } })
      await tx.document.deleteMany({ where: { loanId: { in: ids } } })
      await tx.contract.deleteMany({ where: { loanId: { in: ids } } })
      await tx.loan.deleteMany({ where: { id: { in: ids } } })
    }
    await tx.document.deleteMany({ where: { clientId } })
    await tx.client.delete({ where: { id: clientId } })
  })

  return { ok: true }
})
