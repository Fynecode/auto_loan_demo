import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const currentUser = requireAuth(event)
  const body = await readBody(event)

  const data: Record<string, any> = {}
  if (typeof body?.name === 'string') data.name = body.name.trim()
  if (typeof body?.email === 'string') data.email = body.email.trim()

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, message: 'No updates provided' })
  }

  return prisma.user.update({
    where: { id: currentUser.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  })
})
