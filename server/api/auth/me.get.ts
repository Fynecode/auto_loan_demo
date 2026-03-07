import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'

export default defineEventHandler(async (event) => {
  try {
    const user = requireAuth(event) // throws 401 if no session

    // Optionally, select only fields you want to expose
    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    return safeUser
  } catch (err: any) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
})
