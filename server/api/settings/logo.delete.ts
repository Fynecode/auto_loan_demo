import { createError, defineEventHandler } from 'h3'
import { requireAuth } from '~~/server/utils/requireAuth'
import { setContractLogoUrl } from '~~/server/utils/settings'

export default defineEventHandler(async (event) => {
  const currentUser = requireAuth(event)
  if (currentUser.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await setContractLogoUrl('')
  return { logoUrl: '' }
})
