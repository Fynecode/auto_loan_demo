import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const currentUser = requireAuth(event)
  if (currentUser.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const userId = event.context.params?.id
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Missing user id' })
  }

  if (userId === currentUser.id) {
    throw createError({ statusCode: 400, message: 'You cannot delete your own account.' })
  }

  await prisma.user.delete({ where: { id: userId } })
  return { ok: true }
})
