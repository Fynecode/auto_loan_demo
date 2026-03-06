import { prisma } from '~~/server/utils/prisma'
import { createError, defineEventHandler, getCookie, setCookie } from 'h3'
import bcrypt from 'bcrypt'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '~~/server/utils/jwt'

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, 'refresh_token')
  if (!refreshToken) {
    throw createError({ statusCode: 401, message: 'Missing refresh token' })
  }

  let payload: { userId: string; sessionId: string; role?: string }
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw createError({ statusCode: 401, message: 'Invalid refresh token' })
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: true }
  })

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw createError({ statusCode: 401, message: 'Session expired' })
  }

  const matches = await bcrypt.compare(refreshToken, session.tokenHash)
  if (!matches) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    })
    throw createError({ statusCode: 401, message: 'Refresh token reuse detected' })
  }

  const newPayload = { userId: session.userId, sessionId: session.id, role: session.user.role }
  const newAccessToken = signAccessToken(newPayload)
  const newRefreshToken = signRefreshToken(newPayload)
  const newHash = await bcrypt.hash(newRefreshToken, 10)

  await prisma.session.update({
    where: { id: session.id },
    data: { tokenHash: newHash }
  })

  const sameSite = (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax'
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production'

  setCookie(event, 'access_token', newAccessToken, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: 60 * 60 * 24
  })

  setCookie(event, 'refresh_token', newRefreshToken, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })

  return { ok: true }
})
