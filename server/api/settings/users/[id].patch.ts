import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler, readBody } from 'h3'
import { UserRole } from '~~/app/generated/prisma/client'

export default defineEventHandler(async (event) => {
  const currentUser = requireAuth(event)
  if (currentUser.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const userId = event.context.params?.id
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Missing user id' })
  }

  const body = await readBody(event)
  const data: Record<string, any> = {}

  if (typeof body?.name === 'string') data.name = body.name.trim()
  if (typeof body?.email === 'string') data.email = body.email.trim()
  if (typeof body?.role === 'string' && Object.values(UserRole).includes(body.role)) {
    data.role = body.role
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, message: 'No updates provided' })
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  })
})
