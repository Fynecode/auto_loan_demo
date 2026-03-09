import { requireRole } from '~~/server/utils/requireRole'
import { UserRole } from '~~/prisma/generated/client/index.js'

export default defineEventHandler((event) => {
  requireRole(event, [UserRole.ADMIN])
  return { ok: true }
})

