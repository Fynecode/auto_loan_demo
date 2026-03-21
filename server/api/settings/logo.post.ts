import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { requireAuth } from '~~/server/utils/requireAuth'
import { validateUpload, allowedLogo } from '~~/server/utils/uploadValidation'
import cloudinary from '~~/server/utils/cloudinary'
import { setContractLogoUrl } from '~~/server/utils/settings'

function isImageUpload(type: string, filename: string) {
  const mime = type.toLowerCase()
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (mime.startsWith('image/')) return true
  return ['svg', 'png', 'jpg', 'jpeg', 'ico'].includes(ext)
}

export default defineEventHandler(async (event) => {
  const currentUser = requireAuth(event)
  if (currentUser.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, message: 'No form data' })
  }

  const logoFile = form.find((f) => f.name === 'logo')
  if (!logoFile?.data) {
    throw createError({ statusCode: 400, message: 'Missing logo file' })
  }

  validateUpload(logoFile, allowedLogo)

  const filename = logoFile.filename || 'logo'
  const resourceType = isImageUpload(logoFile.type || '', filename) ? 'image' : 'raw'

  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'contract-logo',
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    ).end(Buffer.from(logoFile.data))
  })

  await setContractLogoUrl(uploadResult.secure_url)

  return { logoUrl: uploadResult.secure_url }
})
