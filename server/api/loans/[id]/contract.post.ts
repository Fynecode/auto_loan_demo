import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { DocumentType } from '~~/prisma/generated/client/index.js'
import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { validateUpload, allowedPdfOnly } from '~~/server/utils/uploadValidation'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

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
  validateUpload(contractFile, allowedPdfOnly)

  const result = await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({
      where: user.role === 'ADMIN'
        ? { id: loanId }
        : {
            id: loanId,
            OR: [
              { createdById: user.id },
              { assignments: { some: { userId: user.id } } }
            ]
          },
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
          signed: true,
          signedAt: new Date()
        }
      })
    } else {
      contractRecord = await tx.contract.create({
        data: {
          loanId: loan.id,
          fileUrl: uploaded.url,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
          format: uploaded.format,
          signed: true,
          signedAt: new Date()
        }
      })

      await tx.loan.update({
        where: { id: loan.id },
        data: { contractId: contractRecord.id }
      })
    }

    if (loan.status !== 'ACTIVE') {
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + loan.durationMonths)

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: 'ACTIVE',
          startDate,
          endDate
        }
      })

      await tx.loanActivity.create({
        data: {
          loanId: loan.id,
          type: 'STATUS_UPDATED',
          details: `${loan.status} -> ACTIVE`,
          performedBy: user.id
        }
      })
    }

    await tx.loanActivity.create({
      data: {
        loanId: loan.id,
        type: 'CONTRACT_UPLOADED',
        performedBy: user.id
      }
    })

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
        folder: 'loan-contracts',
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

