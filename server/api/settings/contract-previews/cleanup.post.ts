import { createError, defineEventHandler, readBody } from 'h3'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'

type PreviewPayload = {
  publicId: string
  resourceType: string
  reference?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody<{ previews?: PreviewPayload[] }>(event)
  const previews = body?.previews ?? []
  if (!Array.isArray(previews) || previews.length === 0) {
    throw createError({ statusCode: 400, message: 'No previews provided' })
  }

  const results = await Promise.all(
    previews.map(async (preview) => {
      if (!preview?.publicId || !preview?.resourceType) {
        return { ok: false, error: 'Missing publicId or resourceType' }
      }
      try {
        const result = await cloudinary.uploader.destroy(preview.publicId, {
          resource_type: preview.resourceType
        })
        return { ok: true, result }
      } catch (error: any) {
        return { ok: false, error: error?.message ?? 'Delete failed' }
      }
    })
  )

  const deleted = results.filter((item) => item.ok).length
  const failed = results.length - deleted

  return { deleted, failed }
})
