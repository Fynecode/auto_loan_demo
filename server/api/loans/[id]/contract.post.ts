import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { DocumentType } from '~~/app/generated/prisma/client'
import { createError, defineEventHandler, readMultipartFormData } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const loanId = event.context.params?.id
  if (!loanId) {
    throw createError({ statusCode: 400, message: 'Missing loan id' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, message: 'No form data' })
  }

  const contractFile = form.find(f => f.name === 'contract')
  if (!contractFile?.data) {
    throw createError({ statusCode: 400, message: 'Missing contract file' })
  }

  const result = await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: { contract: true }
    })

    if (!loan) {
      throw createError({ statusCode: 404, message: 'Loan not found' })
    }

    const uploaded = await uploadToCloudinary(contractFile, DocumentType.CONTRACT)

    const document = await tx.document.create({
      data: {
        type: DocumentType.CONTRACT,
        fileUrl: uploaded.url,
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        format: uploaded.format,
        loanId: loan.id,
        clientId: loan.clientId
      }
    })

    let contractRecord
    if (loan.contractId) {
      contractRecord = await tx.contract.update({
        where: { id: loan.contractId },
        data: {
          fileUrl: uploaded.url,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
          format: uploaded.format,
          signed: false,
          signedAt: null
        }
      })
    } else {
      contractRecord = await tx.contract.create({
        data: {
          loanId: loan.id,
          fileUrl: uploaded.url,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
          format: uploaded.format
        }
      })

      await tx.loan.update({
        where: { id: loan.id },
        data: { contractId: contractRecord.id }
      })
    }

    return {
      contract: {
        id: contractRecord.id,
        fileUrl: contractRecord.fileUrl,
        signed: contractRecord.signed,
        signedAt: contractRecord.signedAt?.toISOString() ?? null
      },
      documentId: document.id
    }
  })

  return result
})

async function uploadToCloudinary(
  file: { data?: Uint8Array; filename?: string; type?: string },
  type: DocumentType
): Promise<{ type: DocumentType; url: string; publicId: string; resourceType: string; format?: string }> {
  if (!file?.data) {
    throw createError({ statusCode: 400, message: 'Missing file data' })
  }

  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'loan-documents',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    ).end(Buffer.from(file.data))
  })

  return {
    type,
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    resourceType: uploadResult.resource_type,
    format: uploadResult.format
  }
}
