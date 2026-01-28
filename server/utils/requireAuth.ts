import type { H3Event } from 'h3'

export function requireAuth(event: H3Event) {
  if (!event.context.auth) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  return event.context.auth.user
}
