import { prisma } from '~~/server/utils/prisma'
import { deleteCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, 'session')

  if (sessionId) {
    await prisma.session.delete({
      where: { id: sessionId },
    })
  }

  deleteCookie(event, 'session', {
    path: '/',
  })

  return { success: true }
})
