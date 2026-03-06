import { prisma } from '~~/server/utils/prisma'
import { defineEventHandler, readBody } from 'h3'
import { sendPasswordResetEmail } from '~~/server/utils/resend'
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body?.email || '').trim()

  if (!email) {
    return { ok: true }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { ok: true }
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  })

  const host = event.node.req.headers.host
  const proto = event.node.req.headers['x-forwarded-proto'] || 'http'
  const baseUrl = process.env.APP_BASE_URL || (host ? `${proto}://${host}` : '')
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`

  await sendPasswordResetEmail({ to: user.email, resetUrl })

  return { ok: true }
})
