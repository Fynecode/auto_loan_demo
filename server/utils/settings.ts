import { prisma } from './prisma'
import { createError } from 'h3'

const CONTRACT_LOGO_KEY = 'contractLogoUrl'

export async function getContractLogoUrl() {
  const appSetting = (prisma as any).appSetting
  if (!appSetting) {
    return ''
  }
  const setting = await appSetting.findUnique({
    where: { key: CONTRACT_LOGO_KEY }
  })
  return setting?.value ?? ''
}

export async function setContractLogoUrl(url: string) {
  const appSetting = (prisma as any).appSetting
  if (!appSetting) {
    throw createError({
      statusCode: 500,
      message: 'Logo settings table missing. Run Prisma migrate.'
    })
  }
  return appSetting.upsert({
    where: { key: CONTRACT_LOGO_KEY },
    update: { value: url },
    create: { key: CONTRACT_LOGO_KEY, value: url }
  })
}
