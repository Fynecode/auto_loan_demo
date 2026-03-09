import bcrypt from 'bcrypt'
import { defineEventHandler, createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole'
import { UserRole } from '@prisma/client'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])

  const existingUsers = await prisma.user.count()
  if (existingUsers > 0) {
    throw createError({ statusCode: 400, message: 'Seed already performed.' })
  }

  const adminPassword = await bcrypt.hash('admin123', 10)
  const staffPassword = await bcrypt.hash('staff123', 10)

  await prisma.user.createMany({
    data: [
      {
        name: 'Admin User',
        email: 'admin@greenline.local',
        password: adminPassword,
        role: UserRole.ADMIN
      },
      {
        name: 'Staff User',
        email: 'staff@greenline.local',
        password: staffPassword,
        role: UserRole.STAFF
      }
    ]
  })

  return { ok: true }
})
