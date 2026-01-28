// server/api/auth/login.post.ts
import { prisma } from '~~/server/utils/prisma'
import { verifyPassword } from '~~/server/utils/verifyPassword'
import { setCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Missing credentials' })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !(await verifyPassword(password, user.password))) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
    },
  })

  setCookie(event, 'session', session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return { success: true }
})
