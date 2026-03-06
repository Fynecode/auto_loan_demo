import { defineEventHandler, getMethod, getRequestIP, createError } from 'h3'

type Bucket = {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const MAX_REQUESTS = 120
const LOGIN_WINDOW_MS = 10 * 60_000
const LOGIN_MAX = 5

const buckets = new Map<string, Bucket>()

function getKey(event: any) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const method = getMethod(event)
  const path = event.path || event.node?.req?.url || ''
  return `${ip}:${method}:${path}`
}

export default defineEventHandler((event) => {
  const method = getMethod(event)
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return

  const path = event.path || event.node?.req?.url || ''
  if (path.startsWith('/api/auth/login')) {
    const key = `${getRequestIP(event, { xForwardedFor: true }) || 'unknown'}:login`
    const now = Date.now()
    const bucket = buckets.get(key)
    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
      return
    }
    bucket.count += 1
    if (bucket.count > LOGIN_MAX) {
      throw createError({ statusCode: 429, message: 'Too many login attempts' })
    }
    return
  }

  const key = getKey(event)
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  bucket.count += 1
  if (bucket.count > MAX_REQUESTS) {
    throw createError({ statusCode: 429, message: 'Too many requests' })
  }
})
