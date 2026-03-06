import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { validateUpload, allowedDocxOnly } from '~~/server/utils/uploadValidation'

export default defineEventHandler(async (event) => {
  const currentUser = requireAuth(event)
  if (currentUser.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, message: 'No form data' })
  }

  const templateFile = form.find(f => f.name === 'template')
  if (!templateFile?.data) {
    throw createError({ statusCode: 400, message: 'Missing template file' })
  }

  validateUpload(templateFile, allowedDocxOnly)

  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'contract-templates',
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    ).end(Buffer.from(templateFile.data))
  })

  const template = await prisma.$transaction(async (tx) => {
    await tx.contractTemplate.updateMany({
      data: { isActive: false }
    })

    return tx.contractTemplate.create({
      data: {
        fileUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        resourceType: uploadResult.resource_type,
        format: uploadResult.format,
        isActive: true
      }
    })
  })

  return template
})
