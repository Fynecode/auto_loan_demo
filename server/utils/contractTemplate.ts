import { createError } from 'h3'
import { prisma } from './prisma'

export async function getActiveContractTemplateOrThrow() {
  const template = await prisma.contractTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      message: 'No active contract template found'
    })
  }

  if (!template.fileUrl) {
    throw createError({
      statusCode: 500,
      message: 'Active contract template has no file URL'
    })
  }

  return template
}

export async function downloadContractTemplateBuffer(template: { fileUrl: string }) {
  const res = await fetch(template.fileUrl)
  if (!res.ok) {
    throw createError({
      statusCode: 502,
      message: `Failed to download contract template (${res.status})`
    })
  }
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
