import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const clientId = event.context.params?.id
  if (!clientId) {
    throw createError({ statusCode: 400, message: 'Missing client id' })
  }

  const body = await readBody(event)
  const data: Record<string, any> = {}

  if (typeof body?.fullName === 'string') data.firstName = body.fullName.trim()
  if (typeof body?.email === 'string') data.email = body.email.trim()
  if (typeof body?.phone === 'string') data.phone = body.phone.trim()
  if (typeof body?.empNumber === 'string') data.empNumber = body.empNumber.trim()
  if (typeof body?.idNumber === 'string') data.idNumber = body.idNumber.trim()

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, message: 'No updates provided' })
  }

  if (user.role !== 'ADMIN') {
    const access = await prisma.client.findFirst({
      where: {
        id: clientId,
        loans: {
          some: {
            OR: [
              { createdById: user.id },
              { assignments: { some: { userId: user.id } } }
            ]
          }
        }
      },
      select: { id: true }
    })

    if (!access) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
  }

  return prisma.client.update({
    where: { id: clientId },
    data,
    select: {
      id: true,
      firstName: true,
      email: true,
      phone: true,
      empNumber: true,
      idNumber: true
    }
  })
})
