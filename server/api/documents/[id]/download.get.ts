import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { createError, defineEventHandler, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const documentId = event.context.params?.id
  if (!documentId) {
    throw createError({ statusCode: 400, message: 'Missing document id' })
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { fileUrl: true, publicId: true, resourceType: true, format: true }
  })

  if (!doc) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  const signedUrl = getSignedUrlFromMeta(doc.publicId, doc.resourceType, doc.format, doc.fileUrl)
  const response = await fetch(signedUrl)

  if (!response.ok) {
    throw createError({ statusCode: response.status, message: 'Failed to download document' })
  }

  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  const extension = doc.format ? `.${doc.format}` : '.pdf'
  const filename = `document-${documentId}${extension}`

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

  return Buffer.from(arrayBuffer)
})

function getSignedUrlFromMeta(
  publicId: string | null,
  resourceType: string | null,
  format: string | null,
  fallbackUrl: string
) {
  if (publicId && resourceType) {
    return cloudinary.utils.private_download_url(publicId, format || undefined, {
      resource_type: resourceType as 'image' | 'raw' | 'video',
      type: 'upload',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60
    })
  }

  const parsed = parseCloudinaryUrl(fallbackUrl)
  if (!parsed) return fallbackUrl

  return cloudinary.utils.private_download_url(parsed.publicId, parsed.ext || undefined, {
    resource_type: parsed.resourceType,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60
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
