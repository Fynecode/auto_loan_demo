import { defineEventHandler, getCookie, setCookie, getHeader, createError, getMethod } from 'h3'

const CSRF_COOKIE = 'csrf_token'
const CSRF_HEADER = 'x-csrf-token'

export default defineEventHandler((event) => {
  const method = getMethod(event)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']

  let token = getCookie(event, CSRF_COOKIE)
  if (!token) {
    token = crypto.randomUUID()
    setCookie(event, CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    })
  }

  if (safeMethods.includes(method)) return

  const origin = getHeader(event, 'origin')
  const host = getHeader(event, 'host')
  if (!origin || !host || !origin.includes(host)) {
    throw createError({ statusCode: 403, message: 'Invalid origin' })
  }

  const headerToken = getHeader(event, CSRF_HEADER)
  if (!headerToken || headerToken !== token) {
    throw createError({ statusCode: 403, message: 'Invalid CSRF token' })
  }
})
