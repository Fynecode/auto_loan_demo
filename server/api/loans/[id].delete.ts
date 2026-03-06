import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const loanId = event.context.params?.id
  if (!loanId) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }

  const loanWhere = user.role === 'ADMIN'
    ? { id: loanId }
    : {
        id: loanId,
        OR: [
          { createdById: user.id },
          { assignments: { some: { userId: user.id } } }
        ]
      }

  const loan = await prisma.loan.findFirst({
    where: loanWhere,
    select: { id: true, contractId: true }
  })

  if (!loan) {
    throw createError({ statusCode: 404, message: 'Loan not found' })
  }

  const documents = await prisma.document.findMany({
    where: { loanId },
    select: { fileUrl: true, publicId: true, resourceType: true }
  })

  const contract = loan.contractId
    ? await prisma.contract.findUnique({
        where: { id: loan.contractId },
        select: { fileUrl: true, publicId: true, resourceType: true }
      })
    : null

  const assets = [
    ...documents.map(doc => ({
      url: doc.fileUrl,
      publicId: doc.publicId,
      resourceType: doc.resourceType
    })),
    ...(contract
      ? [{
          url: contract.fileUrl,
          publicId: contract.publicId,
          resourceType: contract.resourceType
        }]
      : [])
  ]

  await deleteFromCloudinary(assets)

  await prisma.$transaction(async (tx) => {
    await tx.loanActivity.create({
      data: {
        loanId,
        type: 'DELETED',
        performedBy: user.id
      }
    })

    await tx.loanQuantityHistory.deleteMany({ where: { loanId } })
    await tx.document.deleteMany({ where: { loanId } })

    if (loan.contractId) {
      await tx.contract.delete({ where: { id: loan.contractId } })
    }

    await tx.loan.delete({ where: { id: loanId } })
  })

  return { ok: true }
})

async function deleteFromCloudinary(
  assets: Array<{ url: string; publicId: string | null; resourceType: string | null }>
) {
  const unique = Array.from(new Map(assets.filter(a => a.url).map(a => [a.url, a])).values())

  await Promise.allSettled(
    unique.map(async (asset) => {
      const parsed = asset.publicId && asset.resourceType
        ? { publicId: asset.publicId, resourceType: asset.resourceType as 'image' | 'raw' | 'video' }
        : parseCloudinaryUrl(asset.url)
      if (!parsed) return
      await cloudinary.uploader.destroy(parsed.publicId, {
        resource_type: parsed.resourceType
      })
    })
  )
}

function parseCloudinaryUrl(url: string) {
  const resourceTypeMatch = url.match(/\/(image|raw|video)\/upload\//)
  if (!resourceTypeMatch) return null

  const resourceType = resourceTypeMatch[1] as 'image' | 'raw' | 'video'
  const parts = url.split('/upload/')
  if (parts.length < 2) return null

  let path = parts[1]
  path = path.replace(/^v\d+\//, '')

  const lastDot = path.lastIndexOf('.')
  if (lastDot > path.lastIndexOf('/')) {
    path = path.slice(0, lastDot)
  }

  return { publicId: path, resourceType }
}
