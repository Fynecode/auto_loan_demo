import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import { createError, defineEventHandler, readBody } from 'h3'
import { UserRole } from '~~/app/generated/prisma/client'
import bcrypt from 'bcrypt'

export default defineEventHandler(async (event) => {
  const currentUser = requireAuth(event)
  if (currentUser.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const body = await readBody(event)
  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  const password = String(body?.password || '').trim()
  const role = body?.role

  if (!name || !email || !password) {
    throw createError({ statusCode: 400, message: 'Name, email, and password are required' })
  }

  if (!Object.values(UserRole).includes(role)) {
    throw createError({ statusCode: 400, message: 'Invalid role' })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({ statusCode: 409, message: 'User already exists' })
  }

  const hashed = await bcrypt.hash(password, 10)

  return prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  })
})
