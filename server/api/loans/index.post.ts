import { prisma } from '~~/server/utils/prisma'
import { generateLoanReference } from '~~/server/utils/generateLoanReference'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { DocumentType } from '~~/app/generated/prisma/client'
import { createError, defineEventHandler, readMultipartFormData } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const reference = await generateLoanReference()

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, message: 'No form data' })
  }

  const payloadPart = form.find(f => f.name === 'data')
  if (!payloadPart?.data) {
    throw createError({ statusCode: 400, message: 'Missing payload' })
  }

  const { client, loan } = JSON.parse(payloadPart.data.toString())

  if (!client || !loan) {
    throw createError({ statusCode: 400, message: 'Missing client or loan data' })
  }

  const {
    fullName,
    empNumber,
    email,
    phone,
    idNumber
  } = client

  const {
    amount,
    interest,
    duration,
  } = loan

  if (!fullName || !empNumber || !email || !amount || !interest || !duration) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields'
    })
  }

  const empString = String(empNumber)

  const idCopy = form.find(f => f.name === 'idCopy')
  const bankStatement = form.find(f => f.name === 'bankStatement')
  const payslip = form.find(f => f.name === 'payslip')
  const contract = form.find(f => f.name === 'contract')

  const uploads: Array<{ type: DocumentType; file: any }> = []
  if (idCopy?.data) uploads.push({ type: DocumentType.ID, file: idCopy })
  if (bankStatement?.data) uploads.push({ type: DocumentType.BANK_STATEMENT, file: bankStatement })
  if (contract?.data) uploads.push({ type: DocumentType.CONTRACT, file: contract })
  if (payslip?.data) uploads.push({ type: DocumentType.OTHER, file: payslip })

  const uploaded = await Promise.all(
    uploads.map(({ type, file }) => uploadToCloudinary(file, type))
  )

  const loanResult = await prisma.$transaction(async (tx) => {
    const clientRecord = await tx.client.upsert({
      where: { email },
      update: {
        firstName: fullName,
        empNumber: empString,
        phone,
        idNumber
      },
      create: {
        firstName: fullName,
        empNumber: empString,
        email,
        phone,
        idNumber
      }
    })

    const createdLoan = await tx.loan.create({
      data: {
        reference,
        principal: amount,
        interestRate: interest,
        durationMonths: duration,
        clientId: clientRecord.id
      }
    })

    for (const doc of uploaded) {
      await tx.document.create({
        data: {
          type: doc.type,
          fileUrl: doc.url,
          publicId: doc.publicId,
          resourceType: doc.resourceType,
          format: doc.format,
          clientId: clientRecord.id,
          loanId: createdLoan.id
        }
      })
    }

    const contractDoc = uploaded.find(doc => doc.type === DocumentType.CONTRACT)
    if (contractDoc) {
      const contractRecord = await tx.contract.create({
        data: {
          loanId: createdLoan.id,
          fileUrl: contractDoc.url,
          publicId: contractDoc.publicId,
          resourceType: contractDoc.resourceType,
          format: contractDoc.format
        }
      })

      await tx.loan.update({
        where: { id: createdLoan.id },
        data: { contractId: contractRecord.id }
      })
    }

    return tx.loan.findUnique({
      where: { id: createdLoan.id },
      include: { client: true, Documents: true, contract: true }
    })
  })

  return loanResult
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
