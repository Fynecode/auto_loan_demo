import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const loanId = event.context.params?.id
  if (!loanId) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }

  const body = await readBody(event)
  const userId = String(body?.userId || '')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Missing user id' })
  }

  await prisma.loanAssignment.delete({
    where: {
      loanId_userId: { loanId, userId }
    }
  })

  return { ok: true }
})
