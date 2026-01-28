import { requireRole } from '~~/server/utils/requireRole'
import { UserRole } from '~~/app/generated/prisma/client'

export default defineEventHandler((event) => {
  requireRole(event, [UserRole.ADMIN])
  return { ok: true }
})
