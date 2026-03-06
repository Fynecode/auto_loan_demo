import { prisma } from '~~/server/utils/prisma'
import { createError, defineEventHandler, readBody } from 'h3'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = String(body?.token || '').trim()
  const newPassword = String(body?.password || '')

  if (!token || !newPassword) {
    throw createError({ statusCode: 400, message: 'Missing token or password' })
  }

  if (newPassword.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  })

  if (!resetToken || resetToken.expiresAt < new Date()) {
    throw createError({ statusCode: 400, message: 'Invalid or expired token' })
  }

  const hashed = await bcrypt.hash(newPassword, 10)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { password: hashed, failedLoginAttempts: 0, lockoutUntil: null }
    })

    await tx.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId }
    })

    await tx.session.deleteMany({
      where: { userId: resetToken.userId }
    })
  })

  return { ok: true }
})
