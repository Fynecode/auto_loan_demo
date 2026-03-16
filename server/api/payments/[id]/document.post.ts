import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import pkg from '@prisma/client'
import { validateUpload, allowedPaymentProof } from '~~/server/utils/uploadValidation'

const { DocumentType } = pkg

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const paymentId = event.context.params?.id
  if (!paymentId) {
    throw createError({ statusCode: 400, message: 'Missing payment id' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, message: 'No form data' })
  }

  const filePart = form.find(item => item.name === 'proof')
  if (!filePart?.data) {
    throw createError({ statusCode: 400, message: 'Missing proof file' })
  }

  const payment = await prisma.payment.findFirst({
    where: user.role === 'ADMIN'
      ? { id: paymentId }
      : {
          id: paymentId,
          loan: {
            OR: [
              { createdById: user.id },
              { assignments: { some: { userId: user.id } } }
            ]
          }
        },
    include: {
      loan: { select: { clientId: true } }
    }
  })

  if (!payment) {
    throw createError({ statusCode: 404, message: 'Payment not found' })
  }

  validateUpload(filePart, allowedPaymentProof)

  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'payment-proofs',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    ).end(Buffer.from(filePart.data))
  })

  const doc = await prisma.document.create({
    data: {
      type: DocumentType.PAYMENT_PROOF,
      fileUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      resourceType: uploadResult.resource_type,
      format: uploadResult.format,
      loanId: payment.loanId,
      clientId: payment.loan.clientId,
      paymentId: payment.id
    }
  })

  return {
    id: doc.id,
    fileUrl: doc.fileUrl,
    uploadedAt: doc.uploadedAt.toISOString()
  }
})
