import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = event.context.params!.id

  const loan = await prisma.loan.findUnique({
    where: { id }
  })

  if (!loan) {
    throw createError({ statusCode: 404, message: 'Loan not found' })
  }

  return loan
})
