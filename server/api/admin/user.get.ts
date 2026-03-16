import { requireRole } from '~~/server/utils/requireRole'
import pkg from '@prisma/client'

const { UserRole } = pkg

export default defineEventHandler((event) => {
  requireRole(event, [UserRole.ADMIN])
  return { ok: true }
})


