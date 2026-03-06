import jwt from 'jsonwebtoken'

type JwtPayload = {
  userId: string
  sessionId: string
  role?: string
}

const accessSecret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret'
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret'

export const ACCESS_EXPIRES_IN = '24h'
export const REFRESH_EXPIRES_IN = '7d'

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, accessSecret, { expiresIn: ACCESS_EXPIRES_IN })
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, refreshSecret, { expiresIn: REFRESH_EXPIRES_IN })
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, accessSecret) as JwtPayload
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, refreshSecret) as JwtPayload
}
