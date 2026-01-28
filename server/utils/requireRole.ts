import { UserRole } from '~~/app/generated/prisma/client'
import type { H3Event } from 'h3'

export function requireRole(
  event: H3Event,
  roles: UserRole[]
) {
  const user = event.context.auth?.user

  if (!user || !roles.includes(user.role)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return user
}
