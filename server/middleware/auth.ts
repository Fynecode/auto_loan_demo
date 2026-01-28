import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, 'session')
  if (!sessionId) return

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return

  // Optional: block disabled users later
  // if (session.user.status !== 'ACTIVE') return

  event.context.auth = {
    user: session.user,
    sessionId: session.id,
  }

  // Optional: update lastUsedAt
  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })
})
