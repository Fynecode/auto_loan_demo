import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const loanId = event.context.params?.id
  if (!loanId) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      client: true,
      Documents: true,
      contract: true
    }
  })

  if (!loan) {
    throw createError({ statusCode: 404, message: 'Loan not found' })
  }

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + 60 * 60

  return {
    id: loan.id,
    reference: loan.reference,
    principal: Number(loan.principal),
    interestRate: Number(loan.interestRate),
    durationMonths: loan.durationMonths,
    startDate: loan.startDate?.toISOString() ?? null,
    endDate: loan.endDate?.toISOString() ?? null,
    status: loan.status,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
    client: {
      id: loan.client.id,
      firstName: loan.client.firstName,
      empNumber: loan.client.empNumber,
      email: loan.client.email,
      phone: loan.client.phone,
      idNumber: loan.client.idNumber
    },
    documents: loan.Documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileUrl: doc.fileUrl,
      signedUrl: getSignedUrlFromMeta(doc.publicId, doc.resourceType, doc.format, doc.fileUrl, expiresAt),
      uploadedAt: doc.uploadedAt.toISOString()
    })),
    contract: loan.contract
      ? {
          id: loan.contract.id,
          fileUrl: loan.contract.fileUrl,
          signedUrl: getSignedUrlFromMeta(
            loan.contract.publicId,
            loan.contract.resourceType,
            loan.contract.format,
            loan.contract.fileUrl,
            expiresAt
          ),
          signed: loan.contract.signed,
          signedAt: loan.contract.signedAt?.toISOString() ?? null
        }
      : null
  }
})

function getSignedUrlFromMeta(
  publicId: string | null,
  resourceType: string | null,
  format: string | null,
  fallbackUrl: string,
  expiresAt: number
) {
  if (publicId && resourceType) {
    return cloudinary.utils.private_download_url(publicId, format || undefined, {
      resource_type: resourceType as 'image' | 'raw' | 'video',
      type: 'upload',
      expires_at: expiresAt
    })
  }

  const parsed = parseCloudinaryUrl(fallbackUrl)
  if (!parsed) return fallbackUrl

  const inferredFormat = parsed.ext || undefined
  return cloudinary.utils.private_download_url(parsed.publicId, inferredFormat, {
    resource_type: parsed.resourceType,
    type: 'upload',
    expires_at: expiresAt
  })
}

function parseCloudinaryUrl(url: string) {
  const resourceTypeMatch = url.match(/\/(image|raw|video)\/upload\//)
  const resourceTypeFromUrl = resourceTypeMatch?.[1] as 'image' | 'raw' | 'video' | undefined
  const parts = url.split('/upload/')
  if (parts.length < 2) return null

  let path = parts[1]
  path = path.replace(/^v\d+\//, '')

  const lastDot = path.lastIndexOf('.')
  let ext = ''
  if (lastDot > path.lastIndexOf('/')) {
    ext = path.slice(lastDot + 1)
    path = path.slice(0, lastDot)
  }

  const rawExts = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'])
  const resourceType = ext && rawExts.has(ext.toLowerCase())
    ? 'raw'
    : (resourceTypeFromUrl ?? 'image')

  return { publicId: path, resourceType, ext }
}
