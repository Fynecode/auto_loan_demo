import bcrypt from 'bcrypt'

export async function verifyPassword(
  plain: string,
  hash: string
) {
  return bcrypt.compare(plain, hash)
}