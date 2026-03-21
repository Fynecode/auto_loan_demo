import { defineEventHandler } from 'h3'
import { requireAuth } from '~~/server/utils/requireAuth'
import { getContractLogoUrl } from '~~/server/utils/settings'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const logoUrl = await getContractLogoUrl()
  return { logoUrl }
})
