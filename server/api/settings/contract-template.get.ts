import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  return prisma.contractTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  })
})
